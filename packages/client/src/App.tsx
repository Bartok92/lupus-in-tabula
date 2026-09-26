import { Component, type ReactNode } from 'react';
import { usePercorso } from './percorso';
import { Home } from './pagine/Home';
import { PaginaMockup } from './pagine/Mockup';
import { PaginaGiocatore } from './pagine/PaginaGiocatore';
import { PaginaMaster } from './pagine/PaginaMaster';
import { Styleguide } from './pagine/Styleguide';
import { useApp } from './store';

export function App() {
  const percorso = usePercorso();
  const [, sezione, codice] = percorso.split('/');

  let pagina = <Home />;
  if (sezione === 'mockup') pagina = <PaginaMockup schermata={codice} />;
  if (sezione === 'styleguide') pagina = <Styleguide />;
  if (sezione === 'master' && codice) pagina = <PaginaMaster codice={codice.toUpperCase()} />;
  if (sezione === 'g' && codice) pagina = <PaginaGiocatore codice={codice.toUpperCase()} />;

  return (
    <Paracadute>
      {pagina}
      <Avviso />
    </Paracadute>
  );
}

/**
 * Se qualcosa va storto, niente schermo nero: si mostra un messaggio e si ricarica.
 * La partita è salvata (sul server o nell'archivio del Master) e riparte da dov'era.
 */
class Paracadute extends Component<{ children: ReactNode }, { errore: Error | null }> {
  state = { errore: null as Error | null };
  static getDerivedStateFromError(errore: Error) {
    return { errore };
  }
  render() {
    if (!this.state.errore) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-notte-900 px-6 text-center text-luna">
        <p className="font-titolo text-2xl text-oro-chiaro">Un intoppo nel villaggio</p>
        <p className="text-argento">Qualcosa è andato storto. La partita è salvata: ricarica e si riparte da dove eravate.</p>
        <button className="min-h-12 rounded-2xl bg-oro px-6 font-maiuscolo font-semibold text-inchiostro" onClick={() => location.reload()}>
          Ricarica
        </button>
        <p className="max-w-sm break-words text-[0.75rem] text-argento/70">{this.state.errore.message}</p>
      </div>
    );
  }
}

/** Errori del server (comando rifiutato, rete assente): notifica in alto, si chiude toccandola. */
function Avviso() {
  const errore = useApp((s) => s.errore);
  const pulisci = useApp((s) => s.pulisciErrore);
  if (!errore) return null;
  return (
    <button
      role="alert"
      onClick={pulisci}
      className="compari fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-pericolo bg-notte-900/95 px-4 py-3 text-left text-luna shadow-2xl"
    >
      <span className="flex-1">{errore}</span>
      <span aria-hidden className="text-argento">✕</span>
    </button>
  );
}
