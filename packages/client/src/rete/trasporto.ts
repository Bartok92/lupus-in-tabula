import type { Comando, ComandoTimer, Esito, MessaggioHost, MessaggioOspite, PacchettoVista, RispostaEntra } from '@lupus/engine';

// Un "trasporto" collega l'interfaccia alla partita, ovunque sia ospitata:
// - sul server Node (Socket.IO), per rete locale o cloud;
// - sul telefono del Master (collegamento diretto WebRTC), per giocare ovunque senza server.

export interface Ascoltatori {
  vista: (p: PacchettoVista) => void;
  chiamata: () => void;
  espulso: () => void;
  connessione: (connesso: boolean) => void;
}

export interface DatiIngresso {
  nickname?: string;
  token?: string;
  idDispositivo?: string;
}

export interface Trasporto {
  readonly tipo: 'server' | 'host' | 'ospite';
  ascolta(a: Partial<Ascoltatori>): void;
  entraComeMaster(codice: string, tokenMaster: string): Promise<Esito>;
  entraComeGiocatore(codice: string, dati: DatiIngresso): Promise<RispostaEntra>;
  comando(c: Comando): Promise<Esito>;
  timer(c: ComandoTimer): Promise<Esito>;
  chiudi(): void;
}

/** Canale di messaggi verso un altro telefono (una connessione WebRTC, oppure finta nei test). */
export interface Canale<In, Out> {
  invia(m: Out): void;
  suMessaggio(cb: (m: In) => void): void;
  suChiusura(cb: () => void): void;
  chiudi(): void;
}

export type CanaleVersoOspite = Canale<MessaggioOspite, MessaggioHost>;
export type CanaleVersoHost = Canale<MessaggioHost, MessaggioOspite>;

/** Emettitore minimo di eventi, condiviso dai trasporti. */
export class Emettitore {
  private a: Partial<Ascoltatori> = {};
  ascolta(a: Partial<Ascoltatori>): void {
    this.a = { ...this.a, ...a };
  }
  vista(p: PacchettoVista): void {
    this.a.vista?.(p);
  }
  chiamata(): void {
    this.a.chiamata?.();
  }
  espulso(): void {
    this.a.espulso?.();
  }
  connessione(c: boolean): void {
    this.a.connessione?.(c);
  }
}
