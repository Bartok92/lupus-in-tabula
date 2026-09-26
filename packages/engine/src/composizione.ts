import type { DefinizioneRuolo } from './ruoli.js';
import type { IdRuolo } from './tipi.js';

export type Composizione = Record<IdRuolo, number>;

export interface EsitoValidazione {
  errori: string[];
  avvisi: string[];
}

export const MIN_GIOCATORI_CONSIGLIATO = 8;

export function totaleRuoli(c: Composizione): number {
  return Object.values(c).reduce((a, b) => a + b, 0);
}

export function validaComposizione(
  c: Composizione,
  numGiocatori: number,
  registro: Map<IdRuolo, DefinizioneRuolo>,
  setEsteso: boolean,
): EsitoValidazione {
  const errori: string[] = [];
  const avvisi: string[] = [];
  const tot = totaleRuoli(c);

  if (tot !== numGiocatori) errori.push(`I ruoli sono ${tot} ma i giocatori sono ${numGiocatori}.`);
  if (numGiocatori < MIN_GIOCATORI_CONSIGLIATO)
    avvisi.push(`Con meno di ${MIN_GIOCATORI_CONSIGLIATO} giocatori la partita è poco equilibrata.`);

  let lupi = 0;
  let peso = 0;
  for (const [id, n] of Object.entries(c)) {
    if (n <= 0) continue;
    const def = registro.get(id);
    if (!def) {
      errori.push(`Ruolo sconosciuto: ${id}.`);
      continue;
    }
    if (!Number.isInteger(n)) errori.push(`Quantità non valida per ${def.nome}.`);
    if (def.set === 'esteso' && !setEsteso) errori.push(`${def.nome} fa parte del set esteso, che non è attivo.`);
    if (def.minimo !== undefined && n < def.minimo)
      errori.push(`${def.nome}: ne servono almeno ${def.minimo}.`);
    if (def.massimo !== undefined && n > def.massimo)
      errori.push(`${def.nome}: al massimo ${def.massimo}.`);
    if (numGiocatori < def.minGiocatoriConsigliato)
      avvisi.push(`${def.nome} è consigliato da ${def.minGiocatoriConsigliato} giocatori in su.`);
    if (def.contaComeLupo) lupi += n;
    peso += def.peso * n;
  }

  if (lupi === 0) errori.push('Serve almeno un lupo mannaro.');
  else if (tot > 0) {
    if (lupi < tot / 6) avvisi.push('Pochi lupi: il villaggio è favorito.');
    if (lupi > tot / 3) avvisi.push('Troppi lupi: i lupi sono favoriti.');
  }
  const soglia = Math.max(5, 0.35 * tot);
  if (Math.abs(peso) > soglia)
    avvisi.push(peso > 0 ? 'Composizione sbilanciata a favore del villaggio.' : 'Composizione sbilanciata a favore dei lupi.');

  return { errori, avvisi };
}

/** Composizione suggerita in base al numero di giocatori (vedi RULES.md §7). */
export function suggerisciComposizione(n: number): Composizione {
  const c: Composizione = {};
  const aggiungi = (id: IdRuolo, q = 1) => (c[id] = (c[id] ?? 0) + q);
  const lupi = n >= 19 ? 5 : n >= 15 ? 4 : n >= 12 ? 3 : 2;
  aggiungi('lupo', lupi);
  aggiungi('veggente');
  if (n >= 9) aggiungi('medium');
  if (n >= 10) aggiungi('indemoniato'), aggiungi('guardia');
  if (n >= 11) aggiungi('mitomane');
  if (n >= 12) aggiungi('gufo'), aggiungi('massone', 2);
  if (n >= 13) aggiungi('criceto');
  // a 12 giocatori il Mitomane lascia il posto a Gufo e Massoni, torna a 14
  if (n === 12 || n === 13) delete c.mitomane;
  const villici = n - totaleRuoli(c);
  if (villici > 0) aggiungi('villico', villici);
  return c;
}
