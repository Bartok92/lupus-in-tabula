import type { Composizione } from './composizione.js';
import { IMPOSTAZIONI_DEFAULT, type Impostazioni } from './impostazioni.js';
import { registroRuoli, type DefinizioneRuolo, type EffettoBersaglio } from './ruoli.js';
import type { Aura, Fase, Fazione, IdGiocatore, IdRuolo } from './tipi.js';

export type CausaMorte = 'lupi' | 'veggente' | 'rogo' | 'master';

export interface Giocatore {
  id: IdGiocatore;
  nome: string;
  posto: number;
  ruolo: IdRuolo | null;
  ruoloIniziale: IdRuolo | null;
  vivo: boolean;
  haVisto: boolean;
  morte: { giorno: number; causa: CausaMorte } | null;
}

export interface PassoNotte {
  /** 'lupo' per i ruoli collettivi, 'veggente:<idGiocatore>' per quelli individuali. */
  id: string;
  ruolo: IdRuolo;
  tipo: 'bersaglio' | 'riconoscimento' | 'informazione';
  effetto: EffettoBersaglio | 'medium' | null;
  /** Giocatori vivi chiamati in questo passo. */
  attori: IdGiocatore[];
  /** Nessuno da chiamare (ruolo morto): il Master simula l'attesa. */
  finto: boolean;
  attesaFintaMs: number;
}

export interface EsitoNotte {
  bersaglioLupi: IdGiocatore | null;
  lupiInDisaccordo: boolean;
  morti: { id: IdGiocatore; causa: 'lupi' | 'veggente' }[];
  salvati: { id: IdGiocatore; motivo: 'guardia' | 'immunita' }[];
  trasformazioni: { id: IdGiocatore; da: IdRuolo; a: IdRuolo }[];
  gufo: IdGiocatore[];
  protetti: Record<IdGiocatore, IdGiocatore>;
  sceltePersonalizzate: { passo: string; attore: IdGiocatore | null; bersaglio: IdGiocatore | null }[];
}

export interface StatoNotte {
  numero: number;
  passi: PassoNotte[];
  /** Indice del passo chiamato; -1 = nessuno ancora. */
  corrente: number;
  /** passo → attore → bersaglio (null = rinuncia). */
  scelte: Record<string, Record<IdGiocatore, IdGiocatore | null>>;
  /** passo → bersaglio imposto dal Master. */
  forzature: Record<string, IdGiocatore | null>;
  anteprima: EsitoNotte | null;
}

export interface Indagine {
  notte: number;
  attore: IdGiocatore;
  fonte: 'indaga' | 'medium';
  bersaglio: IdGiocatore | null;
  aura: Aura | null;
}

export type EsitoVoto =
  | { tipo: 'candidati'; candidati: IdGiocatore[] }
  | { tipo: 'condannato'; id: IdGiocatore | null }
  | { tipo: 'pareggio'; sicuri: IdGiocatore[]; pari: IdGiocatore[]; posti: number; rivoto: boolean }
  | { tipo: 'serveSecondo'; sicuri: IdGiocatore[] }
  | { tipo: 'nessuno' };

export interface StatoVotazione {
  tipo: 'nomination' | 'ballottaggio';
  aperta: boolean;
  voti: Record<IdGiocatore, IdGiocatore | null>;
  /** Bersagli ammessi (null = tutti i vivi). */
  ammessi: IdGiocatore[] | null;
  posti: number;
  /** Già qualificati prima di un rivoto. */
  sicuri: IdGiocatore[];
  turno: number;
  esito: EsitoVoto | null;
}

export interface Vittoria {
  fazione: Fazione;
  vincitori: IdGiocatore[];
  motivo: string;
}

export interface VoceLog {
  n: number;
  giorno: number;
  fase: Fase;
  testo: string;
  pubblico: boolean;
}

export interface StatoPartita {
  versione: 1;
  fase: Fase;
  /** Numero della notte/giorno corrente (0 prima della prima notte). */
  giorno: number;
  impostazioni: Impostazioni;
  composizione: Composizione;
  ruoliPersonalizzati: DefinizioneRuolo[];
  giocatori: Giocatore[];
  notte: StatoNotte | null;
  /** Compagni che ogni giocatore ha visto nei passi notturni in cui è stato chiamato. */
  compagniRivelati: Record<IdGiocatore, IdGiocatore[]>;
  indagini: Indagine[];
  alba: { giorno: number; confermata: boolean; morti: IdGiocatore[] } | null;
  gufoBersagli: IdGiocatore[];
  guardiaUltimo: Record<IdGiocatore, IdGiocatore>;
  votazione: StatoVotazione | null;
  ballottaggio: { candidati: IdGiocatore[]; sottofase: 'difesa' | 'voto' } | null;
  ultimoRogo: { giorno: number; id: IdGiocatore | null; aura: Aura | null } | null;
  esitoProposto: Vittoria | null;
  vittoria: Vittoria | null;
  log: VoceLog[];
  /** Pila per l'annullamento (non viene mai inviata ai giocatori). */
  _undo: string[];
}

export function creaPartita(impostazioni: Impostazioni = IMPOSTAZIONI_DEFAULT): StatoPartita {
  return {
    versione: 1, fase: 'lobby', giorno: 0,
    impostazioni: clona(impostazioni), composizione: {}, ruoliPersonalizzati: [],
    giocatori: [], notte: null, compagniRivelati: {}, indagini: [], alba: null,
    gufoBersagli: [], guardiaUltimo: {}, votazione: null, ballottaggio: null,
    ultimoRogo: null, esitoProposto: null, vittoria: null, log: [], _undo: [],
  };
}

// ——— funzioni di supporto ———

export function clona<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function registro(s: StatoPartita): Map<IdRuolo, DefinizioneRuolo> {
  return registroRuoli(s.ruoliPersonalizzati);
}

export function trovaGiocatore(s: StatoPartita, id: IdGiocatore): Giocatore | undefined {
  return s.giocatori.find((g) => g.id === id);
}

export function defDi(s: StatoPartita, g: Giocatore): DefinizioneRuolo | undefined {
  return g.ruolo ? registro(s).get(g.ruolo) : undefined;
}

export function vivi(s: StatoPartita): Giocatore[] {
  return s.giocatori.filter((g) => g.vivo);
}

export function nome(s: StatoPartita, id: IdGiocatore | null | undefined): string {
  if (!id) return 'nessuno';
  return trovaGiocatore(s, id)?.nome ?? '?';
}

export function elencoNomi(nomi: string[]): string {
  if (nomi.length === 0) return 'nessuno';
  if (nomi.length === 1) return nomi[0]!;
  return `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

/** Giocatori che `g` conosce grazie al suo ruolo (compagni di gruppo), escluso se stesso. */
export function compagniNoti(s: StatoPartita, g: Giocatore): Giocatore[] {
  const def = defDi(s, g);
  if (!def?.conosce?.length) return [];
  const reg = registro(s);
  return s.giocatori.filter((altro) => {
    if (altro.id === g.id || !altro.ruolo) return false;
    const gruppo = reg.get(altro.ruolo)?.gruppo;
    return gruppo !== undefined && def.conosce!.includes(gruppo);
  });
}

export function aggiungiLog(s: StatoPartita, testo: string, pubblico = false): void {
  s.log.push({ n: s.log.length + 1, giorno: s.giorno, fase: s.fase, testo, pubblico });
}
