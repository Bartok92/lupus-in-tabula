import {
  giocatore, Limitatore, MASTER, Stanza, validaComando,
  type Comando, type ComandoTimer, type Esito, type EsitoComandoStanza, type IdGiocatore, type MessaggioOspite, type RispostaEntra,
} from '@lupus/engine';
import { Emettitore, type Ascoltatori, type CanaleVersoOspite, type DatiIngresso, type Trasporto } from '../trasporto';

// Il telefono del Master fa da "server": tiene la partita (la stessa Stanza del server Node),
// accoglie i telefoni degli amici e manda a ciascuno solo la sua vista filtrata.

export interface Profilo {
  nickname: string;
  partite: number;
  vittorie: Record<string, number>;
}

/** Dove il Master salva partita, profili e storico (IndexedDB nell'app, memoria nei test). */
export interface ArchivioHost {
  salvaPartita(codice: string, dati: string): Promise<void>;
  caricaPartita(codice: string): Promise<string | undefined>;
  profilo(idDispositivo: string): Promise<Profilo | undefined>;
  salvaProfilo(idDispositivo: string, p: Profilo): Promise<void>;
  aggiungiStorico(voce: unknown): Promise<void>;
}

/** Chi ospita la partita si presenta alla rete con questo nome: gli ospiti lo trovano dal codice. */
export function idPeerDelCodice(codice: string): string {
  return `lupus-in-tabula-v1-${codice.toLowerCase()}`;
}

interface Collegamento {
  idGiocatore: IdGiocatore | null;
  limite: Limitatore;
}

export class HostLocale implements Trasporto {
  readonly tipo = 'host';
  private em = new Emettitore();
  private collegamenti = new Map<CanaleVersoOspite, Collegamento>();
  private profili = new Map<string, Profilo>();
  private salvataggio: ReturnType<typeof setTimeout> | null = null;
  /** La rete (PeerJS) è pronta a ricevere gli ospiti? */
  reteAperta = false;

  constructor(public stanza: Stanza, private archivio: ArchivioHost, private ora: () => number = Date.now) {}

  get codice(): string {
    return this.stanza.codice;
  }

  ascolta(a: Partial<Ascoltatori>): void {
    this.em.ascolta(a);
    a.connessione?.(this.reteAperta);
  }

  impostaReteAperta(aperta: boolean): void {
    this.reteAperta = aperta;
    this.em.connessione(aperta);
  }

  // ——— Lato Master (stesso dispositivo) ———

  async entraComeMaster(codice: string, tokenMaster: string): Promise<Esito> {
    if (codice !== this.stanza.codice || !this.stanza.verificaMaster(tokenMaster)) return { ok: false, errore: 'Questa partita non è tua.' };
    this.diffondi();
    return { ok: true };
  }

  async entraComeGiocatore(): Promise<RispostaEntra> {
    return { ok: false, errore: 'Su questo telefono c\'è il Master.' };
  }

  async comando(c: Comando): Promise<Esito> {
    const r = this.stanza.comando(MASTER, c);
    if (!r.ok) return r;
    await this.dopoComando(r);
    return { ok: true };
  }

  async timer(c: ComandoTimer): Promise<Esito> {
    this.stanza.comandoTimer(c);
    this.salva();
    this.diffondi();
    return { ok: true };
  }

  chiudi(): void {
    if (this.salvataggio) void this.salvaSubito();
    for (const canale of this.collegamenti.keys()) canale.chiudi();
    this.collegamenti.clear();
  }

  // ——— Lato ospiti (i telefoni degli amici) ———

  /** Un nuovo telefono si è collegato. */
  accogli(canale: CanaleVersoOspite): void {
    const c: Collegamento = { idGiocatore: null, limite: new Limitatore(16, 8, this.ora) };
    this.collegamenti.set(canale, c);
    canale.suMessaggio((m) => void this.suMessaggio(canale, c, m));
    canale.suChiusura(() => {
      this.collegamenti.delete(canale);
      if (c.idGiocatore) this.diffondi();
    });
  }

  private async suMessaggio(canale: CanaleVersoOspite, c: Collegamento, m: MessaggioOspite): Promise<void> {
    if (!m || typeof m !== 'object' || typeof m.id !== 'number') return;
    const rispondi = (r: Esito | RispostaEntra) => canale.invia({ t: 'risposta', id: m.id, r });
    if (!c.limite.consuma('x')) return rispondi({ ok: false, errore: 'Troppe richieste: rallenta un attimo.' });

    if (m.t === 'entra') {
      const d = (m.dati ?? {}) as DatiIngresso;
      const str = (x: unknown) => (typeof x === 'string' && x.length <= 200 ? x : undefined);
      const r = this.stanza.entraGiocatore({ nickname: str(d.nickname), token: str(d.token), idDispositivo: str(d.idDispositivo) });
      if (!r.ok) return rispondi(r);
      c.idGiocatore = r.sessione.idGiocatore;
      if (r.sessione.idDispositivo) await this.caricaProfilo(r.sessione.idDispositivo, r.nickname, r.nuovo);
      rispondi({ ok: true, idGiocatore: r.sessione.idGiocatore, token: r.sessione.token });
      this.salva();
      this.diffondi();
      return;
    }

    if (m.t === 'comando') {
      if (!c.idGiocatore) return rispondi({ ok: false, errore: 'Prima entra nella partita.' });
      const comando = validaComando(m.comando);
      if (!comando) return rispondi({ ok: false, errore: 'Comando non valido.' });
      const r = this.stanza.comando(giocatore(c.idGiocatore), comando);
      if (!r.ok) return rispondi(r);
      rispondi({ ok: true });
      await this.dopoComando(r);
    }
  }

  private async dopoComando(r: Extract<EsitoComandoStanza, { ok: true }>): Promise<void> {
    for (const id of r.espulsi) {
      for (const [canale, c] of this.collegamenti) {
        if (c.idGiocatore !== id) continue;
        canale.invia({ t: 'espulso' });
        c.idGiocatore = null;
      }
    }
    for (const e of r.eventi) {
      if (e.tipo !== 'chiamata' || e.finto) continue;
      for (const [canale, c] of this.collegamenti) if (c.idGiocatore && e.giocatori.includes(c.idGiocatore)) canale.invia({ t: 'chiamata' });
    }
    if (r.appenaFinita) await this.registraFine();
    this.salva();
    this.diffondi();
  }

  // ——— Viste ———

  private connessi(): Record<IdGiocatore, boolean> {
    const online = new Set([...this.collegamenti.values()].map((c) => c.idGiocatore).filter(Boolean));
    return Object.fromEntries(this.stanza.stato.giocatori.map((g) => [g.id, online.has(g.id)]));
  }

  /** Manda a ognuno la sua vista: al Master tutto, agli ospiti solo ciò che devono sapere. */
  diffondi(): void {
    const connessi = this.connessi();
    this.em.vista(this.stanza.pacchetto(MASTER, connessi));
    for (const [canale, c] of this.collegamenti) {
      if (!c.idGiocatore || !this.stanza.stato.giocatori.some((g) => g.id === c.idGiocatore)) continue;
      const p = this.stanza.pacchetto(giocatore(c.idGiocatore), connessi);
      const ses = [...this.stanza.sessioni.values()].find((s) => s.idGiocatore === c.idGiocatore);
      const prof = ses?.idDispositivo ? this.profili.get(ses.idDispositivo) : undefined;
      canale.invia({ t: 'vista', p: { ...p, profilo: prof ? { partite: prof.partite, vittorie: prof.vittorie } : null } });
    }
  }

  // ——— Salvataggi, profili, storico ———

  private salva(): void {
    if (this.salvataggio) return;
    this.salvataggio = setTimeout(() => void this.salvaSubito(), 300);
  }

  async salvaSubito(): Promise<void> {
    if (this.salvataggio) clearTimeout(this.salvataggio);
    this.salvataggio = null;
    await this.archivio.salvaPartita(this.stanza.codice, this.stanza.serializza());
  }

  private async caricaProfilo(idDispositivo: string, nickname: string, nuovo: boolean): Promise<void> {
    let p = this.profili.get(idDispositivo) ?? (await this.archivio.profilo(idDispositivo));
    p ??= { nickname, partite: 0, vittorie: {} };
    if (nuovo) p = { ...p, nickname };
    this.profili.set(idDispositivo, p);
    await this.archivio.salvaProfilo(idDispositivo, p);
  }

  private async registraFine(): Promise<void> {
    const s = this.stanza.stato;
    await this.archivio.aggiungiStorico({
      codice: this.codice, iniziata: this.stanza.iniziata ?? this.stanza.creata, finita: this.ora(), vittoria: s.vittoria,
      giocatori: s.giocatori.map((g) => ({ nome: g.nome, ruolo: g.ruolo, vivo: g.vivo })), log: s.log,
    });
    for (const e of this.stanza.esitiPerDispositivo()) {
      const p = this.profili.get(e.idDispositivo) ?? (await this.archivio.profilo(e.idDispositivo)) ?? { nickname: e.nickname, partite: 0, vittorie: {} };
      const vittorie = { ...p.vittorie };
      if (e.vinto) vittorie[e.fazione] = (vittorie[e.fazione] ?? 0) + 1;
      const nuovo = { nickname: e.nickname, partite: p.partite + 1, vittorie };
      this.profili.set(e.idDispositivo, nuovo);
      await this.archivio.salvaProfilo(e.idDispositivo, nuovo);
    }
  }
}
