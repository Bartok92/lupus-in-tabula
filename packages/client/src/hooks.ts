import { useEffect, useRef, useState } from 'react';
import type { Fase, Fazione, StatoTimer } from '@lupus/engine';
import type { Tema } from './ds/Sfondo';
import { suona, type Suono } from './suoni';

/** Orologio che si aggiorna ogni `ms` millisecondi. */
export function useOra(ms = 1000): number {
  const [ora, setOra] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setOra(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return ora;
}

/** Millisecondi rimanenti di un conto alla rovescia ricevuto dal server alle `ricevutoA`. */
export function useRimanente(rimanenteMs: number, ricevutoA: number, inPausa = false): number {
  const ora = useOra(250);
  return inPausa ? rimanenteMs : Math.max(0, rimanenteMs - (ora - ricevutoA));
}

export function useTimer(timer: StatoTimer | null, ricevutoA: number): StatoTimer | null {
  const rimanente = useRimanente(timer?.rimanenteMs ?? 0, ricevutoA, timer?.inPausa);
  return timer ? { ...timer, rimanenteMs: rimanente } : null;
}

/** Il tema del cielo segue la fase: notte fino all'alba, poi giorno. Se vincono i lupi, la fine resta di notte. */
export function temaDellaFase(fase: Fase, vincitori?: Fazione): Tema {
  if (fase === 'fine') return vincitori === 'lupi' ? 'notte' : 'giorno';
  return fase === 'lobby' || fase === 'rivelazione' || fase === 'notte' ? 'notte' : 'giorno';
}

type WakeLockSentinelMinimo = { release: () => Promise<void>; addEventListener: (t: 'release', f: () => void) => void };
type NavigatorWakeLock = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelMinimo> } };

/**
 * Tiene acceso lo schermo (Wake Lock API). Funziona solo in contesto sicuro (HTTPS o localhost):
 * restituisce 'non-supportato' altrimenti, così la UI può suggerire di cambiare le impostazioni del telefono.
 */
export function useWakeLock(attivo: boolean): 'attivo' | 'non-supportato' | 'inattivo' {
  const [stato, setStato] = useState<'attivo' | 'non-supportato' | 'inattivo'>('inattivo');
  useEffect(() => {
    const wl = (navigator as NavigatorWakeLock).wakeLock;
    if (!attivo) return;
    if (!wl || !window.isSecureContext) {
      setStato('non-supportato');
      return;
    }
    let sentinella: WakeLockSentinelMinimo | null = null;
    let chiuso = false;
    const richiedi = async () => {
      try {
        sentinella = await wl.request('screen');
        setStato('attivo');
        sentinella.addEventListener('release', () => !chiuso && setStato('inattivo'));
      } catch {
        setStato('inattivo');
      }
    };
    const visibilita = () => document.visibilityState === 'visible' && void richiedi();
    void richiedi();
    document.addEventListener('visibilitychange', visibilita);
    return () => {
      chiuso = true;
      document.removeEventListener('visibilitychange', visibilita);
      void sentinella?.release().catch(() => undefined);
    };
  }, [attivo]);
  return stato;
}

/** Suona al cambio di fase: ululato quando scende la notte, gallo all'alba, campana per il voto. */
export function useSuoniFase(chiave: string, abilitato: boolean): void {
  const prima = useRef(chiave);
  useEffect(() => {
    if (prima.current === chiave) return;
    const [faseDopo, extra] = chiave.split(':');
    const [fasePrima] = prima.current.split(':');
    prima.current = chiave;
    if (!abilitato) return;
    const mappa: Record<string, Suono> = { notte: 'ululato', alba: 'gallo' };
    const s = extra === 'voto' ? 'campana' : fasePrima !== faseDopo ? mappa[faseDopo!] : undefined;
    if (s) suona(s);
  }, [chiave, abilitato]);
}

/** Scarica un file generato nel browser. */
export function scaricaFile(nome: string, contenuto: string, tipo = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([contenuto], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
