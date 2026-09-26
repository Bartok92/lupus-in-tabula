import { casualeSicuro } from './casuale.js';
import { applica, type EventoMotore } from './comandi.js';
import type { Comando } from './comandi.js';
import type { ComandoTimer, PacchettoVista } from './eventi.js';
import { creaPartita, defDi, type StatoPartita } from './stato.js';
import { MASTER, type Attore, type Casuale, type Fazione, type IdGiocatore } from './tipi.js';
import { vistaPer } from './viste.js';

// La "stanza" è la partita ospitata da qualcuno: il server Node oppure il telefono del Master.
// Gestisce sessioni (riconnessione), attesa finta, timer e fine partita.
// Nessun I/O: rete e salvataggi sono compito di chi la ospita.

declare function btoa(s: string): string;

// Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L): 31^6 ≈ 890 milioni di codici.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LUNGHEZZA_CODICE = 6;
export const MAX_GIOCATORI = 30;

export interface Sessione {
  token: string;
  idGiocatore: IdGiocatore;
  idDispositivo: string | null;
}

interface TimerInterno {
  etichetta: string;
  durataMs: number;
  fineA: number | null;
  rimanenteInPausa: number | null;
}

export interface AmbienteStanza {
  ora: () => number;
  casuale: () => Casuale;
}

export type EsitoEntra =
  | { ok: true; sessione: Sessione; nuovo: boolean; nickname: string }
  | { ok: false; errore: string };

export type EsitoComandoStanza =
  | { ok: true; eventi: EventoMotore[]; espulsi: IdGiocatore[]; appenaFinita: boolean }
  | { ok: false; errore: string };

/** Byte casuali crittograficamente sicuri, in base64url (Web Crypto: Node ≥19 e browser). */
export function idCasuale(byte: number): string {
  const b = new Uint8Array(byte);
  (globalThis as unknown as { crypto: { getRandomValues(a: Uint8Array): void } }).crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generaCodice(casuale: Casuale = casualeSicuro()): string {
  return Array.from({ length: LUNGHEZZA_CODICE }, () => ALFABETO[Math.floor(casuale() * ALFABETO.length)]).join('');
}

export function normalizzaCodice(codice: string): string {
  return codice.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Confronto a tempo costante (per i token). */
export function ugualeSicuro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const AMBIENTE_DEFAULT: AmbienteStanza = { ora: () => Date.now(), casuale: casualeSicuro };

export class Stanza {
  sessioni = new Map<string, Sessione>();
  attesaFino = 0;
  timer: TimerInterno | null = null;
  iniziata: number | null = null;
  storicoSalvato = false;
  creata: number;
  ultimaAttivita: number;
  private amb: AmbienteStanza;

  constructor(
    public codice: string,
    public tokenMaster: string,
    public stato: StatoPartita = creaPartita(),
    amb: Partial<AmbienteStanza> = {},
  ) {
    this.amb = { ...AMBIENTE_DEFAULT, ...amb };
    this.creata = this.ultimaAttivita = this.amb.ora();
  }

  static nuova(amb: Partial<AmbienteStanza> = {}, codice = generaCodice()): Stanza {
    return new Stanza(codice, idCasuale(32), creaPartita(), amb);
  }

  verificaMaster(token: string): boolean {
    return ugualeSicuro(this.tokenMaster, token);
  }

  tocca(): void {
    this.ultimaAttivita = this.amb.ora();
  }

  entraGiocatore(dati: { nickname?: string; token?: string; idDispositivo?: string }): EsitoEntra {
    const idDispositivo = dati.idDispositivo && /^[A-Za-z0-9-]{8,64}$/.test(dati.idDispositivo) ? dati.idDispositivo : null;

    // Riconnessione: stesso token, oppure stesso dispositivo già registrato.
    const esistente =
      (dati.token ? this.sessioni.get(dati.token) : undefined) ??
      (idDispositivo ? [...this.sessioni.values()].find((s) => s.idDispositivo === idDispositivo) : undefined);
    const g = esistente && this.stato.giocatori.find((x) => x.id === esistente.idGiocatore);
    if (esistente && g) {
      this.tocca();
      return { ok: true, sessione: esistente, nuovo: false, nickname: g.nome };
    }

    if (this.stato.fase !== 'lobby') return { ok: false, errore: 'La partita è già iniziata: non si possono aggiungere giocatori.' };
    if (this.stato.giocatori.length >= MAX_GIOCATORI) return { ok: false, errore: 'La stanza è piena.' };
    const nickname = (dati.nickname ?? '').trim();
    const id = `g_${idCasuale(6)}`;
    const r = applica(this.stato, MASTER, { tipo: 'aggiungiGiocatore', id, nome: nickname }, this.amb.casuale());
    if (!r.ok) return { ok: false, errore: r.errore };
    this.stato = r.stato;

    const sessione: Sessione = { token: idCasuale(24), idGiocatore: id, idDispositivo };
    this.sessioni.set(sessione.token, sessione);
    this.tocca();
    return { ok: true, sessione, nuovo: true, nickname };
  }

  comando(attore: Attore, c: Comando): EsitoComandoStanza {
    const adesso = this.amb.ora();
    if (attore.tipo === 'master' && (c.tipo === 'chiamaProssimoPasso' || c.tipo === 'terminaNotte') && adesso < this.attesaFino) {
      return { ok: false, errore: `Aspetta ancora ${Math.ceil((this.attesaFino - adesso) / 1000)} s: nessuno deve capire chi manca.` };
    }
    // Il Master può aggiungere a mano un giocatore senza telefono: l'id lo decide chi ospita.
    if (c.tipo === 'aggiungiGiocatore') c = { ...c, id: `g_${idCasuale(6)}` };

    const fasePrima = this.stato.fase;
    const r = applica(this.stato, attore, c, this.amb.casuale());
    if (!r.ok) return r;
    this.stato = r.stato;
    // Il timer (discussione, difesa) vale per una fase sola.
    if (this.stato.fase !== fasePrima || c.tipo === 'apriVotoBallottaggio') this.timer = null;

    let espulsi: IdGiocatore[] = [];
    if (c.tipo === 'rimuoviGiocatore') {
      espulsi = [c.id];
      for (const [token, s] of this.sessioni) if (s.idGiocatore === c.id) this.sessioni.delete(token);
    }
    if (c.tipo === 'avviaPartita') this.iniziata = adesso;
    if (c.tipo === 'nuovaPartita') {
      this.iniziata = null;
      this.storicoSalvato = false;
      this.timer = null;
      this.attesaFino = 0;
    }
    if (c.tipo === 'annulla' && this.stato.fase === 'lobby') this.iniziata = null;
    for (const e of r.eventi) {
      if (e.tipo === 'chiamata') this.attesaFino = e.finto ? adesso + e.attesaFintaMs : 0;
    }
    if (this.stato.fase === 'notte' && c.tipo === 'iniziaNotte') this.attesaFino = 0;
    const appenaFinita = this.stato.fase === 'fine' && !this.storicoSalvato;
    if (appenaFinita) this.storicoSalvato = true;

    this.tocca();
    return { ok: true, eventi: r.eventi, espulsi, appenaFinita };
  }

  comandoTimer(c: ComandoTimer): void {
    const adesso = this.amb.ora();
    const t = this.timer;
    switch (c.azione) {
      case 'avvia':
        this.timer = { etichetta: c.etichetta.slice(0, 40), durataMs: c.secondi * 1000, fineA: adesso + c.secondi * 1000, rimanenteInPausa: null };
        break;
      case 'pausa':
        if (t?.fineA != null) { t.rimanenteInPausa = Math.max(0, t.fineA - adesso); t.fineA = null; }
        break;
      case 'riprendi':
        if (t && t.fineA === null) { t.fineA = adesso + (t.rimanenteInPausa ?? 0); t.rimanenteInPausa = null; }
        break;
      case 'aggiungi':
        if (t) {
          t.durataMs += c.secondi * 1000;
          if (t.fineA !== null) t.fineA = Math.max(t.fineA, adesso) + c.secondi * 1000;
          else t.rimanenteInPausa = (t.rimanenteInPausa ?? 0) + c.secondi * 1000;
        }
        break;
      case 'stop':
        this.timer = null;
        break;
    }
    this.tocca();
  }

  pacchetto(attore: Attore, connessi: Record<IdGiocatore, boolean>): PacchettoVista {
    const ora = this.amb.ora();
    let timer: PacchettoVista['timer'] = null;
    if (this.timer) {
      const rimanente = this.timer.fineA !== null ? Math.max(0, this.timer.fineA - ora) : (this.timer.rimanenteInPausa ?? 0);
      timer = { etichetta: this.timer.etichetta, durataMs: this.timer.durataMs, rimanenteMs: rimanente, inPausa: this.timer.fineA === null };
    }
    return {
      codice: this.codice,
      connessi,
      timer,
      attesaRimanenteMs: attore.tipo === 'master' ? Math.max(0, this.attesaFino - ora) : 0,
      vista: vistaPer(this.stato, attore),
    };
  }

  /** Per le statistiche a fine partita: chi ha giocato da quale dispositivo, con che fazione e se ha vinto. */
  esitiPerDispositivo(): { idDispositivo: string; nickname: string; fazione: Fazione; vinto: boolean }[] {
    const v = this.stato.vittoria;
    if (!v) return [];
    const out: { idDispositivo: string; nickname: string; fazione: Fazione; vinto: boolean }[] = [];
    for (const ses of this.sessioni.values()) {
      const g = this.stato.giocatori.find((x) => x.id === ses.idGiocatore);
      if (!ses.idDispositivo || !g) continue;
      out.push({ idDispositivo: ses.idDispositivo, nickname: g.nome, fazione: defDi(this.stato, g)?.fazione ?? 'villaggio', vinto: v.vincitori.includes(g.id) });
    }
    return out;
  }

  serializza(): string {
    return JSON.stringify({
      codice: this.codice, tokenMaster: this.tokenMaster, stato: this.stato, creata: this.creata,
      ultimaAttivita: this.ultimaAttivita, iniziata: this.iniziata, storicoSalvato: this.storicoSalvato,
      sessioni: [...this.sessioni.values()],
    });
  }

  static deserializza(json: string, amb: Partial<AmbienteStanza> = {}): Stanza {
    const d = JSON.parse(json) as {
      codice: string; tokenMaster: string; stato: StatoPartita; creata: number; ultimaAttivita: number;
      iniziata: number | null; storicoSalvato: boolean; sessioni: Sessione[];
    };
    const s = new Stanza(d.codice, d.tokenMaster, d.stato, amb);
    s.creata = d.creata;
    s.ultimaAttivita = d.ultimaAttivita;
    s.iniziata = d.iniziata;
    s.storicoSalvato = d.storicoSalvato;
    for (const ses of d.sessioni) s.sessioni.set(ses.token, ses);
    return s;
  }
}
