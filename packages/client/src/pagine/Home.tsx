import { useEffect, useState } from 'react';
import { archivio } from '../archivio';
import { Chip, Pannello, Pulsante, TitoloSezione } from '../ds/componenti';
import { Sfondo } from '../ds/Sfondo';
import { vai } from '../percorso';
import { creaPartita, dimenticaPartitaOspitata } from '../rete/connessione';
import { partiteSalvate, type PartitaSalvata } from '../rete/p2p/archivioIdb';
import { useApp } from '../store';

const NOME_FASE: Record<string, string> = {
  lobby: 'in lobby', rivelazione: 'carte', notte: 'notte', alba: 'alba', discussione: 'giorno',
  nomination: 'voto', ballottaggio: 'ballottaggio', rogo: 'rogo', fine: 'finita',
};

export function Home() {
  const modalita = useApp((s) => s.modalita);
  const [codice, setCodice] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvate, setSalvate] = useState<PartitaSalvata[]>([]);

  const ricarica = () => void partiteSalvate().then((p) => setSalvate(p.filter((x) => archivio.tokenMaster(x.codice)))).catch(() => setSalvate([]));
  useEffect(() => {
    if (modalita === 'p2p') ricarica();
  }, [modalita]);

  async function crea() {
    setAttesa(true);
    setErrore(null);
    try {
      const s = await creaPartita();
      archivio.salvaTokenMaster(s.codice, s.tokenMaster);
      vai(`/master/${s.codice}`);
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setAttesa(false);
    }
  }

  return (
    <div data-tema="notte" className="relative min-h-dvh text-testo">
      <Sfondo fisso />
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <header className="text-center">
          <h1 className="font-titolo text-[2.6rem] leading-tight text-oro-chiaro drop-shadow-[0_0_18px_rgb(212_175_55/0.45)]">Lupus in Tabula</h1>
          <p className="mt-2 italic text-testo-tenue">Il villaggio si addormenta…</p>
        </header>

        <Pannello>
          <TitoloSezione>Entra in una partita</TitoloSezione>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (codice.trim()) vai(`/g/${codice.trim().toUpperCase()}`);
            }}
          >
            <label className="text-testo-tenue" htmlFor="codice">Codice della partita (o scansiona il QR del Master)</label>
            <input
              id="codice"
              value={codice}
              onChange={(e) => setCodice(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={8}
              placeholder="K7PQ2X"
              className="min-h-14 rounded-2xl border border-bordo bg-riga px-4 text-center font-maiuscolo text-3xl tracking-[0.3em] uppercase outline-none placeholder:text-testo/25 focus:ring-2 focus:ring-accento"
            />
            <Pulsante type="submit" grande disabled={!codice.trim()}>Entra</Pulsante>
          </form>
        </Pannello>

        <Pannello>
          <TitoloSezione>Sei il Master?</TitoloSezione>
          <p className="mb-3 text-testo-tenue">
            {modalita === 'p2p'
              ? 'Crea la partita: il tuo telefono farà da tavolo. Tieni l\'app aperta per tutta la serata.'
              : 'Crea una partita: i giocatori entreranno con il codice o il QR.'}
          </p>
          <Pulsante variante="fantasma" className="w-full" onClick={crea} disabled={attesa || !modalita}>
            {attesa ? 'Preparo il tavolo…' : 'Crea una partita'}
          </Pulsante>
          {errore && <p className="mt-2 text-pericolo">{errore}</p>}
        </Pannello>

        {salvate.length > 0 && (
          <Pannello>
            <TitoloSezione>Le tue partite su questo telefono</TitoloSezione>
            <ul className="flex flex-col gap-2">
              {salvate.slice(0, 5).map((p) => (
                <li key={p.codice} className="flex items-center gap-2 rounded-2xl border border-testo/10 bg-riga py-1 pl-3 pr-1">
                  <span className="font-maiuscolo tracking-[0.15em]">{p.codice}</span>
                  <Chip>{NOME_FASE[p.fase] ?? p.fase}</Chip>
                  <span className="flex-1 text-[0.85rem] text-testo-tenue">{p.giocatori} giocatori</span>
                  <button className="min-h-11 px-3 text-accento" onClick={() => vai(`/master/${p.codice}`)}>Riprendi</button>
                  <button
                    aria-label={`Elimina la partita ${p.codice}`}
                    className="min-h-11 px-2 text-testo-tenue"
                    onClick={() => confirm(`Eliminare la partita ${p.codice} da questo telefono?`) && void dimenticaPartitaOspitata(p.codice).then(ricarica)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </Pannello>
        )}
      </main>
    </div>
  );
}
