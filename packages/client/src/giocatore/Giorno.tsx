import { useEffect, useState } from 'react';
import type { GiocatorePubblico, VistaGiocatore } from '@lupus/engine';
import { Chip, ListaGiocatori, Pannello, Pergamena, Pulsante, TitoloSezione, type VoceGiocatore } from '../ds/componenti';
import { Fiamme } from '../ds/effetti';
import { IconaTeschio } from '../ds/icone';
import { useApp } from '../store';
import { nomeDi, testoEsito } from '../utilita';

const ASTENSIONE = '__astensione';

function rivelazione(g: GiocatorePubblico | undefined): string | null {
  if (!g?.rivelato) return null;
  return g.rivelato.ruolo ? g.rivelato.ruolo.nome : `fazione: ${g.rivelato.fazione}`;
}

export function FaseAlba({ v }: { v: VistaGiocatore }) {
  if (!v.alba) {
    return (
      <Pannello className="compari mt-2 text-center">
        <p className="font-maiuscolo uppercase tracking-[0.2em] text-accento">Il sole sorge</p>
        <p className="mt-1 text-testo-tenue">{v.istruzioni.testo}</p>
      </Pannello>
    );
  }
  const morti = v.alba.morti;
  return (
    <div className="mt-2 flex flex-col gap-4">
      <Pergamena titolo={`L'alba del giorno ${v.alba.giorno}`} className="srotola">
        {morti.length === 0 ? (
          <p className="text-center">Il villaggio si sveglia: stanotte <b>nessuno ci ha lasciato</b>.</p>
        ) : (
          <>
            <p className="text-center">Il villaggio si sveglia e scopre che stanotte {morti.length > 1 ? 'ci hanno lasciato' : 'ci ha lasciato'}…</p>
            <ul className="mt-2 flex flex-col items-center gap-1">
              {morti.map((id) => {
                const g = v.giocatori.find((x) => x.id === id);
                return (
                  <li key={id} className="flex items-center gap-2 font-maiuscolo text-xl font-bold text-sangue">
                    <IconaTeschio /> {g?.nome}
                    {rivelazione(g) && <span className="font-testo text-base font-normal text-legno">({rivelazione(g)})</span>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Pergamena>
      {v.io.vivo && (
        <Pannello className="compari" style={{ animationDelay: '1.2s' }}>
          <p>{v.istruzioni.testo}</p>
        </Pannello>
      )}
    </div>
  );
}

export function ElencoVillaggio({ v }: { v: VistaGiocatore }) {
  const voci: VoceGiocatore[] = v.giocatori.map((g) => ({
    id: g.id, nome: g.nome, vivo: g.vivo, tu: g.id === v.io.id, sottotitolo: !g.vivo ? rivelazione(g) ?? undefined : undefined,
  }));
  return (
    <Pannello>
      <TitoloSezione destra={<Chip>{v.giocatori.filter((g) => g.vivo).length} vivi</Chip>}>Il villaggio</TitoloSezione>
      <ListaGiocatori voci={voci} colonne={2} />
    </Pannello>
  );
}

export function FaseDiscussione({ v }: { v: VistaGiocatore }) {
  return (
    <div className="mt-2 flex flex-col gap-4">
      <Pannello>
        <TitoloSezione>{v.istruzioni.titolo}</TitoloSezione>
        <p>{v.istruzioni.testo}</p>
      </Pannello>
      <ElencoVillaggio v={v} />
    </div>
  );
}

/** Nomination e ballottaggio (difesa, voto, risultato). */
export function FaseVoto({ v }: { v: VistaGiocatore }) {
  const vt = v.votazione;
  const b = v.ballottaggio;

  if (v.fase === 'ballottaggio' && b?.sottofase === 'difesa') {
    const sonoCandidato = b.candidati.includes(v.io.id);
    return (
      <div className="mt-2 flex flex-col gap-4">
        <Pannello className={sonoCandidato ? 'border-pericolo' : ''}>
          <TitoloSezione>{v.istruzioni.titolo}</TitoloSezione>
          <p>{v.istruzioni.testo}</p>
        </Pannello>
        <Pannello>
          <TitoloSezione>Al ballottaggio</TitoloSezione>
          <ListaGiocatori voci={b.candidati.map((id) => ({ id, nome: nomeDi(v.giocatori, id), tu: id === v.io.id }))} />
        </Pannello>
      </div>
    );
  }
  if (!vt) return null;
  if (!vt.aperta) return <RisultatoVoto v={v} />;
  if (!vt.possoVotare) {
    return (
      <div className="mt-2 flex flex-col gap-4">
        <Pannello>
          <TitoloSezione>{v.istruzioni.titolo}</TitoloSezione>
          <p>{v.istruzioni.testo}</p>
          <p className="mt-2 text-testo-tenue">Hanno votato in {vt.votiDati}.</p>
        </Pannello>
        {vt.voti && <BarreVoti v={v} />}
      </div>
    );
  }
  return <Scheda key={`${vt.tipo}-${vt.turno}`} v={v} />;
}

/** La scheda di voto: si sceglie, si conferma, si può cambiare finché il Master non chiude. */
function Scheda({ v }: { v: VistaGiocatore }) {
  const vt = v.votazione!;
  const invia = useApp((s) => s.invia);
  const registrato = vt.mioVoto === undefined ? undefined : (vt.mioVoto ?? ASTENSIONE);
  const [scelta, setScelta] = useState<string | null>(registrato ?? null);
  useEffect(() => {
    if (registrato !== undefined) setScelta(registrato);
  }, [registrato]);

  const voci: VoceGiocatore[] = vt.bersagli.map((id) => ({ id, nome: nomeDi(v.giocatori, id) }));
  if (vt.astensione) voci.push({ id: ASTENSIONE, nome: 'Mi astengo', simbolo: '–' });
  const giaVotato = scelta !== null && scelta === registrato;

  return (
    <div className="mt-2 flex flex-1 flex-col">
      <Pannello>
        <TitoloSezione destra={<Chip>{vt.votiDati} voti</Chip>}>{v.istruzioni.titolo}</TitoloSezione>
        <p>{v.istruzioni.testo}</p>
      </Pannello>
      <div className="mt-3 pb-4">
        <ListaGiocatori voci={voci} selezionato={scelta} onSeleziona={setScelta} tonoSelezione={vt.tipo === 'ballottaggio' ? 'sangue' : 'oro'} etichetta="Il tuo voto" />
      </div>
      {vt.voti && <BarreVoti v={v} />}
      <div className="sticky bottom-0 -mx-4 mt-auto bg-linear-to-t from-sfondo via-sfondo/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <Pulsante
          variante={vt.tipo === 'ballottaggio' ? 'sangue' : 'oro'}
          grande
          className="w-full"
          disabled={scelta === null || giaVotato}
          onClick={() => scelta && void invia({ tipo: 'voto', bersaglio: scelta === ASTENSIONE ? null : scelta })}
        >
          {scelta === null ? 'Tocca un nome' : giaVotato ? 'Voto registrato ✓' : scelta === ASTENSIONE ? 'Conferma astensione' : `Vota ${nomeDi(v.giocatori, scelta)}`}
        </Pulsante>
        {giaVotato && <p className="mt-1 text-center text-[0.85rem] text-testo-tenue">Puoi cambiare voto finché il Master non chiude.</p>}
      </div>
    </div>
  );
}

function RisultatoVoto({ v }: { v: VistaGiocatore }) {
  const vt = v.votazione!;
  return (
    <div className="mt-2 flex flex-col gap-4">
      <Pergamena titolo={vt.tipo === 'nomination' ? 'Esito della votazione' : 'Il verdetto'} className="srotola">
        <p className="text-center text-lg">{testoEsito(vt.esito, v.giocatori)}</p>
      </Pergamena>
      <BarreVoti v={v} />
    </div>
  );
}

/** Conteggio dei voti con chi ha votato chi (visibile a fine votazione, o in diretta se il Master lo permette). */
export function BarreVoti({ v, voti: votiEsterni }: { v: { giocatori: { id: string; nome: string }[]; votazione?: VistaGiocatore['votazione'] }; voti?: Record<string, string | null> }) {
  const voti = votiEsterni ?? v.votazione?.voti;
  if (!voti) return null;
  const perBersaglio = new Map<string, string[]>();
  const astenuti: string[] = [];
  for (const [da, a] of Object.entries(voti)) {
    if (a === null) astenuti.push(nomeDi(v.giocatori, da));
    else perBersaglio.set(a, [...(perBersaglio.get(a) ?? []), nomeDi(v.giocatori, da)]);
  }
  const righe = [...perBersaglio.entries()].sort((x, y) => y[1].length - x[1].length);
  const max = Math.max(1, ...righe.map((r) => r[1].length));
  return (
    <Pannello>
      <TitoloSezione>Voti</TitoloSezione>
      {righe.length === 0 && <p className="text-testo-tenue">Nessun voto.</p>}
      <ul className="flex flex-col gap-2.5">
        {righe.map(([id, chi]) => (
          <li key={id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{nomeDi(v.giocatori, id)}</span>
              <span className="font-maiuscolo text-accento">{chi.length}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-testo/10">
              <div className="h-2 rounded-full bg-accento transition-all" style={{ width: `${(chi.length / max) * 100}%` }} />
            </div>
            <p className="mt-0.5 text-[0.8rem] text-testo-tenue">{chi.join(', ')}</p>
          </li>
        ))}
      </ul>
      {astenuti.length > 0 && <p className="mt-2 text-[0.85rem] text-testo-tenue">Astenuti: {astenuti.join(', ')}</p>}
    </Pannello>
  );
}

export function FaseRogo({ v }: { v: VistaGiocatore }) {
  const id = v.rogo?.id;
  const g = v.giocatori.find((x) => x.id === id);
  return (
    <div className="compari mt-2 flex flex-col items-center gap-3 text-center">
      {id ? <Fiamme className="h-56 w-56" /> : null}
      <h2 className="font-titolo text-2xl">{id ? `${g?.nome} finisce sul rogo` : 'Oggi nessuno va al rogo'}</h2>
      {rivelazione(g) && <p className="text-testo-tenue">Era: {rivelazione(g)}</p>}
      <p className="text-testo-tenue">Presto scenderà la notte.</p>
    </div>
  );
}
