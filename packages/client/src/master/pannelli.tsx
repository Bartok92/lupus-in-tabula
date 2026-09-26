import { useState } from 'react';
import {
  bersagliValidi, bersagliVoto, passoCorrente, registroRuoli, risolviNotte, votantiAmmessi, type EsitoNotte, type PassoNotte, type StatoPartita, type StatoTimer, type VistaMaster,
} from '@lupus/engine';
import { CLASSE_FAZIONE } from '../ds/Carta';
import { Chip, Foglio, ListaGiocatori, Pallino, Pannello, Pergamena, Pulsante, Timer, TitoloSezione } from '../ds/componenti';
import { IconaSpunta, IconaTeschio } from '../ds/icone';
import { BarreVoti } from '../giocatore/Giorno';
import { scaricaFile } from '../hooks';
import { useApp } from '../store';
import { elenco, nomeDi, testoCronaca, testoEsito } from '../utilita';

export const comeStato = (v: VistaMaster) => ({ ...v, _undo: [] }) as unknown as StatoPartita;

// ——— Scelta di uno o più giocatori (forzature e decisioni del Master) ———

export function SceltaGiocatori({
  aperto, onChiudi, titolo, candidati, multipla = false, conNessuno = false, onConferma, nomi,
}: {
  aperto: boolean; onChiudi: () => void; titolo: string; candidati: string[]; multipla?: boolean; conNessuno?: boolean;
  onConferma: (ids: (string | null)[]) => void; nomi: { id: string; nome: string }[];
}) {
  const [scelti, setScelti] = useState<string[]>([]);
  const NESSUNO = '__nessuno';
  const voci = candidati.map((id) => ({ id, nome: nomeDi(nomi, id) }));
  if (conNessuno) voci.push({ id: NESSUNO, nome: 'Nessuno' });
  return (
    <Foglio aperto={aperto} onChiudi={onChiudi} titolo={titolo}>
      {multipla ? (
        <ul className="flex flex-col gap-2">
          {voci.map((x) => {
            const sel = scelti.includes(x.id);
            return (
              <li key={x.id}>
                <button
                  role="checkbox"
                  aria-checked={sel}
                  onClick={() => setScelti(sel ? scelti.filter((s) => s !== x.id) : [...scelti, x.id])}
                  className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 ${sel ? 'border-accento bg-accento/15' : 'border-testo/10 bg-riga'}`}
                >
                  {x.nome} {sel && <IconaSpunta className="text-accento" />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ListaGiocatori voci={voci} selezionato={scelti[0] ?? null} onSeleziona={(id) => setScelti([id])} tonoSelezione="oro" />
      )}
      <Pulsante
        className="mt-4 w-full"
        disabled={scelti.length === 0}
        onClick={() => {
          onConferma(scelti.map((s) => (s === NESSUNO ? null : s)));
          setScelti([]);
          onChiudi();
        }}
      >
        Conferma
      </Pulsante>
    </Foglio>
  );
}

// ——— Notte: passi e scelte in diretta ———

function statoPasso(v: VistaMaster, i: number): 'fatto' | 'ora' | 'dopo' {
  const c = v.notte!.corrente;
  return i < c ? 'fatto' : i === c ? 'ora' : 'dopo';
}

function DettaglioPasso({ v, p }: { v: VistaMaster; p: PassoNotte }) {
  const reg = registroRuoli(v.ruoliPersonalizzati);
  const n = v.notte!;
  if (p.finto) return <span>nessuno in vita · attesa finta</span>;
  if (p.tipo === 'riconoscimento') return <span>si riconoscono</span>;
  if (p.tipo === 'informazione') {
    const info = v.indagini.filter((i) => i.notte === n.numero && i.fonte === 'medium').at(-1);
    return <span>{info ? (info.bersaglio ? `${nomeDi(v.giocatori, info.bersaglio)}: ${info.aura === 'lupo' ? 'LUPO' : 'non lupo'}` : 'ieri nessun rogo') : 'in attesa'}</span>;
  }
  const scelte = n.scelte[p.id] ?? {};
  const forzato = p.id in n.forzature;
  const righe = p.attori.map((a) => {
    const b = scelte[a];
    return `${nomeDi(v.giocatori, a)} → ${b === undefined ? '…' : b === null ? 'nessuno' : nomeDi(v.giocatori, b)}`;
  });
  const bersaglio = forzato ? n.forzature[p.id] : p.effetto === 'uccidi_branco' ? undefined : Object.values(scelte)[0];
  const auraBersaglio = p.effetto === 'indaga' && bersaglio ? reg.get(v.giocatori.find((g) => g.id === bersaglio)?.ruolo ?? '')?.aura : undefined;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {p.effetto === 'uccidi_branco' ? righe.join(' · ') : righe[0]}
      {forzato && <Chip tono="oro">imposto: {nomeDi(v.giocatori, n.forzature[p.id])}</Chip>}
      {auraBersaglio && <Chip tono={auraBersaglio === 'lupo' ? 'sangue' : 'luna'}>{auraBersaglio === 'lupo' ? 'LUPO' : 'non lupo'}</Chip>}
    </span>
  );
}

export function PassiNotte({ v, conForza = true }: { v: VistaMaster; conForza?: boolean }) {
  const invia = useApp((s) => s.invia);
  const [forza, setForza] = useState<PassoNotte | null>(null);
  const reg = registroRuoli(v.ruoliPersonalizzati);
  const n = v.notte!;
  const vivi = v.giocatori.filter((g) => g.vivo).map((g) => g.id);
  return (
    <>
      <ol className="flex flex-col">
        {n.passi.map((p, i) => {
          const st = v.fase === 'notte' ? statoPasso(v, i) : 'fatto';
          return (
            <li key={p.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[0.75rem] ${
                    st === 'fatto' ? 'border-oro bg-oro text-inchiostro' : st === 'ora' ? 'pulsa border-pericolo bg-sangue text-white' : 'border-testo/25 text-testo-tenue'
                  }`}
                >
                  {st === 'fatto' ? <IconaSpunta width={15} height={15} /> : i + 1}
                </span>
                {i < n.passi.length - 1 && <span className="w-px flex-1 bg-testo/15" />}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <p className={`leading-tight ${st === 'dopo' ? 'text-testo-tenue' : ''}`}>
                  <span className="font-maiuscolo font-semibold">{reg.get(p.ruolo)?.nome}</span>
                  {!p.finto && <> · {elenco(p.attori.map((a) => nomeDi(v.giocatori, a)))}</>}
                </p>
                {st !== 'dopo' && <div className="text-[0.9rem] text-testo-tenue"><DettaglioPasso v={v} p={p} /></div>}
              </div>
              {conForza && p.tipo === 'bersaglio' && st !== 'dopo' && (
                <button className="min-h-11 shrink-0 self-start rounded-xl border border-bordo px-2.5 text-[0.8rem] text-testo-tenue" onClick={() => setForza(p)}>
                  Forza
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <SceltaGiocatori
        aperto={!!forza}
        onChiudi={() => setForza(null)}
        titolo={`Imponi il bersaglio: ${forza ? reg.get(forza.ruolo)?.nome : ''}`}
        candidati={vivi}
        conNessuno
        nomi={v.giocatori}
        onConferma={([id]) => forza && void invia({ tipo: 'forzaBersaglio', passo: forza.id, bersaglio: id ?? null })}
      />
    </>
  );
}

export function AnteprimaAlba({ v, esito, titolo }: { v: VistaMaster; esito: EsitoNotte; titolo: string }) {
  const n = (id: string) => nomeDi(v.giocatori, id);
  const reg = registroRuoli(v.ruoliPersonalizzati);
  return (
    <Pergamena titolo={titolo}>
      {esito.lupiInDisaccordo && <p className="font-semibold text-sangue">I lupi non sono d'accordo: decidi tu la vittima.</p>}
      {esito.morti.length ? (
        <ul>
          {esito.morti.map((m) => (
            <li key={m.id}><b>{n(m.id)}</b> muore ({m.causa === 'lupi' ? 'vittima dei lupi' : 'per mano del Veggente'})</li>
          ))}
        </ul>
      ) : (
        <p><b>Nessun morto.</b></p>
      )}
      <div className="mt-1 text-[0.95rem] text-legno">
        {esito.salvati.map((s) => <p key={s.id}>{n(s.id)} si salva ({s.motivo === 'guardia' ? 'grazie alla Guardia' : 'immune ai lupi'}).</p>)}
        {esito.trasformazioni.map((t) => <p key={t.id}>{n(t.id)} diventa {reg.get(t.a)?.nome}.</p>)}
        {esito.gufo.length > 0 && <p>Il Gufo manda al ballottaggio: {elenco(esito.gufo.map(n))}.</p>}
        {esito.sceltePersonalizzate.map((c) => <p key={c.passo}>Ruolo personalizzato ({n(c.attore ?? '')}) → {n(c.bersaglio ?? '')}: applica tu l'effetto.</p>)}
      </div>
    </Pergamena>
  );
}

export function PannelloNotte({ v }: { v: VistaMaster }) {
  const s = comeStato(v);
  return (
    <>
      <Pannello>
        <TitoloSezione destra={<span className="text-[0.85rem] text-testo-tenue">passo {Math.max(0, v.notte!.corrente + 1)} di {v.notte!.passi.length}</span>}>
          La notte
        </TitoloSezione>
        <PassiNotte v={v} />
      </Pannello>
      <AnteprimaAlba v={v} esito={risolviNotte(s)} titolo="Se la notte finisse ora" />
    </>
  );
}

export function PannelloAlba({ v }: { v: VistaMaster }) {
  const invia = useApp((s) => s.invia);
  const [scegli, setScegli] = useState(false);
  if (v.alba?.confermata) {
    return (
      <Pergamena titolo={`Alba del giorno ${v.giorno}`}>
        <p>{v.alba.morti.length ? `Hai annunciato: ${elenco(v.alba.morti.map((id) => nomeDi(v.giocatori, id)))}.` : 'Hai annunciato: nessun morto.'}</p>
        {v.gufoBersagli.length > 0 && <p className="text-legno">Oggi al ballottaggio per il Gufo: {elenco(v.gufoBersagli.map((id) => nomeDi(v.giocatori, id)))}.</p>}
      </Pergamena>
    );
  }
  const esito = risolviNotte(comeStato(v));
  const lupo = v.notte!.passi.find((p) => p.effetto === 'uccidi_branco');
  const votiLupi = lupo ? Object.values(v.notte!.scelte[lupo.id] ?? {}).filter((x): x is string => !!x) : [];
  return (
    <>
      <AnteprimaAlba v={v} esito={esito} titolo="Prima di annunciare l'alba" />
      {esito.lupiInDisaccordo && lupo && (
        <Pulsante variante="sangue" onClick={() => setScegli(true)}>Scegli la vittima dei lupi</Pulsante>
      )}
      <Pannello>
        <TitoloSezione>Correggi la notte</TitoloSezione>
        <PassiNotte v={v} />
      </Pannello>
      <SceltaGiocatori
        aperto={scegli}
        onChiudi={() => setScegli(false)}
        titolo="Vittima dei lupi"
        candidati={[...new Set(votiLupi.length ? votiLupi : v.giocatori.filter((g) => g.vivo).map((g) => g.id))]}
        conNessuno
        nomi={v.giocatori}
        onConferma={([id]) => lupo && void invia({ tipo: 'forzaBersaglio', passo: lupo.id, bersaglio: id ?? null })}
      />
    </>
  );
}

// ——— Votazioni ———

export function PannelloVoti({ v }: { v: VistaMaster }) {
  const invia = useApp((s) => s.invia);
  const [decidi, setDecidi] = useState(false);
  const vt = v.votazione;
  const b = v.ballottaggio;

  if (v.fase === 'ballottaggio' && b?.sottofase === 'difesa') {
    return (
      <Pannello>
        <TitoloSezione>Al ballottaggio</TitoloSezione>
        <ListaGiocatori voci={b.candidati.map((id) => ({ id, nome: nomeDi(v.giocatori, id) }))} />
        <ControlliTimer etichetta="Difesa" preset={[30, 60, 90]} />
      </Pannello>
    );
  }
  if (!vt) return null;

  const vivi = v.giocatori.filter((g) => g.vivo).map((g) => g.id);
  const votanti = vivi.filter((id) => {
    const g = v.giocatori.find((x) => x.id === id)!;
    const def = registroRuoli(v.ruoliPersonalizzati).get(g.ruolo ?? '');
    const candidato = vt.tipo === 'ballottaggio' && !v.impostazioni.ballottaggio.candidatiVotano && b?.candidati.includes(id);
    return def?.puoVotare !== false && !candidato;
  });
  const mancano = votanti.filter((id) => !(id in vt.voti));
  const e = vt.esito;
  const serveDecisione = e && (e.tipo === 'serveSecondo' || (e.tipo === 'pareggio' && !e.rivoto));

  return (
    <>
      <Pannello>
        <TitoloSezione destra={<Chip tono={vt.aperta ? 'oro' : 'neutro'}>{vt.aperta ? 'aperta' : 'chiusa'}</Chip>}>
          {vt.tipo === 'nomination' ? 'Nomination' : 'Voto finale'}{vt.turno ? ` · turno ${vt.turno + 1}` : ''}
        </TitoloSezione>
        {vt.aperta && (
          <p className="text-testo-tenue">
            Hanno votato {Object.keys(vt.voti).length} su {votanti.length}.{mancano.length > 0 && <> Mancano: {elenco(mancano.map((id) => nomeDi(v.giocatori, id)))}.</>}
          </p>
        )}
        {!vt.aperta && <p className="text-lg">{testoEsito(e, v.giocatori)}</p>}
        {serveDecisione && (
          <Pulsante className="mt-3 w-full" onClick={() => setDecidi(true)}>
            {vt.tipo === 'nomination' ? 'Scegli tu i candidati' : 'Scegli tu chi va al rogo'}
          </Pulsante>
        )}
      </Pannello>
      <BarreVoti v={{ giocatori: v.giocatori }} voti={vt.voti} />
      <SceltaGiocatori
        aperto={decidi}
        onChiudi={() => setDecidi(false)}
        titolo={vt.tipo === 'nomination' ? 'Candidati al ballottaggio' : 'Chi va al rogo?'}
        multipla={vt.tipo === 'nomination'}
        conNessuno={vt.tipo === 'ballottaggio'}
        candidati={vt.tipo === 'nomination' ? vivi : (e?.tipo === 'pareggio' ? e.pari : b?.candidati ?? [])}
        nomi={v.giocatori}
        onConferma={(ids) =>
          vt.tipo === 'nomination'
            ? void invia({ tipo: 'scegliCandidati', candidati: [...(e && 'sicuri' in e ? e.sicuri : []), ...ids.filter((x): x is string => !!x)] })
            : void invia({ tipo: 'scegliCondannato', id: ids[0] ?? null })
        }
      />
    </>
  );
}

// ——— Timer ———

export function ControlliTimer({ etichetta, preset }: { etichetta: string; preset: number[] }) {
  const timer = useApp((s) => s.timer);
  const pacchetto = useApp((s) => s.pacchetto);
  const t = pacchetto?.timer;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {preset.map((sec) => (
          <Pulsante key={sec} variante="fantasma" onClick={() => void timer({ azione: 'avvia', secondi: sec, etichetta })}>
            {sec >= 60 ? `${sec / 60}′` : `${sec}″`}
          </Pulsante>
        ))}
      </div>
      {t && (
        <div className="flex flex-wrap gap-2">
          <Pulsante variante="fantasma" onClick={() => void timer({ azione: t.inPausa ? 'riprendi' : 'pausa' })}>{t.inPausa ? 'Riprendi' : 'Pausa'}</Pulsante>
          <Pulsante variante="fantasma" onClick={() => void timer({ azione: 'aggiungi', secondi: 30 })}>+30″</Pulsante>
          <Pulsante variante="fantasma" onClick={() => void timer({ azione: 'stop' })}>Stop</Pulsante>
        </div>
      )}
    </div>
  );
}

export function TimerCorrente({ t }: { t: StatoTimer | null }) {
  if (!t) return null;
  return (
    <div className="flex justify-center">
      <Timer rimanenteMs={t.rimanenteMs} durataMs={t.durataMs} etichetta={t.etichetta} inPausa={t.inPausa} />
    </div>
  );
}

// ——— Tabella dei giocatori con azioni del Master ———

export function TabellaGiocatori({ v, connessi }: { v: VistaMaster; connessi: Record<string, boolean> }) {
  const invia = useApp((s) => s.invia);
  const [aperto, setAperto] = useState<string | null>(null);
  const reg = registroRuoli(v.ruoliPersonalizzati);
  const g = v.giocatori.find((x) => x.id === aperto);
  const haAgito = (id: string) => v.fase === 'notte' && Object.values(v.notte?.scelte ?? {}).some((sc) => id in sc);

  return (
    <Pannello>
      <TitoloSezione destra={<Chip>{Object.values(connessi).filter(Boolean).length}/{v.giocatori.length} online</Chip>}>Giocatori</TitoloSezione>
      <table className="w-full text-left text-[0.95rem]">
        <thead className="font-maiuscolo text-[0.65rem] uppercase tracking-widest text-testo-tenue">
          <tr>
            <th className="pb-2 font-semibold">Nome</th>
            <th className="pb-2 font-semibold">Ruolo</th>
            <th className="pb-2 text-center font-semibold">{v.fase === 'rivelazione' ? 'Visto' : v.fase === 'notte' ? 'Azione' : ''}</th>
          </tr>
        </thead>
        <tbody>
          {v.giocatori.map((x) => {
            const def = reg.get(x.ruolo ?? '');
            return (
              <tr key={x.id} className="cursor-pointer border-t border-testo/10" onClick={() => setAperto(x.id)}>
                <td className="py-2.5">
                  <span className="flex items-center gap-2">
                    <Pallino acceso={!!connessi[x.id]} />
                    {!x.vivo && <IconaTeschio width={15} height={15} className="text-testo-tenue" />}
                    <span className={x.vivo ? '' : 'text-testo-tenue line-through'}>{x.nome}</span>
                  </span>
                </td>
                <td className={def ? CLASSE_FAZIONE[def.fazione] : ''}>
                  {def?.nome ?? '—'}{x.ruolo !== x.ruoloIniziale && x.ruoloIniziale && <span className="text-[0.75rem] text-testo-tenue"> (era {reg.get(x.ruoloIniziale)?.nome})</span>}
                </td>
                <td className="text-center">
                  {v.fase === 'rivelazione' ? (x.haVisto ? <IconaSpunta className="inline text-accento" /> : '…') : haAgito(x.id) ? <IconaSpunta className="inline text-accento" /> : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Foglio aperto={!!g} onChiudi={() => setAperto(null)} titolo={g?.nome ?? ''}>
        {g && (
          <div className="flex flex-col gap-2">
            <p className="text-testo-tenue">{reg.get(g.ruolo ?? '')?.nome} · {g.vivo ? 'in gioco' : 'fuori gioco'} · {connessi[g.id] ? 'online' : 'offline'}</p>
            {g.vivo ? (
              <Pulsante variante="sangue" onClick={() => { void invia({ tipo: 'uccidi', id: g.id }); setAperto(null); }}>Elimina (decisione del Master)</Pulsante>
            ) : (
              <Pulsante onClick={() => { void invia({ tipo: 'resuscita', id: g.id }); setAperto(null); }}>Riporta in vita</Pulsante>
            )}
            <Pulsante
              variante="fantasma"
              onClick={() => {
                const nome = prompt('Nuovo nickname', g.nome);
                if (nome) void invia({ tipo: 'rinominaGiocatore', id: g.id, nome });
                setAperto(null);
              }}
            >
              Rinomina
            </Pulsante>
            <PerContoDi v={v} id={g.id} onFatto={() => setAperto(null)} />
          </div>
        )}
      </Foglio>
    </Pannello>
  );
}

/**
 * Il Master agisce al posto di un giocatore (senza telefono, o con il telefono spento):
 * conferma la carta, vota, fa l'azione notturna. Il giocatore gliela indica a gesti.
 */
function PerContoDi({ v, id, onFatto }: { v: VistaMaster; id: string; onFatto: () => void }) {
  const invia = useApp((s) => s.invia);
  const [scelta, setScelta] = useState<'voto' | 'notte' | null>(null);
  const s = comeStato(v);
  const g = v.giocatori.find((x) => x.id === id)!;
  const passo = passoCorrente(s);
  const agisceOra = passo && passo.tipo === 'bersaglio' && passo.attori.includes(id);
  const puoVotare = !!v.votazione?.aperta && votantiAmmessi(s).includes(id);
  const nomeNotte = passo ? registroRuoli(v.ruoliPersonalizzati).get(passo.ruolo)?.nome : '';

  if (!(v.fase === 'rivelazione' && !g.haVisto) && !agisceOra && !puoVotare) return null;
  return (
    <div className="mt-3 border-t border-testo/10 pt-3">
      <p className="mb-2 font-maiuscolo text-[0.75rem] uppercase tracking-[0.18em] text-accento">Agisci per conto di {g.nome}</p>
      <div className="flex flex-col gap-2">
        {v.fase === 'rivelazione' && !g.haVisto && (
          <Pulsante variante="fantasma" onClick={() => { void invia({ tipo: 'confermaVisto', per: id }); onFatto(); }}>Ha visto la sua carta</Pulsante>
        )}
        {agisceOra && <Pulsante variante="fantasma" onClick={() => setScelta('notte')}>Scelta notturna ({nomeNotte})</Pulsante>}
        {puoVotare && <Pulsante variante="fantasma" onClick={() => setScelta('voto')}>Registra il suo voto</Pulsante>}
      </div>
      <SceltaGiocatori
        aperto={scelta !== null}
        onChiudi={() => setScelta(null)}
        titolo={scelta === 'voto' ? `Voto di ${g.nome}` : `Scelta di ${g.nome}`}
        candidati={scelta === 'voto' ? bersagliVoto(s, id) : passo && agisceOra ? bersagliValidi(s, passo, id) : []}
        conNessuno
        nomi={v.giocatori}
        onConferma={([b]) => {
          void invia(scelta === 'voto' ? { tipo: 'voto', bersaglio: b ?? null, per: id } : { tipo: 'azioneNotturna', bersaglio: b ?? null, per: id });
          onFatto();
        }}
      />
    </div>
  );
}

export function Registro({ v, codice }: { v: VistaMaster; codice: string }) {
  const [tutto, setTutto] = useState(false);
  const voci = [...v.log].reverse();
  return (
    <Pannello>
      <TitoloSezione destra={<button className="min-h-11 px-2 text-[0.85rem] text-testo-tenue" onClick={() => scaricaFile(`lupus-${codice}.txt`, testoCronaca(v.log))}>Esporta</button>}>
        Registro
      </TitoloSezione>
      <ol className="flex flex-col gap-1 text-[0.9rem]">
        {(tutto ? voci : voci.slice(0, 12)).map((l) => (
          <li key={l.n} className={l.pubblico ? '' : 'text-testo-tenue'}>{l.testo}</li>
        ))}
      </ol>
      {voci.length > 12 && (
        <button className="mt-2 min-h-11 text-[0.85rem] text-accento" onClick={() => setTutto(!tutto)}>{tutto ? 'Mostra meno' : `Mostra tutto (${voci.length})`}</button>
      )}
    </Pannello>
  );
}
