import { create } from 'zustand';
import type { Comando, ComandoTimer, Esito, PacchettoVista, RispostaEntra } from '@lupus/engine';
import { archivio } from './archivio';
import { modalita, trasportoGiocatore, trasportoMaster, type Modalita } from './rete/connessione';
import type { Trasporto } from './rete/trasporto';

type Identita =
  | { tipo: 'master'; codice: string; tokenMaster: string }
  | { tipo: 'giocatore'; codice: string; token: string };

interface StatoApp {
  modalita: Modalita | null;
  connesso: boolean;
  identita: Identita | null;
  pacchetto: PacchettoVista | null;
  /** Quando è arrivato l'ultimo pacchetto (per i conti alla rovescia locali). */
  ricevutoA: number;
  errore: string | null;
  espulso: boolean;
  entraComeMaster: (codice: string, tokenMaster: string) => Promise<Esito>;
  entraComeGiocatore: (codice: string, nickname?: string) => Promise<RispostaEntra>;
  invia: (c: Comando) => Promise<Esito>;
  timer: (c: ComandoTimer) => Promise<Esito>;
  pulisciErrore: () => void;
}

let trasporto: Trasporto | null = null;
const SCOLLEGATO = { ok: false as const, errore: 'Non sei collegato a nessuna partita.' };

export const useApp = create<StatoApp>((set, get) => {
  void modalita().then((m) => set({ modalita: m }));

  /** Si ripresenta con la propria identità (dopo ogni riconnessione). */
  const riautentica = () => {
    const id = get().identita;
    if (!trasporto || !id) return;
    if (id.tipo === 'master') void trasporto.entraComeMaster(id.codice, id.tokenMaster);
    else void trasporto.entraComeGiocatore(id.codice, { token: id.token, idDispositivo: archivio.idDispositivo() });
  };

  const collega = (t: Trasporto) => {
    if (trasporto === t) return;
    trasporto = t;
    t.ascolta({
      vista: (pacchetto) => trasporto === t && set({ pacchetto, ricevutoA: Date.now() }),
      connessione: (connesso) => {
        if (trasporto !== t) return;
        set({ connesso });
        if (connesso) riautentica();
      },
      chiamata: () => {
        try {
          navigator.vibrate?.([250, 120, 250]);
        } catch {
          // vibrazione non disponibile
        }
      },
      espulso: () => {
        const id = get().identita;
        if (id?.tipo === 'giocatore') archivio.dimenticaGiocatore(id.codice);
        set({ espulso: true, identita: null, pacchetto: null });
      },
    });
  };

  const conErrore = <T extends { ok: boolean }>(r: T): T => {
    if (!r.ok) set({ errore: (r as unknown as { errore: string }).errore });
    return r;
  };

  return {
    modalita: null,
    connesso: false,
    identita: null,
    pacchetto: null,
    ricevutoA: 0,
    errore: null,
    espulso: false,

    entraComeMaster: async (codice, tokenMaster) => {
      const t = await trasportoMaster(codice);
      if (!t) return conErrore({ ok: false, errore: 'Questa partita non è su questo telefono.' });
      collega(t);
      const r = await t.entraComeMaster(codice, tokenMaster);
      if (r.ok) set({ identita: { tipo: 'master', codice, tokenMaster }, espulso: false });
      return conErrore(r);
    },

    entraComeGiocatore: async (codice, nickname) => {
      const t = await trasportoGiocatore(codice, trasporto);
      collega(t);
      const r = await t.entraComeGiocatore(codice, { nickname, token: archivio.tokenGiocatore(codice), idDispositivo: archivio.idDispositivo() });
      if (r.ok) {
        archivio.salvaTokenGiocatore(codice, r.token);
        set({ identita: { tipo: 'giocatore', codice, token: r.token }, espulso: false });
      }
      return conErrore(r);
    },

    invia: async (c) => conErrore(trasporto ? await trasporto.comando(c) : SCOLLEGATO),
    timer: async (c) => conErrore(trasporto ? await trasporto.timer(c) : SCOLLEGATO),
    pulisciErrore: () => set({ errore: null }),
  };
});
