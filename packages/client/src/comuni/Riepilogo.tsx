import type { Fazione, VoceLog } from '@lupus/engine';
import { FronteCarta, type DatiCarta } from '../ds/Carta';
import { Pannello, Pulsante, TitoloSezione } from '../ds/componenti';
import { ScenaVittoria } from '../ds/effetti';
import { IconaTeschio } from '../ds/icone';
import { scaricaFile } from '../hooks';
import { etichettaFase, testoCronaca } from '../utilita';

export interface GiocatoreRiepilogo {
  id: string;
  nome: string;
  vivo: boolean;
  carta: DatiCarta | null;
  vincitore: boolean;
}

/** Fine partita: chi ha vinto e "cosa è successo davvero" (ruoli di tutti e cronaca completa). */
export function Riepilogo({
  fazione, motivo, hoVinto, giocatori, log, codice,
}: {
  fazione: Fazione; motivo: string; hoVinto?: boolean; giocatori: GiocatoreRiepilogo[]; log: VoceLog[]; codice: string;
}) {
  const data = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-5">
      <ScenaVittoria fazione={fazione} hoVinto={hoVinto} />
      <p className="text-center text-testo-tenue">{motivo}</p>

      <Pannello>
        <TitoloSezione>Cosa è successo davvero</TitoloSezione>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {giocatori.map((g) => (
            <li key={g.id} className="flex flex-col items-center gap-1 text-center">
              <div className={`aspect-[5/7] w-full ${g.vivo ? '' : 'opacity-60 grayscale-[0.6]'}`}>
                {g.carta && <FronteCarta carta={g.carta} />}
              </div>
              <span className="flex items-center gap-1 text-[0.9rem] leading-tight">
                {!g.vivo && <IconaTeschio width={14} height={14} />} {g.nome}
              </span>
              <span className={`font-maiuscolo text-[0.65rem] uppercase tracking-widest ${g.vincitore ? 'text-accento' : 'text-testo-tenue'}`}>
                {g.vincitore ? 'ha vinto' : 'ha perso'}
              </span>
            </li>
          ))}
        </ul>
      </Pannello>

      <Pannello>
        <TitoloSezione>La cronaca</TitoloSezione>
        <ol className="flex flex-col gap-1.5 text-[0.95rem]">
          {log.map((l) => (
            <li key={l.n} className={l.pubblico ? '' : 'text-testo-tenue'}>
              <span className="mr-1.5 font-maiuscolo text-[0.65rem] uppercase tracking-wider text-accento">{etichettaFase(l)}</span>
              {l.testo}
            </li>
          ))}
        </ol>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Pulsante variante="fantasma" onClick={() => scaricaFile(`lupus-${codice}-${data}.txt`, testoCronaca(log))}>Scarica (.txt)</Pulsante>
          <Pulsante
            variante="fantasma"
            onClick={() => scaricaFile(`lupus-${codice}-${data}.json`, JSON.stringify({ fazione, motivo, giocatori, log }, null, 2), 'application/json')}
          >
            Scarica (.json)
          </Pulsante>
        </div>
      </Pannello>
    </div>
  );
}
