import Peer, { type DataConnection } from 'peerjs';
import type { Canale, CanaleVersoHost } from '../trasporto';
import { idPeerDelCodice, type HostLocale } from './host';
import type { Connettore } from './ospite';

// Collegamento diretto tra telefoni (WebRTC) tramite PeerJS.
// Il servizio pubblico gratuito di PeerJS serve solo a "presentarsi"; poi i dati viaggiano da telefono a telefono.
// PeerJS include anche server STUN/TURN pubblici per superare le reti mobili più chiuse.

function canaleDa<In, Out>(conn: DataConnection): Canale<In, Out> {
  return {
    invia: (m) => {
      if (conn.open) void conn.send(m);
    },
    suMessaggio: (cb) => conn.on('data', (d) => cb(d as In)),
    suChiusura: (cb) => {
      let fatto = false;
      const una = () => {
        if (!fatto) {
          fatto = true;
          cb();
        }
      };
      conn.on('close', una);
      conn.on('error', una);
    },
    chiudi: () => conn.close(),
  };
}

const ERRORI_DA_RIPROVARE = ['unavailable-id', 'network', 'server-error', 'socket-error', 'socket-closed'];

/**
 * Apre il "tavolo" del Master sulla rete: gli ospiti lo raggiungono dal codice della partita.
 * Restituisce la funzione per chiuderlo.
 */
export function apriTavolo(host: HostLocale): () => void {
  let peer: Peer | null = null;
  let chiuso = false;
  let tentativo: ReturnType<typeof setTimeout> | undefined;

  const avvia = () => {
    if (chiuso) return;
    const p = new Peer(idPeerDelCodice(host.codice), { debug: 1 });
    peer = p;
    p.on('open', () => host.impostaReteAperta(true));
    p.on('connection', (conn) => conn.on('open', () => host.accogli(canaleDa(conn))));
    p.on('disconnected', () => {
      host.impostaReteAperta(false);
      if (!chiuso && !p.destroyed) p.reconnect();
    });
    p.on('error', (e) => {
      if (!ERRORI_DA_RIPROVARE.includes(e.type)) return;
      host.impostaReteAperta(false);
      // 'unavailable-id': il nome è ancora occupato dalla sessione precedente (pagina ricaricata): riprovo tra poco.
      p.destroy();
      clearTimeout(tentativo);
      tentativo = setTimeout(avvia, 3000);
    });
  };
  avvia();

  // Tornando in primo piano (telefono sbloccato) si controlla che il tavolo sia ancora aperto.
  const visibilita = () => {
    if (document.visibilityState !== 'visible' || chiuso || !peer) return;
    if (peer.destroyed) avvia();
    else if (peer.disconnected) peer.reconnect();
  };
  document.addEventListener('visibilitychange', visibilita);

  return () => {
    chiuso = true;
    clearTimeout(tentativo);
    document.removeEventListener('visibilitychange', visibilita);
    peer?.destroy();
    host.impostaReteAperta(false);
  };
}

let peerOspite: Promise<Peer> | null = null;

function prendiPeerOspite(): Promise<Peer> {
  peerOspite ??= new Promise<Peer>((ok, ko) => {
    const p = new Peer({ debug: 1 });
    p.on('open', () => ok(p));
    p.on('error', (e) => {
      if (p.open) return;
      peerOspite = null;
      p.destroy();
      ko(new Error(e.type === 'browser-incompatible' ? 'Questo browser non supporta il collegamento diretto.' : 'Nessuna connessione a internet.'));
    });
    p.on('disconnected', () => {
      if (!p.destroyed) p.reconnect();
    });
  });
  return peerOspite;
}

/** Collega il telefono di un amico al telefono del Master che ospita la partita `codice`. */
export const connettiAlMaster: Connettore = async (codice) => {
  const peer = await prendiPeerOspite();
  const idMaster = idPeerDelCodice(codice);
  return new Promise<CanaleVersoHost>((ok, ko) => {
    const conn = peer.connect(idMaster, { reliable: true, serialization: 'json' });
    const fine = (errore?: string) => {
      clearTimeout(scadenza);
      peer.off('error', suErrore);
      if (errore) {
        conn.close();
        ko(new Error(errore));
      }
    };
    const suErrore = (e: { type: string; message: string }) => {
      if (e.type === 'peer-unavailable' && e.message.includes(idMaster))
        fine('Il telefono del Master non è raggiungibile: controlla il codice e che abbia l\'app aperta.');
    };
    const scadenza = setTimeout(() => fine('Il telefono del Master non risponde. Ha l\'app aperta?'), 15_000);
    peer.on('error', suErrore);
    conn.on('open', () => {
      fine();
      ok(canaleDa(conn));
    });
  });
};
