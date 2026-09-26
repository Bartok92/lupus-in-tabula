import { del, get, keys, set } from 'idb-keyval';
import type { StatoPartita } from '@lupus/engine';
import type { ArchivioHost, Profilo } from './host';

// Archivio del telefono del Master (IndexedDB): partite in corso, profili degli amici, storico.
// Sopravvive alla chiusura della pagina e al riavvio del telefono.

const MAX_STORICO = 30;

export const archivioIdb: ArchivioHost = {
  salvaPartita: (codice, dati) => set(`partita:${codice}`, dati),
  caricaPartita: (codice) => get<string>(`partita:${codice}`),
  profilo: (id) => get<Profilo>(`profilo:${id}`),
  salvaProfilo: (id, p) => set(`profilo:${id}`, p),
  aggiungiStorico: async (voce) => {
    const elenco = (await get<unknown[]>('storico')) ?? [];
    await set('storico', [voce, ...elenco].slice(0, MAX_STORICO));
  },
};

export interface PartitaSalvata {
  codice: string;
  fase: StatoPartita['fase'];
  giocatori: number;
  ultimaAttivita: number;
}

/** Le partite ospitate da questo telefono, dalla più recente. */
export async function partiteSalvate(): Promise<PartitaSalvata[]> {
  const chiavi = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith('partita:'));
  const out: PartitaSalvata[] = [];
  for (const k of chiavi) {
    try {
      const d = JSON.parse((await get<string>(k)) ?? '') as { codice: string; stato: StatoPartita; ultimaAttivita: number };
      out.push({ codice: d.codice, fase: d.stato.fase, giocatori: d.stato.giocatori.length, ultimaAttivita: d.ultimaAttivita });
    } catch {
      // partita illeggibile: la ignoriamo
    }
  }
  return out.sort((a, b) => b.ultimaAttivita - a.ultimaAttivita);
}

export function eliminaPartita(codice: string): Promise<void> {
  return del(`partita:${codice}`);
}
