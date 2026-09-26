import type { AddressInfo } from 'node:net';
import { expect } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type {
  Comando, ComandoTimer, EventiClientServer, EventiServerClient, Esito, PacchettoVista, RispostaEntra, StanzaCreata,
  VistaGiocatore, VistaMaster,
} from '@lupus/engine';
import { creaServer, type OpzioniServer, type ServerAvviato } from '../src/app.js';

export async function attendi(cond: () => boolean, ms = 2000, msg = 'condizione non raggiunta'): Promise<void> {
  const fine = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fine) throw new Error(`Timeout: ${msg}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

export class Client {
  socket: Socket<EventiServerClient, EventiClientServer>;
  pacchetti: PacchettoVista[] = [];
  chiamate = 0;
  espulso = false;
  token?: string;
  idGiocatore?: string;

  constructor(url: string) {
    this.socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    this.socket.on('vista', (p) => this.pacchetti.push(p));
    this.socket.on('chiamata', () => this.chiamate++);
    this.socket.on('espulso', () => (this.espulso = true));
  }

  get ultimo(): PacchettoVista | undefined {
    return this.pacchetti[this.pacchetti.length - 1];
  }
  get vistaGiocatore(): VistaGiocatore {
    return this.ultimo!.vista as VistaGiocatore;
  }
  get vistaMaster(): VistaMaster {
    return this.ultimo!.vista as VistaMaster;
  }

  async connesso(): Promise<this> {
    if (!this.socket.connected) await new Promise<void>((r) => this.socket.once('connect', () => r()));
    return this;
  }

  async entra(codice: string, nickname?: string, extra: { token?: string; idDispositivo?: string } = {}): Promise<RispostaEntra> {
    await this.connesso();
    const r = await this.socket.emitWithAck('entra', { codice, nickname, ...extra });
    if (r.ok) {
      this.token = r.token;
      this.idGiocatore = r.idGiocatore;
    }
    return r;
  }

  async master(codice: string, tokenMaster: string): Promise<Esito> {
    await this.connesso();
    return this.socket.emitWithAck('master:entra', { codice, tokenMaster });
  }

  async comando(c: Comando): Promise<Esito> {
    return this.socket.emitWithAck('comando', c);
  }

  /** Comando che deve riuscire. */
  async ok(c: Comando): Promise<void> {
    const r = await this.comando(c);
    if (!r.ok) throw new Error(`${c.tipo}: ${r.errore}`);
  }

  async timer(c: ComandoTimer): Promise<Esito> {
    return this.socket.emitWithAck('master:timer', c);
  }

  /** Attende una vista che soddisfi la condizione. */
  async attendiVista(cond: (p: PacchettoVista) => boolean, msg?: string): Promise<PacchettoVista> {
    await attendi(() => !!this.ultimo && cond(this.ultimo), 2000, msg);
    return this.ultimo!;
  }

  chiudi(): void {
    this.socket.disconnect();
  }
}

export interface Ambiente {
  srv: ServerAvviato;
  url: string;
  client: () => Client;
  creaStanza: () => Promise<StanzaCreata>;
  chiudi: () => Promise<void>;
}

export async function avvia(opz: Partial<OpzioniServer> = {}): Promise<Ambiente> {
  const srv = await creaServer({ percorsoDb: ':memory:', ritardoSalvataggio: 0, eventiAlSecondo: 1000, ...opz });
  await srv.app.listen({ port: 0, host: '127.0.0.1' });
  const url = `http://127.0.0.1:${(srv.app.server.address() as AddressInfo).port}`;
  const clienti: Client[] = [];
  return {
    srv, url,
    client: () => {
      const c = new Client(url);
      clienti.push(c);
      return c;
    },
    creaStanza: async () => (await (await fetch(`${url}/api/stanze`, { method: 'POST' })).json()) as StanzaCreata,
    chiudi: async () => {
      for (const c of clienti) c.chiudi();
      await srv.chiudi();
    },
  };
}

/** Stanza con Master collegato e `n` giocatori entrati. */
export async function stanzaConGiocatori(amb: Ambiente, n: number, opz: { idDispositivo?: boolean } = {}) {
  const { codice, tokenMaster } = await amb.creaStanza();
  const master = amb.client();
  expect((await master.master(codice, tokenMaster)).ok).toBe(true);
  const giocatori: Client[] = [];
  for (let i = 0; i < n; i++) {
    const c = amb.client();
    const r = await c.entra(codice, `Giocatore${i + 1}`, opz.idDispositivo ? { idDispositivo: `dispositivo-${i + 1}-abcdef` } : {});
    if (!r.ok) throw new Error(r.errore);
    giocatori.push(c);
  }
  await master.attendiVista((p) => p.vista.giocatori.length === n);
  return { codice, tokenMaster, master, giocatori };
}
