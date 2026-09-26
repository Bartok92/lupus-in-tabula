// Memoria locale del dispositivo. localStorage può mancare o lanciare eccezioni
// (navigazione privata, dati bloccati): ogni accesso è protetto.

function leggi<T>(chiave: string, predefinito: T): T {
  try {
    const v = localStorage.getItem(chiave);
    return v ? (JSON.parse(v) as T) : predefinito;
  } catch {
    return predefinito;
  }
}

function scrivi(chiave: string, valore: unknown): void {
  try {
    localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {
    // niente memoria: si continua senza
  }
}

/** Id casuale. crypto.randomUUID esiste solo in contesti sicuri (HTTPS), getRandomValues ovunque. */
function idCasuale(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
}

const K = {
  dispositivo: 'lupus.dispositivo',
  sessioni: 'lupus.sessioni',
  master: 'lupus.master',
  nickname: 'lupus.nickname',
};

export const archivio = {
  idDispositivo(): string {
    let id = leggi<string | null>(K.dispositivo, null);
    if (!id) scrivi(K.dispositivo, (id = idCasuale()));
    return id;
  },

  tokenGiocatore(codice: string): string | undefined {
    return leggi<Record<string, string>>(K.sessioni, {})[codice];
  },
  salvaTokenGiocatore(codice: string, token: string): void {
    scrivi(K.sessioni, { ...leggi<Record<string, string>>(K.sessioni, {}), [codice]: token });
  },
  dimenticaGiocatore(codice: string): void {
    const s = leggi<Record<string, string>>(K.sessioni, {});
    delete s[codice];
    scrivi(K.sessioni, s);
  },

  tokenMaster(codice: string): string | undefined {
    return leggi<Record<string, string>>(K.master, {})[codice];
  },
  salvaTokenMaster(codice: string, token: string): void {
    scrivi(K.master, { ...leggi<Record<string, string>>(K.master, {}), [codice]: token });
  },

  ultimoNickname(): string {
    return leggi(K.nickname, '');
  },
  salvaNickname(n: string): void {
    scrivi(K.nickname, n);
  },
};
