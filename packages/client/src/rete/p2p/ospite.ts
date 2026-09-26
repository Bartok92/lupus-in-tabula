import type { Comando, ComandoTimer, Esito, MessaggioHost, RispostaEntra } from '@lupus/engine';
import { Emettitore, type Ascoltatori, type CanaleVersoHost, type DatiIngresso, type Trasporto } from '../trasporto';

// Il telefono di un amico: si collega direttamente al telefono del Master.
// Se la connessione cade (schermo bloccato, rete ballerina) ci riprova da solo.

export type Connettore = (codice: string) => Promise<CanaleVersoHost>;

const ATTESA_RISPOSTA_MS = 10_000;
const RIPROVA_MS = 2_500;

export class TrasportoOspite implements Trasporto {
  readonly tipo = 'ospite';
  private em = new Emettitore();
  private canale: CanaleVersoHost | null = null;
  private prossimoId = 1;
  private inAttesa = new Map<number, (r: Esito | RispostaEntra) => void>();
  private coda: (() => void)[] = [];
  private chiuso = false;
  private riprova: ReturnType<typeof setTimeout> | null = null;
  /** Ultimo motivo per cui non si riesce a collegarsi (per l'interfaccia). */
  ultimoErrore: string | null = null;

  constructor(private codice: string, private connetti: Connettore, private riprovaMs = RIPROVA_MS) {
    void this.collega();
  }

  get codicePartita(): string {
    return this.codice;
  }

  ascolta(a: Partial<Ascoltatori>): void {
    this.em.ascolta(a);
    a.connessione?.(!!this.canale);
  }

  private async collega(): Promise<void> {
    if (this.chiuso) return;
    try {
      const canale = await this.connetti(this.codice);
      if (this.chiuso) return canale.chiudi();
      this.canale = canale;
      this.ultimoErrore = null;
      canale.suMessaggio((m) => this.suMessaggio(m));
      canale.suChiusura(() => {
        if (this.canale !== canale) return;
        this.canale = null;
        this.em.connessione(false);
        this.programmaRiprova();
      });
      this.em.connessione(true);
      for (const f of this.coda.splice(0)) f();
    } catch (e) {
      this.ultimoErrore = (e as Error).message;
      this.em.connessione(false);
      this.programmaRiprova();
    }
  }

  private programmaRiprova(): void {
    if (this.chiuso || this.riprova) return;
    this.riprova = setTimeout(() => {
      this.riprova = null;
      void this.collega();
    }, this.riprovaMs);
  }

  private suMessaggio(m: MessaggioHost): void {
    if (m.t === 'risposta') {
      this.inAttesa.get(m.id)?.(m.r);
      this.inAttesa.delete(m.id);
    } else if (m.t === 'vista') this.em.vista(m.p);
    else if (m.t === 'chiamata') this.em.chiamata();
    else if (m.t === 'espulso') this.em.espulso();
  }

  /** Invia una richiesta e aspetta la risposta del Master (anche se prima serve ricollegarsi). */
  private richiesta<R extends Esito | RispostaEntra>(costruisci: (id: number) => Parameters<CanaleVersoHost['invia']>[0]): Promise<R> {
    return new Promise<R>((risolvi) => {
      const id = this.prossimoId++;
      const scadenza = setTimeout(() => {
        this.inAttesa.delete(id);
        risolvi({ ok: false, errore: this.ultimoErrore ?? 'Il telefono del Master non risponde.' } as R);
      }, ATTESA_RISPOSTA_MS);
      this.inAttesa.set(id, (r) => {
        clearTimeout(scadenza);
        risolvi(r as R);
      });
      const invia = () => this.canale?.invia(costruisci(id));
      if (this.canale) invia();
      else this.coda.push(invia);
    });
  }

  entraComeGiocatore(_codice: string, dati: DatiIngresso): Promise<RispostaEntra> {
    return this.richiesta<RispostaEntra>((id) => ({ t: 'entra', id, dati }));
  }

  comando(c: Comando): Promise<Esito> {
    return this.richiesta<Esito>((id) => ({ t: 'comando', id, comando: c }));
  }

  async entraComeMaster(): Promise<Esito> {
    return { ok: false, errore: 'La partita è sul telefono del Master.' };
  }

  async timer(_c: ComandoTimer): Promise<Esito> {
    return { ok: false, errore: 'Solo il Master può usare il timer.' };
  }

  chiudi(): void {
    this.chiuso = true;
    if (this.riprova) clearTimeout(this.riprova);
    this.canale?.chiudi();
    this.canale = null;
  }
}
