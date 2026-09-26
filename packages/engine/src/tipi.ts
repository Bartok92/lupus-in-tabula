// Tipi di base condivisi da server e client.

export type Fazione = 'villaggio' | 'lupi' | 'criceto' | 'personalizzata';
export type Aura = 'lupo' | 'non_lupo';
export type NottiAttive = 'mai' | 'tutte' | 'solo_prima' | 'dalla_seconda';

export type IdGiocatore = string;
export type IdRuolo = string;

export type Fase =
  | 'lobby'
  | 'rivelazione'
  | 'notte'
  | 'alba'
  | 'discussione'
  | 'nomination'
  | 'ballottaggio'
  | 'rogo'
  | 'fine';

/** Generatore casuale iniettato dall'esterno: restituisce un numero in [0, 1). */
export type Casuale = () => number;

/** Chi invia un comando al motore. */
export type Attore = { tipo: 'master' } | { tipo: 'giocatore'; id: IdGiocatore };

export const MASTER: Attore = { tipo: 'master' };
export const giocatore = (id: IdGiocatore): Attore => ({ tipo: 'giocatore', id });
