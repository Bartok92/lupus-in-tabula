import type { Fazione } from '@lupus/engine';
import { IconaCampana } from './icone';
import { Illustrazione } from './illustrazioni';

/** Rogo: pira di legna con fiamme animate. */
export function Fiamme({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <radialGradient id="bagliore-rogo">
          <stop offset="0" stopColor="#ff8a3d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="alone" cx="100" cy="120" r="95" fill="url(#bagliore-rogo)" />
      <path className="fiamma" d="M100 30 C130 70 150 95 140 130 C134 152 118 162 100 162 C82 162 66 152 60 130 C50 95 70 70 100 30 Z" fill="#9e1b1b" />
      <path className="fiamma" style={{ animationDelay: '-0.3s' }} d="M100 58 C122 88 134 108 126 134 C121 150 111 158 100 158 C89 158 79 150 74 134 C66 108 78 88 100 58 Z" fill="#e8622a" />
      <path className="fiamma" style={{ animationDelay: '-0.55s' }} d="M100 88 C114 108 120 122 115 138 C112 149 106 154 100 154 C94 154 88 149 85 138 C80 122 86 108 100 88 Z" fill="#ffc94d" />
      <g fill="#5b3a1e" stroke="#2a1c0d" strokeWidth="2">
        <rect x="40" y="158" width="120" height="12" rx="6" transform="rotate(-8 100 164)" />
        <rect x="40" y="158" width="120" height="12" rx="6" transform="rotate(8 100 164)" />
        <rect x="55" y="170" width="90" height="11" rx="5.5" />
      </g>
    </svg>
  );
}

// Colori presi dai token del tema: leggibili sia sul cielo notturno sia sulla pergamena.
const SCENE: Record<Fazione, { titolo: string; sottotitolo: string; classe: string }> = {
  lupi: { titolo: 'I lupi hanno vinto', sottotitolo: 'L\'ululato si alza sul villaggio deserto.', classe: 'text-pericolo' },
  villaggio: { titolo: 'Il villaggio ha vinto', sottotitolo: 'Le campane suonano a festa: i lupi non ci sono più.', classe: 'text-accento' },
  criceto: { titolo: 'Vince il Criceto mannaro!', sottotitolo: 'Vi ha beffati tutti, lupi e villici.', classe: 'text-criceto' },
  personalizzata: { titolo: 'Partita conclusa', sottotitolo: 'Il Master ha deciso l\'esito.', classe: 'text-testo-tenue' },
};

/** Scena di vittoria, diversa per ogni fazione. */
export function ScenaVittoria({ fazione, hoVinto }: { fazione: Fazione; hoVinto?: boolean }) {
  const s = SCENE[fazione];
  return (
    <div className="compari flex flex-col items-center gap-3 text-center">
      <div className="relative h-44 w-44">
        {fazione === 'lupi' && (
          <>
            <div className="alone absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgb(158_27_27/0.7),transparent_70%)]" />
            <Illustrazione id="lupo" className="relative h-full w-full rounded-full border-2 border-sangue-chiaro/60" />
          </>
        )}
        {fazione === 'villaggio' && (
          <div className="flex h-full items-center justify-center gap-4 text-accento">
            <IconaCampana className="oscilla" width={72} height={72} />
            <IconaCampana className="oscilla" style={{ animationDelay: '-0.65s' }} width={88} height={88} />
          </div>
        )}
        {fazione === 'criceto' && (
          <div className="saltella h-full w-full">
            <Illustrazione id="criceto" className="h-full w-full rounded-full border-2 border-[#c9a7ff]/60" />
          </div>
        )}
        {fazione === 'personalizzata' && <Illustrazione id="notte" className="h-full w-full rounded-full" />}
      </div>
      <h2 className={`font-titolo text-[1.9rem] leading-tight drop-shadow-[0_0_14px_rgb(0_0_0/0.25)] ${s.classe}`}>{s.titolo}</h2>
      <p className="text-testo-tenue">{s.sottotitolo}</p>
      {hoVinto !== undefined && (
        <p className={`font-maiuscolo text-lg font-bold uppercase tracking-[0.2em] ${hoVinto ? 'text-accento' : 'text-testo-tenue'}`}>{hoVinto ? 'Hai vinto!' : 'Hai perso'}</p>
      )}
    </div>
  );
}
