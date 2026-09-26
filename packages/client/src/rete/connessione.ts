import { Stanza, type StanzaCreata } from '@lupus/engine';
import { api } from './api';
import { archivioIdb, eliminaPartita } from './p2p/archivioIdb';
import { HostLocale } from './p2p/host';
import { TrasportoOspite } from './p2p/ospite';
import type { Trasporto } from './trasporto';

// PeerJS e Socket.IO si caricano solo se servono: pagina più leggera sui dati mobili.
const caricaPeer = () => import('./p2p/peer');

// Sceglie dove vive la partita:
// - 'server': c'è il nostro server Node (rete locale o cloud) → Socket.IO;
// - 'p2p': app statica (es. GitHub Pages) → il telefono del Master fa da server.
// Si può forzare con ?modo=p2p oppure ?modo=server nell'indirizzo.

export type Modalita = 'server' | 'p2p';

let modalitaScelta: Promise<Modalita> | null = null;

export function modalita(): Promise<Modalita> {
  modalitaScelta ??= (async () => {
    const forzata = new URLSearchParams(window.location.search).get('modo') ?? import.meta.env.VITE_MODALITA;
    if (forzata === 'p2p' || forzata === 'server') return forzata;
    try {
      const r = await fetch('api/salute', { signal: AbortSignal.timeout(2500) });
      const j = (await r.json()) as { ok?: boolean };
      return j.ok ? 'server' : 'p2p';
    } catch {
      return 'p2p';
    }
  })();
  return modalitaScelta;
}

let socket: Promise<Trasporto> | null = null;
const trasportoServer = () => (socket ??= import('./trasportoSocket').then((m) => new m.TrasportoSocket()));

let host: { host: HostLocale; chiudiTavolo: () => void } | null = null;

async function avviaHost(h: HostLocale): Promise<HostLocale> {
  if (host?.host.codice === h.codice) return host.host;
  chiudiHost();
  const { apriTavolo } = await caricaPeer();
  host = { host: h, chiudiTavolo: apriTavolo(h) };
  return h;
}

export function chiudiHost(): void {
  if (!host) return;
  host.chiudiTavolo();
  host.host.chiudi();
  host = null;
}

/** Crea una partita nuova e restituisce codice e token del Master. */
export async function creaPartita(): Promise<StanzaCreata> {
  if ((await modalita()) === 'server') return api.creaStanza();
  const stanza = Stanza.nuova();
  const h = new HostLocale(stanza, archivioIdb);
  await h.salvaSubito();
  await avviaHost(h);
  return { codice: stanza.codice, tokenMaster: stanza.tokenMaster };
}

/** Il trasporto per chi fa il Master della partita `codice` (null se la partita non è su questo telefono). */
export async function trasportoMaster(codice: string): Promise<Trasporto | null> {
  if ((await modalita()) === 'server') return trasportoServer();
  if (host?.host.codice === codice) return host.host;
  const dati = await archivioIdb.caricaPartita(codice);
  if (!dati) return null;
  return avviaHost(new HostLocale(Stanza.deserializza(dati), archivioIdb));
}

/** Il trasporto per un giocatore che entra nella partita `codice`. */
export async function trasportoGiocatore(codice: string, precedente: Trasporto | null): Promise<Trasporto> {
  if ((await modalita()) === 'server') return trasportoServer();
  if (precedente instanceof TrasportoOspite && precedente.codicePartita === codice) return precedente;
  precedente?.chiudi();
  const { connettiAlMaster } = await caricaPeer();
  return new TrasportoOspite(codice, connettiAlMaster);
}

export async function dimenticaPartitaOspitata(codice: string): Promise<void> {
  if (host?.host.codice === codice) chiudiHost();
  await eliminaPartita(codice);
}

// ——— Preset delle composizioni: sul server, oppure sul telefono del Master ———

export interface Preset {
  id: number;
  nome: string;
  composizione: Record<string, number>;
  impostazioni: Record<string, unknown> | null;
}

const CHIAVE_PRESET = 'lupus.preset';

function presetLocali(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE_PRESET) ?? '[]') as Preset[];
  } catch {
    return [];
  }
}

function salvaPresetLocali(p: Preset[]): void {
  try {
    localStorage.setItem(CHIAVE_PRESET, JSON.stringify(p));
  } catch {
    // memoria non disponibile
  }
}

export const preset = {
  async elenco(): Promise<Preset[]> {
    if ((await modalita()) === 'server') return api.preset() as Promise<Preset[]>;
    return presetLocali().sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async salva(tokenMaster: string, p: Omit<Preset, 'id'>): Promise<void> {
    if ((await modalita()) === 'server') {
      await api.salvaPreset(tokenMaster, p as never);
      return;
    }
    const altri = presetLocali().filter((x) => x.nome !== p.nome);
    salvaPresetLocali([...altri, { ...p, id: Date.now() }]);
  },
  async elimina(tokenMaster: string, id: number): Promise<void> {
    if ((await modalita()) === 'server') {
      await api.eliminaPreset(tokenMaster, id);
      return;
    }
    salvaPresetLocali(presetLocali().filter((x) => x.id !== id));
  },
};
