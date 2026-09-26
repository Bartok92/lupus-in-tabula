import type { IdRuolo } from './tipi.js';

export interface Impostazioni {
  primaNotte: { lupiUccidono: boolean; veggenteAgisce: boolean; gufoAgisce: boolean };
  lupiDisaccordo: 'master' | 'maggioranza';
  veggenteRisultatoSubito: boolean;
  guardiaNonStessoDueNotti: boolean;
  gufoPuoSeStesso: boolean;
  mitomaneCopiaQualsiasi: boolean;
  rivelaRuoloMorti: 'nascosto' | 'fazione' | 'ruolo';
  nomination: {
    autovoto: boolean;
    astensione: boolean;
    pareggio: 'tutti' | 'rivoto' | 'master' | 'sorteggio';
    unSoloVotato: 'master_aggiunge' | 'rogo_diretto';
  };
  votiVisibiliInDiretta: boolean;
  ballottaggio: {
    candidatiVotano: boolean;
    astensione: boolean;
    pareggio: 'rivoto_poi_master' | 'master' | 'sorteggio' | 'nessuno';
  };
  /** Attesa simulata per i passi notturni di ruoli morti: [minimo, massimo] in ms. */
  attesaFintaMs: [number, number];
  setEsteso: boolean;
  ordinePrimaNotte: IdRuolo[];
  ordineNotti: IdRuolo[];
  suoni: { master: boolean; giocatori: boolean };
}

export const IMPOSTAZIONI_DEFAULT: Impostazioni = {
  primaNotte: { lupiUccidono: false, veggenteAgisce: true, gufoAgisce: true },
  lupiDisaccordo: 'master',
  veggenteRisultatoSubito: true,
  guardiaNonStessoDueNotti: true,
  gufoPuoSeStesso: false,
  mitomaneCopiaQualsiasi: false,
  rivelaRuoloMorti: 'nascosto',
  nomination: { autovoto: false, astensione: true, pareggio: 'tutti', unSoloVotato: 'master_aggiunge' },
  votiVisibiliInDiretta: false,
  ballottaggio: { candidatiVotano: false, astensione: true, pareggio: 'rivoto_poi_master' },
  attesaFintaMs: [6000, 12000],
  setEsteso: false,
  ordinePrimaNotte: ['lupo', 'mucca', 'massone', 'mitomane', 'veggente', 'cartomante', 'gufo'],
  ordineNotti: ['veggente', 'cartomante', 'medium', 'guardia', 'gufo', 'lupo'],
  suoni: { master: true, giocatori: false },
};

export type ImpostazioniParziali = {
  [K in keyof Impostazioni]?: Impostazioni[K] extends unknown[]
    ? Impostazioni[K]
    : Impostazioni[K] extends object
      ? Partial<Impostazioni[K]>
      : Impostazioni[K];
};

/** Unisce impostazioni parziali (un livello di profondità). */
export function unisciImpostazioni(base: Impostazioni, parz: ImpostazioniParziali): Impostazioni {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(parz)) {
    if (v === undefined) continue;
    const prima = (base as unknown as Record<string, unknown>)[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && prima && typeof prima === 'object'
        ? { ...prima, ...v }
        : v;
  }
  return out as unknown as Impostazioni;
}
