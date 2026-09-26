// Script di controllo (non è un test): gioca N partite casuali e stampa chi vince.
// Uso: pnpm --filter @lupus/server exec tsx ../engine/test/statistiche.ts
import {
  applica, casualeDaSeme, creaPartita, giocatore, MASTER, suggerisciComposizione, vistaPer,
  type Comando, type StatoPartita, type VistaGiocatore,
} from '../src/index.js';

// Il motore non dipende dai tipi di Node/DOM: dichiariamo solo ciò che serve.
declare const console: { log(...a: unknown[]): void };

const vittorie: Record<string, number> = {};
let giorni = 0;
const N = 1000;
for (let seme = 1; seme <= N; seme++) {
  const rnd = casualeDaSeme(seme);
  const scegli = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  let s: StatoPartita = creaPartita();
  const p = (c: Comando, a = MASTER) => {
    const r = applica(s, a, c, rnd);
    if (!r.ok) throw new Error(`${seme} ${c.tipo}: ${r.errore}`);
    s = r.stato;
  };
  const n = 8 + (seme % 9);
  for (let i = 0; i < n; i++) p({ tipo: 'aggiungiGiocatore', id: `g${i}`, nome: `G${i}` });
  p({ tipo: 'impostaComposizione', composizione: suggerisciComposizione(n) });
  p({ tipo: 'avviaPartita' });
  while (s.fase !== 'fine') {
    p({ tipo: 'iniziaNotte' });
    for (let i = 0; i < s.notte!.passi.length; i++) {
      p({ tipo: 'chiamaProssimoPasso' });
      for (const a of s.notte!.passi[i]!.attori) {
        const az = (vistaPer(s, giocatore(a)) as VistaGiocatore).notte!.azione!;
        if (az.tipo === 'bersaglio' && az.bersagliValidi.length) p({ tipo: 'azioneNotturna', bersaglio: scegli(az.bersagliValidi) }, giocatore(a));
      }
    }
    p({ tipo: 'terminaNotte' });
    if (s.notte!.anteprima!.lupiInDisaccordo)
      p({ tipo: 'forzaBersaglio', passo: 'lupo', bersaglio: scegli(Object.values(s.notte!.scelte.lupo!).filter(Boolean) as string[]) });
    p({ tipo: 'confermaAlba' });
    if (s.esitoProposto) { p({ tipo: 'confermaVittoria' }); break; }
    p({ tipo: 'apriNomination' });
    for (const g of s.giocatori.filter((g) => g.vivo)) {
      const v = (vistaPer(s, giocatore(g.id)) as VistaGiocatore).votazione!;
      if (v.possoVotare) p({ tipo: 'voto', bersaglio: scegli(v.bersagli) }, giocatore(g.id));
    }
    p({ tipo: 'chiudiVotazione' });
    const e = s.votazione!.esito!;
    if (e.tipo !== 'candidati') {
      const vivi = s.giocatori.filter((g) => g.vivo).map((g) => g.id);
      const base = 'sicuri' in e ? e.sicuri : [];
      p({ tipo: 'scegliCandidati', candidati: [...base, vivi.find((id) => !base.includes(id))!] });
    }
    p({ tipo: 'avviaBallottaggio' });
    p({ tipo: 'apriVotoBallottaggio' });
    for (const g of s.giocatori.filter((g) => g.vivo)) {
      const v = (vistaPer(s, giocatore(g.id)) as VistaGiocatore).votazione!;
      if (v.possoVotare) p({ tipo: 'voto', bersaglio: scegli(v.bersagli) }, giocatore(g.id));
    }
    p({ tipo: 'chiudiVotazione' });
    const eb = s.votazione!.esito!;
    if (eb.tipo === 'pareggio') p({ tipo: 'scegliCondannato', id: scegli(eb.pari) });
    p({ tipo: 'eseguiRogo' });
    if (s.esitoProposto) p({ tipo: 'confermaVittoria' });
  }
  vittorie[s.vittoria!.fazione] = (vittorie[s.vittoria!.fazione] ?? 0) + 1;
  giorni += s.giorno;
}
console.log(`${N} partite con giocatori che scelgono a caso:`, vittorie, `durata media: ${(giorni / N).toFixed(1)} notti`);
