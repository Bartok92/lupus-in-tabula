import type { Comando } from './comandi.js';
import { validaComposizione } from './composizione.js';
import { risolviNotte } from './notte.js';
import { elencoNomi, nome, registro, type StatoPartita } from './stato.js';
import { votantiAmmessi } from './voti.js';

// "Regista": per ogni momento della partita propone al Master il passo successivo
// (il pulsante grande "Prossima fase") e le alternative. Usato dalla UI online e offline.

export interface AzioneRegia {
  comando: Comando;
  etichetta: string;
  /** Spiegazione breve sotto il pulsante. */
  dettaglio?: string;
  tono?: 'oro' | 'sangue';
}

export interface Regia {
  /** Titolo della fase per il Master. */
  titolo: string;
  principale: AzioneRegia | null;
  secondarie: AzioneRegia[];
  /** Cosa manca per poter andare avanti (es. "Scegli tu i candidati"). */
  avviso?: string;
  /** Il Master deve prendere una decisione con un pannello dedicato. */
  decisione?: 'bersaglioLupi' | 'candidati' | 'condannato' | 'vittoria';
}

/** Testo del passo notturno, dal punto di vista del Master. */
export function descriviPasso(s: StatoPartita, indice: number): string {
  const p = s.notte?.passi[indice];
  if (!p) return '';
  const def = registro(s).get(p.ruolo)!;
  const chi = p.finto ? 'nessuno in vita' : elencoNomi(p.attori.map((id) => nome(s, id)));
  const cosa = p.tipo === 'riconoscimento' ? ' (si riconoscono)' : '';
  return `${def.nome}${cosa} · ${chi}`;
}

export function regia(s: StatoPartita): Regia {
  if (s.esitoProposto) {
    const v = s.esitoProposto;
    const chi = v.fazione === 'criceto' ? 'il Criceto mannaro' : v.fazione === 'lupi' ? 'i Lupi' : 'il Villaggio';
    return {
      titolo: 'Fine della partita?',
      principale: { comando: { tipo: 'confermaVittoria' }, etichetta: `Vince ${chi}!`, dettaglio: v.motivo },
      secondarie: [{ comando: { tipo: 'ignoraVittoria' }, etichetta: 'Ignora e continua' }],
      decisione: 'vittoria',
    };
  }

  switch (s.fase) {
    case 'lobby': {
      const v = validaComposizione(s.composizione, s.giocatori.length, registro(s), s.impostazioni.setEsteso);
      return {
        titolo: 'Lobby',
        principale: v.errori.length ? null : { comando: { tipo: 'avviaPartita' }, etichetta: 'Distribuisci i ruoli' },
        secondarie: [],
        avviso: v.errori[0],
      };
    }

    case 'rivelazione': {
      const mancano = s.giocatori.filter((g) => !g.haVisto).map((g) => g.nome);
      return {
        titolo: 'Ognuno guarda la sua carta',
        principale: { comando: { tipo: 'iniziaNotte' }, etichetta: 'Fai scendere la notte', dettaglio: mancano.length ? `Non hanno ancora confermato: ${elencoNomi(mancano)}` : 'Tutti hanno visto la loro carta.' },
        secondarie: [],
      };
    }

    case 'notte': {
      const n = s.notte!;
      const prossimo = n.corrente + 1;
      const termina: AzioneRegia = { comando: { tipo: 'terminaNotte' }, etichetta: 'Fai sorgere il sole' };
      if (prossimo < n.passi.length) {
        const p = n.passi[prossimo]!;
        return {
          titolo: `Notte ${s.giorno}`,
          principale: { comando: { tipo: 'chiamaProssimoPasso' }, etichetta: `Chiama: ${registro(s).get(p.ruolo)!.nome}`, dettaglio: descriviPasso(s, prossimo) },
          secondarie: n.corrente >= 0 ? [{ ...termina, etichetta: 'Termina la notte' }] : [],
        };
      }
      return { titolo: `Notte ${s.giorno}`, principale: termina, secondarie: [] };
    }

    case 'alba': {
      if (!s.alba?.confermata) {
        const esito = risolviNotte(s);
        if (esito.lupiInDisaccordo)
          return { titolo: 'Alba', principale: null, secondarie: [], avviso: 'I lupi non sono d\'accordo: scegli tu la vittima (o nessuna).', decisione: 'bersaglioLupi' };
        const morti = esito.morti.map((m) => nome(s, m.id));
        return {
          titolo: 'Alba',
          principale: {
            comando: { tipo: 'confermaAlba' },
            etichetta: 'Annuncia l\'alba',
            dettaglio: morti.length ? `Muore: ${elencoNomi(morti)}` : 'Nessun morto stanotte',
            tono: morti.length ? 'sangue' : 'oro',
          },
          secondarie: [],
        };
      }
      return {
        titolo: 'Alba',
        principale: { comando: { tipo: 'iniziaDiscussione' }, etichetta: 'Apri la discussione' },
        secondarie: [{ comando: { tipo: 'apriNomination' }, etichetta: 'Vai subito al voto' }],
      };
    }

    case 'discussione':
      return { titolo: 'Discussione', principale: { comando: { tipo: 'apriNomination' }, etichetta: 'Apri la votazione' }, secondarie: [] };

    case 'nomination':
    case 'ballottaggio': {
      const v = s.votazione;
      const b = s.ballottaggio;
      if (s.fase === 'ballottaggio' && b?.sottofase === 'difesa') {
        return {
          titolo: 'Ballottaggio: la difesa',
          principale: { comando: { tipo: 'apriVotoBallottaggio' }, etichetta: 'Apri il voto finale', dettaglio: `Candidati: ${elencoNomi(b.candidati.map((id) => nome(s, id)))}` },
          secondarie: [],
        };
      }
      if (!v) return { titolo: s.fase, principale: null, secondarie: [] };
      const titolo = v.tipo === 'nomination' ? 'Chi va al ballottaggio?' : 'Chi va al rogo?';
      if (v.aperta) {
        const votanti = votantiAmmessi(s).length;
        return {
          titolo,
          principale: { comando: { tipo: 'chiudiVotazione' }, etichetta: 'Chiudi la votazione', dettaglio: `Hanno votato ${Object.keys(v.voti).length} su ${votanti}` },
          secondarie: [],
        };
      }
      const e = v.esito!;
      const saltaNotte: AzioneRegia = { comando: { tipo: 'iniziaNotte' }, etichetta: 'Salta il rogo: fai scendere la notte' };
      switch (e.tipo) {
        case 'candidati':
          return {
            titolo,
            principale: { comando: { tipo: 'avviaBallottaggio' }, etichetta: 'Vai al ballottaggio', dettaglio: elencoNomi(e.candidati.map((id) => nome(s, id))) },
            secondarie: [saltaNotte],
          };
        case 'condannato':
          return {
            titolo,
            principale: e.id
              ? { comando: { tipo: 'eseguiRogo' }, etichetta: `Al rogo: ${nome(s, e.id)}`, tono: 'sangue' }
              : { comando: { tipo: 'eseguiRogo' }, etichetta: 'Oggi nessuno va al rogo' },
            secondarie: [],
          };
        case 'pareggio':
          return {
            titolo,
            principale: e.rivoto ? { comando: { tipo: 'ripetiVoto' }, etichetta: 'Rivota fra i pari merito', dettaglio: elencoNomi(e.pari.map((id) => nome(s, id))) } : null,
            secondarie: v.tipo === 'nomination' ? [saltaNotte] : [],
            avviso: e.rivoto ? undefined : 'Pareggio: decidi tu.',
            decisione: v.tipo === 'nomination' ? 'candidati' : 'condannato',
          };
        case 'serveSecondo':
          return { titolo, principale: null, secondarie: [saltaNotte], avviso: 'Un solo votato: scegli tu il secondo candidato.', decisione: 'candidati' };
        case 'nessuno':
          return {
            titolo,
            principale: saltaNotte,
            secondarie: [{ comando: { tipo: 'apriNomination' }, etichetta: 'Ripeti la votazione' }],
            avviso: 'Nessuno ha ricevuto voti.',
          };
      }
      return { titolo, principale: null, secondarie: [] };
    }

    case 'rogo':
      return { titolo: 'Il rogo', principale: { comando: { tipo: 'iniziaNotte' }, etichetta: 'Fai scendere la notte' }, secondarie: [] };

    case 'fine':
      return { titolo: 'Partita finita', principale: { comando: { tipo: 'nuovaPartita' }, etichetta: 'Nuova partita, stessi giocatori' }, secondarie: [] };
  }
}
