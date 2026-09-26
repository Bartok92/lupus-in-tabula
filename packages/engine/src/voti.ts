import { mescola } from './casuale.js';
import { defDi, trovaGiocatore, vivi, type EsitoVoto, type StatoPartita, type StatoVotazione } from './stato.js';
import type { Casuale, IdGiocatore } from './tipi.js';

/** Chi può votare nella votazione corrente. */
export function votantiAmmessi(s: StatoPartita): IdGiocatore[] {
  const v = s.votazione;
  if (!v) return [];
  const candidati = s.ballottaggio?.candidati ?? [];
  return vivi(s)
    .filter((g) => defDi(s, g)?.puoVotare !== false)
    .filter((g) => v.tipo !== 'ballottaggio' || s.impostazioni.ballottaggio.candidatiVotano || !candidati.includes(g.id))
    .map((g) => g.id);
}

/** Chi può essere votato da `votante`. */
export function bersagliVoto(s: StatoPartita, votante: IdGiocatore): IdGiocatore[] {
  const v = s.votazione;
  if (!v) return [];
  const base = v.ammessi ?? vivi(s).map((g) => g.id);
  const autovoto = v.tipo === 'nomination' ? s.impostazioni.nomination.autovoto : true;
  return base.filter((id) => trovaGiocatore(s, id)?.vivo && (autovoto || id !== votante));
}

export function astensionePermessa(s: StatoPartita): boolean {
  return s.votazione?.tipo === 'ballottaggio' ? s.impostazioni.ballottaggio.astensione : s.impostazioni.nomination.astensione;
}

export function conteggio(v: StatoVotazione): Record<IdGiocatore, number> {
  const c: Record<IdGiocatore, number> = {};
  for (const b of Object.values(v.voti)) if (b) c[b] = (c[b] ?? 0) + 1;
  return c;
}

interface Selezione {
  scelti: IdGiocatore[];
  pari: IdGiocatore[];
  postiRimasti: number;
}

/** Sceglie i `posti` più votati; se il pareggio impedisce di decidere, restituisce i pari merito. */
function selezionaPosti(s: StatoPartita, v: StatoVotazione): Selezione {
  const c = conteggio(v);
  const ordinePosto = (id: IdGiocatore) => trovaGiocatore(s, id)?.posto ?? 0;
  const lista = (v.ammessi ?? Object.keys(c))
    .map((id) => ({ id, voti: c[id] ?? 0 }))
    .sort((a, b) => b.voti - a.voti || ordinePosto(a.id) - ordinePosto(b.id));
  if (lista.length <= v.posti) return { scelti: lista.map((x) => x.id), pari: [], postiRimasti: 0 };
  const soglia = lista[v.posti - 1]!.voti;
  const sopra = lista.filter((x) => x.voti > soglia).map((x) => x.id);
  const uguali = lista.filter((x) => x.voti === soglia).map((x) => x.id);
  if (sopra.length + uguali.length === v.posti) return { scelti: [...sopra, ...uguali], pari: [], postiRimasti: 0 };
  return { scelti: sopra, pari: uguali, postiRimasti: v.posti - sopra.length };
}

function sorteggia(ids: IdGiocatore[], quanti: number, casuale: Casuale): IdGiocatore[] {
  return mescola(ids, casuale).slice(0, quanti);
}

/** Calcola l'esito della votazione chiusa (RULES.md §3.7-3.8). */
export function calcolaEsito(s: StatoPartita, casuale: Casuale): EsitoVoto {
  const v = s.votazione!;
  const sel = selezionaPosti(s, v);

  if (v.tipo === 'ballottaggio') {
    if (v.ammessi && v.ammessi.length === 1) return { tipo: 'condannato', id: v.ammessi[0]! };
    if (sel.pari.length === 0) return { tipo: 'condannato', id: sel.scelti[0] ?? null };
    switch (s.impostazioni.ballottaggio.pareggio) {
      case 'sorteggio': return { tipo: 'condannato', id: sorteggia(sel.pari, 1, casuale)[0]! };
      case 'nessuno': return { tipo: 'condannato', id: null };
      case 'master': return { tipo: 'pareggio', sicuri: [], pari: sel.pari, posti: 1, rivoto: false };
      case 'rivoto_poi_master': return { tipo: 'pareggio', sicuri: [], pari: sel.pari, posti: 1, rivoto: v.turno === 0 };
    }
  }

  // Nomination
  const conGufo = (ids: IdGiocatore[]) => [...ids, ...s.gufoBersagli.filter((g) => trovaGiocatore(s, g)?.vivo && !ids.includes(g))];
  let scelti = [...v.sicuri, ...sel.scelti];
  if (sel.pari.length) {
    const modo = v.turno > 0 && s.impostazioni.nomination.pareggio === 'rivoto' ? 'master' : s.impostazioni.nomination.pareggio;
    if (modo === 'tutti') scelti = [...scelti, ...sel.pari];
    else if (modo === 'sorteggio') scelti = [...scelti, ...sorteggia(sel.pari, sel.postiRimasti, casuale)];
    else return { tipo: 'pareggio', sicuri: scelti, pari: sel.pari, posti: sel.postiRimasti, rivoto: modo === 'rivoto' };
  }
  const candidati = conGufo(scelti);
  if (candidati.length === 0) return { tipo: 'nessuno' };
  if (candidati.length === 1 && scelti.length === 1 && s.impostazioni.nomination.unSoloVotato === 'master_aggiunge')
    return { tipo: 'serveSecondo', sicuri: candidati };
  return { tipo: 'candidati', candidati };
}
