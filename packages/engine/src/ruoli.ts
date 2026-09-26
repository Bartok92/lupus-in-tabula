import type { Aura, Fazione, IdRuolo, NottiAttive } from './tipi.js';

export type EffettoBersaglio = 'uccidi_branco' | 'proteggi' | 'indaga' | 'gufo' | 'copia' | 'manuale';

export interface VincoliBersaglio {
  nonSeStesso?: boolean;
  /** Esclude chi appartiene al proprio gruppo segreto (i lupi non sbranano lupi). */
  nonCompagni?: boolean;
  /** Vincolo della Guardia, attivo solo se l'impostazione lo prevede. */
  nonStessoDueNottiDiFila?: boolean;
}

export type AzioneRuolo =
  | { tipo: 'nessuna' }
  | { tipo: 'bersaglio'; effetto: EffettoBersaglio; vincoli: VincoliBersaglio }
  | { tipo: 'informazione'; effetto: 'medium' }
  | { tipo: 'riconoscimento' };

export interface DefinizioneRuolo {
  id: IdRuolo;
  nome: string;
  set: 'base' | 'esteso' | 'personalizzato';
  fazione: Fazione;
  aura: Aura;
  /** Conta come lupo per la parità e per la vittoria del villaggio. */
  contaComeLupo: boolean;
  /** false = non conta tra gli "altri" nella parità (Mortovivo). */
  contaPerParita: boolean;
  puoVotare: boolean;
  notti: NottiAttive;
  azione: AzioneRuolo;
  /** Tutti i giocatori con questo ruolo vengono chiamati insieme (lupi, massoni). */
  collettivo: boolean;
  /** Gruppo segreto di appartenenza: i membri si conoscono. */
  gruppo?: string;
  /** Gruppi di cui questo ruolo conosce i membri (Mucca mannara → lupi). */
  conosce?: string[];
  immunitaLupi?: boolean;
  muoreSeIndagato?: boolean;
  minimo?: number;
  massimo?: number;
  minGiocatoriConsigliato: number;
  /** Bilanciamento: positivo aiuta il villaggio. */
  peso: number;
  descrizione: string;
  obiettivo: string;
  /** Segnaposti: {compagni}, {ieri}, {vincoli}. */
  istruzioniNotte?: string;
  istruzioniPrimaNotte?: string;
  istruzioniGiorno: string;
  /** Chiave dell'illustrazione (il client la risolve; il Master può sostituirla). */
  immagine: string;
}

const villaggio = { fazione: 'villaggio', aura: 'non_lupo', contaComeLupo: false, contaPerParita: true, puoVotare: true } as const;

export const RUOLI_BASE: DefinizioneRuolo[] = [
  {
    id: 'villico', nome: 'Villico', set: 'base', ...villaggio,
    notti: 'mai', azione: { tipo: 'nessuna' }, collettivo: false,
    minGiocatoriConsigliato: 0, peso: 1, immagine: 'villico',
    descrizione: 'Un abitante del villaggio senza poteri speciali, armato solo del suo intuito.',
    obiettivo: 'Vinci con il villaggio quando tutti i lupi mannari sono morti.',
    istruzioniGiorno: 'Ascolta, osserva le reazioni e vota chi ti sembra un lupo.',
  },
  {
    id: 'lupo', nome: 'Lupo mannaro', set: 'base',
    fazione: 'lupi', aura: 'lupo', contaComeLupo: true, contaPerParita: true, puoVotare: true,
    notti: 'tutte', collettivo: true, gruppo: 'lupi', conosce: ['lupi'],
    azione: { tipo: 'bersaglio', effetto: 'uccidi_branco', vincoli: { nonCompagni: true } },
    minimo: 1, minGiocatoriConsigliato: 0, peso: -5, immagine: 'lupo',
    descrizione: 'Di giorno sembra un villico come gli altri. Di notte caccia con il branco.',
    obiettivo: 'Vinci quando i lupi vivi sono tanti quanti (o più de) gli altri giocatori vivi.',
    istruzioniPrimaNotte: 'Guarda bene i tuoi compagni: {compagni}. Stanotte non si sbrana: memorizzate chi siete.',
    istruzioniNotte:
      'Scegli con il branco chi sbranare stanotte. I tuoi compagni: {compagni}. Vedete i voti degli altri in tempo reale: mettetevi d\'accordo, altrimenti decide il Master.',
    istruzioniGiorno: 'Difendi i compagni senza farti notare e vota come un villico qualsiasi. Compagni: {compagni}.',
  },
  {
    id: 'veggente', nome: 'Veggente', set: 'base', ...villaggio,
    notti: 'tutte', collettivo: false,
    azione: { tipo: 'bersaglio', effetto: 'indaga', vincoli: { nonSeStesso: true } },
    massimo: 1, minGiocatoriConsigliato: 0, peso: 7, immagine: 'veggente',
    descrizione: 'Ogni notte scruta nell\'anima di un giocatore e scopre se è un lupo mannaro.',
    obiettivo: 'Vinci con il villaggio quando tutti i lupi mannari sono morti.',
    istruzioniNotte: 'Scegli un giocatore: scoprirai subito se è un lupo mannaro. Una volta scelto non puoi cambiare.',
    istruzioniGiorno: 'Usa ciò che sai con prudenza: se ti scoprono, i lupi ti sbraneranno.',
  },
  {
    id: 'medium', nome: 'Medium', set: 'base', ...villaggio,
    notti: 'dalla_seconda', collettivo: false,
    azione: { tipo: 'informazione', effetto: 'medium' },
    massimo: 1, minGiocatoriConsigliato: 9, peso: 3, immagine: 'medium',
    descrizione: 'Parla con i morti: scopre se chi è salito sul rogo era davvero un lupo.',
    obiettivo: 'Vinci con il villaggio quando tutti i lupi mannari sono morti.',
    istruzioniNotte: 'Ecco cosa ti rivelano gli spiriti su chi è andato al rogo ieri.',
    istruzioniGiorno: 'Racconta ciò che hai scoperto quando può servire al villaggio.',
  },
  {
    id: 'guardia', nome: 'Guardia del corpo', set: 'base', ...villaggio,
    notti: 'tutte', collettivo: false,
    azione: { tipo: 'bersaglio', effetto: 'proteggi', vincoli: { nonSeStesso: true, nonStessoDueNottiDiFila: true } },
    massimo: 1, minGiocatoriConsigliato: 9, peso: 3, immagine: 'guardia',
    descrizione: 'Veglia nell\'ombra: i lupi non possono colpire chi protegge.',
    obiettivo: 'Vinci con il villaggio quando tutti i lupi mannari sono morti.',
    istruzioniNotte: 'Scegli chi proteggere dai lupi stanotte. {vincoli}',
    istruzioniGiorno: 'Non rivelarti: se i lupi sanno chi sei, ti colpiranno per primo.',
  },
  {
    id: 'gufo', nome: 'Gufo', set: 'base', ...villaggio,
    notti: 'tutte', collettivo: false,
    azione: { tipo: 'bersaglio', effetto: 'gufo', vincoli: {} },
    massimo: 1, minGiocatoriConsigliato: 10, peso: 2, immagine: 'gufo',
    descrizione: 'Dall\'alto del campanile indica un sospetto: il giorno dopo finirà al ballottaggio.',
    obiettivo: 'Vinci con il villaggio quando tutti i lupi mannari sono morti.',
    istruzioniNotte: 'Scegli un giocatore: domani andrà direttamente al ballottaggio. {vincoli}',
    istruzioniGiorno: 'Il tuo sospetto è già al ballottaggio: convinci gli altri.',
  },
  {
    id: 'massone', nome: 'Massone', set: 'base', ...villaggio,
    notti: 'solo_prima', collettivo: true, gruppo: 'massoni', conosce: ['massoni'],
    azione: { tipo: 'riconoscimento' },
    minimo: 2, minGiocatoriConsigliato: 10, peso: 2, immagine: 'massone',
    descrizione: 'Membro di una confraternita segreta: conosce i suoi confratelli.',
    obiettivo: 'Vinci con il villaggio quando tutti i lupi mannari sono morti.',
    istruzioniNotte: 'Riconosci i tuoi confratelli massoni: {compagni}. Di loro puoi fidarti.',
    istruzioniGiorno: 'I tuoi confratelli sono innocenti: {compagni}. Fai fronte comune.',
  },
  {
    id: 'indemoniato', nome: 'Indemoniato', set: 'base',
    fazione: 'lupi', aura: 'non_lupo', contaComeLupo: false, contaPerParita: true, puoVotare: true,
    notti: 'mai', azione: { tipo: 'nessuna' }, collettivo: false,
    massimo: 1, minGiocatoriConsigliato: 10, peso: -3, immagine: 'indemoniato',
    descrizione: 'Un umano posseduto che tifa per i lupi. Il Veggente lo vede innocente.',
    obiettivo: 'Vinci con i lupi. Non sai chi sono e loro non sanno chi sei.',
    istruzioniGiorno: 'Semina confusione e proteggi chi sembra un lupo: la tua vittoria è la loro.',
  },
  {
    id: 'criceto', nome: 'Criceto mannaro', set: 'base',
    fazione: 'criceto', aura: 'non_lupo', contaComeLupo: false, contaPerParita: true, puoVotare: true,
    notti: 'mai', azione: { tipo: 'nessuna' }, collettivo: false,
    immunitaLupi: true, muoreSeIndagato: true,
    massimo: 1, minGiocatoriConsigliato: 12, peso: -2, immagine: 'criceto',
    descrizione: 'I lupi non possono ucciderlo, ma lo sguardo del Veggente gli è fatale.',
    obiettivo: 'Resta vivo fino alla fine: se sei vivo quando la partita finisce, vinci solo tu.',
    istruzioniGiorno: 'Non farti notare dal Veggente e sopravvivi: chiunque vinca, se sei vivo vinci tu.',
  },
  {
    id: 'mitomane', nome: 'Mitomane', set: 'base', ...villaggio,
    notti: 'solo_prima', collettivo: false,
    azione: { tipo: 'bersaglio', effetto: 'copia', vincoli: { nonSeStesso: true } },
    massimo: 1, minGiocatoriConsigliato: 11, peso: 0, immagine: 'mitomane',
    descrizione: 'Vuole essere qualcun altro: la prima notte sceglie chi imitare.',
    obiettivo: 'Il tuo obiettivo dipende da chi diventerai all\'alba.',
    istruzioniNotte:
      'Scegli un giocatore da imitare: se è un lupo diventerai lupo, se è il Veggente diventerai veggente, altrimenti diventerai villico. Lo scoprirai all\'alba.',
    istruzioniGiorno: 'Aspetta l\'alba per scoprire chi sei diventato.',
  },
];

export const RUOLI_ESTESI: DefinizioneRuolo[] = [
  {
    id: 'cartomante', nome: 'Cartomante', set: 'esteso', ...villaggio,
    notti: 'tutte', collettivo: false,
    azione: { tipo: 'bersaglio', effetto: 'indaga', vincoli: { nonSeStesso: true } },
    massimo: 1, minGiocatoriConsigliato: 12, peso: 5, immagine: 'cartomante',
    descrizione: 'Legge i tarocchi: come il Veggente, scopre se un giocatore è un lupo.',
    obiettivo: 'Vinci con il villaggio quando tutti i lupi mannari sono morti.',
    istruzioniNotte: 'Scegli un giocatore: le carte ti diranno subito se è un lupo mannaro. Una volta scelto non puoi cambiare.',
    istruzioniGiorno: 'Usa ciò che sai con prudenza: i lupi ti cercano.',
  },
  {
    id: 'mucca', nome: 'Mucca mannara', set: 'esteso',
    fazione: 'lupi', aura: 'non_lupo', contaComeLupo: false, contaPerParita: true, puoVotare: true,
    notti: 'solo_prima', collettivo: true, conosce: ['lupi'],
    azione: { tipo: 'riconoscimento' },
    massimo: 1, minGiocatoriConsigliato: 12, peso: -3, immagine: 'mucca',
    descrizione: 'Conosce i lupi e tifa per loro, ma loro non sanno chi sia.',
    obiettivo: 'Vinci con i lupi. Loro non sanno chi sei e potrebbero sbranarti.',
    istruzioniNotte: 'Ecco i lupi mannari: {compagni}. Loro non sanno chi sei.',
    istruzioniGiorno: 'Aiuta i lupi senza farti scoprire: {compagni}.',
  },
  {
    id: 'mortovivo', nome: 'Mortovivo', set: 'esteso', ...villaggio,
    contaPerParita: false, puoVotare: false,
    notti: 'mai', azione: { tipo: 'nessuna' }, collettivo: false,
    massimo: 1, minGiocatoriConsigliato: 12, peso: 0, immagine: 'mortovivo',
    descrizione: 'È già morto, ma non se n\'è accorto: parla, ma non vota.',
    obiettivo: 'Vinci con il villaggio quando tutti i lupi mannari sono morti.',
    istruzioniGiorno: 'Partecipa alla discussione: non puoi votare, ma puoi convincere gli altri.',
  },
];

export const TUTTI_I_RUOLI: DefinizioneRuolo[] = [...RUOLI_BASE, ...RUOLI_ESTESI];

/** Dati che il Master compila nell'editor per creare un ruolo personalizzato. */
export interface DatiRuoloPersonalizzato {
  id: IdRuolo;
  nome: string;
  fazione: Fazione;
  aura: Aura;
  contaComeLupo: boolean;
  agisceDiNotte: boolean;
  descrizione: string;
}

export function creaRuoloPersonalizzato(d: DatiRuoloPersonalizzato): DefinizioneRuolo {
  return {
    id: d.id, nome: d.nome, set: 'personalizzato', fazione: d.fazione, aura: d.aura,
    contaComeLupo: d.contaComeLupo, contaPerParita: true, puoVotare: true,
    notti: d.agisceDiNotte ? 'tutte' : 'mai', collettivo: false,
    azione: d.agisceDiNotte ? { tipo: 'bersaglio', effetto: 'manuale', vincoli: {} } : { tipo: 'nessuna' },
    minGiocatoriConsigliato: 0, peso: 0, immagine: 'personalizzato',
    descrizione: d.descrizione,
    obiettivo: `Il tuo obiettivo: ${d.descrizione}`,
    istruzioniNotte: 'Scegli un giocatore. Il Master applicherà l\'effetto del tuo potere.',
    istruzioniGiorno: d.descrizione,
  };
}

export function registroRuoli(personalizzati: DefinizioneRuolo[] = []): Map<IdRuolo, DefinizioneRuolo> {
  return new Map([...TUTTI_I_RUOLI, ...personalizzati].map((r) => [r.id, r]));
}
