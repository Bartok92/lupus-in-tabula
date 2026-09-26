import { describe, expect, it } from 'vitest';
import {
  applica, casualeDaSeme, creaPartita, giocatore, MASTER, suggerisciComposizione, vistaPer,
  type Comando, type StatoPartita, type VistaGiocatore,
} from '../src/index.js';

function esegui(s: StatoPartita, c: Comando, attore = MASTER, seme = 1): StatoPartita {
  const r = applica(s, attore, c, casualeDaSeme(seme));
  if (!r.ok) throw new Error(`${c.tipo}: ${r.errore}`);
  return r.stato;
}

describe('partita completa', () => {
  it('l\'assegnazione dei ruoli rispetta la composizione ed è riproducibile con lo stesso seme', () => {
    let s = creaPartita();
    for (let i = 0; i < 12; i++) s = esegui(s, { tipo: 'aggiungiGiocatore', id: `g${i}`, nome: `Giocatore ${i}` });
    s = esegui(s, { tipo: 'impostaComposizione', composizione: suggerisciComposizione(12) });
    const a = esegui(s, { tipo: 'avviaPartita' }, MASTER, 7);
    const b = esegui(s, { tipo: 'avviaPartita' }, MASTER, 7);
    const c = esegui(s, { tipo: 'avviaPartita' }, MASTER, 8);
    expect(a.giocatori.map((g) => g.ruolo)).toEqual(b.giocatori.map((g) => g.ruolo));
    expect(a.giocatori.map((g) => g.ruolo)).not.toEqual(c.giocatori.map((g) => g.ruolo));
    const conta: Record<string, number> = {};
    for (const g of a.giocatori) conta[g.ruolo!] = (conta[g.ruolo!] ?? 0) + 1;
    expect(conta).toEqual(suggerisciComposizione(12));
    expect(a.fase).toBe('rivelazione');
  });

  it('non si avvia con una composizione non valida', () => {
    let s = creaPartita();
    for (let i = 0; i < 8; i++) s = esegui(s, { tipo: 'aggiungiGiocatore', id: `g${i}`, nome: `G${i}` });
    s = esegui(s, { tipo: 'impostaComposizione', composizione: { lupo: 2, villico: 5 } });
    const r = applica(s, MASTER, { tipo: 'avviaPartita' }, casualeDaSeme(1));
    expect(r.ok).toBe(false);
  });

  it('nickname duplicati e vuoti vengono rifiutati', () => {
    let s = creaPartita();
    s = esegui(s, { tipo: 'aggiungiGiocatore', id: 'a', nome: 'Anna' });
    expect(applica(s, MASTER, { tipo: 'aggiungiGiocatore', id: 'b', nome: ' anna ' }, Math.random).ok).toBe(false);
    expect(applica(s, MASTER, { tipo: 'aggiungiGiocatore', id: 'c', nome: '   ' }, Math.random).ok).toBe(false);
  });

  it('annulla ripristina lo stato precedente', () => {
    let s = creaPartita();
    s = esegui(s, { tipo: 'aggiungiGiocatore', id: 'a', nome: 'Anna' });
    s = esegui(s, { tipo: 'aggiungiGiocatore', id: 'b', nome: 'Bruno' });
    s = esegui(s, { tipo: 'annulla' });
    expect(s.giocatori.map((g) => g.id)).toEqual(['a']);
    s = esegui(s, { tipo: 'annulla' });
    expect(s.giocatori).toEqual([]);
    expect(applica(s, MASTER, { tipo: 'annulla' }, Math.random).ok).toBe(false);
  });

  it('lo stato originale non viene mai modificato (funzione pura)', () => {
    const s = creaPartita();
    const copia = JSON.stringify(s);
    esegui(s, { tipo: 'aggiungiGiocatore', id: 'a', nome: 'Anna' });
    expect(JSON.stringify(s)).toBe(copia);
  });

  it('simulazione: 200 partite casuali terminano sempre con un vincitore, senza errori né fughe di informazioni', () => {
    for (let seme = 1; seme <= 200; seme++) {
      const rnd = casualeDaSeme(seme);
      const scegli = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
      const n = 8 + Math.floor(rnd() * 9);
      let s = creaPartita();
      const passo = (c: Comando, attore = MASTER) => {
        const r = applica(s, attore, c, rnd);
        if (!r.ok) throw new Error(`seme ${seme}, ${c.tipo}: ${r.errore}`);
        s = r.stato;
      };
      for (let i = 0; i < n; i++) passo({ tipo: 'aggiungiGiocatore', id: `g${i}`, nome: `G${i}` });
      passo({ tipo: 'impostaComposizione', composizione: suggerisciComposizione(n) });
      passo({ tipo: 'avviaPartita' });
      for (const g of s.giocatori) passo({ tipo: 'confermaVisto' }, giocatore(g.id));

      let giri = 0;
      while (s.fase !== 'fine') {
        expect(++giri, `seme ${seme}: la partita non finisce`).toBeLessThan(50);
        // ——— notte ———
        passo({ tipo: 'iniziaNotte' });
        for (let i = 0; i < s.notte!.passi.length; i++) {
          passo({ tipo: 'chiamaProssimoPasso' });
          const p = s.notte!.passi[i]!;
          for (const a of p.attori) {
            const v = vistaPer(s, giocatore(a)) as VistaGiocatore;
            expect(v.notte!.azione?.passo).toBe(p.id);
            if (p.tipo === 'bersaglio' && v.notte!.azione!.bersagliValidi.length)
              passo({ tipo: 'azioneNotturna', bersaglio: scegli(v.notte!.azione!.bersagliValidi) }, giocatore(a));
          }
        }
        passo({ tipo: 'terminaNotte' });
        if (s.notte!.anteprima!.lupiInDisaccordo) {
          const lupo = s.notte!.passi.find((p) => p.id === 'lupo')!;
          const voti = Object.values(s.notte!.scelte.lupo ?? {}).filter(Boolean) as string[];
          passo({ tipo: 'forzaBersaglio', passo: lupo.id, bersaglio: scegli(voti) });
        }
        passo({ tipo: 'confermaAlba' });
        if (s.esitoProposto) { passo({ tipo: 'confermaVittoria' }); break; }
        // ——— giorno ———
        passo({ tipo: 'iniziaDiscussione' });
        passo({ tipo: 'apriNomination' });
        for (const g of s.giocatori.filter((g) => g.vivo)) {
          const v = vistaPer(s, giocatore(g.id)) as VistaGiocatore;
          if (v.votazione!.possoVotare) passo({ tipo: 'voto', bersaglio: scegli(v.votazione!.bersagli) }, giocatore(g.id));
        }
        passo({ tipo: 'chiudiVotazione' });
        let e = s.votazione!.esito!;
        if (e.tipo === 'pareggio' && e.rivoto) {
          passo({ tipo: 'ripetiVoto' });
          passo({ tipo: 'chiudiVotazione' });
          e = s.votazione!.esito!;
        }
        if (e.tipo === 'nessuno') continue; // si passa direttamente alla notte
        if (e.tipo !== 'candidati') {
          const vivi = s.giocatori.filter((g) => g.vivo).map((g) => g.id);
          const base = e.tipo === 'pareggio' || e.tipo === 'serveSecondo' ? e.sicuri : [];
          const altro = vivi.find((id) => !base.includes(id))!;
          passo({ tipo: 'scegliCandidati', candidati: [...base, altro] });
        }
        passo({ tipo: 'avviaBallottaggio' });
        passo({ tipo: 'apriVotoBallottaggio' });
        for (const g of s.giocatori.filter((g) => g.vivo)) {
          const v = vistaPer(s, giocatore(g.id)) as VistaGiocatore;
          if (v.votazione!.possoVotare) passo({ tipo: 'voto', bersaglio: scegli(v.votazione!.bersagli) }, giocatore(g.id));
        }
        passo({ tipo: 'chiudiVotazione' });
        while (s.votazione!.esito!.tipo === 'pareggio') {
          const pe = s.votazione!.esito!;
          if (pe.tipo === 'pareggio' && pe.rivoto) { passo({ tipo: 'ripetiVoto' }); passo({ tipo: 'chiudiVotazione' }); }
          else if (pe.tipo === 'pareggio') passo({ tipo: 'scegliCondannato', id: scegli(pe.pari) });
        }
        passo({ tipo: 'eseguiRogo' });
        if (s.esitoProposto) passo({ tipo: 'confermaVittoria' });
      }
      expect(s.vittoria, `seme ${seme}`).not.toBeNull();
      expect(s.vittoria!.vincitori.length, `seme ${seme}`).toBeGreaterThan(0);
    }
  });
});
