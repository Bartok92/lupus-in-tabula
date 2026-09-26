import type { Comando } from './comandi.js';
import type { ComandoTimer } from './eventi.js';

// Validazione dei dati in arrivo dai client: non ci si fida di nulla.
// Restituisce un comando "pulito" (solo i campi noti) oppure null.

const MAX_STR = 200;
type Campo = 'str' | 'str?' | 'strNull' | 'strArr' | 'numRec' | 'obj' | 'ruolo' | 'vittoria';

const SCHEMA: Record<Comando['tipo'], Record<string, Campo>> = {
  aggiungiGiocatore: { id: 'str', nome: 'str' },
  rimuoviGiocatore: { id: 'str' },
  rinominaGiocatore: { id: 'str', nome: 'str' },
  riordinaGiocatori: { ordine: 'strArr' },
  impostaComposizione: { composizione: 'numRec' },
  impostaImpostazioni: { impostazioni: 'obj' },
  aggiungiRuoloPersonalizzato: { ruolo: 'ruolo' },
  rimuoviRuoloPersonalizzato: { id: 'str' },
  avviaPartita: {},
  confermaVisto: { per: 'str?' },
  azioneNotturna: { bersaglio: 'strNull', per: 'str?' },
  voto: { bersaglio: 'strNull', per: 'str?' },
  iniziaNotte: {},
  chiamaProssimoPasso: {},
  forzaBersaglio: { passo: 'str', bersaglio: 'strNull' },
  terminaNotte: {},
  confermaAlba: {},
  iniziaDiscussione: {},
  apriNomination: {},
  chiudiVotazione: {},
  ripetiVoto: {},
  scegliCandidati: { candidati: 'strArr' },
  avviaBallottaggio: {},
  apriVotoBallottaggio: {},
  scegliCondannato: { id: 'strNull' },
  eseguiRogo: {},
  uccidi: { id: 'str' },
  resuscita: { id: 'str' },
  confermaVittoria: {},
  ignoraVittoria: {},
  terminaPartita: { vittoria: 'vittoria' },
  nuovaPartita: {},
  annulla: {},
};

const isStr = (x: unknown): x is string => typeof x === 'string' && x.length <= MAX_STR;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.length <= 100 && x.every(isStr);
const FAZIONI = ['villaggio', 'lupi', 'criceto', 'personalizzata'];

function valido(tipo: Campo, v: unknown): boolean {
  switch (tipo) {
    case 'str': return isStr(v);
    case 'str?': return v === undefined || isStr(v);
    case 'strNull': return v === null || isStr(v);
    case 'strArr': return isStrArr(v);
    case 'numRec':
      return isObj(v) && Object.keys(v).length <= 50 &&
        Object.entries(v).every(([k, n]) => isStr(k) && Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 50);
    case 'obj': return isObj(v) && JSON.stringify(v).length <= 5000;
    case 'ruolo':
      return isObj(v) && isStr(v.id) && /^[a-z0-9_]{1,30}$/.test(v.id) && isStr(v.nome) && isStr(v.descrizione) &&
        FAZIONI.includes(v.fazione as string) && (v.aura === 'lupo' || v.aura === 'non_lupo') &&
        typeof v.contaComeLupo === 'boolean' && typeof v.agisceDiNotte === 'boolean';
    case 'vittoria':
      return isObj(v) && FAZIONI.includes(v.fazione as string) && isStrArr(v.vincitori) && isStr(v.motivo);
  }
}

export function validaComando(x: unknown): Comando | null {
  if (!isObj(x) || !isStr(x.tipo) || !(x.tipo in SCHEMA)) return null;
  const schema = SCHEMA[x.tipo as Comando['tipo']];
  const pulito: Record<string, unknown> = { tipo: x.tipo };
  for (const [campo, tipo] of Object.entries(schema)) {
    if (!valido(tipo, x[campo])) return null;
    if (x[campo] !== undefined) pulito[campo] = x[campo];
  }
  return pulito as Comando;
}

export function validaTimer(x: unknown): ComandoTimer | null {
  if (!isObj(x)) return null;
  const secondiOk = (s: unknown) => typeof s === 'number' && Number.isFinite(s) && s >= 1 && s <= 3600;
  switch (x.azione) {
    case 'avvia': return secondiOk(x.secondi) && isStr(x.etichetta) ? { azione: 'avvia', secondi: x.secondi as number, etichetta: x.etichetta } : null;
    case 'aggiungi': return secondiOk(x.secondi) ? { azione: 'aggiungi', secondi: x.secondi as number } : null;
    case 'pausa': case 'riprendi': case 'stop': return { azione: x.azione };
    default: return null;
  }
}

export { isStr, isObj };
