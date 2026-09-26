import { useState } from 'react';
import { regia, registroRuoli, type PacchettoVista, type VistaMaster } from '@lupus/engine';
import { Riepilogo } from '../comuni/Riepilogo';
import { Foglio, Interruttore, Pannello, Pulsante, Selettore, TitoloSezione } from '../ds/componenti';
import { IconaAnnulla, IconaLuna, IconaSole } from '../ds/icone';
import { Sfondo } from '../ds/Sfondo';
import { temaDellaFase, useRimanente, useSuoniFase, useTimer } from '../hooks';
import { useApp } from '../store';
import { ControlliTimer, comeStato, PannelloAlba, PannelloNotte, PannelloVoti, Registro, TabellaGiocatori, TimerCorrente } from './pannelli';

export function Regia({ pacchetto }: { pacchetto: PacchettoVista }) {
  const v = pacchetto.vista as VistaMaster;
  const invia = useApp((s) => s.invia);
  const ricevutoA = useApp((s) => s.ricevutoA);
  const timer = useTimer(pacchetto.timer, ricevutoA);
  const attesa = useRimanente(pacchetto.attesaRimanenteMs, ricevutoA);
  const [menu, setMenu] = useState(false);
  const tema = temaDellaFase(v.fase, v.vittoria?.fazione);
  const r = regia(comeStato(v));
  useSuoniFase(`${v.fase}:${v.votazione?.aperta ? 'voto' : ''}`, v.impostazioni.suoni.master);

  const bloccatoDaAttesa = attesa > 0 && r.principale && ['chiamaProssimoPasso', 'terminaNotte'].includes(r.principale.comando.tipo);
  const reg = registroRuoli(v.ruoliPersonalizzati);

  return (
    <div data-tema={tema} className="relative min-h-dvh text-testo">
      <Sfondo tema={tema} fisso />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-4 px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] md:grid-cols-2 md:items-start">
        <header className="flex items-center gap-2 md:col-span-2">
          <div className="min-w-0 flex-1">
            <p className="font-maiuscolo text-[0.7rem] uppercase tracking-[0.3em] text-testo-tenue">Regia · {pacchetto.codice}</p>
            <h1 className="flex items-center gap-2 font-titolo text-2xl">
              {tema === 'notte' ? <IconaLuna /> : <IconaSole className="text-accento" />} {r.titolo}
            </h1>
          </div>
          <button aria-label="Impostazioni rapide" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-bordo bg-superficie text-xl" onClick={() => setMenu(true)}>⚙</button>
          <button
            aria-label="Annulla l'ultima azione"
            disabled={v.annullabili === 0}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-bordo bg-superficie disabled:opacity-40"
            onClick={() => void invia({ tipo: 'annulla' })}
          >
            <IconaAnnulla />
          </button>
        </header>

        {v.fase === 'fine' ? (
          <div className="flex flex-col gap-4 md:col-span-2">
            <Riepilogo
              fazione={v.vittoria!.fazione}
              motivo={v.vittoria!.motivo}
              codice={pacchetto.codice}
              log={v.log}
              giocatori={v.giocatori.map((g) => ({
                id: g.id, nome: g.nome, vivo: g.vivo, carta: g.ruolo ? reg.get(g.ruolo) ?? null : null, vincitore: v.vittoria!.vincitori.includes(g.id),
              }))}
            />
            {r.principale && <Pulsante grande onClick={() => void invia(r.principale!.comando)}>{r.principale.etichetta}</Pulsante>}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <Pannello>
                {r.avviso && <p className="mb-3 rounded-xl bg-sangue/20 px-3 py-2 text-pericolo">{r.avviso}</p>}
                {r.principale ? (
                  <Pulsante
                    grande
                    variante={r.principale.tono === 'sangue' ? 'sangue' : 'oro'}
                    className="w-full"
                    disabled={!!bloccatoDaAttesa}
                    onClick={() => void invia(r.principale!.comando)}
                  >
                    {bloccatoDaAttesa ? `Attendi ${Math.ceil(attesa / 1000)} s…` : r.principale.etichetta}
                  </Pulsante>
                ) : (
                  <p className="text-center text-testo-tenue">Prendi una decisione qui sotto per andare avanti.</p>
                )}
                {r.principale?.dettaglio && <p className="mt-2 text-center text-[0.95rem] text-testo-tenue">{r.principale.dettaglio}</p>}
                {bloccatoDaAttesa && (
                  <p className="mt-1 text-center text-[0.85rem] text-testo-tenue">Il ruolo chiamato è morto: fai finta di aspettare, così nessuno lo capisce.</p>
                )}
                {r.secondarie.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {r.secondarie.map((a) => (
                      <Pulsante key={a.etichetta} variante="fantasma" disabled={attesa > 0 && a.comando.tipo === 'terminaNotte'} onClick={() => void invia(a.comando)}>
                        {a.etichetta}
                      </Pulsante>
                    ))}
                  </div>
                )}
              </Pannello>

              {timer && <TimerCorrente t={timer} />}
              {v.fase === 'notte' && <PannelloNotte v={v} />}
              {v.fase === 'alba' && <PannelloAlba v={v} />}
              {v.fase === 'discussione' && (
                <Pannello>
                  <TitoloSezione>Timer della discussione</TitoloSezione>
                  <ControlliTimer etichetta="Discussione" preset={[60, 120, 180, 300]} />
                </Pannello>
              )}
              {(v.fase === 'nomination' || v.fase === 'ballottaggio') && <PannelloVoti v={v} />}
              {v.fase === 'rogo' && v.ultimoRogo && (
                <Pannello>
                  <p className="text-lg">{v.ultimoRogo.id ? `Il rogo si porta via ${v.giocatori.find((g) => g.id === v.ultimoRogo!.id)?.nome} (${v.ultimoRogo.aura === 'lupo' ? 'era un lupo' : 'non era un lupo'}).` : 'Oggi nessuno è andato al rogo.'}</p>
                </Pannello>
              )}
              {v.fase === 'rivelazione' && (
                <Pannello>
                  <p>Tutti guardano la propria carta tenendo premuto lo schermo. Quando hanno confermato, fai scendere la notte.</p>
                </Pannello>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <TabellaGiocatori v={v} connessi={pacchetto.connessi} />
              <Registro v={v} codice={pacchetto.codice} />
            </div>
          </>
        )}
      </div>

      <Foglio aperto={menu} onChiudi={() => setMenu(false)} titolo="Impostazioni rapide">
        <ImpostazioniRapide v={v} />
      </Foglio>
    </div>
  );
}

function ImpostazioniRapide({ v }: { v: VistaMaster }) {
  const invia = useApp((s) => s.invia);
  const i = v.impostazioni;
  return (
    <div className="flex flex-col gap-1">
      <Interruttore etichetta="Suoni sul mio dispositivo" descrizione="Ululato, gallo, campana" valore={i.suoni.master} onCambia={(x) => void invia({ tipo: 'impostaImpostazioni', impostazioni: { suoni: { master: x } } })} />
      <Interruttore etichetta="Suoni sui telefoni dei giocatori" descrizione="Sconsigliato: di notte potrebbero tradire qualcuno" valore={i.suoni.giocatori} onCambia={(x) => void invia({ tipo: 'impostaImpostazioni', impostazioni: { suoni: { giocatori: x } } })} />
      <Interruttore etichetta="Voti visibili in diretta" valore={i.votiVisibiliInDiretta} onCambia={(x) => void invia({ tipo: 'impostaImpostazioni', impostazioni: { votiVisibiliInDiretta: x } })} />
      <Selettore
        etichetta="Ruolo dei morti"
        valore={i.rivelaRuoloMorti}
        opzioni={[{ valore: 'nascosto', etichetta: 'Nascosto' }, { valore: 'fazione', etichetta: 'Solo fazione' }, { valore: 'ruolo', etichetta: 'Ruolo completo' }]}
        onCambia={(x) => void invia({ tipo: 'impostaImpostazioni', impostazioni: { rivelaRuoloMorti: x } })}
      />
      <p className="mt-3 text-[0.85rem] text-testo-tenue">Le altre varianti si scelgono in lobby, prima di distribuire i ruoli.</p>
    </div>
  );
}
