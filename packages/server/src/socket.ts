import type { Server, Socket } from 'socket.io';
import {
  giocatore, isObj, isStr, Limitatore, MASTER, validaComando, validaTimer,
  type Attore, type EventiClientServer, type EventiServerClient, type IdGiocatore,
} from '@lupus/engine';
import type { GestoreStanze, StanzaServer as Stanza } from './stanze.js';

export interface DatiSocket {
  codice?: string;
  master?: boolean;
  idGiocatore?: IdGiocatore;
}

export type ServerLupus = Server<EventiClientServer, EventiServerClient, Record<string, never>, DatiSocket>;
type SocketLupus = Socket<EventiClientServer, EventiServerClient, Record<string, never>, DatiSocket>;

export interface OpzioniSocket {
  ora?: () => number;
  /** Eventi al secondo per socket (con raffica doppia). */
  eventiAlSecondo?: number;
}

export function collegaSocket(io: ServerLupus, gestore: GestoreStanze, opz: OpzioniSocket = {}) {
  const ora = opz.ora ?? Date.now;
  const eps = opz.eventiAlSecondo ?? 8;
  const limiteEventi = new Limitatore(eps * 2, eps, ora);
  // Tentativi di accesso falliti per indirizzo IP: frena chi prova a indovinare i codici.
  const limiteTentativi = new Limitatore(10, 0.2, ora);
  const pulizia = setInterval(() => { limiteEventi.pulisci(); limiteTentativi.pulisci(); }, 60_000);
  pulizia.unref();

  function inviaA(stanza: Stanza, socketId: string, attore: Attore) {
    io.to(socketId).emit('vista', stanza.pacchetto(attore));
  }

  /** Invia a ogni client connesso della stanza la sua vista filtrata. */
  function diffondi(stanza: Stanza) {
    if (stanza.socketMaster.size) {
      const p = stanza.pacchetto(MASTER);
      for (const id of stanza.socketMaster) io.to(id).emit('vista', p);
    }
    for (const [idGiocatore, sockets] of stanza.socketGiocatori) {
      if (!sockets.size || !stanza.stato.giocatori.some((g) => g.id === idGiocatore)) continue;
      const p = stanza.pacchetto(giocatore(idGiocatore));
      for (const id of sockets) io.to(id).emit('vista', p);
    }
  }

  /** Scollega il socket dall'identità precedente (se cambia stanza o ruolo). */
  function lascia(socket: SocketLupus): Stanza | undefined {
    const { codice, master, idGiocatore } = socket.data;
    socket.data = {};
    const stanza = codice ? gestore.trova(codice) : undefined;
    if (!stanza) return undefined;
    if (master) stanza.socketMaster.delete(socket.id);
    if (idGiocatore) stanza.socketGiocatori.get(idGiocatore)?.delete(socket.id);
    return stanza;
  }

  io.on('connection', (socket: SocketLupus) => {
    const ip = socket.handshake.address;

    /** Applica il limite di frequenza; se superato risponde con un errore. */
    const limitato = (ack: unknown): boolean => {
      if (limiteEventi.consuma(socket.id)) return false;
      if (typeof ack === 'function') ack({ ok: false, errore: 'Troppe richieste: rallenta un attimo.' });
      return true;
    };
    const tentativoFallito = () => limiteTentativi.consuma(ip);

    socket.on('master:entra', (dati, ack) => {
      if (typeof ack !== 'function' || limitato(ack)) return;
      if (!limiteTentativi.disponibile(ip)) return ack({ ok: false, errore: 'Troppi tentativi falliti: riprova tra poco.' });
      if (!isObj(dati) || !isStr(dati.codice) || !isStr(dati.tokenMaster)) return ack({ ok: false, errore: 'Dati non validi.' });
      const stanza = gestore.trova(dati.codice);
      if (!stanza || !gestore.verificaMaster(stanza, dati.tokenMaster)) {
        tentativoFallito();
        return ack({ ok: false, errore: 'Stanza non trovata o accesso da Master non valido.' });
      }
      const prima = lascia(socket);
      socket.data = { codice: stanza.codice, master: true };
      stanza.socketMaster.add(socket.id);
      gestore.tocca(stanza);
      ack({ ok: true });
      inviaA(stanza, socket.id, MASTER);
      if (prima && prima !== stanza) diffondi(prima);
    });

    socket.on('entra', (dati, ack) => {
      if (typeof ack !== 'function' || limitato(ack)) return;
      if (!limiteTentativi.disponibile(ip)) return ack({ ok: false, errore: 'Troppi tentativi falliti: riprova tra poco.' });
      if (!isObj(dati) || !isStr(dati.codice)) return ack({ ok: false, errore: 'Dati non validi.' });
      const r = gestore.entraGiocatore(dati.codice, {
        nickname: isStr(dati.nickname) ? dati.nickname : undefined,
        token: isStr(dati.token) ? dati.token : undefined,
        idDispositivo: isStr(dati.idDispositivo) ? dati.idDispositivo : undefined,
      });
      if (!r.ok) {
        if (r.errore.startsWith('Stanza non trovata')) tentativoFallito();
        return ack(r);
      }
      const prima = lascia(socket);
      const { stanza, sessione } = r;
      socket.data = { codice: stanza.codice, idGiocatore: sessione.idGiocatore };
      let sockets = stanza.socketGiocatori.get(sessione.idGiocatore);
      if (!sockets) stanza.socketGiocatori.set(sessione.idGiocatore, (sockets = new Set()));
      sockets.add(socket.id);
      ack({ ok: true, idGiocatore: sessione.idGiocatore, token: sessione.token });
      diffondi(stanza);
      if (prima && prima !== stanza) diffondi(prima);
    });

    socket.on('comando', (dati, ack) => {
      if (typeof ack !== 'function' || limitato(ack)) return;
      const { codice, master, idGiocatore } = socket.data;
      const stanza = codice ? gestore.trova(codice) : undefined;
      if (!stanza || (!master && !idGiocatore)) return ack({ ok: false, errore: 'Non sei collegato a nessuna stanza.' });
      const comando = validaComando(dati);
      if (!comando) return ack({ ok: false, errore: 'Comando non valido.' });

      let r;
      try {
        r = gestore.comando(stanza, master ? MASTER : giocatore(idGiocatore!), comando);
      } catch (e) {
        console.error('Errore interno sul comando', comando.tipo, e);
        return ack({ ok: false, errore: 'Errore interno: comando ignorato.' });
      }
      if (!r.ok) return ack(r);
      ack({ ok: true });

      for (const id of r.espulsi) {
        for (const sid of stanza.socketGiocatori.get(id) ?? []) {
          io.to(sid).emit('espulso');
          const s = io.sockets.sockets.get(sid);
          if (s) s.data = {};
        }
        stanza.socketGiocatori.delete(id);
      }
      for (const e of r.eventi) {
        if (e.tipo !== 'chiamata' || e.finto) continue;
        for (const id of e.giocatori) for (const sid of stanza.socketGiocatori.get(id) ?? []) io.to(sid).emit('chiamata');
      }
      diffondi(stanza);
    });

    socket.on('master:timer', (dati, ack) => {
      if (typeof ack !== 'function' || limitato(ack)) return;
      const stanza = socket.data.codice ? gestore.trova(socket.data.codice) : undefined;
      if (!stanza || !socket.data.master) return ack({ ok: false, errore: 'Solo il Master può usare il timer.' });
      const c = validaTimer(dati);
      if (!c) return ack({ ok: false, errore: 'Comando del timer non valido.' });
      gestore.timer(stanza, c);
      ack({ ok: true });
      diffondi(stanza);
    });

    socket.on('disconnect', () => {
      const eraGiocatore = !!socket.data.idGiocatore;
      const stanza = lascia(socket);
      if (stanza && eraGiocatore) diffondi(stanza);
    });
  });

  /** Elimina le stanze scadute e avvisa chi era ancora collegato. */
  function pulisciStanze() {
    for (const stanza of gestore.pulisci()) {
      for (const sid of [...stanza.socketMaster, ...[...stanza.socketGiocatori.values()].flatMap((s) => [...s])]) {
        io.to(sid).emit('espulso');
        const s = io.sockets.sockets.get(sid);
        if (s) s.data = {};
      }
    }
  }

  return { diffondi, pulisciStanze, ferma: () => clearInterval(pulizia) };
}
