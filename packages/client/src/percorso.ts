import { useSyncExternalStore } from 'react';

// Router minimo basato sull'hash: https://…/lupus/#/g/K7PQ2X
// Funziona su qualsiasi hosting statico (GitHub Pages compreso) senza configurare nulla.

function percorsoAttuale(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

function iscriviti(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function usePercorso(): string {
  return useSyncExternalStore(iscriviti, percorsoAttuale);
}

export function vai(percorso: string, sostituisci = false): void {
  const url = `${window.location.pathname}${window.location.search}#${percorso}`;
  if (sostituisci) {
    history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = percorso;
  }
}

/** Indirizzo completo (da mettere nel QR) per entrare nella partita `codice`. */
export function linkPartita(codice: string, origine = window.location.origin): string {
  return `${origine}${window.location.pathname}${window.location.search}#/g/${codice}`;
}
