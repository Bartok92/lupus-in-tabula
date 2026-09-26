import { useEffect, useState, type ReactNode } from 'react';
import { archivio } from '../archivio';
import { Pannello, Pulsante } from '../ds/componenti';
import { Sfondo } from '../ds/Sfondo';
import { SchermoGiocatore } from '../giocatore/SchermoGiocatore';
import { vai } from '../percorso';
import { useApp } from '../store';

function Cornice({ children }: { children: ReactNode }) {
  return (
    <div data-tema="notte" className="relative min-h-dvh text-testo">
      <Sfondo fisso />
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">{children}</main>
    </div>
  );
}

export function PaginaGiocatore({ codice }: { codice: string }) {
  const entra = useApp((s) => s.entraComeGiocatore);
  const identita = useApp((s) => s.identita);
  const pacchetto = useApp((s) => s.pacchetto);
  const espulso = useApp((s) => s.espulso);
  const [provaAutomatica, setProvaAutomatica] = useState(() => !!archivio.tokenGiocatore(codice));

  // Riconnessione: se questo telefono era già nella stanza, rientra da solo.
  useEffect(() => {
    if (!provaAutomatica) return;
    void entra(codice).then((r) => !r.ok && setProvaAutomatica(false));
  }, [codice, entra, provaAutomatica]);

  if (espulso)
    return (
      <Cornice>
        <Pannello className="text-center">
          <p className="mb-4">Sei uscito dalla stanza: il Master ti ha tolto dal tavolo, oppure la stanza è scaduta.</p>
          <Pulsante onClick={() => vai('/')}>Torna all'inizio</Pulsante>
        </Pannello>
      </Cornice>
    );

  const dentro = identita?.tipo === 'giocatore' && identita.codice === codice && pacchetto?.vista.tipo === 'giocatore' && pacchetto.codice === codice;
  if (dentro) return <SchermoGiocatore pacchetto={pacchetto} />;
  if (provaAutomatica) return <Cornice><p className="text-center text-testo-tenue">Rientro nella stanza…</p></Cornice>;
  return <FormNickname codice={codice} />;
}

function FormNickname({ codice }: { codice: string }) {
  const entra = useApp((s) => s.entraComeGiocatore);
  const [nickname, setNickname] = useState(archivio.ultimoNickname);
  const [attesa, setAttesa] = useState(false);

  return (
    <Cornice>
      <header className="text-center">
        <p className="font-maiuscolo text-[0.7rem] uppercase tracking-[0.35em] text-testo-tenue">Stanza {codice}</p>
        <h1 className="mt-1 font-titolo text-[2.1rem] leading-tight text-oro-chiaro drop-shadow-[0_0_18px_rgb(212_175_55/0.45)]">Lupus in Tabula</h1>
      </header>
      <Pannello>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setAttesa(true);
            archivio.salvaNickname(nickname.trim());
            await entra(codice, nickname.trim());
            setAttesa(false);
          }}
        >
          <label htmlFor="nick" className="font-maiuscolo text-[0.8rem] uppercase tracking-[0.18em] text-accento">Il tuo nome al tavolo</label>
          <input
            id="nick"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            autoComplete="nickname"
            className="min-h-14 rounded-2xl border border-bordo bg-riga px-4 text-xl outline-none focus:ring-2 focus:ring-accento"
          />
          <Pulsante type="submit" grande disabled={!nickname.trim() || attesa}>{attesa ? 'Entro…' : 'Entra nel villaggio'}</Pulsante>
        </form>
      </Pannello>
    </Cornice>
  );
}
