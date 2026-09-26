import { defDi, vivi, type StatoPartita, type Vittoria } from './stato.js';

/** Controlla le condizioni di vittoria (RULES.md §2). null = la partita continua. */
export function controllaVittoria(s: StatoPartita): Vittoria | null {
  let lupi = 0;
  let altri = 0;
  for (const g of vivi(s)) {
    const def = defDi(s, g);
    if (def?.contaComeLupo) lupi++;
    else if (def?.contaPerParita !== false) altri++;
  }

  let vittoria: Vittoria | null = null;
  if (lupi === 0) vittoria = { fazione: 'villaggio', vincitori: [], motivo: 'Tutti i lupi mannari sono morti.' };
  else if (lupi >= altri) vittoria = { fazione: 'lupi', vincitori: [], motivo: 'I lupi sono tanti quanti gli altri abitanti.' };
  if (!vittoria) return null;

  const criceti = vivi(s).filter((g) => defDi(s, g)?.fazione === 'criceto');
  if (criceti.length) {
    return {
      fazione: 'criceto',
      vincitori: criceti.map((g) => g.id),
      motivo: `${vittoria.motivo} Ma il Criceto mannaro è sopravvissuto e vince da solo!`,
    };
  }
  vittoria.vincitori = s.giocatori.filter((g) => defDi(s, g)?.fazione === vittoria.fazione).map((g) => g.id);
  return vittoria;
}
