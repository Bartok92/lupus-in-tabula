import { io, type Socket } from 'socket.io-client';
import type { Comando, ComandoTimer, EventiClientServer, EventiServerClient, Esito, RispostaEntra } from '@lupus/engine';
import { Emettitore, type Ascoltatori, type DatiIngresso, type Trasporto } from './trasporto';

type SocketLupus = Socket<EventiServerClient, EventiClientServer>;

const NON_RISPONDE = { ok: false as const, errore: 'Il server non risponde.' };

/** Partita ospitata dal server Node (rete locale o cloud). */
export class TrasportoSocket implements Trasporto {
  readonly tipo = 'server';
  private socket: SocketLupus;
  private em = new Emettitore();

  constructor() {
    this.socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 });
    this.socket.on('connect', () => this.em.connessione(true));
    this.socket.on('disconnect', () => this.em.connessione(false));
    this.socket.on('vista', (p) => this.em.vista(p));
    this.socket.on('chiamata', () => this.em.chiamata());
    this.socket.on('espulso', () => this.em.espulso());
  }

  ascolta(a: Partial<Ascoltatori>): void {
    this.em.ascolta(a);
    if (this.socket.connected) a.connessione?.(true);
  }

  async entraComeMaster(codice: string, tokenMaster: string): Promise<Esito> {
    return this.socket.timeout(8000).emitWithAck('master:entra', { codice, tokenMaster }).catch(() => NON_RISPONDE);
  }

  async entraComeGiocatore(codice: string, dati: DatiIngresso): Promise<RispostaEntra> {
    return this.socket.timeout(8000).emitWithAck('entra', { codice, ...dati }).catch(() => NON_RISPONDE);
  }

  async comando(c: Comando): Promise<Esito> {
    return this.socket.timeout(8000).emitWithAck('comando', c).catch(() => NON_RISPONDE);
  }

  async timer(c: ComandoTimer): Promise<Esito> {
    return this.socket.timeout(8000).emitWithAck('master:timer', c).catch(() => NON_RISPONDE);
  }

  chiudi(): void {
    this.socket.disconnect();
  }
}
