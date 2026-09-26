import { describe, expect, it } from 'vitest';
import { temaDellaFase } from '../src/hooks';
import { elenco, plurale, testoCronaca, testoEsito } from '../src/utilita';

const NOMI = [{ id: 'a', nome: 'Anna' }, { id: 'b', nome: 'Bruno' }, { id: 'c', nome: 'Carla' }];

describe('testi', () => {
  it('elenca i nomi in italiano', () => {
    expect(elenco([])).toBe('nessuno');
    expect(elenco(['Anna'])).toBe('Anna');
    expect(elenco(['Anna', 'Bruno', 'Carla'])).toBe('Anna, Bruno e Carla');
  });

  it('usa singolare e plurale', () => {
    expect(plurale(1, 'partita', 'partite')).toBe('1 partita');
    expect(plurale(3, 'partita', 'partite')).toBe('3 partite');
  });

  it('descrive ogni esito di votazione', () => {
    expect(testoEsito({ tipo: 'candidati', candidati: ['a', 'b'] }, NOMI)).toBe('Al ballottaggio: Anna e Bruno.');
    expect(testoEsito({ tipo: 'condannato', id: 'c' }, NOMI)).toBe('Il villaggio condanna Carla.');
    expect(testoEsito({ tipo: 'condannato', id: null }, NOMI)).toBe('Oggi nessuno va al rogo.');
    expect(testoEsito({ tipo: 'pareggio', sicuri: [], pari: ['a', 'b'], posti: 1, rivoto: true }, NOMI)).toBe('Pareggio fra Anna e Bruno: si rivota.');
    expect(testoEsito({ tipo: 'serveSecondo', sicuri: ['a'] }, NOMI)).toMatch(/Solo Anna/);
    expect(testoEsito({ tipo: 'nessuno' }, NOMI)).toBe('Nessuno ha ricevuto voti.');
  });

  it('esporta la cronaca con fase e giorno', () => {
    expect(testoCronaca([
      { n: 1, giorno: 0, fase: 'rivelazione', testo: 'Inizio.', pubblico: true },
      { n: 2, giorno: 2, fase: 'notte', testo: 'Scende la notte 2.', pubblico: true },
    ])).toBe('[Carte] Inizio.\n[Notte 2] Scende la notte 2.');
  });
});

describe('tema del cielo', () => {
  it('notte fino all\'alba, poi giorno; la vittoria dei lupi resta di notte', () => {
    expect(temaDellaFase('lobby')).toBe('notte');
    expect(temaDellaFase('notte')).toBe('notte');
    expect(temaDellaFase('alba')).toBe('giorno');
    expect(temaDellaFase('nomination')).toBe('giorno');
    expect(temaDellaFase('fine', 'lupi')).toBe('notte');
    expect(temaDellaFase('fine', 'villaggio')).toBe('giorno');
  });
});
