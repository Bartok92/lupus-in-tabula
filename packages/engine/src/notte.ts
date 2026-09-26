import type { Impostazioni } from './impostazioni.js';
import type { DefinizioneRuolo } from './ruoli.js';
import {
  defDi, registro, trovaGiocatore, vivi,
  type EsitoNotte, type PassoNotte, type StatoPartita,
} from './stato.js';
import type { Casuale, IdGiocatore, IdRuolo } from './tipi.js';

/** Il ruolo viene chiamato nella notte `n`? Tiene conto delle impostazioni della prima notte. */
export function agisceNotte(def: DefinizioneRuolo, n: number, imp: Impostazioni): boolean {
  const base =
    def.notti === 'tutte' || (def.notti === 'solo_prima' && n === 1) || (def.notti === 'dalla_seconda' && n >= 2);
  if (!base || n !== 1 || def.azione.tipo !== 'bersaglio') return base;
  switch (def.azione.effetto) {
    case 'indaga': return imp.primaNotte.veggenteAgisce;
    case 'proteggi': return imp.primaNotte.lupiUccidono;
    case 'gufo': return imp.primaNotte.gufoAgisce;
    default: return true;
  }
}

export function calcolaPassi(s: StatoPartita, casuale: Casuale): PassoNotte[] {
  const n = s.giorno;
  const imp = s.impostazioni;
  const reg = registro(s);
  const ordine = n === 1 ? imp.ordinePrimaNotte : imp.ordineNotti;
  const inGioco = new Set(s.giocatori.map((g) => g.ruolo).filter((r): r is IdRuolo => !!r));
  const sequenza = [
    ...ordine.filter((r) => inGioco.has(r)),
    ...[...reg.keys()].filter((r) => inGioco.has(r) && !ordine.includes(r)),
  ];

  const [min, max] = imp.attesaFintaMs;
  const attesa = () => Math.round(min + casuale() * Math.max(0, max - min));
  const passi: PassoNotte[] = [];

  for (const idRuolo of sequenza) {
    const def = reg.get(idRuolo)!;
    if (def.azione.tipo === 'nessuna' || !agisceNotte(def, n, imp)) continue;
    let tipo: PassoNotte['tipo'] = def.azione.tipo;
    let effetto: PassoNotte['effetto'] = def.azione.tipo === 'bersaglio' || def.azione.tipo === 'informazione' ? def.azione.effetto : null;
    if (def.azione.tipo === 'bersaglio' && def.azione.effetto === 'uccidi_branco' && n === 1 && !imp.primaNotte.lupiUccidono) {
      tipo = 'riconoscimento';
      effetto = null;
    }
    const titolari = s.giocatori.filter((g) => g.ruolo === idRuolo);
    if (def.collettivo) {
      const attori = titolari.filter((g) => g.vivo).map((g) => g.id);
      passi.push({ id: idRuolo, ruolo: idRuolo, tipo, effetto, attori, finto: attori.length === 0, attesaFintaMs: attori.length ? 0 : attesa() });
    } else {
      for (const g of titolari) {
        passi.push({
          id: `${idRuolo}:${g.id}`, ruolo: idRuolo, tipo, effetto,
          attori: g.vivo ? [g.id] : [], finto: !g.vivo, attesaFintaMs: g.vivo ? 0 : attesa(),
        });
      }
    }
  }
  return passi;
}

export function passoCorrente(s: StatoPartita): PassoNotte | null {
  if (s.fase !== 'notte' || !s.notte) return null;
  return s.notte.passi[s.notte.corrente] ?? null;
}

/** Bersagli che `attore` può scegliere nel passo indicato. */
export function bersagliValidi(s: StatoPartita, passo: PassoNotte, attore: IdGiocatore): IdGiocatore[] {
  if (passo.tipo !== 'bersaglio') return [];
  const def = registro(s).get(passo.ruolo);
  if (!def || def.azione.tipo !== 'bersaglio') return [];
  const v = def.azione.vincoli;
  const reg = registro(s);
  const io = trovaGiocatore(s, attore);
  const mioGruppo = io ? defDi(s, io)?.gruppo : undefined;
  const nonSeStesso = def.azione.effetto === 'gufo' ? !s.impostazioni.gufoPuoSeStesso : !!v.nonSeStesso;
  const ieri = v.nonStessoDueNottiDiFila && s.impostazioni.guardiaNonStessoDueNotti ? s.guardiaUltimo[attore] : undefined;

  return vivi(s)
    .filter((g) => {
      if (nonSeStesso && g.id === attore) return false;
      if (v.nonCompagni && mioGruppo && g.ruolo && reg.get(g.ruolo)?.gruppo === mioGruppo) return false;
      if (ieri && g.id === ieri) return false;
      return true;
    })
    .map((g) => g.id);
}

/** Bersaglio effettivo di un passo individuale (forzatura del Master > scelta del giocatore). */
export function bersaglioPasso(s: StatoPartita, idPasso: string): IdGiocatore | null {
  const notte = s.notte!;
  if (idPasso in notte.forzature) return notte.forzature[idPasso] ?? null;
  const scelte = notte.scelte[idPasso] ?? {};
  const valori = Object.values(scelte);
  return valori.length ? (valori[0] ?? null) : null;
}

/** Decide il bersaglio del branco. `disaccordo` = serve la decisione del Master. */
export function bersaglioLupi(s: StatoPartita): { bersaglio: IdGiocatore | null; disaccordo: boolean } {
  const notte = s.notte!;
  const passo = notte.passi.find((p) => p.effetto === 'uccidi_branco');
  if (!passo) return { bersaglio: null, disaccordo: false };
  if (passo.id in notte.forzature) return { bersaglio: notte.forzature[passo.id] ?? null, disaccordo: false };

  const voti = Object.entries(notte.scelte[passo.id] ?? {})
    .filter(([lupo]) => passo.attori.includes(lupo))
    .map(([, b]) => b)
    .filter((b): b is IdGiocatore => b !== null);
  if (voti.length === 0) return { bersaglio: null, disaccordo: false };
  if (voti.every((b) => b === voti[0])) return { bersaglio: voti[0]!, disaccordo: false };

  if (s.impostazioni.lupiDisaccordo === 'maggioranza') {
    const conta = new Map<IdGiocatore, number>();
    for (const b of voti) conta.set(b, (conta.get(b) ?? 0) + 1);
    const ordinati = [...conta.entries()].sort((a, b) => b[1] - a[1]);
    if (ordinati.length === 1 || ordinati[0]![1] > ordinati[1]![1]) return { bersaglio: ordinati[0]![0], disaccordo: false };
  }
  return { bersaglio: null, disaccordo: true };
}

/** Risolve tutte le azioni della notte in modo simultaneo (RULES.md §4). Funzione pura. */
export function risolviNotte(s: StatoPartita): EsitoNotte {
  const notte = s.notte!;
  const reg = registro(s);
  const esito: EsitoNotte = {
    bersaglioLupi: null, lupiInDisaccordo: false, morti: [], salvati: [],
    trasformazioni: [], gufo: [], protetti: {}, sceltePersonalizzate: [],
  };
  const vivoAdInizio = (id: IdGiocatore | null): id is IdGiocatore => !!id && !!trovaGiocatore(s, id)?.vivo;
  const passiBersaglio = notte.passi.filter((p) => p.tipo === 'bersaglio' && p.effetto !== 'uccidi_branco');
  const uccidi = (id: IdGiocatore, causa: 'lupi' | 'veggente') => {
    if (!esito.morti.some((m) => m.id === id)) esito.morti.push({ id, causa });
  };

  // 1. Mitomane
  for (const p of passiBersaglio.filter((p) => p.effetto === 'copia')) {
    const attore = p.id.split(':')[1]!;
    const b = bersaglioPasso(s, p.id);
    if (!vivoAdInizio(b)) continue;
    const ruoloB = trovaGiocatore(s, b)!.ruolo!;
    const nuovo = s.impostazioni.mitomaneCopiaQualsiasi
      ? ruoloB
      : reg.get(ruoloB)?.contaComeLupo ? 'lupo' : ruoloB === 'veggente' ? 'veggente' : 'villico';
    esito.trasformazioni.push({ id: attore, da: p.ruolo, a: nuovo });
  }

  // 2. Bersaglio dei lupi
  const { bersaglio, disaccordo } = bersaglioLupi(s);
  esito.bersaglioLupi = bersaglio;
  esito.lupiInDisaccordo = disaccordo;

  // 3-4. Protezione e immunità
  for (const p of passiBersaglio.filter((p) => p.effetto === 'proteggi')) {
    const b = bersaglioPasso(s, p.id);
    if (b) esito.protetti[p.id.split(':')[1]!] = b;
  }
  if (vivoAdInizio(bersaglio)) {
    const vittima = trovaGiocatore(s, bersaglio)!;
    if (Object.values(esito.protetti).includes(bersaglio)) esito.salvati.push({ id: bersaglio, motivo: 'guardia' });
    else if (defDi(s, vittima)?.immunitaLupi) esito.salvati.push({ id: bersaglio, motivo: 'immunita' });
    else uccidi(bersaglio, 'lupi');
  }

  // 5. Veggenti sul Criceto
  for (const p of passiBersaglio.filter((p) => p.effetto === 'indaga')) {
    const b = bersaglioPasso(s, p.id);
    if (vivoAdInizio(b) && defDi(s, trovaGiocatore(s, b)!)?.muoreSeIndagato) uccidi(b, 'veggente');
  }

  // 6. Gufo e ruoli personalizzati
  for (const p of passiBersaglio.filter((p) => p.effetto === 'gufo')) {
    const b = bersaglioPasso(s, p.id);
    if (vivoAdInizio(b) && !esito.morti.some((m) => m.id === b) && !esito.gufo.includes(b)) esito.gufo.push(b);
  }
  for (const p of passiBersaglio.filter((p) => p.effetto === 'manuale')) {
    esito.sceltePersonalizzate.push({ passo: p.id, attore: p.attori[0] ?? null, bersaglio: bersaglioPasso(s, p.id) });
  }
  return esito;
}
