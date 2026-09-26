import { useState } from 'react';
import type { Fazione } from '@lupus/engine';
import { DorsoCarta, Illustrazione } from './illustrazioni';

export interface DatiCarta {
  id: string;
  nome: string;
  fazione: Fazione;
  descrizione: string;
  immagine?: string;
}

export const COLORE_FAZIONE: Record<Fazione, { nome: string; colore: string }> = {
  villaggio: { nome: 'Villaggio', colore: '#f0d47a' },
  lupi: { nome: 'Lupi', colore: '#e67a7a' },
  criceto: { nome: 'Solitario', colore: '#c9a7ff' },
  personalizzata: { nome: 'Speciale', colore: '#aeb7cc' },
};

/** Classe del colore di fazione leggibile sia di notte sia di giorno (per testi fuori dalle carte). */
export const CLASSE_FAZIONE: Record<Fazione, string> = {
  villaggio: 'text-accento',
  lupi: 'text-pericolo',
  criceto: 'text-criceto',
  personalizzata: 'text-testo-tenue',
};

function Angolo({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`absolute h-[9cqw] w-[9cqw] text-oro ${className}`} fill="none" stroke="currentColor" aria-hidden>
      <path d="M1.5 22.5V9Q1.5 1.5 9 1.5h13.5" strokeWidth="1.6" />
      <path d="M5.5 22.5V11q0-5.5 5.5-5.5h11.5" strokeWidth="0.8" opacity="0.6" />
      <circle cx="9.5" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Faccia della carta con illustrazione, nome, fazione e descrizione.
 * Tutte le misure sono in `cqw` (percentuale della larghezza della carta): la carta è identica a ogni dimensione.
 */
export function FronteCarta({ carta, immaginePersonale }: { carta: DatiCarta; immaginePersonale?: string }) {
  const f = COLORE_FAZIONE[carta.fazione];
  const nomeLungo = carta.nome.length > 13;
  const rombo = <span className="inline-block h-[1.6cqw] w-[1.6cqw] rotate-45" style={{ background: f.colore }} />;
  return (
    <div className="@container h-full w-full">
      <div className="relative flex h-full w-full flex-col rounded-[7cqw] border-2 border-oro/70 bg-linear-to-b from-notte-700 to-notte-950 p-[3.5cqw] shadow-[0_20px_50px_-15px_rgb(0_0_0/0.8)]">
        <div className="relative flex h-full flex-col rounded-[5cqw] border border-oro/35 px-[4cqw] pb-[4cqw] pt-[4cqw]">
          <Angolo className="left-[1cqw] top-[1cqw]" />
          <Angolo className="right-[1cqw] top-[1cqw] rotate-90" />
          <Angolo className="bottom-[1cqw] right-[1cqw] rotate-180" />
          <Angolo className="bottom-[1cqw] left-[1cqw] -rotate-90" />
          {/* finestra ad arco con l'illustrazione: prende tutto lo spazio libero */}
          <div className="relative mx-auto min-h-0 w-[86%] flex-1 overflow-hidden rounded-b-[3cqw] rounded-t-[999px] border-2 border-oro/60">
            {immaginePersonale ? (
              <img src={immaginePersonale} alt={carta.nome} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <Illustrazione id={carta.immagine ?? carta.id} nome={carta.nome} riempi className="absolute inset-0 h-full w-full" />
            )}
          </div>
          <div className="relative z-10 mx-auto -mt-[5cqw] max-w-full rounded-[1.5cqw] border border-oro/70 bg-linear-to-b from-[#2a1c0d] to-[#140d06] px-[4cqw] py-[1cqw] shadow-lg">
            <h3 className={`whitespace-nowrap text-center font-maiuscolo font-bold uppercase tracking-[0.1em] text-oro-chiaro ${nomeLungo ? 'text-[4.8cqw]' : 'text-[6cqw]'}`}>
              {carta.nome}
            </h3>
          </div>
          <p className="mt-[2.5cqw] flex items-center justify-center gap-[2cqw] font-maiuscolo text-[3.3cqw] uppercase tracking-[0.25em]" style={{ color: f.colore }}>
            {rombo} {f.nome} {rombo}
          </p>
          <p className="mt-[2cqw] line-clamp-4 text-center text-[4.6cqw] italic leading-snug text-luna/90">{carta.descrizione}</p>
        </div>
      </div>
    </div>
  );
}

/** Carta con dorso e fronte; `girata` = mostra la faccia. */
export function Carta({ carta, girata, className = '', immaginePersonale }: { carta: DatiCarta; girata: boolean; className?: string; immaginePersonale?: string }) {
  return (
    <div className={`carta-scena ${className}`}>
      <div className={`carta-interno aspect-[5/7] w-full ${girata ? 'girata' : ''}`}>
        <div className="carta-faccia overflow-hidden rounded-[22px] border-2 border-oro/60 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.8)]">
          <DorsoCarta className="h-full w-full" />
        </div>
        <div className="carta-faccia carta-fronte">
          <FronteCarta carta={carta} immaginePersonale={immaginePersonale} />
        </div>
      </div>
    </div>
  );
}

/** Carta segreta: si gira solo finché si tiene premuto il dito (anti-sbirciata). */
export function CartaSegreta({ carta, className = '', immaginePersonale }: { carta: DatiCarta; className?: string; immaginePersonale?: string }) {
  const [girata, setGirata] = useState(false);
  const giu = () => setGirata(true);
  const su = () => setGirata(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Tieni premuto per vedere la tua carta"
      aria-pressed={girata}
      onPointerDown={giu}
      onPointerUp={su}
      onPointerLeave={su}
      onPointerCancel={su}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && giu()}
      onKeyUp={su}
      onContextMenu={(e) => e.preventDefault()}
      className={`touch-none select-none [-webkit-touch-callout:none] ${className}`}
    >
      <Carta carta={carta} girata={girata} immaginePersonale={immaginePersonale} />
      <p className="mt-3 text-center text-[0.9rem] text-testo-tenue">{girata ? 'Lascia per coprirla' : 'Tieni premuto per vedere la tua carta'}</p>
    </div>
  );
}
