import type { ImpostazioniParziali, StanzaCreata } from '@lupus/engine';

// API HTTP del server Node (solo in modalità 'server').

async function json<T>(r: Response): Promise<T> {
  const dati = (await r.json().catch(() => ({}))) as T & { errore?: string };
  if (!r.ok) throw new Error(dati.errore ?? `Errore ${r.status}`);
  return dati;
}

export interface PresetServer {
  id: number;
  nome: string;
  composizione: Record<string, number>;
  impostazioni: ImpostazioniParziali | null;
}

export const api = {
  creaStanza: () => fetch('api/stanze', { method: 'POST' }).then((r) => json<StanzaCreata>(r)),
  rete: () => fetch('api/rete').then((r) => json<{ indirizzi: string[] }>(r)),
  profilo: (idDispositivo: string) =>
    fetch(`api/profilo/${encodeURIComponent(idDispositivo)}`).then((r) =>
      json<{ nickname: string; partite: number; vittorie: Record<string, number> }>(r),
    ),
  preset: () => fetch('api/preset').then((r) => json<PresetServer[]>(r)),
  salvaPreset: (tokenMaster: string, p: Omit<PresetServer, 'id'>) =>
    fetch('api/preset', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-token-master': tokenMaster },
      body: JSON.stringify(p),
    }).then((r) => json<PresetServer>(r)),
  eliminaPreset: (tokenMaster: string, id: number) =>
    fetch(`api/preset/${id}`, { method: 'DELETE', headers: { 'x-token-master': tokenMaster } }).then((r) => json<{ ok: true }>(r)),
};
