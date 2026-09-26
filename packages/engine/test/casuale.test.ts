import { describe, expect, it } from 'vitest';
import { casualeDaSeme, casualeSicuro, mescola } from '../src/index.js';

describe('mescola', () => {
  it('è deterministico con lo stesso seme', () => {
    const lista = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(mescola(lista, casualeDaSeme(42))).toEqual(mescola(lista, casualeDaSeme(42)));
  });

  it('mantiene gli stessi elementi e non modifica l\'originale', () => {
    const lista = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const copia = [...lista];
    const out = mescola(lista, casualeSicuro());
    expect(lista).toEqual(copia);
    expect([...out].sort((a, b) => a - b)).toEqual(copia);
  });

  it('distribuisce in modo uniforme (controllo statistico grezzo)', () => {
    const casuale = casualeDaSeme(7);
    const conteggi = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) conteggi[mescola([0, 1, 2, 3], casuale)[0]!]!++;
    for (const c of conteggi) expect(c).toBeGreaterThan(9_500), expect(c).toBeLessThan(10_500);
  });
});
