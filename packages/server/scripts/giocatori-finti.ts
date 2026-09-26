// Strumento di sviluppo: fa entrare N giocatori finti in una stanza e li fa giocare da soli
// (confermano la carta, agiscono di notte e votano a caso, con piccoli ritardi "umani").
// Uso: pnpm --filter @lupus/server exec tsx scripts/giocatori-finti.ts <CODICE> [quanti=6] [minuti=30] [url=http://localhost:3000]
import { io, type Socket } from 'socket.io-client';
import type { EventiClientServer, EventiServerClient, VistaGiocatore } from '@lupus/engine';

const [codice, quanti = '6', minuti = '30', url = 'http://localhost:3000'] = process.argv.slice(2);
if (!codice) {
  console.error('Indica il codice della stanza.');
  process.exit(1);
}

const NOMI = ['Carla', 'Dario', 'Elena', 'Franco', 'Giulia', 'Ivo', 'Lucia', 'Marco', 'Nora', 'Oscar', 'Paola', 'Rino'];
const scegli = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
const dopo = (ms: number, f: () => void) => setTimeout(f, ms + Math.random() * ms);

for (let i = 0; i < Number(quanti); i++) {
  const socket: Socket<EventiServerClient, EventiClientServer> = io(url, { transports: ['websocket'] });
  const nome = NOMI[i % NOMI.length]!;
  let token: string | undefined;
  let inCorso = new Set<string>(); // azioni già programmate, per non ripeterle

  socket.on('connect', async () => {
    const r = await socket.emitWithAck('entra', { codice, nickname: nome, token });
    if (r.ok) token = r.token;
    console.log(`${nome}: ${r.ok ? 'dentro' : r.errore}`);
  });

  socket.on('vista', (p) => {
    const v = p.vista as VistaGiocatore;
    if (v.tipo !== 'giocatore') return;
    const una = (chiave: string, ms: number, f: () => void) => {
      if (inCorso.has(chiave)) return;
      inCorso.add(chiave);
      dopo(ms, f);
    };
    if (v.fase === 'lobby') inCorso = new Set();
    if (v.fase === 'rivelazione' && !v.io.haVisto) una('visto', 800, () => void socket.emitWithAck('comando', { tipo: 'confermaVisto' }));

    const az = v.notte?.azione;
    if (az?.tipo === 'bersaglio' && az.miaScelta === undefined && az.bersagliValidi.length) {
      una(`notte-${v.notte!.numero}-${az.passo}`, 1500, () => {
        // i lupi finti seguono il primo compagno che ha votato, così spesso sono d'accordo
        const giaVotato = Object.values(az.votiBranco ?? {}).find((b) => b && az.bersagliValidi.includes(b));
        void socket.emitWithAck('comando', { tipo: 'azioneNotturna', bersaglio: giaVotato ?? scegli(az.bersagliValidi) });
      });
    }

    const vt = v.votazione;
    if (vt?.aperta && vt.possoVotare && vt.mioVoto === undefined && vt.bersagli.length) {
      una(`voto-${v.giorno}-${vt.tipo}-${vt.turno}`, 1200, () => void socket.emitWithAck('comando', { tipo: 'voto', bersaglio: scegli(vt.bersagli) }));
    }
  });
}

setTimeout(() => process.exit(0), Number(minuti) * 60_000);
