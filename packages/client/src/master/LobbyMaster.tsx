import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  regia, registroRuoli, suggerisciComposizione, totaleRuoli, validaComposizione,
  type Composizione, type DatiRuoloPersonalizzato, type Fazione, type ImpostazioniParziali, type PacchettoVista, type VistaMaster,
} from '@lupus/engine';
import { Avatar, Chip, Foglio, Interruttore, Pallino, Pannello, Pulsante, Selettore, TitoloSezione } from '../ds/componenti';
import { Sfondo } from '../ds/Sfondo';
import { linkPartita } from '../percorso';
import { api } from '../rete/api';
import { preset as archivioPreset, type Preset } from '../rete/connessione';
import { useApp } from '../store';
import { plurale } from '../utilita';
import { comeStato } from './pannelli';

export function LobbyMaster({ pacchetto }: { pacchetto: PacchettoVista }) {
  const v = pacchetto.vista as VistaMaster;
  const invia = useApp((s) => s.invia);
  const [impostazioni, setImpostazioni] = useState(false);
  const r = regia(comeStato(v));
  const esito = validaComposizione(v.composizione, v.giocatori.length, registroRuoli(v.ruoliPersonalizzati), v.impostazioni.setEsteso);

  return (
    <div data-tema="notte" className="relative min-h-dvh text-testo">
      <Sfondo fisso />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-4 px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-4">
          <IntestazioneStanza codice={pacchetto.codice} />
          <GiroDelTavolo v={v} connessi={pacchetto.connessi} />
        </div>
        <div className="flex flex-col gap-4">
          <EditorComposizione v={v} />
          <Pannello>
            <Pulsante variante="fantasma" className="w-full" onClick={() => setImpostazioni(true)}>Varianti delle regole</Pulsante>
            <div className="mt-3 flex flex-col gap-1 text-[0.9rem]">
              {esito.errori.map((e) => <p key={e} className="text-pericolo">⛔ {e}</p>)}
              {esito.avvisi.map((e) => <p key={e} className="text-accento">⚠ {e}</p>)}
            </div>
            <Pulsante grande className="mt-3 w-full" disabled={!r.principale} onClick={() => r.principale && void invia(r.principale.comando)}>
              Distribuisci i ruoli
            </Pulsante>
          </Pannello>
        </div>
      </div>
      <Foglio aperto={impostazioni} onChiudi={() => setImpostazioni(false)} titolo="Varianti delle regole">
        <Varianti v={v} />
      </Foglio>
    </div>
  );
}

function IntestazioneStanza({ codice }: { codice: string }) {
  const modalita = useApp((s) => s.modalita);
  const connesso = useApp((s) => s.connesso);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState('');

  useEffect(() => {
    let annullato = false;
    (async () => {
      // Con il server in casa e il Master su "localhost", nel QR mettiamo l'IP della rete locale.
      let origine = window.location.origin;
      if (modalita === 'server' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
        const ip = (await api.rete().catch(() => ({ indirizzi: [] }))).indirizzi[0];
        if (ip) origine = `${window.location.protocol}//${ip}${window.location.port ? `:${window.location.port}` : ''}`;
      }
      const url = linkPartita(codice, origine);
      const dati = await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#0b1026', light: '#efe3c4' } });
      if (!annullato) {
        setLink(url);
        setQr(dati);
      }
    })();
    return () => {
      annullato = true;
    };
  }, [codice, modalita]);

  const messaggio = `Giochiamo a Lupus in Tabula! Entra nel villaggio: ${link}`;
  const invita = async () => {
    try {
      if (navigator.share) return await navigator.share({ title: 'Lupus in Tabula', text: messaggio });
    } catch {
      return; // condivisione annullata
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(messaggio)}`, '_blank', 'noopener');
  };

  return (
    <Pannello className="flex flex-col items-center gap-3 text-center">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:text-left">
        {qr ? <img src={qr} alt={`QR per entrare nella partita ${codice}`} className="h-44 w-44 rounded-2xl border-4 border-pergamena" /> : <div className="h-44 w-44" />}
        <div>
          <p className="font-maiuscolo text-[0.75rem] uppercase tracking-[0.25em] text-testo-tenue">Codice della partita</p>
          <p className="font-maiuscolo text-5xl font-bold tracking-[0.15em] text-oro-chiaro">{codice}</p>
          {modalita === 'p2p' && (
            <p className="mt-2">
              <Chip tono={connesso ? 'oro' : 'sangue'}>{connesso ? 'Tavolo aperto: si può entrare' : 'Apro il tavolo in rete…'}</Chip>
            </p>
          )}
        </div>
      </div>
      <Pulsante variante="fantasma" className="w-full" disabled={!link} onClick={() => void invita()}>
        Invita (WhatsApp, messaggi…)
      </Pulsante>
      <p className="break-all text-[0.75rem] text-testo-tenue">{link}</p>
    </Pannello>
  );
}

function GiroDelTavolo({ v, connessi }: { v: VistaMaster; connessi: Record<string, boolean> }) {
  const invia = useApp((s) => s.invia);
  const ordine = v.giocatori.map((g) => g.id);
  const sposta = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= ordine.length) return;
    const nuovo = [...ordine];
    [nuovo[i], nuovo[j]] = [nuovo[j]!, nuovo[i]!];
    void invia({ tipo: 'riordinaGiocatori', ordine: nuovo });
  };
  return (
    <Pannello>
      <TitoloSezione destra={<Chip>{plurale(v.giocatori.length, 'giocatore', 'giocatori')}</Chip>}>Il giro del tavolo</TitoloSezione>
      {v.giocatori.length === 0 && <p className="text-testo-tenue">Nessuno ancora: fate scansionare il QR.</p>}
      <ol className="flex flex-col gap-2">
        {v.giocatori.map((g, i) => (
          <li key={g.id} className="flex items-center gap-1 rounded-2xl border border-testo/10 bg-riga py-1 pl-2 pr-1">
            <span className="w-5 text-right text-[0.8rem] text-testo-tenue">{i + 1}</span>
            <Avatar nome={g.nome} piccolo />
            <span className="min-w-0 flex-1 truncate pl-1">{g.nome}</span>
            <Pallino acceso={!!connessi[g.id]} />
            <button aria-label={`Sposta su ${g.nome}`} className="h-12 w-9 text-lg" onClick={() => sposta(i, -1)}>↑</button>
            <button aria-label={`Sposta giù ${g.nome}`} className="h-12 w-9 text-lg" onClick={() => sposta(i, 1)}>↓</button>
            <button
              aria-label={`Rinomina ${g.nome}`}
              className="h-12 w-9"
              onClick={() => {
                const nome = prompt('Nuovo nickname', g.nome);
                if (nome) void invia({ tipo: 'rinominaGiocatore', id: g.id, nome });
              }}
            >
              ✎
            </button>
            <button aria-label={`Espelli ${g.nome}`} className="h-12 w-9 text-pericolo" onClick={() => confirm(`Togliere ${g.nome} dal tavolo?`) && void invia({ tipo: 'rimuoviGiocatore', id: g.id })}>
              ✕
            </button>
          </li>
        ))}
      </ol>
      <Pulsante
        variante="fantasma"
        className="mt-3 w-full"
        onClick={() => {
          const nome = prompt('Nome del giocatore senza telefono');
          if (nome) void invia({ tipo: 'aggiungiGiocatore', id: 'nuovo', nome });
        }}
      >
        + Aggiungi un giocatore senza telefono
      </Pulsante>
    </Pannello>
  );
}

function EditorComposizione({ v }: { v: VistaMaster }) {
  const invia = useApp((s) => s.invia);
  const identita = useApp((s) => s.identita);
  const [preset, setPreset] = useState<Preset[]>([]);
  const [ruoliPers, setRuoliPers] = useState(false);
  const n = v.giocatori.length;
  const registro = useMemo(() => registroRuoli(v.ruoliPersonalizzati), [v.ruoliPersonalizzati]);
  const ruoli = [...registro.values()].filter((r) => r.set !== 'esteso' || v.impostazioni.setEsteso);
  const imposta = (c: Composizione) => void invia({ tipo: 'impostaComposizione', composizione: c });
  const cambia = (id: string, d: number) => imposta({ ...v.composizione, [id]: Math.max(0, (v.composizione[id] ?? 0) + d) });
  const token = identita?.tipo === 'master' ? identita.tokenMaster : '';

  const ricarica = () => archivioPreset.elenco().then(setPreset).catch(() => setPreset([]));
  useEffect(() => void ricarica(), []);

  return (
    <Pannello>
      <TitoloSezione destra={<Chip tono={totaleRuoli(v.composizione) === n ? 'oro' : 'sangue'}>{totaleRuoli(v.composizione)} ruoli / {n}</Chip>}>
        Composizione
      </TitoloSezione>
      <div className="mb-3 flex flex-wrap gap-2">
        <Pulsante variante="fantasma" onClick={() => imposta(suggerisciComposizione(n))} disabled={n === 0}>Suggerisci per {n}</Pulsante>
        <Pulsante variante="fantasma" onClick={() => setRuoliPers(true)}>Ruoli personalizzati</Pulsante>
      </div>
      <Interruttore
        etichetta="Set esteso"
        descrizione="Cartomante, Mucca mannara, Mortovivo"
        valore={v.impostazioni.setEsteso}
        onCambia={(x) => void invia({ tipo: 'impostaImpostazioni', impostazioni: { setEsteso: x } })}
      />
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {ruoli.map((r) => (
          <li key={r.id} className="flex items-center gap-1 rounded-2xl border border-testo/10 bg-riga py-1 pl-3 pr-1">
            <span className="min-w-0 flex-1 truncate">{r.nome}</span>
            <button aria-label={`Togli ${r.nome}`} className="h-12 w-11 text-2xl" onClick={() => cambia(r.id, -1)}>−</button>
            <span className="w-6 text-center font-maiuscolo text-lg">{v.composizione[r.id] ?? 0}</span>
            <button aria-label={`Aggiungi ${r.nome}`} className="h-12 w-11 text-2xl" onClick={() => cambia(r.id, 1)}>+</button>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-testo/10 pt-3">
        <p className="mb-2 font-maiuscolo text-[0.75rem] uppercase tracking-[0.18em] text-accento">Preset</p>
        <div className="flex flex-wrap gap-2">
          {preset.map((p) => (
            <span key={p.id} className="inline-flex items-center rounded-xl border border-bordo">
              <button
                className="min-h-11 px-3"
                onClick={() => {
                  imposta(p.composizione);
                  if (p.impostazioni) void invia({ tipo: 'impostaImpostazioni', impostazioni: p.impostazioni as ImpostazioniParziali });
                }}
              >
                {p.nome}
              </button>
              <button aria-label={`Elimina ${p.nome}`} className="min-h-11 px-2 text-testo-tenue" onClick={() => confirm(`Eliminare il preset "${p.nome}"?`) && void archivioPreset.elimina(token, p.id).then(ricarica)}>
                ✕
              </button>
            </span>
          ))}
          <Pulsante
            variante="fantasma"
            onClick={() => {
              const nome = prompt('Nome del preset (es. "Classica 10")', `Serata ${n}`);
              if (nome)
                void archivioPreset
                  .salva(token, { nome, composizione: v.composizione, impostazioni: v.impostazioni as unknown as Record<string, unknown> })
                  .then(ricarica);
            }}
          >
            Salva come preset
          </Pulsante>
        </div>
      </div>

      <Foglio aperto={ruoliPers} onChiudi={() => setRuoliPers(false)} titolo="Ruoli personalizzati">
        <EditorRuoliPersonalizzati v={v} />
      </Foglio>
    </Pannello>
  );
}

function EditorRuoliPersonalizzati({ v }: { v: VistaMaster }) {
  const invia = useApp((s) => s.invia);
  const vuoto: DatiRuoloPersonalizzato = { id: '', nome: '', fazione: 'villaggio', aura: 'non_lupo', contaComeLupo: false, agisceDiNotte: false, descrizione: '' };
  const [r, setR] = useState(vuoto);
  const idDa = (nome: string) => nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.9rem] text-testo-tenue">
        Ruoli semplici: l'app li distribuisce e, di notte, ti mostra la scelta del giocatore. Gli effetti li applichi tu (per esempio con "Elimina" nella tabella).
      </p>
      {v.ruoliPersonalizzati.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-xl bg-riga px-3 py-2">
          <span>{p.nome} <span className="text-[0.8rem] text-testo-tenue">· {p.fazione}{p.azione.tipo !== 'nessuna' ? ' · agisce di notte' : ''}</span></span>
          <button className="min-h-11 px-2 text-pericolo" onClick={() => void invia({ tipo: 'rimuoviRuoloPersonalizzato', id: p.id })}>✕</button>
        </div>
      ))}
      <input
        placeholder="Nome del ruolo"
        value={r.nome}
        maxLength={30}
        onChange={(e) => setR({ ...r, nome: e.target.value, id: idDa(e.target.value) })}
        className="min-h-12 rounded-xl border border-bordo bg-riga px-3"
      />
      <textarea
        placeholder="Cosa fa (testo della carta)"
        value={r.descrizione}
        maxLength={160}
        onChange={(e) => setR({ ...r, descrizione: e.target.value })}
        className="min-h-20 rounded-xl border border-bordo bg-riga p-3"
      />
      <Selettore<Fazione>
        etichetta="Fazione"
        valore={r.fazione}
        opzioni={[{ valore: 'villaggio', etichetta: 'Villaggio' }, { valore: 'lupi', etichetta: 'Lupi' }, { valore: 'criceto', etichetta: 'Solitario' }, { valore: 'personalizzata', etichetta: 'Altro' }]}
        onCambia={(fazione) => setR({ ...r, fazione })}
      />
      <Interruttore etichetta="Il Veggente lo vede lupo" valore={r.aura === 'lupo'} onCambia={(x) => setR({ ...r, aura: x ? 'lupo' : 'non_lupo' })} />
      <Interruttore etichetta="Conta come lupo per la vittoria" valore={r.contaComeLupo} onCambia={(x) => setR({ ...r, contaComeLupo: x })} />
      <Interruttore etichetta="Agisce di notte" valore={r.agisceDiNotte} onCambia={(x) => setR({ ...r, agisceDiNotte: x })} />
      <Pulsante
        disabled={!r.id || !r.descrizione.trim()}
        onClick={() => {
          void invia({ tipo: 'aggiungiRuoloPersonalizzato', ruolo: r });
          setR(vuoto);
        }}
      >
        Aggiungi il ruolo
      </Pulsante>
    </div>
  );
}

/** Tutte le varianti di RULES.md, modificabili prima di distribuire i ruoli. */
function Varianti({ v }: { v: VistaMaster }) {
  const invia = useApp((s) => s.invia);
  const i = v.impostazioni;
  const set = (impostazioni: ImpostazioniParziali) => void invia({ tipo: 'impostaImpostazioni', impostazioni });
  const [min, max] = i.attesaFintaMs;
  return (
    <div className="flex flex-col gap-1">
      <p className="mt-1 font-maiuscolo text-[0.75rem] uppercase tracking-[0.18em] text-accento">Prima notte</p>
      <Interruttore etichetta="I lupi sbranano già la prima notte" valore={i.primaNotte.lupiUccidono} onCambia={(x) => set({ primaNotte: { lupiUccidono: x } })} />
      <Interruttore etichetta="Il Veggente agisce la prima notte" valore={i.primaNotte.veggenteAgisce} onCambia={(x) => set({ primaNotte: { veggenteAgisce: x } })} />
      <Interruttore etichetta="Il Gufo agisce la prima notte" valore={i.primaNotte.gufoAgisce} onCambia={(x) => set({ primaNotte: { gufoAgisce: x } })} />

      <p className="mt-3 font-maiuscolo text-[0.75rem] uppercase tracking-[0.18em] text-accento">Notte</p>
      <Selettore etichetta="Se i lupi non sono d'accordo" valore={i.lupiDisaccordo} opzioni={[{ valore: 'master', etichetta: 'Decide il Master' }, { valore: 'maggioranza', etichetta: 'Vince la maggioranza' }]} onCambia={(x) => set({ lupiDisaccordo: x })} />
      <Interruttore etichetta="Il Veggente vede subito il risultato" valore={i.veggenteRisultatoSubito} onCambia={(x) => set({ veggenteRisultatoSubito: x })} />
      <Interruttore etichetta="La Guardia non protegge la stessa persona due notti di fila" valore={i.guardiaNonStessoDueNotti} onCambia={(x) => set({ guardiaNonStessoDueNotti: x })} />
      <Interruttore etichetta="Il Gufo può indicare se stesso" valore={i.gufoPuoSeStesso} onCambia={(x) => set({ gufoPuoSeStesso: x })} />
      <Interruttore etichetta="Il Mitomane copia qualsiasi ruolo" valore={i.mitomaneCopiaQualsiasi} onCambia={(x) => set({ mitomaneCopiaQualsiasi: x })} />
      <Selettore
        etichetta="Attesa finta per i ruoli morti"
        valore={`${min}-${max}`}
        opzioni={[{ valore: '3000-6000', etichetta: '3–6 s' }, { valore: '6000-12000', etichetta: '6–12 s' }, { valore: '10000-20000', etichetta: '10–20 s' }]}
        onCambia={(x) => set({ attesaFintaMs: x.split('-').map(Number) as [number, number] })}
      />

      <p className="mt-3 font-maiuscolo text-[0.75rem] uppercase tracking-[0.18em] text-accento">Morti</p>
      <Selettore etichetta="Ruolo dei morti" valore={i.rivelaRuoloMorti} opzioni={[{ valore: 'nascosto', etichetta: 'Nascosto' }, { valore: 'fazione', etichetta: 'Solo fazione' }, { valore: 'ruolo', etichetta: 'Ruolo completo' }]} onCambia={(x) => set({ rivelaRuoloMorti: x })} />

      <p className="mt-3 font-maiuscolo text-[0.75rem] uppercase tracking-[0.18em] text-accento">Votazioni</p>
      <Interruttore etichetta="Si può votare se stessi" valore={i.nomination.autovoto} onCambia={(x) => set({ nomination: { autovoto: x } })} />
      <Interruttore etichetta="Astensione permessa (nomination)" valore={i.nomination.astensione} onCambia={(x) => set({ nomination: { astensione: x } })} />
      <Selettore
        etichetta="Pareggio per il secondo posto"
        valore={i.nomination.pareggio}
        opzioni={[{ valore: 'tutti', etichetta: 'Vanno tutti' }, { valore: 'rivoto', etichetta: 'Si rivota' }, { valore: 'master', etichetta: 'Decide il Master' }, { valore: 'sorteggio', etichetta: 'Sorteggio' }]}
        onCambia={(x) => set({ nomination: { pareggio: x } })}
      />
      <Selettore
        etichetta="Un solo votato"
        valore={i.nomination.unSoloVotato}
        opzioni={[{ valore: 'master_aggiunge', etichetta: 'Il Master aggiunge un candidato' }, { valore: 'rogo_diretto', etichetta: 'Va dritto al rogo' }]}
        onCambia={(x) => set({ nomination: { unSoloVotato: x } })}
      />
      <Interruttore etichetta="Voti visibili in diretta" valore={i.votiVisibiliInDiretta} onCambia={(x) => set({ votiVisibiliInDiretta: x })} />
      <Interruttore etichetta="I candidati votano al ballottaggio" valore={i.ballottaggio.candidatiVotano} onCambia={(x) => set({ ballottaggio: { candidatiVotano: x } })} />
      <Interruttore etichetta="Astensione permessa (ballottaggio)" valore={i.ballottaggio.astensione} onCambia={(x) => set({ ballottaggio: { astensione: x } })} />
      <Selettore
        etichetta="Pareggio al ballottaggio"
        valore={i.ballottaggio.pareggio}
        opzioni={[{ valore: 'rivoto_poi_master', etichetta: 'Rivoto, poi il Master' }, { valore: 'master', etichetta: 'Decide il Master' }, { valore: 'sorteggio', etichetta: 'Sorteggio' }, { valore: 'nessuno', etichetta: 'Nessun morto' }]}
        onCambia={(x) => set({ ballottaggio: { pareggio: x } })}
      />

      <p className="mt-3 font-maiuscolo text-[0.75rem] uppercase tracking-[0.18em] text-accento">Suoni</p>
      <Interruttore etichetta="Suoni sul dispositivo del Master" valore={i.suoni.master} onCambia={(x) => set({ suoni: { master: x } })} />
      <Interruttore etichetta="Suoni sui telefoni dei giocatori" descrizione="Sconsigliato: di notte potrebbero tradire qualcuno" valore={i.suoni.giocatori} onCambia={(x) => set({ suoni: { giocatori: x } })} />
    </div>
  );
}
