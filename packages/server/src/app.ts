import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { desc, eq } from 'drizzle-orm';
import { isObj, isStr, Limitatore, type StanzaCreata } from '@lupus/engine';
import { apriDb, preset, profili, storico } from './db.js';
import { collegaSocket, type ServerLupus } from './socket.js';
import { GestoreStanze } from './stanze.js';

export interface OpzioniServer {
  /** Percorso del file SQLite (':memory:' per i test). */
  percorsoDb: string;
  scadenzaMs?: number;
  /** Cartella con il client compilato da servire (null = nessuna). */
  distClient?: string | null;
  log?: boolean;
  ora?: () => number;
  eventiAlSecondo?: number;
  ritardoSalvataggio?: number;
}

export interface ServerAvviato {
  app: FastifyInstance;
  io: ServerLupus;
  gestore: GestoreStanze;
  /** Elimina subito le stanze scadute (di norma avviene ogni minuto). */
  pulisciStanze: () => void;
  chiudi: () => Promise<void>;
}

export async function creaServer(opz: OpzioniServer): Promise<ServerAvviato> {
  const ora = opz.ora ?? Date.now;
  const { db, chiudi: chiudiDb } = apriDb(opz.percorsoDb);
  const gestore = new GestoreStanze({
    db, ora, scadenzaMs: opz.scadenzaMs ?? 6 * 3600_000, ritardoSalvataggio: opz.ritardoSalvataggio,
  });
  const app = Fastify({ logger: opz.log ?? false, trustProxy: true, bodyLimit: 64 * 1024 });
  const io: ServerLupus = new Server(app.server, { cors: { origin: true }, maxHttpBufferSize: 32 * 1024 });
  const sock = collegaSocket(io, gestore, { ora, eventiAlSecondo: opz.eventiAlSecondo });

  const limiteCreazione = new Limitatore(10, 0.1, ora); // 10 stanze subito, poi una ogni 10 s per IP
  const limiteLetture = new Limitatore(30, 1, ora);
  const tokenMaster = (h: unknown) => (isStr(h) && gestore.eMasterDiQualcheStanza(h) ? h : null);

  // ——— API ———

  app.get('/api/salute', async () => ({ ok: true, nome: 'Lupus in Tabula', stanze: gestore.stanze.size }));

  app.post('/api/stanze', async (req, rep): Promise<StanzaCreata | { errore: string }> => {
    if (!limiteCreazione.consuma(req.ip)) return rep.code(429).send({ errore: 'Troppe stanze create: riprova tra poco.' });
    const s = gestore.crea();
    return { codice: s.codice, tokenMaster: s.core.tokenMaster };
  });

  app.get<{ Params: { codice: string } }>('/api/stanze/:codice', async (req, rep) => {
    if (!limiteLetture.consuma(req.ip)) return rep.code(429).send({ errore: 'Troppe richieste.' });
    const s = gestore.trova(req.params.codice);
    if (!s) return rep.code(404).send({ errore: 'Stanza non trovata.' });
    return { codice: s.codice, fase: s.stato.fase, giocatori: s.stato.giocatori.length, accettaNuovi: s.stato.fase === 'lobby' };
  });

  /** Indirizzi IP locali, per il QR in rete locale (LAN / hotspot). */
  app.get('/api/rete', async () => {
    const indirizzi = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i!.address);
    return { indirizzi };
  });

  app.get('/api/preset', async () => db.select().from(preset).orderBy(preset.nome).all());

  app.post('/api/preset', async (req, rep) => {
    if (!tokenMaster(req.headers['x-token-master'])) return rep.code(403).send({ errore: 'Solo un Master può salvare preset.' });
    const b = req.body;
    const composizioneOk = (c: unknown) =>
      isObj(c) && Object.entries(c).every(([k, n]) => k.length <= 40 && Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 50);
    if (!isObj(b) || !isStr(b.nome) || !b.nome.trim() || b.nome.length > 40 || !composizioneOk(b.composizione))
      return rep.code(400).send({ errore: 'Preset non valido.' });
    const valori = {
      nome: b.nome.trim(),
      composizione: b.composizione as Record<string, number>,
      impostazioni: isObj(b.impostazioni) ? b.impostazioni : null,
      creato: ora(),
    };
    return db.insert(preset).values(valori)
      .onConflictDoUpdate({ target: preset.nome, set: { composizione: valori.composizione, impostazioni: valori.impostazioni } })
      .returning().get();
  });

  app.delete<{ Params: { id: string } }>('/api/preset/:id', async (req, rep) => {
    if (!tokenMaster(req.headers['x-token-master'])) return rep.code(403).send({ errore: 'Solo un Master può eliminare preset.' });
    db.delete(preset).where(eq(preset.id, Number(req.params.id))).run();
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/api/profilo/:id', async (req, rep) => {
    const p = db.select().from(profili).where(eq(profili.idDispositivo, req.params.id)).get();
    if (!p) return rep.code(404).send({ errore: 'Profilo non trovato.' });
    return { nickname: p.nickname, partite: p.partite, vittorie: p.vittorie };
  });

  app.get('/api/storico', async () =>
    db.select({ id: storico.id, codice: storico.codice, iniziata: storico.iniziata, finita: storico.finita, vittoria: storico.vittoria, giocatori: storico.giocatori })
      .from(storico).orderBy(desc(storico.finita)).limit(30).all(),
  );

  // ——— Client compilato (stesso server, stessa porta) ———
  if (opz.distClient && existsSync(opz.distClient)) {
    await app.register(fastifyStatic, { root: opz.distClient, wildcard: false });
    app.setNotFoundHandler((req, rep) => {
      if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/socket.io')) return rep.sendFile('index.html');
      return rep.code(404).send({ errore: 'Non trovato.' });
    });
  }

  const intervalloPulizia = setInterval(() => sock.pulisciStanze(), 60_000);
  intervalloPulizia.unref();

  return {
    app, io, gestore,
    pulisciStanze: sock.pulisciStanze,
    chiudi: async () => {
      clearInterval(intervalloPulizia);
      sock.ferma();
      gestore.salvaTutto();
      io.close();
      await app.close();
      chiudiDb();
    },
  };
}
