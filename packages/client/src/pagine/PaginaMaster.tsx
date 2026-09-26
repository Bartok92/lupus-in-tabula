import { useEffect, useState } from 'react';
import { archivio } from '../archivio';
import { Pannello, Pulsante } from '../ds/componenti';
import { Sfondo } from '../ds/Sfondo';
import { useWakeLock } from '../hooks';
import { LobbyMaster } from '../master/LobbyMaster';
import { Regia } from '../master/Regia';
import { vai } from '../percorso';
import { useApp } from '../store';

export function PaginaMaster({ codice }: { codice: string }) {
  const entra = useApp((s) => s.entraComeMaster);
  const pacchetto = useApp((s) => s.pacchetto);
  const espulso = useApp((s) => s.espulso);
  const [problema, setProblema] = useState<string | null>(null);
  // Il telefono del Master deve restare acceso: soprattutto quando è lui a ospitare la partita.
  useWakeLock(true);

  useEffect(() => {
    const token = archivio.tokenMaster(codice);
    if (!token) {
      setProblema('Su questo telefono non risulti il Master di questa partita.');
      return;
    }
    void entra(codice, token).then((r) => !r.ok && setProblema(r.errore));
  }, [codice, entra]);

  if (problema || espulso) {
    return (
      <div data-tema="notte" className="relative min-h-dvh text-testo">
        <Sfondo fisso />
        <main className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
          <Pannello className="text-center">
            <p className="mb-4">{problema ?? 'La partita non esiste più.'}</p>
            <Pulsante onClick={() => vai('/')}>Torna all'inizio</Pulsante>
          </Pannello>
        </main>
      </div>
    );
  }
  if (!pacchetto || pacchetto.vista.tipo !== 'master' || pacchetto.codice !== codice) {
    return <div data-tema="notte" className="relative min-h-dvh"><Sfondo fisso /></div>;
  }
  return pacchetto.vista.fase === 'lobby' ? <LobbyMaster pacchetto={pacchetto} /> : <Regia pacchetto={pacchetto} />;
}
