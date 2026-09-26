import { eq, lt, sql } from 'drizzle-orm';
import {
  generaCodice, normalizzaCodice, Stanza,
  type Attore, type Casuale, type Comando, type ComandoTimer, type EsitoComandoStanza, type IdGiocatore, type PacchettoVista, type Sessione,
} from '@lupus/engine';
import { istantanee, profili, storico, type Db } from './db.js';

/** Una stanza ospitata dal server: la logica è quella del motore, qui aggiungiamo i socket collegati. */
export class StanzaServer {
  socketMaster = new Set<string>();
  socketGiocatori = new Map<IdGiocatore, Set<string>>();

  constructor(public core: Stanza) {}

  get codice(): string {
    return this.core.codice;
  }
  get stato() {
    return this.core.stato;
  }

  connessi(): Record<IdGiocatore, boolean> {
    return Object.fromEntries(this.core.stato.giocatori.map((g) => [g.id, (this.socketGiocatori.get(g.id)?.size ?? 0) > 0]));
  }

  pacchetto(attore: Attore): PacchettoVista {
    return this.core.pacchetto(attore, this.connessi());
  }
}

export interface OpzioniGestore {
  db: Db;
  /** Una stanza senza attività per questo tempo viene eliminata. */
  scadenzaMs: number;
  ora?: () => number;
  casuale?: () => Casuale;
  /** Ritardo del salvataggio delle istantanee (ms). */
  ritardoSalvataggio?: number;
}

export type EsitoEntraServer =
  | { ok: true; stanza: StanzaServer; sessione: Sessione; nuovo: boolean }
  | { ok: false; errore: string };

export class GestoreStanze {
  stanze = new Map<string, StanzaServer>();
  private ora: () => number;
  private salvataggi = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private opz: OpzioniGestore) {
    this.ora = opz.ora ?? Date.now;
    this.carica();
  }

  private get ambiente() {
    return { ora: this.ora, ...(this.opz.casuale ? { casuale: this.opz.casuale } : {}) };
  }

  crea(): StanzaServer {
    let codice: string;
    do codice = generaCodice();
    while (this.stanze.has(codice));
    const stanza = new StanzaServer(Stanza.nuova(this.ambiente, codice));
    this.stanze.set(codice, stanza);
    this.salva(stanza);
    return stanza;
  }

  trova(codice: string): StanzaServer | undefined {
    return this.stanze.get(normalizzaCodice(codice));
  }

  verificaMaster(stanza: StanzaServer, token: string): boolean {
    return stanza.core.verificaMaster(token);
  }

  /** Un token di Master valido per una qualsiasi stanza attiva (per le API dei preset). */
  eMasterDiQualcheStanza(token: string): boolean {
    return [...this.stanze.values()].some((s) => s.core.verificaMaster(token));
  }

  entraGiocatore(codice: string, dati: { nickname?: string; token?: string; idDispositivo?: string }): EsitoEntraServer {
    const stanza = this.trova(codice);
    if (!stanza) return { ok: false, errore: 'Stanza non trovata. Controlla il codice.' };
    const r = stanza.core.entraGiocatore(dati);
    if (!r.ok) return r;
    if (r.nuovo && r.sessione.idDispositivo) this.aggiornaProfilo(r.sessione.idDispositivo, r.nickname);
    this.salva(stanza);
    return { ok: true, stanza, sessione: r.sessione, nuovo: r.nuovo };
  }

  comando(stanza: StanzaServer, attore: Attore, c: Comando): EsitoComandoStanza {
    const r = stanza.core.comando(attore, c);
    if (!r.ok) return r;
    if (r.appenaFinita) this.registraFine(stanza);
    this.salva(stanza);
    return r;
  }

  timer(stanza: StanzaServer, c: ComandoTimer): void {
    stanza.core.comandoTimer(c);
    this.salva(stanza);
  }

  /** Segna attività (rinvia la scadenza) e programma il salvataggio. */
  tocca(stanza: StanzaServer): void {
    stanza.core.tocca();
    this.salva(stanza);
  }

  // ——— Persistenza ———

  private salva(stanza: StanzaServer): void {
    const ritardo = this.opz.ritardoSalvataggio ?? 500;
    if (ritardo <= 0) return this.salvaSubito(stanza);
    if (this.salvataggi.has(stanza.codice)) return;
    this.salvataggi.set(stanza.codice, setTimeout(() => this.salvaSubito(stanza), ritardo));
  }

  salvaSubito(stanza: StanzaServer): void {
    const t = this.salvataggi.get(stanza.codice);
    if (t) clearTimeout(t);
    this.salvataggi.delete(stanza.codice);
    if (!this.stanze.has(stanza.codice)) return;
    const dati = stanza.core.serializza();
    this.opz.db.insert(istantanee).values({ codice: stanza.codice, dati, aggiornato: this.ora() })
      .onConflictDoUpdate({ target: istantanee.codice, set: { dati, aggiornato: this.ora() } }).run();
  }

  salvaTutto(): void {
    for (const s of this.stanze.values()) this.salvaSubito(s);
  }

  private carica(): void {
    const limite = this.ora() - this.opz.scadenzaMs;
    this.opz.db.delete(istantanee).where(lt(istantanee.aggiornato, limite)).run();
    for (const riga of this.opz.db.select().from(istantanee).all()) {
      try {
        const s = new StanzaServer(Stanza.deserializza(riga.dati, this.ambiente));
        if (s.core.ultimaAttivita >= limite) this.stanze.set(s.codice, s);
      } catch {
        // istantanea illeggibile: la ignoriamo
      }
    }
  }

  /** Elimina le stanze inattive. Restituisce le stanze eliminate. */
  pulisci(): StanzaServer[] {
    const limite = this.ora() - this.opz.scadenzaMs;
    const scadute = [...this.stanze.values()].filter((s) => s.core.ultimaAttivita < limite);
    for (const s of scadute) {
      this.stanze.delete(s.codice);
      const t = this.salvataggi.get(s.codice);
      if (t) clearTimeout(t);
      this.salvataggi.delete(s.codice);
      this.opz.db.delete(istantanee).where(eq(istantanee.codice, s.codice)).run();
    }
    return scadute;
  }

  // ——— Profili e storico ———

  private aggiornaProfilo(idDispositivo: string, nickname: string): void {
    this.opz.db.insert(profili).values({ idDispositivo, nickname, partite: 0, vittorie: {}, aggiornato: this.ora() })
      .onConflictDoUpdate({ target: profili.idDispositivo, set: { nickname, aggiornato: this.ora() } }).run();
  }

  private registraFine(stanza: StanzaServer): void {
    const s = stanza.stato;
    this.opz.db.insert(storico).values({
      codice: stanza.codice, iniziata: stanza.core.iniziata ?? stanza.core.creata, finita: this.ora(), vittoria: s.vittoria!,
      giocatori: s.giocatori.map((g) => ({ nome: g.nome, ruolo: g.ruolo, vivo: g.vivo })), log: s.log,
    }).run();
    for (const e of stanza.core.esitiPerDispositivo()) {
      const riga = this.opz.db.select().from(profili).where(eq(profili.idDispositivo, e.idDispositivo)).get();
      const vittorie = { ...(riga?.vittorie ?? {}) };
      if (e.vinto) vittorie[e.fazione] = (vittorie[e.fazione] ?? 0) + 1;
      this.opz.db.update(profili)
        .set({ partite: sql`${profili.partite} + 1`, vittorie, aggiornato: this.ora() })
        .where(eq(profili.idDispositivo, e.idDispositivo)).run();
    }
  }
}
