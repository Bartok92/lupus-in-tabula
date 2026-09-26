import { describe, expect, it } from 'vitest';
import { controllaVittoria, MASTER } from '../src/index.js';
import { DIECI, Tavolo } from './tavolo.js';

function uccidi(t: Tavolo, ...nomi: string[]) {
  for (const n of nomi) {
    t.m({ tipo: 'uccidi', id: n });
    if (t.s.esitoProposto && n !== nomi[nomi.length - 1]) t.m({ tipo: 'ignoraVittoria' });
  }
}

describe('vittoria', () => {
  it('il villaggio vince quando tutti i lupi sono morti', () => {
    const t = new Tavolo(DIECI);
    uccidi(t, 'Lupo1', 'Lupo2');
    expect(t.s.esitoProposto).toMatchObject({ fazione: 'villaggio' });
    expect(t.s.esitoProposto!.vincitori).toContain('Villico1');
    expect(t.s.esitoProposto!.vincitori).not.toContain('Indemoniato');
  });

  it('lupi in parità: 2 lupi contro 2 altri → vincono i lupi (con l\'Indemoniato)', () => {
    const t = new Tavolo(DIECI);
    uccidi(t, 'Villico1', 'Villico2', 'Villico3', 'Villico4', 'Veggente', 'Guardia');
    // Vivi: Lupo1, Lupo2, Medium, Indemoniato → 2 ≥ 2
    expect(t.s.esitoProposto).toMatchObject({ fazione: 'lupi' });
    expect(t.s.esitoProposto!.vincitori.sort()).toEqual(['Indemoniato', 'Lupo1', 'Lupo2']);
  });

  it('l\'Indemoniato conta come "altro" nella parità', () => {
    const t = new Tavolo(DIECI);
    uccidi(t, 'Lupo2', 'Villico1', 'Villico2', 'Villico3', 'Villico4', 'Veggente', 'Guardia');
    // Vivi: Lupo1, Medium, Indemoniato → 1 < 2: si continua
    expect(controllaVittoria(t.s)).toBeNull();
  });

  it('ultima coppia lupo-contadino dopo una notte: vincono i lupi', () => {
    const t = new Tavolo({ Lupo: 'lupo', Contadino: 'villico', A: 'villico', B: 'villico', C: 'villico', D: 'villico', E: 'villico', F: 'veggente' });
    uccidi(t, 'A', 'B', 'C', 'D', 'E');
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    t.notte({ Lupo: 'F' });
    expect(t.s.esitoProposto).toMatchObject({ fazione: 'lupi', vincitori: ['Lupo'] });
  });

  it('ultima coppia lupo-contadino al rogo: la morte al rogo fa vincere i lupi', () => {
    const t = new Tavolo({ Lupo: 'lupo', Contadino: 'villico', A: 'villico', B: 'villico', C: 'villico', D: 'villico', E: 'villico', F: 'veggente' });
    uccidi(t, 'A', 'B', 'C', 'D', 'E');
    expect(controllaVittoria(t.s)).toBeNull(); // Lupo, Contadino, F: 1 < 2
    t.m({ tipo: 'iniziaNotte' });
    while (t.s.notte!.corrente < t.s.notte!.passi.length - 1) t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'terminaNotte' });
    t.m({ tipo: 'confermaAlba' });
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'apriNomination' });
    t.g('Contadino', { tipo: 'voto', bersaglio: 'F' });
    t.g('Lupo', { tipo: 'voto', bersaglio: 'F' });
    t.g('F', { tipo: 'voto', bersaglio: 'Lupo' });
    t.m({ tipo: 'chiudiVotazione' });
    t.m({ tipo: 'avviaBallottaggio' });
    t.m({ tipo: 'apriVotoBallottaggio' });
    t.g('Contadino', { tipo: 'voto', bersaglio: 'F' });
    t.m({ tipo: 'chiudiVotazione' });
    t.m({ tipo: 'eseguiRogo' });
    // Vivi: Lupo e Contadino → 1 ≥ 1
    expect(t.s.esitoProposto).toMatchObject({ fazione: 'lupi' });
    t.m({ tipo: 'confermaVittoria' });
    expect(t.s.fase).toBe('fine');
    expect(t.vista('Lupo').vittoria!.hoVinto).toBe(true);
    expect(t.vista('Contadino').vittoria!.hoVinto).toBe(false);
  });

  it('il Criceto vivo a fine partita vince da solo', () => {
    const t = new Tavolo({ ...DIECI, Villico4: 'criceto' });
    uccidi(t, 'Lupo1', 'Lupo2');
    expect(t.s.esitoProposto).toMatchObject({ fazione: 'criceto', vincitori: ['Villico4'] });
  });

  it('il Criceto morto non vince', () => {
    const t = new Tavolo({ ...DIECI, Villico4: 'criceto' });
    uccidi(t, 'Villico4', 'Lupo1', 'Lupo2');
    expect(t.s.esitoProposto).toMatchObject({ fazione: 'villaggio' });
  });

  it('il Mortovivo non conta nella parità', () => {
    const t = new Tavolo({ ...DIECI, Villico4: 'mortovivo' }, { setEsteso: true });
    uccidi(t, 'Villico1', 'Villico2', 'Villico3', 'Veggente', 'Guardia');
    // Vivi: 2 lupi, Medium, Indemoniato, Mortovivo → 2 ≥ 2 (il Mortovivo non conta)
    expect(t.s.esitoProposto).toMatchObject({ fazione: 'lupi' });
  });

  it('tutti morti: vince il villaggio', () => {
    const t = new Tavolo(DIECI);
    uccidi(t, ...Object.keys(DIECI));
    expect(t.s.esitoProposto).toMatchObject({ fazione: 'villaggio' });
  });

  it('con un esito proposto non si può avanzare finché il Master non decide', () => {
    const t = new Tavolo(DIECI);
    uccidi(t, 'Lupo1', 'Lupo2');
    expect(t.rifiuta(MASTER, { tipo: 'iniziaNotte' })).toMatch(/esito/);
    t.m({ tipo: 'ignoraVittoria' });
    t.m({ tipo: 'iniziaNotte' });
  });
});
