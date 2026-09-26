import { expect } from 'vitest';
import {
  applica, casualeDaSeme, creaPartita, giocatore, IMPOSTAZIONI_DEFAULT, MASTER, trovaGiocatore, unisciImpostazioni, vistaPer,
  type Attore, type Comando, type EventoMotore, type ImpostazioniParziali, type StatoPartita, type VistaGiocatore,
} from '../src/index.js';

/**
 * Tavolo di prova: i giocatori hanno come id il loro nome e ricevono esattamente il ruolo indicato
 * (niente mescolamento), così gli scenari sono leggibili.
 */
export class Tavolo {
  s: StatoPartita;
  casuale = casualeDaSeme(1234);

  constructor(ruoli: Record<string, string>, imp: ImpostazioniParziali = {}) {
    this.s = creaPartita(unisciImpostazioni(IMPOSTAZIONI_DEFAULT, imp));
    const composizione: Record<string, number> = {};
    for (const [nome, ruolo] of Object.entries(ruoli)) {
      this.m({ tipo: 'aggiungiGiocatore', id: nome, nome });
      composizione[ruolo] = (composizione[ruolo] ?? 0) + 1;
    }
    this.m({ tipo: 'impostaComposizione', composizione });
    this.m({ tipo: 'avviaPartita' });
    // Sostituisce l'assegnazione casuale con quella voluta dal test.
    for (const g of this.s.giocatori) g.ruolo = g.ruoloIniziale = ruoli[g.id]!;
    for (const g of this.s.giocatori) this.g(g.id, { tipo: 'confermaVisto' });
  }

  esegui(attore: Attore, c: Comando): EventoMotore[] {
    const r = applica(this.s, attore, c, this.casuale);
    if (!r.ok) throw new Error(`Comando ${c.tipo} rifiutato: ${r.errore}`);
    this.s = r.stato;
    return r.eventi;
  }

  m(c: Comando): EventoMotore[] {
    return this.esegui(MASTER, c);
  }

  g(nome: string, c: Comando): EventoMotore[] {
    return this.esegui(giocatore(nome), c);
  }

  /** Il comando deve fallire: restituisce il messaggio d'errore. */
  rifiuta(attore: Attore, c: Comando): string {
    const r = applica(this.s, attore, c, this.casuale);
    expect(r.ok, `il comando ${c.tipo} doveva essere rifiutato`).toBe(false);
    return r.ok ? '' : r.errore;
  }

  /**
   * Gioca una notte intera: chiama tutti i passi e fa agire i giocatori indicati.
   * `azioni`: nome → bersaglio. Per i lupi basta indicarne uno (gli altri votano uguale).
   */
  notte(azioni: Record<string, string | null> = {}, opz: { conferma?: boolean } = {}): void {
    this.iniziaNotteERiconosci(azioni);
    this.m({ tipo: 'terminaNotte' });
    if (opz.conferma !== false) this.m({ tipo: 'confermaAlba' });
  }

  iniziaNotteERiconosci(azioni: Record<string, string | null> = {}): void {
    this.m({ tipo: 'iniziaNotte' });
    const notte = this.s.notte!;
    for (let i = 0; i < notte.passi.length; i++) {
      this.m({ tipo: 'chiamaProssimoPasso' });
      const passo = this.s.notte!.passi[i]!;
      if (passo.tipo !== 'bersaglio') continue;
      const comune = passo.effetto === 'uccidi_branco' ? passo.attori.map((a) => azioni[a]).find((x) => x !== undefined) : undefined;
      for (const a of passo.attori) {
        const b = a in azioni ? azioni[a] : comune;
        if (b !== undefined) this.g(a, { tipo: 'azioneNotturna', bersaglio: b });
      }
    }
  }

  /** Giorno completo: nomination con i voti dati, ballottaggio con i voti dati, rogo. */
  giorno(nomination: Record<string, string | null>, ballottaggio: Record<string, string | null>): void {
    this.m({ tipo: 'iniziaDiscussione' });
    this.m({ tipo: 'apriNomination' });
    for (const [da, a] of Object.entries(nomination)) this.g(da, { tipo: 'voto', bersaglio: a });
    this.m({ tipo: 'chiudiVotazione' });
    this.m({ tipo: 'avviaBallottaggio' });
    this.m({ tipo: 'apriVotoBallottaggio' });
    for (const [da, a] of Object.entries(ballottaggio)) this.g(da, { tipo: 'voto', bersaglio: a });
    this.m({ tipo: 'chiudiVotazione' });
    this.m({ tipo: 'eseguiRogo' });
  }

  vivo(nome: string): boolean {
    return trovaGiocatore(this.s, nome)!.vivo;
  }

  ruolo(nome: string): string | null {
    return trovaGiocatore(this.s, nome)!.ruolo;
  }

  vista(nome: string): VistaGiocatore {
    return vistaPer(this.s, giocatore(nome)) as VistaGiocatore;
  }
}

/** 10 giocatori, set base tipico. */
export const DIECI = {
  Lupo1: 'lupo', Lupo2: 'lupo', Veggente: 'veggente', Guardia: 'guardia', Medium: 'medium',
  Indemoniato: 'indemoniato', Villico1: 'villico', Villico2: 'villico', Villico3: 'villico', Villico4: 'villico',
};
