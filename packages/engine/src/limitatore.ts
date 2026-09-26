/**
 * Limitatore a "secchio di gettoni": ogni chiave ha al massimo `capacita` gettoni,
 * che si ricaricano al ritmo di `ricaricaAlSecondo`. Ogni richiesta consuma un gettone.
 */
export class Limitatore {
  private secchi = new Map<string, { gettoni: number; ultimo: number }>();

  constructor(
    private capacita: number,
    private ricaricaAlSecondo: number,
    private ora: () => number = Date.now,
  ) {}

  consuma(chiave: string): boolean {
    const adesso = this.ora();
    const s = this.secchi.get(chiave) ?? { gettoni: this.capacita, ultimo: adesso };
    s.gettoni = Math.min(this.capacita, s.gettoni + ((adesso - s.ultimo) / 1000) * this.ricaricaAlSecondo);
    s.ultimo = adesso;
    const ok = s.gettoni >= 1;
    if (ok) s.gettoni -= 1;
    this.secchi.set(chiave, s);
    return ok;
  }

  /** Ha ancora gettoni? (senza consumarne) */
  disponibile(chiave: string): boolean {
    const s = this.secchi.get(chiave);
    if (!s) return true;
    return s.gettoni + ((this.ora() - s.ultimo) / 1000) * this.ricaricaAlSecondo >= 1;
  }

  /** Elimina le chiavi tornate piene, per non accumulare memoria. */
  pulisci(): void {
    const adesso = this.ora();
    for (const [k, s] of this.secchi)
      if (s.gettoni + ((adesso - s.ultimo) / 1000) * this.ricaricaAlSecondo >= this.capacita) this.secchi.delete(k);
  }
}
