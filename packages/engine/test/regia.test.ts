import { describe, expect, it } from 'vitest';
import {
  applica, casualeDaSeme, creaPartita, giocatore, MASTER, regia, suggerisciComposizione, vistaPer,
  type Comando, type StatoPartita, type VistaGiocatore,
} from '../src/index.js';
import { DIECI, Tavolo } from './tavolo.js';

describe('regia', () => {
  it('propone i passi giusti in una notte', () => {
    const t = new Tavolo(DIECI);
    expect(regia(t.s).principale?.comando).toEqual({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'iniziaNotte' });
    const r = regia(t.s);
    expect(r.principale?.etichetta).toBe('Chiama: Lupo mannaro');
    expect(r.principale?.dettaglio).toBe('Lupo mannaro (si riconoscono) · Lupo1 e Lupo2');
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    expect(regia(t.s).principale?.comando).toEqual({ tipo: 'terminaNotte' });
    t.m({ tipo: 'terminaNotte' });
    expect(regia(t.s).principale).toMatchObject({ comando: { tipo: 'confermaAlba' }, dettaglio: 'Nessun morto stanotte' });
  });

  it('chiede una decisione se i lupi non sono d\'accordo', () => {
    const t = new Tavolo(DIECI);
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    t.iniziaNotteERiconosci({ Lupo1: 'Villico1', Lupo2: 'Villico2' });
    t.m({ tipo: 'terminaNotte' });
    expect(regia(t.s)).toMatchObject({ principale: null, decisione: 'bersaglioLupi' });
  });

  it('con un esito proposto il pulsante principale conferma la vittoria', () => {
    const t = new Tavolo(DIECI);
    t.m({ tipo: 'uccidi', id: 'Lupo1' });
    t.m({ tipo: 'uccidi', id: 'Lupo2' });
    expect(regia(t.s)).toMatchObject({ principale: { comando: { tipo: 'confermaVittoria' }, etichetta: 'Vince il Villaggio!' }, decisione: 'vittoria' });
  });

  it('nuova partita: stessi giocatori, di nuovo in lobby', () => {
    const t = new Tavolo(DIECI);
    t.m({ tipo: 'uccidi', id: 'Lupo1' });
    t.m({ tipo: 'uccidi', id: 'Lupo2' });
    t.m({ tipo: 'confermaVittoria' });
    t.m({ tipo: 'nuovaPartita' });
    expect(t.s.fase).toBe('lobby');
    expect(t.s.giocatori.map((g) => g.id)).toEqual(Object.keys(DIECI));
    expect(t.s.giocatori.every((g) => g.vivo && g.ruolo === null)).toBe(true);
    expect(t.s.vittoria).toBeNull();
    expect(t.s.log).toHaveLength(1);
    t.m({ tipo: 'avviaPartita' });
    expect(t.s.fase).toBe('rivelazione');
  });

  it('100 partite guidate solo dal pulsante principale arrivano sempre alla fine', () => {
    for (let seme = 1; seme <= 100; seme++) {
      const rnd = casualeDaSeme(seme * 31);
      const scegli = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
      let s: StatoPartita = creaPartita();
      const esegui = (c: Comando, a = MASTER) => {
        const r = applica(s, a, c, rnd);
        if (!r.ok) throw new Error(`seme ${seme} ${c.tipo}: ${r.errore}`);
        s = r.stato;
      };
      const n = 8 + (seme % 10);
      for (let i = 0; i < n; i++) esegui({ tipo: 'aggiungiGiocatore', id: `g${i}`, nome: `G${i}` });
      esegui({ tipo: 'impostaComposizione', composizione: suggerisciComposizione(n) });

      for (let passi = 0; s.fase !== 'fine'; passi++) {
        expect(passi, `seme ${seme}: troppi passi`).toBeLessThan(2000);
        // i giocatori chiamati agiscono, gli altri votano
        for (const g of s.giocatori.filter((g) => g.vivo)) {
          const v = vistaPer(s, giocatore(g.id)) as VistaGiocatore;
          const az = v.notte?.azione;
          if (az?.tipo === 'bersaglio' && az.miaScelta === undefined && az.bersagliValidi.length)
            esegui({ tipo: 'azioneNotturna', bersaglio: scegli(az.bersagliValidi) }, giocatore(g.id));
          if (v.votazione?.aperta && v.votazione.possoVotare && v.votazione.mioVoto === undefined && v.votazione.bersagli.length)
            esegui({ tipo: 'voto', bersaglio: scegli(v.votazione.bersagli) }, giocatore(g.id));
        }
        const r = regia(s);
        if (r.principale) {
          esegui(r.principale.comando);
          continue;
        }
        // decisioni del Master
        const vivi = s.giocatori.filter((g) => g.vivo).map((g) => g.id);
        if (r.decisione === 'bersaglioLupi') {
          const voti = Object.values(s.notte!.scelte.lupo ?? {}).filter(Boolean) as string[];
          esegui({ tipo: 'forzaBersaglio', passo: 'lupo', bersaglio: scegli(voti) });
        } else if (r.decisione === 'candidati') {
          esegui({ tipo: 'scegliCandidati', candidati: [scegli(vivi), scegli(vivi)] });
        } else if (r.decisione === 'condannato') {
          const e = s.votazione!.esito!;
          esegui({ tipo: 'scegliCondannato', id: e.tipo === 'pareggio' ? scegli(e.pari) : null });
        } else {
          throw new Error(`seme ${seme}: bloccato in ${s.fase} (${r.avviso ?? 'nessun avviso'})`);
        }
      }
      expect(s.vittoria).not.toBeNull();
    }
  });
});
