import { useState, type ReactNode } from 'react';
import { Chip, ListaGiocatori, Pannello, Pergamena, Pulsante, TitoloSezione, Pallino, type VoceGiocatore } from '../ds/componenti';
import { IconaAnnulla, IconaLuna, IconaSpunta, IconaWifi, IconaZampa } from '../ds/icone';
import { Illustrazione } from '../ds/illustrazioni';
import { Sfondo, type Tema } from '../ds/Sfondo';
import { vai } from '../percorso';

// Mockup statici (dati finti) delle schermate principali, da approvare prima della milestone 4.

const NOMI = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Franco', 'Giulia', 'Ivo', 'Lucia'];

export const SCHERMATE: Record<string, { titolo: string; componente: () => ReactNode; larghezza?: number }> = {
  lobby: { titolo: '1 · Lobby del giocatore', componente: LobbyGiocatore },
  notte: { titolo: '2a · Notte: il Lupo è chiamato', componente: NotteLupo },
  sogni: { titolo: '2b · Notte: chi dorme (stesso aspetto)', componente: NotteSogni },
  master: { titolo: '3 · Regia del Master', componente: RegiaMaster },
};

/** Pagina /mockup: tutte le schermate in cornici da telefono. */
export function PaginaMockup({ schermata }: { schermata?: string }) {
  const singola = schermata ? SCHERMATE[schermata] : undefined;
  if (singola) {
    const C = singola.componente;
    return (
      <div className="relative min-h-dvh">
        <Sfondo fisso />
        <div className="relative z-10 min-h-dvh">
          <C />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh">
      <Sfondo fisso />
      <main className="relative z-10 mx-auto max-w-[1700px] px-4 py-8">
        <h1 className="text-center font-titolo text-3xl text-oro-chiaro">Mockup · Lupus in Tabula</h1>
        <p className="mx-auto mt-2 max-w-xl text-center text-testo-tenue">
          Tocca il titolo di una schermata per aprirla a tutto schermo (ideale dal telefono). Il design system completo è in{' '}
          <button className="underline" onClick={() => vai('/styleguide')}>/styleguide</button>.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-8">
          {Object.entries(SCHERMATE).map(([chiave, s]) => (
            <figure key={chiave} className="flex flex-col items-center gap-3">
              <button className="font-maiuscolo text-sm uppercase tracking-widest text-oro-chiaro underline-offset-4 hover:underline" onClick={() => vai(`/mockup/${chiave}`)}>
                {s.titolo}
              </button>
              <Telefono>
                <s.componente />
              </Telefono>
            </figure>
          ))}
        </div>
      </main>
    </div>
  );
}

function Telefono({ children, tema = 'notte' }: { children: ReactNode; tema?: Tema }) {
  return (
    <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[46px] border-[10px] border-[#111] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]" data-tema={tema}>
      <Sfondo tema={tema} />
      <div className="relative z-10 h-full overflow-y-auto [scrollbar-width:none]">{children}</div>
    </div>
  );
}

// ——— 1. Lobby del giocatore ———

function LobbyGiocatore() {
  const voci: VoceGiocatore[] = NOMI.map((nome, i) => ({ id: nome, nome, connesso: i !== 5, tu: nome === 'Anna' }));
  return (
    <div className="flex min-h-full flex-col px-4 pb-10 pt-8">
      <header className="text-center">
        <p className="font-maiuscolo text-[0.7rem] uppercase tracking-[0.35em] text-testo-tenue">Stanza K7PQ2X</p>
        <h1 className="mt-1 font-titolo text-[2.1rem] leading-tight text-oro-chiaro drop-shadow-[0_0_18px_rgb(212_175_55/0.45)]">Lupus in Tabula</h1>
      </header>

      <Pannello className="mt-6">
        <p className="font-maiuscolo text-[0.75rem] uppercase tracking-[0.2em] text-accento">Ti diamo il benvenuto</p>
        <h2 className="font-titolo text-[1.7rem] leading-tight">Anna</h2>
        <p className="mt-1 leading-snug text-testo-tenue">
          Il Master sta preparando i ruoli. Tieni il telefono a portata di mano: quando la partita inizia vedrai la tua carta.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tono="luna">12 partite</Chip>
          <Chip tono="oro">5 vittorie</Chip>
          <Chip tono="sangue">
            <IconaZampa width={14} height={14} /> 2 da lupo
          </Chip>
        </div>
      </Pannello>

      <Pannello className="mt-4">
        <TitoloSezione destra={<Chip>9 al tavolo</Chip>}>Al tavolo</TitoloSezione>
        <ListaGiocatori voci={voci} colonne={2} />
      </Pannello>

      <div className="mt-auto flex flex-col items-center gap-2 pt-8 text-testo-tenue">
        <span className="fiammella inline-block h-3 w-3 rounded-full bg-oro-chiaro shadow-[0_0_16px_4px_rgb(240_212_122/0.6)]" />
        <p className="font-maiuscolo text-[0.75rem] uppercase tracking-[0.25em]">In attesa del Master…</p>
      </div>
    </div>
  );
}

// ——— 2. Notte: stessa struttura per chi agisce e per chi dorme ———

function SchermoNotte({
  immagine, titoloRiquadro, sottotitolo, istruzioni, voci, scelta, setScelta, conferma,
}: {
  immagine: ReactNode; titoloRiquadro: string; sottotitolo: ReactNode; istruzioni: string;
  voci: VoceGiocatore[]; scelta: string | null; setScelta: (id: string) => void; conferma: string;
}) {
  return (
    <div className="flex min-h-full flex-col px-4 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-luna">
          <IconaLuna />
          <span className="font-titolo text-xl">Notte 2</span>
        </div>
        <Chip tono="luna">
          <IconaWifi width={14} height={14} /> collegato
        </Chip>
      </header>

      <Pannello className="mt-4 flex items-center gap-3 p-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-oro/50">{immagine}</div>
        <div className="min-w-0">
          <p className="font-maiuscolo text-[0.95rem] font-bold uppercase tracking-[0.12em] text-oro-chiaro">{titoloRiquadro}</p>
          <p className="text-[0.95rem] leading-snug text-testo-tenue">{sottotitolo}</p>
        </div>
      </Pannello>

      <p className="mt-4 text-[1.05rem] leading-snug">{istruzioni}</p>

      <div className="mt-3 pb-28">
        <ListaGiocatori voci={voci} selezionato={scelta} onSeleziona={setScelta} etichetta="Scelta" />
      </div>

      <div className="sticky bottom-0 -mx-4 mt-auto bg-linear-to-t from-notte-950 via-notte-950/90 to-transparent px-4 pb-6 pt-8">
        <Pulsante variante="sangue" grande className="w-full" disabled={!scelta}>
          {conferma}
        </Pulsante>
      </div>
    </div>
  );
}

function NotteLupo() {
  const [scelta, setScelta] = useState<string | null>('Bruno');
  const votoIvo = 'Carla';
  const bersagli = NOMI.filter((n) => !['Giulia', 'Ivo', 'Dario'].includes(n));
  const voci: VoceGiocatore[] = bersagli.map((nome) => ({
    id: nome,
    nome,
    destra: nome === votoIvo ? <Chip tono="sangue"><IconaZampa width={13} height={13} /> Ivo</Chip> : undefined,
  }));
  return (
    <SchermoNotte
      immagine={<Illustrazione id="lupo" nome="Lupo mannaro" className="h-full w-full" />}
      titoloRiquadro="Lupo mannaro"
      sottotitolo={<>Il tuo branco: <span className="text-sangue-chiaro">Ivo</span></>}
      istruzioni="Scegli con il branco chi sbranare stanotte. Vedete i voti degli altri in tempo reale: mettetevi d'accordo, altrimenti decide il Master."
      voci={voci}
      scelta={scelta}
      setScelta={setScelta}
      conferma={scelta ? `Sbrana ${scelta}` : 'Scegli una vittima'}
    />
  );
}

function NotteSogni() {
  const [scelta, setScelta] = useState<string | null>('Il mare');
  const sogni = ['Una fiera in piazza', 'Il mare', 'Un banchetto', 'Il bosco d\'inverno', 'Una cavalcata', 'La torre del mago'];
  return (
    <SchermoNotte
      immagine={<Illustrazione id="notte" nome="La notte" className="h-full w-full" />}
      titoloRiquadro="Il villaggio dorme"
      sottotitolo="Occhi chiusi: il Master sta chiamando qualcuno."
      istruzioni="Mentre aspetti, scegli cosa sognare stanotte. Tutti fanno lo stesso gesto, così nessuno capisce chi ha un potere."
      voci={sogni.map((s, i) => ({ id: s, nome: s, simbolo: i % 2 ? <IconaLuna width={16} height={16} /> : '✦' }))}
      scelta={scelta}
      setScelta={setScelta}
      conferma={scelta ? 'Conferma il sogno' : 'Scegli un sogno'}
    />
  );
}

// ——— 3. Regia del Master ———

const PASSI = [
  { ruolo: 'Veggente', chi: 'Anna', stato: 'fatto', nota: <>ha indagato <b>Ivo</b>: <span className="text-sangue-chiaro">LUPO</span></> },
  { ruolo: 'Medium', chi: 'Dario (morto)', stato: 'fatto', nota: 'attesa finta completata' },
  { ruolo: 'Guardia', chi: 'Carla', stato: 'ora', nota: <>protegge <b>Bruno</b></> },
  { ruolo: 'Gufo', chi: 'Elena', stato: 'dopo', nota: '' },
  { ruolo: 'Lupi', chi: 'Giulia, Ivo', stato: 'dopo', nota: '' },
] as const;

const TAVOLO = [
  { nome: 'Anna', ruolo: 'Veggente', fazione: 'villaggio', vivo: true, connesso: true, azione: true },
  { nome: 'Bruno', ruolo: 'Villico', fazione: 'villaggio', vivo: true, connesso: true, azione: null },
  { nome: 'Carla', ruolo: 'Guardia', fazione: 'villaggio', vivo: true, connesso: true, azione: true },
  { nome: 'Dario', ruolo: 'Medium', fazione: 'villaggio', vivo: false, connesso: true, azione: null },
  { nome: 'Elena', ruolo: 'Gufo', fazione: 'villaggio', vivo: true, connesso: true, azione: false },
  { nome: 'Franco', ruolo: 'Indemoniato', fazione: 'lupi', vivo: true, connesso: false, azione: null },
  { nome: 'Giulia', ruolo: 'Lupo mannaro', fazione: 'lupi', vivo: true, connesso: true, azione: false },
  { nome: 'Ivo', ruolo: 'Lupo mannaro', fazione: 'lupi', vivo: true, connesso: true, azione: false },
  { nome: 'Lucia', ruolo: 'Villico', fazione: 'villaggio', vivo: true, connesso: true, azione: null },
] as const;

function RegiaMaster() {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 px-4 pb-10 pt-6 md:grid md:grid-cols-2 md:items-start">
      <header className="flex items-center gap-2 md:col-span-2">
        <div className="min-w-0 flex-1">
          <p className="font-maiuscolo text-[0.7rem] uppercase tracking-[0.3em] text-testo-tenue">Regia · K7PQ2X</p>
          <h1 className="flex items-center gap-2 font-titolo text-2xl text-luna">
            <IconaLuna className="text-luna" /> Notte 2
          </h1>
        </div>
        <Chip tono="luna">8/9 online</Chip>
        <button aria-label="Annulla l'ultima azione" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-bordo bg-superficie">
          <IconaAnnulla />
        </button>
      </header>

      <div className="flex flex-col gap-4">
      <Pannello>
        <TitoloSezione destra={<span className="text-[0.85rem] text-testo-tenue">passo 3 di 5</span>}>La notte</TitoloSezione>
        <ol className="flex flex-col">
          {PASSI.map((p, i) => (
            <li key={p.ruolo} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[0.75rem] ${
                    p.stato === 'fatto' ? 'border-oro bg-oro text-inchiostro' : p.stato === 'ora' ? 'pulsa border-sangue-chiaro bg-sangue text-white' : 'border-white/25 text-testo-tenue'
                  }`}
                >
                  {p.stato === 'fatto' ? <IconaSpunta width={15} height={15} /> : i + 1}
                </span>
                {i < PASSI.length - 1 && <span className="w-px flex-1 bg-white/15" />}
              </div>
              <div className="pb-3">
                <p className={`leading-tight ${p.stato === 'dopo' ? 'text-testo-tenue' : ''}`}>
                  <span className="font-maiuscolo font-semibold">{p.ruolo}</span> · {p.chi}
                </p>
                {p.nota && <p className="text-[0.9rem] text-testo-tenue">{p.nota}</p>}
              </div>
            </li>
          ))}
        </ol>
        <Pulsante grande className="mt-2 w-full">Chiama il Gufo</Pulsante>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Pulsante variante="fantasma">Forza bersaglio</Pulsante>
          <Pulsante variante="fantasma">Termina notte</Pulsante>
        </div>
      </Pannello>

      <Pergamena titolo="Anteprima dell'alba">
        <p>Se la notte finisse ora: <b>nessun morto</b>.</p>
        <p className="mt-1 text-[0.95rem] text-legno">I lupi non hanno ancora scelto. La Guardia protegge Bruno.</p>
      </Pergamena>
      </div>

      <Pannello>
        <TitoloSezione>Giocatori</TitoloSezione>
        <table className="w-full text-left text-[0.95rem]">
          <thead className="font-maiuscolo text-[0.65rem] uppercase tracking-widest text-testo-tenue">
            <tr>
              <th className="pb-2 font-semibold">Nome</th>
              <th className="pb-2 font-semibold">Ruolo</th>
              <th className="pb-2 text-center font-semibold">Azione</th>
            </tr>
          </thead>
          <tbody>
            {TAVOLO.map((g) => (
              <tr key={g.nome} className="border-t border-white/8">
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <Pallino acceso={g.connesso} />
                    <span className={g.vivo ? '' : 'text-testo-tenue line-through'}>{g.nome}</span>
                  </span>
                </td>
                <td className={g.fazione === 'lupi' ? 'text-sangue-chiaro' : 'text-oro-chiaro'}>{g.ruolo}</td>
                <td className="text-center">{g.azione === true ? <IconaSpunta className="inline text-oro" /> : g.azione === false ? '…' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Pannello>
    </div>
  );
}
