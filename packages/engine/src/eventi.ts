// Contratto tipizzato degli eventi Socket.IO, condiviso da server e client.
// Il client invia solo intenzioni (comandi); il server le valida con il motore
// e risponde a ciascuno con la propria vista filtrata.

import type { Comando } from './comandi.js';
import type { IdGiocatore } from './tipi.js';
import type { Vista } from './viste.js';

export type Esito = { ok: true } | { ok: false; errore: string };

export type RispostaEntra =
  | { ok: true; idGiocatore: IdGiocatore; token: string }
  | { ok: false; errore: string };

export interface StatoTimer {
  etichetta: string;
  durataMs: number;
  /** Millisecondi rimanenti al momento dell'invio. */
  rimanenteMs: number;
  inPausa: boolean;
}

export type ComandoTimer =
  | { azione: 'avvia'; secondi: number; etichetta: string }
  | { azione: 'pausa' }
  | { azione: 'riprendi' }
  | { azione: 'aggiungi'; secondi: number }
  | { azione: 'stop' };

/** Ciò che il server invia a ogni client dopo ogni cambiamento. */
export interface PacchettoVista {
  codice: string;
  /** Stato di connessione dei giocatori (non rivela nulla del gioco). */
  connessi: Record<IdGiocatore, boolean>;
  timer: StatoTimer | null;
  /** Solo per il Master: attesa simulata rimanente prima di poter chiamare il passo successivo. */
  attesaRimanenteMs: number;
  vista: Vista;
  /** Statistiche del giocatore (quando chi ospita le conosce). */
  profilo?: { partite: number; vittorie: Record<string, number> } | null;
}

// ——— Protocollo diretto telefono ↔ telefono (il Master ospita la partita) ———

export type MessaggioOspite =
  | { t: 'entra'; id: number; dati: { nickname?: string; token?: string; idDispositivo?: string } }
  | { t: 'comando'; id: number; comando: unknown };

export type MessaggioHost =
  | { t: 'risposta'; id: number; r: Esito | RispostaEntra }
  | { t: 'vista'; p: PacchettoVista }
  | { t: 'chiamata' }
  | { t: 'espulso' };

export interface EventiClientServer {
  'master:entra': (dati: { codice: string; tokenMaster: string }, ack: (r: Esito) => void) => void;
  'master:timer': (comando: ComandoTimer, ack: (r: Esito) => void) => void;
  entra: (
    dati: { codice: string; nickname?: string; token?: string; idDispositivo?: string },
    ack: (r: RispostaEntra) => void,
  ) => void;
  comando: (comando: Comando, ack: (r: Esito) => void) => void;
}

export interface EventiServerClient {
  vista: (pacchetto: PacchettoVista) => void;
  /** Vibrazione: sei stato chiamato di notte. */
  chiamata: () => void;
  espulso: () => void;
}

/** Risposta di POST /api/stanze. */
export interface StanzaCreata {
  codice: string;
  tokenMaster: string;
}
