import { describe, expect, it } from 'vitest';
import { registroRuoli, suggerisciComposizione, totaleRuoli, validaComposizione } from '../src/index.js';

const reg = registroRuoli();

describe('composizione', () => {
  it('errore se il numero di ruoli non corrisponde ai giocatori', () => {
    const v = validaComposizione({ lupo: 2, villico: 5 }, 8, reg, false);
    expect(v.errori[0]).toMatch(/7 ma i giocatori sono 8/);
  });

  it('errore senza lupi, con un solo massone, con due veggenti', () => {
    expect(validaComposizione({ villico: 8 }, 8, reg, false).errori).toContain('Serve almeno un lupo mannaro.');
    expect(validaComposizione({ lupo: 2, massone: 1, villico: 5 }, 8, reg, false).errori.join()).toMatch(/Massone: ne servono almeno 2/);
    expect(validaComposizione({ lupo: 2, veggente: 2, villico: 4 }, 8, reg, false).errori.join()).toMatch(/Veggente: al massimo 1/);
  });

  it('il set esteso va attivato', () => {
    expect(validaComposizione({ lupo: 2, mucca: 1, villico: 5 }, 8, reg, false).errori.join()).toMatch(/set esteso/);
    expect(validaComposizione({ lupo: 2, mucca: 1, villico: 5 }, 8, reg, true).errori).toEqual([]);
  });

  it('avvisi: pochi giocatori, ruolo sotto il minimo consigliato, sbilanciamento', () => {
    const v = validaComposizione({ lupo: 1, villico: 5 }, 6, reg, false);
    expect(v.errori).toEqual([]);
    expect(v.avvisi.join()).toMatch(/meno di 8/);
    expect(validaComposizione({ lupo: 2, criceto: 1, villico: 5 }, 8, reg, false).avvisi.join()).toMatch(/Criceto mannaro è consigliato da 12/);
    expect(validaComposizione({ lupo: 4, villico: 4 }, 8, reg, false).avvisi.join()).toMatch(/Troppi lupi/);
  });

  it('le composizioni suggerite da 8 a 24 giocatori sono valide ed equilibrate', () => {
    for (let n = 8; n <= 24; n++) {
      const c = suggerisciComposizione(n);
      expect(totaleRuoli(c), `n=${n}`).toBe(n);
      const v = validaComposizione(c, n, reg, false);
      expect(v.errori, `n=${n}`).toEqual([]);
      expect(v.avvisi, `n=${n}`).toEqual([]);
    }
  });

  it('corrisponde alla tabella di RULES.md', () => {
    expect(suggerisciComposizione(8)).toEqual({ lupo: 2, veggente: 1, villico: 5 });
    expect(suggerisciComposizione(12)).toEqual({ lupo: 3, veggente: 1, medium: 1, indemoniato: 1, guardia: 1, gufo: 1, massone: 2, villico: 2 });
    expect(suggerisciComposizione(14)).toMatchObject({ lupo: 3, mitomane: 1, criceto: 1, villico: 2 });
  });
});
