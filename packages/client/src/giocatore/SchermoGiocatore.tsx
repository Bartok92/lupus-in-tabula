import { useEffect, useState } from 'react';
import type { PacchettoVista, VistaGiocatore } from '@lupus/engine';
import { Riepilogo } from '../comuni/Riepilogo';
import { CartaSegreta } from '../ds/Carta';
import { Chip, Foglio, ListaGiocatori, Pannello, Pulsante, Timer, TitoloSezione } from '../ds/componenti';
import { IconaLuna, IconaSole, IconaTeschio, IconaZampa } from '../ds/icone';
import { Sfondo } from '../ds/Sfondo';
import { temaDellaFase, useSuoniFase, useTimer, useWakeLock } from '../hooks';
import { archivio } from '../archivio';
import { api } from '../rete/api';
import { useApp } from '../store';
import { nomeDi, plurale } from '../utilita';
import { FaseAlba, FaseDiscussione, FaseRogo, FaseVoto } from './Giorno';
import { FaseNotte } from './Notte';

const TITOLI: Record<string, (g: number) => string> = {
  lobby: () => 'Lobby',
  rivelazione: () => 'La carta',
  notte: (g) => `Notte ${g}`,
  alba: (g) => `Alba ${g}`,
  discussione: (g) => `Giorno ${g}`,
  nomination: (g) => `Giorno ${g}`,
  ballottaggio: (g) => `Giorno ${g}`,
  rogo: (g) => `Giorno ${g}`,
  fine: () => 'Fine',
};

export function SchermoGiocatore({ pacchetto }: { pacchetto: PacchettoVista }) {
  const v = pacchetto.vista as VistaGiocatore;
  const connesso = useApp((s) => s.connesso);
  const ricevutoA = useApp((s) => s.ricevutoA);
  const timer = useTimer(pacchetto.timer, ricevutoA);
  const [taccuino, setTaccuino] = useState(false);
  const tema = temaDellaFase(v.fase, v.vittoria?.fazione);
  const wakeLock = useWakeLock(v.fase !== 'fine');
  // Suoni sui telefoni dei giocatori solo se il Master li ha attivati (di default no).
  useSuoniFase(`${v.fase}:${v.votazione?.aperta ? 'voto' : ''}`, v.suoni);

  return (
    <div data-tema={tema} className="relative min-h-dvh text-testo">
      <Sfondo tema={tema} fisso />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex min-h-12 items-center gap-2">
          <span className="flex items-center gap-2 font-titolo text-xl">
            {tema === 'notte' ? <IconaLuna /> : <IconaSole className="text-accento" />}
            {TITOLI[v.fase]?.(v.giorno)}
          </span>
          <span className="flex-1" />
          {!connesso && <Chip tono="sangue">offline…</Chip>}
          {v.io.ruolo && v.fase !== 'rivelazione' && (
            <button onClick={() => setTaccuino(true)} className="min-h-11 rounded-xl border border-bordo bg-superficie px-3 font-maiuscolo text-[0.75rem] uppercase tracking-wider">
              Il mio ruolo
            </button>
          )}
        </header>

        {!v.io.vivo && v.fase !== 'fine' && (
          <p className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-sangue/25 py-1.5 text-[0.9rem] text-pericolo">
            <IconaTeschio width={16} height={16} /> Fuori dal gioco: ora guardi senza giocare
          </p>
        )}

        {timer && (
          <div className="mt-2 flex justify-center">
            <Timer rimanenteMs={timer.rimanenteMs} durataMs={timer.durataMs} etichetta={timer.etichetta} inPausa={timer.inPausa} />
          </div>
        )}

        <div className="mt-3 flex flex-1 flex-col">
          <Contenuto v={v} codice={pacchetto.codice} connessi={pacchetto.connessi} wakeLock={wakeLock} />
        </div>
      </div>

      <Foglio aperto={taccuino} onChiudi={() => setTaccuino(false)} titolo="Il tuo ruolo">
        <Taccuino v={v} />
      </Foglio>
    </div>
  );
}

function Contenuto({ v, codice, connessi, wakeLock }: { v: VistaGiocatore; codice: string; connessi: Record<string, boolean>; wakeLock: string }) {
  switch (v.fase) {
    case 'lobby': return <Lobby v={v} codice={codice} connessi={connessi} wakeLock={wakeLock} />;
    case 'rivelazione': return <Rivelazione v={v} />;
    case 'notte': return v.io.vivo ? <FaseNotte v={v} /> : <Spettatore v={v} />;
    case 'alba': return <FaseAlba v={v} />;
    case 'discussione': return <FaseDiscussione v={v} />;
    case 'nomination':
    case 'ballottaggio': return <FaseVoto v={v} />;
    case 'rogo': return <FaseRogo v={v} />;
    case 'fine': return (
      <Riepilogo
        fazione={v.vittoria!.fazione}
        motivo={v.vittoria!.motivo}
        hoVinto={v.vittoria!.hoVinto}
        codice={codice}
        log={v.log}
        giocatori={v.giocatori.map((g) => ({
          id: g.id, nome: g.nome, vivo: g.vivo, carta: g.rivelato?.ruolo ?? null, vincitore: v.vittoria!.vincitori.includes(g.id),
        }))}
      />
    );
  }
}

function Lobby({ v, codice, connessi, wakeLock }: { v: VistaGiocatore; codice: string; connessi: Record<string, boolean>; wakeLock: string }) {
  // Le statistiche arrivano dal telefono del Master (modalità diretta) oppure dal server.
  const modalita = useApp((s) => s.modalita);
  const profiloHost = useApp((s) => s.pacchetto?.profilo);
  const [profiloServer, setProfiloServer] = useState<{ partite: number; vittorie: Record<string, number> } | null>(null);
  useEffect(() => {
    if (modalita === 'server') api.profilo(archivio.idDispositivo()).then(setProfiloServer).catch(() => setProfiloServer(null));
  }, [modalita]);
  const profilo = profiloHost ?? profiloServer;
  const vittorie = profilo ? Object.values(profilo.vittorie).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="text-center">
        <p className="font-maiuscolo text-[0.7rem] uppercase tracking-[0.35em] text-testo-tenue">Partita {codice}</p>
        <h1 className="mt-1 font-titolo text-[2.1rem] leading-tight text-oro-chiaro drop-shadow-[0_0_18px_rgb(212_175_55/0.45)]">Lupus in Tabula</h1>
      </header>
      <Pannello>
        <p className="font-maiuscolo text-[0.75rem] uppercase tracking-[0.2em] text-accento">Ti diamo il benvenuto</p>
        <h2 className="font-titolo text-[1.7rem] leading-tight">{v.io.nome}</h2>
        <p className="mt-1 leading-snug text-testo-tenue">
          Il Master sta preparando i ruoli. Tieni il telefono a portata di mano: quando la partita inizia vedrai la tua carta.
        </p>
        {profilo && profilo.partite > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tono="luna">{plurale(profilo.partite, 'partita', 'partite')}</Chip>
            <Chip tono="oro">{plurale(vittorie, 'vittoria', 'vittorie')}</Chip>
            {(profilo.vittorie.lupi ?? 0) > 0 && <Chip tono="sangue"><IconaZampa width={14} height={14} /> {profilo.vittorie.lupi} da lupo</Chip>}
          </div>
        )}
      </Pannello>
      <Pannello>
        <TitoloSezione destra={<Chip>{v.giocatori.length} al tavolo</Chip>}>Al tavolo</TitoloSezione>
        <ListaGiocatori voci={v.giocatori.map((g) => ({ id: g.id, nome: g.nome, connesso: !!connessi[g.id], tu: g.id === v.io.id }))} colonne={2} />
      </Pannello>
      {wakeLock === 'non-supportato' && (
        <p className="text-center text-[0.85rem] text-testo-tenue">
          Consiglio: allunga il tempo di spegnimento dello schermo nelle impostazioni del telefono.
        </p>
      )}
      <div className="mt-auto flex flex-col items-center gap-2 pt-6 text-testo-tenue">
        <span className="fiammella inline-block h-3 w-3 rounded-full bg-oro-chiaro shadow-[0_0_16px_4px_rgb(240_212_122/0.6)]" />
        <p className="font-maiuscolo text-[0.75rem] uppercase tracking-[0.25em]">In attesa del Master…</p>
      </div>
    </div>
  );
}

function Rivelazione({ v }: { v: VistaGiocatore }) {
  const invia = useApp((s) => s.invia);
  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <div className="w-full max-w-[19rem]">
        <CartaSegreta carta={v.io.ruolo!} />
      </div>
      <Pannello className="w-full">
        <TitoloSezione>{v.istruzioni.titolo}</TitoloSezione>
        <p>{v.istruzioni.testo}</p>
      </Pannello>
      <div className="mt-auto w-full">
        <Pulsante grande className="w-full" disabled={v.io.haVisto} onClick={() => void invia({ tipo: 'confermaVisto' })}>
          {v.io.haVisto ? 'Fatto: aspetta la notte ✓' : 'Ho visto il mio ruolo'}
        </Pulsante>
      </div>
    </div>
  );
}

function Spettatore({ v }: { v: VistaGiocatore }) {
  return (
    <div className="flex flex-col gap-4">
      <Pannello>
        <TitoloSezione>{v.istruzioni.titolo}</TitoloSezione>
        <p>{v.istruzioni.testo}</p>
      </Pannello>
      <Pannello>
        <TitoloSezione>Cronaca pubblica</TitoloSezione>
        <ol className="flex flex-col gap-1 text-[0.95rem] text-testo-tenue">
          {v.log.slice(-12).map((l) => <li key={l.n}>{l.testo}</li>)}
        </ol>
      </Pannello>
    </div>
  );
}

/** "Il mio ruolo": la carta (tenendo premuto), i compagni noti e il taccuino delle scoperte. */
function Taccuino({ v }: { v: VistaGiocatore }) {
  const carta = v.io.ruolo!;
  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-[16rem]">
        <CartaSegreta carta={carta} />
      </div>
      <p className="text-center text-[0.95rem] text-testo-tenue">{carta.obiettivo}</p>
      {v.compagni.length > 0 && (
        <div>
          <TitoloSezione>Chi conosci</TitoloSezione>
          <ListaGiocatori voci={v.compagni.map((c) => ({ id: c.id, nome: c.nome, sottotitolo: c.ruolo.nome, vivo: v.giocatori.find((g) => g.id === c.id)?.vivo }))} />
        </div>
      )}
      {v.indagini.length > 0 && (
        <div>
          <TitoloSezione>Il tuo taccuino</TitoloSezione>
          <ul className="flex flex-col gap-1.5">
            {v.indagini.map((i, n) => (
              <li key={n} className="flex items-center justify-between gap-2 rounded-xl bg-riga px-3 py-2">
                <span>Notte {i.notte}: <b>{nomeDi(v.giocatori, i.bersaglio)}</b></span>
                {i.bersaglio ? (
                  <Chip tono={i.aura === 'lupo' ? 'sangue' : 'oro'}>{i.aura === 'lupo' ? 'lupo' : 'non lupo'}</Chip>
                ) : (
                  <Chip>nessun rogo</Chip>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
