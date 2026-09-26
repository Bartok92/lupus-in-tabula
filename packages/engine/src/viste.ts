import { bersagliValidi, passoCorrente } from './notte.js';
import type { DefinizioneRuolo } from './ruoli.js';
import {
  defDi, elencoNomi, nome, registro, trovaGiocatore,
  type EsitoVoto, type Giocatore, type StatoPartita, type Vittoria, type VoceLog,
} from './stato.js';
import type { Attore, Aura, Fase, Fazione, IdGiocatore, IdRuolo } from './tipi.js';
import { astensionePermessa, bersagliVoto, conteggio, votantiAmmessi } from './voti.js';

export interface CartaRuolo {
  id: IdRuolo;
  nome: string;
  fazione: Fazione;
  aura: Aura;
  descrizione: string;
  obiettivo: string;
  immagine: string;
}

export interface Istruzioni {
  titolo: string;
  testo: string;
}

export interface GiocatorePubblico {
  id: IdGiocatore;
  nome: string;
  posto: number;
  vivo: boolean;
  /** Ruolo del morto, secondo l'impostazione `rivelaRuoloMorti` (o tutti a fine partita). */
  rivelato: { fazione: Fazione; ruolo: CartaRuolo | null } | null;
}

export interface AzioneNotturnaVista {
  passo: string;
  tipo: 'bersaglio' | 'riconoscimento' | 'informazione';
  effetto: string | null;
  bersagliValidi: IdGiocatore[];
  miaScelta: IdGiocatore | null | undefined;
  /** Solo per i lupi: voti dei compagni in tempo reale. */
  votiBranco: Record<IdGiocatore, IdGiocatore | null> | null;
  bloccata: boolean;
}

export interface VistaGiocatore {
  tipo: 'giocatore';
  fase: Fase;
  giorno: number;
  io: { id: IdGiocatore; nome: string; vivo: boolean; haVisto: boolean; ruolo: CartaRuolo | null; ruoloCambiato: boolean };
  giocatori: GiocatorePubblico[];
  compagni: { id: IdGiocatore; nome: string; ruolo: CartaRuolo }[];
  indagini: { notte: number; fonte: 'indaga' | 'medium'; bersaglio: IdGiocatore | null; aura: Aura | null }[];
  /** Durante la notte tutti ricevono questo oggetto; `azione` è presente solo per chi è chiamato. */
  notte: { numero: number; azione: AzioneNotturnaVista | null } | null;
  alba: { giorno: number; morti: IdGiocatore[] } | null;
  ballottaggio: { candidati: IdGiocatore[]; sottofase: 'difesa' | 'voto' } | null;
  votazione: {
    tipo: 'nomination' | 'ballottaggio';
    aperta: boolean;
    turno: number;
    possoVotare: boolean;
    bersagli: IdGiocatore[];
    astensione: boolean;
    mioVoto: IdGiocatore | null | undefined;
    votiDati: number;
    voti: Record<IdGiocatore, IdGiocatore | null> | null;
    conteggio: Record<IdGiocatore, number> | null;
    esito: EsitoVoto | null;
  } | null;
  rogo: { giorno: number; id: IdGiocatore | null } | null;
  vittoria: (Vittoria & { hoVinto: boolean }) | null;
  log: VoceLog[];
  istruzioni: Istruzioni;
  /** Il Master ha attivato i suoni anche sui telefoni dei giocatori. */
  suoni: boolean;
}

export type VistaMaster = Omit<StatoPartita, '_undo'> & { tipo: 'master'; annullabili: number };

export type Vista = VistaMaster | VistaGiocatore;

export function carta(def: DefinizioneRuolo): CartaRuolo {
  return {
    id: def.id, nome: def.nome, fazione: def.fazione, aura: def.aura,
    descrizione: def.descrizione, obiettivo: def.obiettivo, immagine: def.immagine,
  };
}

export function vistaPer(s: StatoPartita, attore: Attore): Vista {
  if (attore.tipo === 'master') {
    const { _undo, ...resto } = s;
    return { ...resto, tipo: 'master', annullabili: _undo.length };
  }
  const io = trovaGiocatore(s, attore.id);
  if (!io) throw new Error('Giocatore inesistente');
  return vistaGiocatore(s, io);
}

function vistaGiocatore(s: StatoPartita, io: Giocatore): VistaGiocatore {
  const reg = registro(s);
  const fine = s.fase === 'fine';
  const mioDef = defDi(s, io);
  // I morti non ricevono più informazioni segrete (a parte il proprio ruolo).
  const segreti = io.vivo && s.fase !== 'lobby' && s.fase !== 'rivelazione';

  const giocatori: GiocatorePubblico[] = s.giocatori.map((g) => {
    const def = defDi(s, g);
    let rivelato: GiocatorePubblico['rivelato'] = null;
    if (def && (fine || (!g.vivo && s.impostazioni.rivelaRuoloMorti !== 'nascosto'))) {
      rivelato = { fazione: def.fazione, ruolo: fine || s.impostazioni.rivelaRuoloMorti === 'ruolo' ? carta(def) : null };
    }
    return { id: g.id, nome: g.nome, posto: g.posto, vivo: g.vivo, rivelato };
  });

  // Compagni: solo quelli visti nei passi notturni in cui si è stati chiamati.
  const compagni = segreti
    ? (s.compagniRivelati[io.id] ?? []).map((id) => {
        const g = trovaGiocatore(s, id)!;
        return { id: g.id, nome: g.nome, ruolo: carta(reg.get(g.ruolo!)!) };
      })
    : [];

  const indagini = segreti || fine
    ? s.indagini.filter((i) => i.attore === io.id).map(({ notte, fonte, bersaglio, aura }) => ({ notte, fonte, bersaglio, aura }))
    : [];

  let notte: VistaGiocatore['notte'] = null;
  if (s.fase === 'notte' && s.notte) {
    const passo = passoCorrente(s);
    let azione: AzioneNotturnaVista | null = null;
    if (segreti && passo && passo.attori.includes(io.id)) {
      const scelte = s.notte.scelte[passo.id] ?? {};
      const branco = passo.effetto === 'uccidi_branco';
      azione = {
        passo: passo.id, tipo: passo.tipo, effetto: passo.effetto,
        bersagliValidi: bersagliValidi(s, passo, io.id),
        miaScelta: scelte[io.id],
        votiBranco: branco ? { ...scelte } : null,
        bloccata: passo.effetto === 'indaga' && s.impostazioni.veggenteRisultatoSubito && io.id in scelte,
      };
    }
    notte = { numero: s.notte.numero, azione };
  }

  let votazione: VistaGiocatore['votazione'] = null;
  const v = s.votazione;
  if (v) {
    const pubblici = !v.aperta || s.impostazioni.votiVisibiliInDiretta;
    const possoVotare = v.aperta && votantiAmmessi(s).includes(io.id);
    votazione = {
      tipo: v.tipo, aperta: v.aperta, turno: v.turno, possoVotare,
      bersagli: possoVotare ? bersagliVoto(s, io.id) : [],
      astensione: astensionePermessa(s),
      mioVoto: v.voti[io.id],
      votiDati: Object.keys(v.voti).length,
      voti: pubblici ? { ...v.voti } : null,
      conteggio: pubblici ? conteggio(v) : null,
      esito: v.esito,
    };
  }

  const vittoria = s.vittoria ? { ...s.vittoria, hoVinto: s.vittoria.vincitori.includes(io.id) } : null;

  const vista: VistaGiocatore = {
    tipo: 'giocatore', fase: s.fase, giorno: s.giorno,
    io: {
      id: io.id, nome: io.nome, vivo: io.vivo, haVisto: io.haVisto,
      ruolo: mioDef && s.fase !== 'lobby' ? carta(mioDef) : null,
      ruoloCambiato: !!io.ruolo && io.ruolo !== io.ruoloIniziale,
    },
    giocatori, compagni, indagini, notte,
    alba: s.alba?.confermata ? { giorno: s.alba.giorno, morti: [...s.alba.morti] } : null,
    ballottaggio: s.ballottaggio ? { candidati: [...s.ballottaggio.candidati], sottofase: s.ballottaggio.sottofase } : null,
    votazione,
    rogo: s.fase === 'rogo' && s.ultimoRogo ? { giorno: s.ultimoRogo.giorno, id: s.ultimoRogo.id } : null,
    vittoria,
    log: fine ? s.log.map((l) => ({ ...l })) : s.log.filter((l) => l.pubblico).map((l) => ({ ...l })),
    istruzioni: { titolo: '', testo: '' },
    suoni: s.impostazioni.suoni.giocatori,
  };
  vista.istruzioni = istruzioniPer(s, io, vista);
  return vista;
}

// ——— Istruzioni contestuali (RULES.md §6.4) ———

function riempi(testo: string, valori: Record<string, string>): string {
  return testo.replace(/\{(\w+)\}/g, (_, k: string) => valori[k] ?? '').replace(/\s+/g, ' ').trim();
}

export function istruzioniPer(s: StatoPartita, io: Giocatore, v: VistaGiocatore): Istruzioni {
  const def = defDi(s, io);
  const compagni = elencoNomi(v.compagni.map((c) => c.nome));

  if (s.fase === 'lobby') return { titolo: 'In attesa', testo: 'Sei nella stanza. Aspetta che il Master scelga i ruoli e avvii la partita.' };
  if (!def) return { titolo: '', testo: '' };

  if (s.fase === 'fine') {
    const vt = v.vittoria!;
    return {
      titolo: vt.hoVinto ? 'Hai vinto!' : 'Hai perso',
      testo: `${vt.motivo} Guarda il riepilogo per scoprire cosa è successo davvero.`,
    };
  }
  if (s.fase === 'rivelazione') {
    return io.haVisto
      ? { titolo: def.nome, testo: `${def.obiettivo} Aspetta che il Master faccia scendere la notte.` }
      : { titolo: 'Il tuo ruolo', testo: 'Tieni premuto sulla carta per vederla, senza farla vedere agli altri. Poi premi "Ho visto".' };
  }
  if (!io.vivo) {
    return {
      titolo: 'Fuori dal gioco',
      testo: 'Il tuo personaggio è morto. Da ora segui la partita senza giocare: non parlare e non fare gesti, così non aiuti nessuno.',
    };
  }

  if (s.fase === 'notte') {
    const azione = v.notte?.azione;
    if (!azione) {
      return {
        titolo: `Notte ${s.giorno}`,
        testo: 'Il villaggio dorme. Tieni gli occhi chiusi quando lo chiede il Master e completa il piccolo compito sullo schermo mentre aspetti.',
      };
    }
    const primaNotte = s.giorno === 1 && def.istruzioniPrimaNotte && azione.tipo === 'riconoscimento';
    let testo = (primaNotte ? def.istruzioniPrimaNotte : def.istruzioniNotte) ?? 'È il tuo turno.';
    const vincoli: string[] = [];
    if (azione.tipo === 'bersaglio') {
      if (def.azione.tipo === 'bersaglio' && (def.azione.effetto === 'gufo' ? !s.impostazioni.gufoPuoSeStesso : def.azione.vincoli.nonSeStesso))
        vincoli.push('te stesso');
      const ieri = s.guardiaUltimo[io.id];
      if (def.azione.tipo === 'bersaglio' && def.azione.vincoli.nonStessoDueNottiDiFila && s.impostazioni.guardiaNonStessoDueNotti && ieri)
        vincoli.push(`${nome(s, ieri)} (protetto ieri)`);
    }
    if (azione.tipo === 'informazione') {
      const ultima = v.indagini.filter((i) => i.fonte === 'medium' && i.notte === s.giorno).at(-1);
      testo += ultima?.bersaglio
        ? ` ${nome(s, ultima.bersaglio)} ${ultima.aura === 'lupo' ? 'ERA un lupo mannaro.' : 'NON era un lupo mannaro.'}`
        : ' Ieri nessuno è andato al rogo.';
    }
    if (azione.effetto === 'indaga' && azione.bloccata) {
      const ultima = v.indagini.filter((i) => i.fonte === 'indaga' && i.notte === s.giorno).at(-1);
      if (ultima?.bersaglio)
        testo = `${nome(s, ultima.bersaglio)} ${ultima.aura === 'lupo' ? 'È un lupo mannaro!' : 'non è un lupo mannaro.'}`;
    }
    return {
      titolo: `Tocca a te: ${def.nome}`,
      testo: riempi(testo, { compagni, vincoli: vincoli.length ? `Non puoi scegliere ${vincoli.join(' né ')}.` : '' }),
    };
  }

  if (s.fase === 'alba') {
    if (!v.alba) return { titolo: 'Alba', testo: 'Il sole sta sorgendo. Aspetta l\'annuncio del Master.' };
    const cambio = v.io.ruoloCambiato && s.giorno === 1 ? ` Il Mitomane in te si è trasformato: ora sei ${def.nome}. ${def.obiettivo}` : '';
    return { titolo: 'Alba', testo: `Il Master annuncia cosa è successo stanotte.${cambio}` };
  }

  if (s.fase === 'discussione') return { titolo: 'Discussione', testo: riempi(def.istruzioniGiorno, { compagni }) };

  if (s.fase === 'nomination' || (s.fase === 'ballottaggio' && s.ballottaggio?.sottofase === 'voto')) {
    const vt = v.votazione!;
    if (!vt.aperta) return { titolo: 'Votazione chiusa', testo: 'Il Master sta leggendo il risultato.' };
    if (!vt.possoVotare) {
      return {
        titolo: 'Votazione',
        testo: def.puoVotare ? 'Sei tra i candidati: stavolta non voti. Aspetta il verdetto.' : 'Non puoi votare, ma puoi ancora convincere gli altri.',
      };
    }
    return s.fase === 'nomination'
      ? { titolo: 'Chi va al ballottaggio?', testo: 'Vota chi mandare al ballottaggio. Puoi cambiare voto finché il Master non chiude la votazione.' }
      : { titolo: 'Chi va al rogo?', testo: 'Vota chi dei candidati mandare al rogo. Puoi cambiare voto finché il Master non chiude la votazione.' };
  }

  if (s.fase === 'ballottaggio') {
    const candidato = s.ballottaggio?.candidati.includes(io.id);
    return candidato
      ? { titolo: 'Sei al ballottaggio!', testo: 'Difenditi: convinci il villaggio che non sei un lupo.' }
      : { titolo: 'Ballottaggio', testo: `Ascolta la difesa di ${elencoNomi((s.ballottaggio?.candidati ?? []).map((id) => nome(s, id)))}.` };
  }

  if (s.fase === 'rogo') {
    return { titolo: 'Il rogo', testo: v.rogo?.id ? `${nome(s, v.rogo.id)} finisce sul rogo. Presto scenderà la notte.` : 'Oggi nessuno è andato al rogo. Presto scenderà la notte.' };
  }
  return { titolo: '', testo: '' };
}
