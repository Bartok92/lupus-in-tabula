// Suoni sintetizzati al volo con Web Audio: niente file, niente diritti d'autore.
// Sui telefoni dei giocatori restano spenti di default (non devono tradire chi viene chiamato).

export type Suono = 'ululato' | 'gallo' | 'campana';

type FinestraAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
let ctx: AudioContext | null = null;

function contesto(): AudioContext | null {
  try {
    const C = window.AudioContext ?? (window as FinestraAudio).webkitAudioContext;
    if (!C) return null;
    ctx ??= new C();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Da chiamare dopo un tocco dell'utente: i browser avviano l'audio solo dopo un gesto. */
export function sbloccaAudio(): void {
  contesto();
}

export function suona(tipo: Suono): void {
  const c = contesto();
  if (!c) return;
  const t = c.currentTime + 0.05;
  const uscita = c.createGain();
  uscita.gain.value = 0.35;
  uscita.connect(c.destination);

  if (tipo === 'ululato') {
    const filtro = c.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 1100;
    filtro.connect(uscita);
    for (const [forma, molt, vol] of [['sawtooth', 1, 0.25], ['sine', 0.5, 0.5]] as const) {
      const o = c.createOscillator();
      const g = c.createGain();
      const lfo = c.createOscillator();
      const lfoG = c.createGain();
      o.type = forma;
      o.frequency.setValueAtTime(260 * molt, t);
      o.frequency.linearRampToValueAtTime(540 * molt, t + 0.9);
      o.frequency.linearRampToValueAtTime(480 * molt, t + 2);
      o.frequency.linearRampToValueAtTime(300 * molt, t + 2.8);
      lfo.frequency.value = 5.5;
      lfoG.gain.value = 9 * molt;
      lfo.connect(lfoG).connect(o.frequency);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.4);
      g.gain.setValueAtTime(vol, t + 2.2);
      g.gain.linearRampToValueAtTime(0, t + 2.9);
      o.connect(g).connect(filtro);
      o.start(t);
      lfo.start(t);
      o.stop(t + 3);
      lfo.stop(t + 3);
    }
  }

  if (tipo === 'gallo') {
    const note: [number, number, number][] = [[620, 0, 0.12], [820, 0.16, 0.12], [980, 0.32, 0.14], [1150, 0.5, 0.7]];
    for (const [f, inizio, durata] of note) {
      const o = c.createOscillator();
      const g = c.createGain();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 1.5;
      bp.Q.value = 2;
      o.type = 'square';
      o.frequency.setValueAtTime(f, t + inizio);
      if (durata > 0.3) o.frequency.linearRampToValueAtTime(f * 0.78, t + inizio + durata);
      g.gain.setValueAtTime(0, t + inizio);
      g.gain.linearRampToValueAtTime(0.3, t + inizio + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + inizio + durata);
      o.connect(bp).connect(g).connect(uscita);
      o.start(t + inizio);
      o.stop(t + inizio + durata + 0.05);
    }
  }

  if (tipo === 'campana') {
    for (const colpo of [0, 0.9]) {
      for (const [rapporto, vol] of [[1, 0.5], [2, 0.25], [2.76, 0.18], [5.4, 0.08]] as const) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = 392 * rapporto;
        g.gain.setValueAtTime(vol, t + colpo);
        g.gain.exponentialRampToValueAtTime(0.001, t + colpo + 2.4 / rapporto ** 0.3);
        o.connect(g).connect(uscita);
        o.start(t + colpo);
        o.stop(t + colpo + 2.6);
      }
    }
  }
}
