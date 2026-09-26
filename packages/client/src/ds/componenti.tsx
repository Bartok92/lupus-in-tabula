import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { IconaSpunta, IconaTeschio } from './icone';

// ——— Foglio: pannello a comparsa dal basso (menu, scelte, impostazioni) ———

export function Foglio({ aperto, onChiudi, titolo, children }: { aperto: boolean; onChiudi: () => void; titolo: string; children: ReactNode }) {
  useEffect(() => {
    if (!aperto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aperto, onChiudi]);
  if (!aperto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onChiudi}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        className="compari max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-bordo bg-superficie-forte p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-testo sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-maiuscolo text-lg font-semibold text-accento">{titolo}</h2>
          <button aria-label="Chiudi" className="flex h-12 w-12 items-center justify-center rounded-full text-xl text-testo-tenue" onClick={onChiudi}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ——— Interruttore e selettore per le impostazioni ———

export function Interruttore({ etichetta, descrizione, valore, onCambia }: { etichetta: string; descrizione?: string; valore: boolean; onCambia: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-1">
      <span>
        <span className="block leading-tight">{etichetta}</span>
        {descrizione && <span className="block text-[0.8rem] text-testo-tenue">{descrizione}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={valore} onChange={(e) => onCambia(e.target.checked)} />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-testo/20 transition peer-checked:bg-accento peer-focus-visible:outline-3 peer-focus-visible:outline-accento after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

export function Selettore<T extends string>({ etichetta, opzioni, valore, onCambia }: { etichetta: string; opzioni: { valore: T; etichetta: string }[]; valore: T; onCambia: (v: T) => void }) {
  return (
    <div className="py-1">
      <p className="mb-1.5 leading-tight">{etichetta}</p>
      <div role="radiogroup" aria-label={etichetta} className="flex flex-wrap gap-1.5">
        {opzioni.map((o) => (
          <button
            key={o.valore}
            role="radio"
            aria-checked={valore === o.valore}
            onClick={() => onCambia(o.valore)}
            className={`min-h-11 rounded-xl border px-3 text-[0.85rem] ${valore === o.valore ? 'border-accento bg-accento/20 text-testo' : 'border-testo/15 text-testo-tenue'}`}
          >
            {o.etichetta}
          </button>
        ))}
      </div>
    </div>
  );
}

// ——— Pulsante ———

type VariantePulsante = 'oro' | 'sangue' | 'fantasma';

const STILI_PULSANTE: Record<VariantePulsante, string> = {
  oro: 'bg-linear-to-b from-oro-chiaro to-oro text-inchiostro shadow-[0_8px_22px_-8px_rgb(212_175_55/0.7),inset_0_1px_0_rgb(255_255_255/0.55)]',
  sangue: 'bg-linear-to-b from-[#c43030] to-sangue text-white shadow-[0_8px_22px_-8px_rgb(158_27_27/0.9),inset_0_1px_0_rgb(255_255_255/0.25)]',
  fantasma: 'border border-bordo bg-superficie text-testo backdrop-blur-sm',
};

export function Pulsante({
  variante = 'oro', grande = false, className = '', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VariantePulsante; grande?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 text-center font-maiuscolo font-semibold tracking-wide transition active:scale-[0.98] disabled:opacity-40 ${grande ? 'min-h-16 text-lg' : 'min-h-12 text-[0.85rem]'} ${STILI_PULSANTE[variante]} ${className}`}
    />
  );
}

// ——— Pannello: superficie scura semitrasparente con filo d'oro ———

export function Pannello({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`rounded-3xl border border-bordo bg-superficie p-4 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.7)] backdrop-blur-md ${className}`} />;
}

export function TitoloSezione({ children, destra }: { children: ReactNode; destra?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-maiuscolo text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-accento">{children}</h2>
      {destra}
    </div>
  );
}

// ——— Pergamena: per annunci (alba, rogo, esito) ———

export function Pergamena({ titolo, children, className = '' }: { titolo?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="pergamena-rotolo" />
      <div className="pergamena mx-2 px-5 py-4">
        {titolo && <h3 className="mb-2 text-center font-maiuscolo text-lg font-bold tracking-wide text-legno">{titolo}</h3>}
        <div className="text-[1.05rem] leading-snug">{children}</div>
      </div>
      <div className="pergamena-rotolo" />
    </div>
  );
}

// ——— Chip e Pallino ———

export function Chip({ children, tono = 'neutro', className = '' }: { children: ReactNode; tono?: 'neutro' | 'oro' | 'sangue' | 'luna'; className?: string }) {
  const toni = {
    neutro: 'bg-testo/5 text-testo-tenue border-testo/15',
    oro: 'bg-accento/15 text-accento border-accento/40',
    sangue: 'bg-sangue/20 text-pericolo border-pericolo/40',
    luna: 'bg-testo/10 text-testo border-testo/20',
  }[tono];
  return <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.8rem] leading-5 ${toni} ${className}`}>{children}</span>;
}

export function Pallino({ acceso, titolo }: { acceso: boolean; titolo?: string }) {
  return (
    <span
      title={titolo}
      aria-label={acceso ? 'collegato' : 'non collegato'}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${acceso ? 'bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.8)]' : 'bg-white/25'}`}
    />
  );
}

// ——— Avatar: sigillo con le iniziali ———

function tinta(nome: string): number {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({ nome, piccolo = false, morto = false, simbolo }: { nome: string; piccolo?: boolean; morto?: boolean; simbolo?: ReactNode }) {
  const iniziali = nome.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-oro/35 font-maiuscolo font-bold text-luna ${piccolo ? 'h-7 w-7 text-[0.65rem]' : 'h-10 w-10 text-[0.8rem]'} ${morto ? 'grayscale' : ''}`}
      style={{ background: `radial-gradient(circle at 35% 30%, hsl(${tinta(nome)} 35% 38%), hsl(${tinta(nome)} 40% 18%))` }}
    >
      {morto ? <IconaTeschio width={16} height={16} /> : (simbolo ?? iniziali)}
    </span>
  );
}

// ——— ListaGiocatori ———

export interface VoceGiocatore {
  id: string;
  nome: string;
  vivo?: boolean;
  connesso?: boolean;
  tu?: boolean;
  sottotitolo?: ReactNode;
  destra?: ReactNode;
  disabilitato?: boolean;
  /** Simbolo al posto delle iniziali (es. nei sogni della notte). */
  simbolo?: ReactNode;
}

/**
 * Elenco di giocatori. Con `onSeleziona` diventa una scelta singola (radiogroup),
 * con righe da almeno 56 px per il pollice.
 */
export function ListaGiocatori({
  voci, selezionato, onSeleziona, etichetta, tonoSelezione = 'sangue', colonne = 1,
}: {
  voci: VoceGiocatore[];
  selezionato?: string | null;
  onSeleziona?: (id: string) => void;
  etichetta?: string;
  tonoSelezione?: 'sangue' | 'oro';
  colonne?: 1 | 2;
}) {
  const scelta = !!onSeleziona;
  const anello = tonoSelezione === 'sangue' ? 'border-pericolo bg-sangue/25 shadow-[0_0_18px_-4px_rgb(230_122_122/0.7)]' : 'border-accento bg-accento/15 shadow-[0_0_18px_-4px_rgb(212_175_55/0.7)]';
  return (
    <ul role={scelta ? 'radiogroup' : 'list'} aria-label={etichetta} className={`grid gap-2 ${colonne === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {voci.map((v) => {
        const sel = selezionato === v.id;
        const contenuto = (
          <>
            <Avatar nome={v.nome} morto={v.vivo === false} piccolo={colonne === 2} simbolo={v.simbolo} />
            <span className="min-w-0 flex-1 text-left">
              <span className={`block truncate leading-tight ${colonne === 2 ? 'text-[0.95rem]' : 'text-[1.05rem]'} ${v.vivo === false ? 'text-testo-tenue line-through' : ''}`}>
                {v.nome} {v.tu && <span className="text-[0.8rem] text-testo-tenue">(tu)</span>}
              </span>
              {v.sottotitolo && <span className="block truncate text-[0.8rem] text-testo-tenue">{v.sottotitolo}</span>}
            </span>
            {v.destra}
            {v.connesso !== undefined && <Pallino acceso={v.connesso} />}
            {scelta && sel && <IconaSpunta className={tonoSelezione === 'sangue' ? 'text-pericolo' : 'text-accento'} />}
          </>
        );
        const classe = `flex w-full items-center rounded-2xl border transition ${colonne === 2 ? 'min-h-12 gap-2 px-2 py-1.5' : 'min-h-14 gap-3 px-3 py-2'} ${sel ? anello : 'border-testo/10 bg-riga backdrop-blur-sm'} ${v.disabilitato ? 'opacity-40' : ''}`;
        return (
          <li key={v.id}>
            {scelta ? (
              <button role="radio" aria-checked={sel} disabled={v.disabilitato} className={classe} onClick={() => onSeleziona(v.id)}>
                {contenuto}
              </button>
            ) : (
              <div className={classe}>{contenuto}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ——— Timer: anello che si svuota ———

export function Timer({ rimanenteMs, durataMs, etichetta, inPausa = false }: { rimanenteMs: number; durataMs: number; etichetta?: string; inPausa?: boolean }) {
  const secondi = Math.ceil(rimanenteMs / 1000);
  const frazione = durataMs > 0 ? Math.max(0, Math.min(1, rimanenteMs / durataMs)) : 0;
  const C = 2 * Math.PI * 42;
  const urgente = secondi <= 10;
  return (
    <div className="inline-flex flex-col items-center gap-1" role="timer" aria-label={`${etichetta ?? 'Timer'}: ${secondi} secondi`}>
      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        <circle cx="50" cy="50" r="42" fill="rgb(0 0 0 / 0.3)" stroke="rgb(255 255 255 / 0.1)" strokeWidth="7" />
        <circle
          cx="50" cy="50" r="42" fill="none" strokeWidth="7" strokeLinecap="round"
          stroke={urgente ? '#e67a7a' : '#d4af37'} strokeDasharray={C} strokeDashoffset={C * (1 - frazione)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
        <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="central" fontFamily="Cinzel, serif" fontSize="22" fill="currentColor">
          {Math.floor(secondi / 60)}:{String(secondi % 60).padStart(2, '0')}
        </text>
      </svg>
      {etichetta && <span className="font-maiuscolo text-[0.7rem] uppercase tracking-widest text-testo-tenue">{inPausa ? `${etichetta} · in pausa` : etichetta}</span>}
    </div>
  );
}
