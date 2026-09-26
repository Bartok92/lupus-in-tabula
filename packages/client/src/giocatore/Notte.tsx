import { useEffect, useState, type ReactNode } from 'react';
import type { AzioneNotturnaVista, VistaGiocatore } from '@lupus/engine';
import { Chip, ListaGiocatori, Pannello, Pulsante, type VoceGiocatore } from '../ds/componenti';
import { IconaLuna, IconaZampa } from '../ds/icone';
import { Illustrazione } from '../ds/illustrazioni';
import { useApp } from '../store';
import { nomeDi, VERBO_AZIONE } from '../utilita';

// Di notte tutte le schermate hanno la stessa struttura (riquadro, istruzioni, lista, pulsante rosso):
// da fuori non si capisce chi sta agendo davvero e chi sta solo "sognando".

interface PropsSchermo {
  immagine: ReactNode;
  titolo: string;
  sottotitolo: ReactNode;
  istruzioni: string;
  risultato?: ReactNode;
  voci: VoceGiocatore[];
  scelta: string | null;
  onScelta: (id: string) => void;
  pulsante: { testo: string; disabilitato?: boolean; onClick: () => void };
  extra?: ReactNode;
}

function SchermoNotte(p: PropsSchermo) {
  return (
    <div className="flex flex-1 flex-col">
      <Pannello className="flex items-center gap-3 p-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-oro/50">{p.immagine}</div>
        <div className="min-w-0">
          <p className="font-maiuscolo text-[0.95rem] font-bold uppercase tracking-[0.12em] text-accento">{p.titolo}</p>
          <p className="text-[0.95rem] leading-snug text-testo-tenue">{p.sottotitolo}</p>
        </div>
      </Pannello>
      <p className="mt-4 text-[1.05rem] leading-snug">{p.istruzioni}</p>
      {p.risultato}
      <div className="mt-3 pb-4">
        <ListaGiocatori voci={p.voci} selezionato={p.scelta} onSeleziona={p.onScelta} etichetta={p.titolo} />
      </div>
      <div className="sticky bottom-0 -mx-4 mt-auto bg-linear-to-t from-notte-950 via-notte-950/90 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <Pulsante variante="sangue" grande className="w-full" disabled={p.pulsante.disabilitato} onClick={p.pulsante.onClick}>
          {p.pulsante.testo}
        </Pulsante>
        {p.extra}
      </div>
    </div>
  );
}

export function FaseNotte({ v }: { v: VistaGiocatore }) {
  const az = v.notte?.azione;
  if (!az) return <Sogni key={v.notte?.numero} numero={v.notte?.numero ?? v.giorno} />;
  // key = passo: ogni chiamata riparte con lo stato pulito
  if (az.tipo === 'bersaglio') return <AzioneBersaglio key={az.passo} v={v} az={az} />;
  if (az.tipo === 'riconoscimento') return <Riconoscimento key={az.passo} v={v} />;
  return <Informazione key={az.passo} v={v} />;
}

function AzioneBersaglio({ v, az }: { v: VistaGiocatore; az: AzioneNotturnaVista }) {
  const invia = useApp((s) => s.invia);
  const [scelta, setScelta] = useState<string | null>(az.miaScelta ?? null);
  const carta = v.io.ruolo!;
  const inviata = az.miaScelta !== undefined;
  const nomi = v.giocatori;

  const voci: VoceGiocatore[] = az.bersagliValidi.map((id) => {
    const compagni = Object.entries(az.votiBranco ?? {}).filter(([lupo, b]) => lupo !== v.io.id && b === id).map(([lupo]) => nomeDi(nomi, lupo));
    return {
      id,
      nome: nomeDi(nomi, id),
      destra: compagni.length ? <Chip tono="sangue"><IconaZampa width={13} height={13} /> {compagni.join(', ')}</Chip> : undefined,
    };
  });

  const indagine = az.effetto === 'indaga' && az.bloccata ? v.indagini.filter((i) => i.notte === v.notte?.numero && i.fonte === 'indaga').at(-1) : undefined;
  const verbo = VERBO_AZIONE[az.effetto ?? ''] ?? 'Scegli';
  const testo = az.bloccata
    ? 'Scelta fatta'
    : scelta === null
      ? 'Tocca un nome'
      : inviata && scelta === az.miaScelta
        ? 'Scelta inviata ✓'
        : `${verbo} ${nomeDi(nomi, scelta)}`;

  return (
    <SchermoNotte
      immagine={<Illustrazione id={carta.immagine} nome={carta.nome} className="h-full w-full" />}
      titolo={carta.nome}
      sottotitolo={v.compagni.length ? <>Con te: <span className="text-pericolo">{v.compagni.map((c) => c.nome).join(', ')}</span></> : 'Tocca a te: gli altri dormono.'}
      istruzioni={v.istruzioni.testo}
      risultato={indagine?.bersaglio && <Esito lupo={indagine.aura === 'lupo'} nome={nomeDi(nomi, indagine.bersaglio)} />}
      voci={voci}
      scelta={scelta}
      onScelta={(id) => !az.bloccata && setScelta(id)}
      pulsante={{
        testo,
        disabilitato: az.bloccata || scelta === null || (inviata && scelta === az.miaScelta),
        onClick: () => scelta && void invia({ tipo: 'azioneNotturna', bersaglio: scelta }),
      }}
      extra={
        !az.bloccata && (
          <button className="mt-2 min-h-12 w-full text-[0.9rem] text-testo-tenue underline-offset-4 hover:underline" onClick={() => { setScelta(null); void invia({ tipo: 'azioneNotturna', bersaglio: null }); }}>
            {inviata && az.miaScelta === null ? 'Hai scelto di non fare nulla ✓' : 'Stanotte non scelgo nessuno'}
          </button>
        )
      }
    />
  );
}

function Esito({ lupo, nome }: { lupo: boolean; nome: string }) {
  return (
    <div className={`compari mt-3 rounded-2xl border p-3 text-center ${lupo ? 'border-pericolo bg-sangue/30' : 'border-accento bg-accento/15'}`} role="status">
      <p className="font-maiuscolo text-lg font-bold">{nome}</p>
      <p className={lupo ? 'text-pericolo' : 'text-accento'}>{lupo ? 'È un lupo mannaro!' : 'Non è un lupo mannaro.'}</p>
    </div>
  );
}

function Riconoscimento({ v }: { v: VistaGiocatore }) {
  const [scelta, setScelta] = useState<string | null>(null);
  const [visto, setVisto] = useState(false);
  const carta = v.io.ruolo!;
  return (
    <SchermoNotte
      immagine={<Illustrazione id={carta.immagine} nome={carta.nome} className="h-full w-full" />}
      titolo={carta.nome}
      sottotitolo="Tocca a te: gli altri dormono."
      istruzioni={v.istruzioni.testo}
      voci={v.compagni.map((c) => ({ id: c.id, nome: c.nome, sottotitolo: c.ruolo.nome }))}
      scelta={scelta}
      onScelta={setScelta}
      pulsante={{ testo: visto ? 'Fatto ✓' : 'Ho visto', disabilitato: visto, onClick: () => setVisto(true) }}
    />
  );
}

function Informazione({ v }: { v: VistaGiocatore }) {
  const [scelta, setScelta] = useState<string | null>(null);
  const [visto, setVisto] = useState(false);
  const carta = v.io.ruolo!;
  const info = v.indagini.filter((i) => i.fonte === 'medium' && i.notte === v.notte?.numero).at(-1);
  return (
    <SchermoNotte
      immagine={<Illustrazione id={carta.immagine} nome={carta.nome} className="h-full w-full" />}
      titolo={carta.nome}
      sottotitolo="Tocca a te: gli altri dormono."
      istruzioni="Gli spiriti ti parlano di chi è andato al rogo ieri."
      risultato={
        info?.bersaglio ? <Esito lupo={info.aura === 'lupo'} nome={nomeDi(v.giocatori, info.bersaglio)} /> : (
          <p className="compari mt-3 rounded-2xl border border-testo/20 p-3 text-center text-testo-tenue">Ieri nessuno è andato al rogo.</p>
        )
      }
      voci={info?.bersaglio ? [{ id: info.bersaglio, nome: nomeDi(v.giocatori, info.bersaglio), vivo: false }] : []}
      scelta={scelta}
      onScelta={setScelta}
      pulsante={{ testo: visto ? 'Fatto ✓' : 'Ho capito', disabilitato: visto, onClick: () => setVisto(true) }}
    />
  );
}

const SOGNI = [
  'Una fiera in piazza', 'Il mare d\'estate', 'Un banchetto al castello', 'Il bosco d\'inverno', 'Una cavalcata',
  'La torre del mago', 'Un ballo in maschera', 'Il mulino sul fiume', 'Una tempesta di neve', 'Il mercato delle spezie',
];

/** Compito finto per chi non è chiamato: stesso gesto, stessa luce, stesse animazioni. */
function Sogni({ numero }: { numero: number }) {
  const [scelta, setScelta] = useState<string | null>(null);
  const [confermato, setConfermato] = useState<string | null>(null);
  const sogni = Array.from({ length: 6 }, (_, i) => SOGNI[(numero * 3 + i) % SOGNI.length]!);
  useEffect(() => setConfermato(null), [numero]);
  return (
    <SchermoNotte
      immagine={<Illustrazione id="notte" nome="La notte" className="h-full w-full" />}
      titolo="Il villaggio dorme"
      sottotitolo="Occhi chiusi: il Master sta chiamando qualcuno."
      istruzioni="Mentre aspetti, scegli cosa sognare stanotte. Tutti fanno lo stesso gesto, così nessuno capisce chi ha un potere."
      voci={sogni.map((s, i) => ({ id: s, nome: s, simbolo: i % 2 ? <IconaLuna width={16} height={16} /> : '✦' }))}
      scelta={scelta}
      onScelta={setScelta}
      pulsante={{
        testo: scelta === null ? 'Tocca un sogno' : confermato === scelta ? 'Sogno confermato ✓' : 'Conferma il sogno',
        disabilitato: scelta === null || confermato === scelta,
        onClick: () => setConfermato(scelta),
      }}
    />
  );
}
