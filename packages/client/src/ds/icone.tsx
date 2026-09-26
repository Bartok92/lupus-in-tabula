import type { SVGProps } from 'react';

// Icone disegnate a mano, a tratto, 24×24. Ereditano il colore dal testo.

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const IconaLuna = (p: P) => <svg {...base(p)}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor" stroke="none" /></svg>;
export const IconaSole = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4.5" fill="currentColor" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>
);
export const IconaSpunta = (p: P) => <svg {...base(p)}><path d="M4.5 12.5l5 5L19.5 7" /></svg>;
export const IconaTeschio = (p: P) => (
  <svg {...base(p)}><path d="M12 3a7.5 7.5 0 0 0-4.5 13.5V20h9v-3.5A7.5 7.5 0 0 0 12 3Z" /><circle cx="9.3" cy="11.5" r="1.6" fill="currentColor" /><circle cx="14.7" cy="11.5" r="1.6" fill="currentColor" /><path d="M10.5 20v-2M13.5 20v-2" /></svg>
);
export const IconaAnnulla = (p: P) => <svg {...base(p)}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>;
export const IconaOcchio = (p: P) => <svg {...base(p)}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
export const IconaScudo = (p: P) => <svg {...base(p)}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6Z" /></svg>;
export const IconaZampa = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><ellipse cx="12" cy="16" rx="4.5" ry="3.8" /><circle cx="6.5" cy="10.5" r="2" /><circle cx="17.5" cy="10.5" r="2" /><circle cx="9.5" cy="6.5" r="2" /><circle cx="14.5" cy="6.5" r="2" /></svg>
);
export const IconaCampana = (p: P) => <svg {...base(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
export const IconaFiamma = (p: P) => <svg {...base(p)}><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.3 3.6-8.3.6 1.9 1.6 2.9 2.7 3.4-.2-2.8.9-5.2 3-6.9-.2 3.2 3.7 5.5 3.7 11.3C18.5 18.4 15.9 21 12 21Z" /></svg>;
export const IconaGufo = (p: P) => <svg {...base(p)}><path d="M6 5l2.5 2.5h7L18 5v9a6 6 0 0 1-12 0Z" /><circle cx="9.5" cy="11" r="1.7" fill="currentColor" /><circle cx="14.5" cy="11" r="1.7" fill="currentColor" /></svg>;
export const IconaWifi = (p: P) => <svg {...base(p)}><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a4.7 4.7 0 0 1 6.4 0" /><circle cx="12" cy="19.2" r="1.1" fill="currentColor" /></svg>;
