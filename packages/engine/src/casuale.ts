import type { Casuale } from './tipi.js';

/**
 * Generatore deterministico (mulberry32) per test e partite riproducibili.
 * In partita vera si usa `casualeSicuro`.
 */
export function casualeDaSeme(seme: number): Casuale {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generatore crittograficamente sicuro (Web Crypto: disponibile in Node ≥19 e nei browser). */
export function casualeSicuro(): Casuale {
  const buf = new Uint32Array(1);
  return () => {
    (globalThis as unknown as { crypto: { getRandomValues(a: Uint32Array): void } }).crypto.getRandomValues(buf);
    return buf[0]! / 4294967296;
  };
}

/** Mescolamento Fisher–Yates. Non modifica l'array originale. */
export function mescola<T>(elementi: readonly T[], casuale: Casuale): T[] {
  const out = [...elementi];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(casuale() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
