import { useState } from 'react';
import { TUTTI_I_RUOLI } from '@lupus/engine';
import { CartaSegreta, FronteCarta } from '../ds/Carta';
import { Chip, ListaGiocatori, Pannello, Pergamena, Pulsante, Timer, TitoloSezione } from '../ds/componenti';
import * as Icone from '../ds/icone';
import { Illustrazione } from '../ds/illustrazioni';
import { Sfondo, type Tema } from '../ds/Sfondo';

const COLORI = [
  ['notte-950', '#05070f'], ['notte-800', '#0b1026'], ['notte-600', '#1f2a5c'], ['luna', '#e4e8f2'], ['argento', '#aeb7cc'],
  ['pergamena', '#efe3c4'], ['ocra', '#c08a2e'], ['legno', '#5b3a1e'], ['sangue', '#9e1b1b'], ['sangue-chiaro', '#e67a7a'], ['oro', '#d4af37'],
] as const;

/** Pagina /styleguide: token e componenti del design system. */
export function Styleguide() {
  const [tema, setTema] = useState<Tema>('notte');
  const [scelto, setScelto] = useState<string | null>('Bruno');

  return (
    <div className="relative min-h-dvh" data-tema={tema}>
      <Sfondo tema={tema} fisso />
      <main className="relative z-10 mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-titolo text-3xl text-accento">Design system</h1>
          <div className="flex gap-2">
            <Pulsante variante={tema === 'notte' ? 'oro' : 'fantasma'} onClick={() => setTema('notte')}><Icone.IconaLuna /> Notte</Pulsante>
            <Pulsante variante={tema === 'giorno' ? 'oro' : 'fantasma'} onClick={() => setTema('giorno')}><Icone.IconaSole /> Giorno</Pulsante>
          </div>
        </header>

        <Pannello>
          <TitoloSezione>Colori</TitoloSezione>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {COLORI.map(([nome, hex]) => (
              <div key={nome} className="flex flex-col items-center gap-1 text-[0.75rem]">
                <span className="h-12 w-full rounded-xl border border-white/15" style={{ background: hex }} />
                <span>{nome}</span>
                <span className="text-testo-tenue">{hex}</span>
              </div>
            ))}
          </div>
        </Pannello>

        <Pannello>
          <TitoloSezione>Tipografia</TitoloSezione>
          <p className="font-titolo text-4xl">Lupus in Tabula</p>
          <p className="font-maiuscolo text-xl uppercase tracking-[0.15em]">Cinzel · titoli e pulsanti</p>
          <p className="text-lg">EB Garamond per il testo: <i>«Il villaggio si addormenta, e i lupi aprono gli occhi.»</i></p>
        </Pannello>

        <Pannello>
          <TitoloSezione>Pulsanti, chip, icone</TitoloSezione>
          <div className="flex flex-wrap gap-2">
            <Pulsante>Oro</Pulsante>
            <Pulsante variante="sangue">Sangue</Pulsante>
            <Pulsante variante="fantasma">Fantasma</Pulsante>
            <Pulsante disabled>Disattivato</Pulsante>
          </div>
          <Pulsante grande className="mt-3 w-full">Prossima fase (grande)</Pulsante>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip>neutro</Chip><Chip tono="oro">oro</Chip><Chip tono="sangue">sangue</Chip><Chip tono="luna">luna</Chip>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-accento">
            {Object.entries(Icone).map(([nome, I]) => <span key={nome} title={nome}><I width={28} height={28} /></span>)}
          </div>
        </Pannello>

        <div className="grid gap-6 md:grid-cols-2">
          <Pannello>
            <TitoloSezione>ListaGiocatori (scelta)</TitoloSezione>
            <ListaGiocatori
              voci={[
                { id: 'Anna', nome: 'Anna', connesso: true },
                { id: 'Bruno', nome: 'Bruno', connesso: true },
                { id: 'Carla', nome: 'Carla', connesso: false, sottotitolo: 'non collegata' },
                { id: 'Dario', nome: 'Dario', vivo: false, disabilitato: true },
              ]}
              selezionato={scelto}
              onSeleziona={setScelto}
            />
          </Pannello>
          <div className="flex flex-col gap-6">
            <Pannello className="flex items-center justify-around">
              <Timer rimanenteMs={73_000} durataMs={120_000} etichetta="Discussione" />
              <Timer rimanenteMs={8_000} durataMs={60_000} etichetta="Difesa" />
            </Pannello>
            <Pergamena titolo="L'alba della seconda notte">
              <p>Il villaggio si sveglia e scopre che stanotte ci ha lasciato <b>Bruno</b>.</p>
            </Pergamena>
          </div>
        </div>

        <Pannello>
          <TitoloSezione>Carta segreta (tieni premuto)</TitoloSezione>
          <div className="mx-auto w-64">
            <CartaSegreta carta={{ id: 'lupo', nome: 'Lupo mannaro', fazione: 'lupi', descrizione: 'Di giorno sembra un villico come gli altri. Di notte caccia con il branco.' }} />
          </div>
        </Pannello>

        <Pannello>
          <TitoloSezione>Le carte dei ruoli</TitoloSezione>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {TUTTI_I_RUOLI.map((r) => (
              <div key={r.id} className="aspect-[5/7]">
                <FronteCarta carta={r} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['notte'].map((id) => <Illustrazione key={id} id={id} className="h-24 w-24 rounded-xl" />)}
          </div>
        </Pannello>
      </main>
    </div>
  );
}
