import { mescola } from './casuale.js';
import { validaComposizione, type Composizione } from './composizione.js';
import { unisciImpostazioni, type ImpostazioniParziali } from './impostazioni.js';
import { bersagliValidi, calcolaPassi, passoCorrente, risolviNotte } from './notte.js';
import { creaRuoloPersonalizzato, type DatiRuoloPersonalizzato } from './ruoli.js';
import {
  aggiungiLog, compagniNoti, creaPartita, defDi, elencoNomi, nome, registro, trovaGiocatore,
  type CausaMorte, type StatoPartita, type Vittoria,
} from './stato.js';
import type { Attore, Casuale, IdGiocatore } from './tipi.js';
import { controllaVittoria } from './vittoria.js';
import { astensionePermessa, bersagliVoto, calcolaEsito, votantiAmmessi } from './voti.js';

// ——— Comandi ———
// I comandi "del giocatore" possono essere inviati anche dal Master con `per`
// (modalità un solo telefono, o override). Un giocatore agisce sempre e solo per sé.

export type Comando =
  // lobby
  | { tipo: 'aggiungiGiocatore'; id: IdGiocatore; nome: string }
  | { tipo: 'rimuoviGiocatore'; id: IdGiocatore }
  | { tipo: 'rinominaGiocatore'; id: IdGiocatore; nome: string }
  | { tipo: 'riordinaGiocatori'; ordine: IdGiocatore[] }
  | { tipo: 'impostaComposizione'; composizione: Composizione }
  | { tipo: 'impostaImpostazioni'; impostazioni: ImpostazioniParziali }
  | { tipo: 'aggiungiRuoloPersonalizzato'; ruolo: DatiRuoloPersonalizzato }
  | { tipo: 'rimuoviRuoloPersonalizzato'; id: string }
  | { tipo: 'avviaPartita' }
  // giocatore
  | { tipo: 'confermaVisto'; per?: IdGiocatore }
  | { tipo: 'azioneNotturna'; bersaglio: IdGiocatore | null; per?: IdGiocatore }
  | { tipo: 'voto'; bersaglio: IdGiocatore | null; per?: IdGiocatore }
  // notte
  | { tipo: 'iniziaNotte' }
  | { tipo: 'chiamaProssimoPasso' }
  | { tipo: 'forzaBersaglio'; passo: string; bersaglio: IdGiocatore | null }
  | { tipo: 'terminaNotte' }
  | { tipo: 'confermaAlba' }
  // giorno
  | { tipo: 'iniziaDiscussione' }
  | { tipo: 'apriNomination' }
  | { tipo: 'chiudiVotazione' }
  | { tipo: 'ripetiVoto' }
  | { tipo: 'scegliCandidati'; candidati: IdGiocatore[] }
  | { tipo: 'avviaBallottaggio' }
  | { tipo: 'apriVotoBallottaggio' }
  | { tipo: 'scegliCondannato'; id: IdGiocatore | null }
  | { tipo: 'eseguiRogo' }
  // override e fine
  | { tipo: 'uccidi'; id: IdGiocatore }
  | { tipo: 'resuscita'; id: IdGiocatore }
  | { tipo: 'confermaVittoria' }
  | { tipo: 'ignoraVittoria' }
  | { tipo: 'terminaPartita'; vittoria: Vittoria }
  | { tipo: 'nuovaPartita' }
  | { tipo: 'annulla' };

export type TipoComando = Comando['tipo'];

const COMANDI_GIOCATORE: TipoComando[] = ['confermaVisto', 'azioneNotturna', 'voto'];

export type EventoMotore =
  | { tipo: 'chiamata'; giocatori: IdGiocatore[]; passo: string; finto: boolean; attesaFintaMs: number }
  | { tipo: 'vittoriaProposta'; vittoria: Vittoria }
  | { tipo: 'faseCambiata'; fase: StatoPartita['fase'] };

export type Risultato =
  | { ok: true; stato: StatoPartita; eventi: EventoMotore[] }
  | { ok: false; errore: string };

class ErroreRegola extends Error {}
function errore(msg: string): never {
  throw new ErroreRegola(msg);
}
function richiedi(cond: unknown, msg: string): asserts cond {
  if (!cond) errore(msg);
}

const MAX_UNDO = 60;

/**
 * Applica un comando. Funzione pura: non modifica `stato`, restituisce un nuovo stato
 * oppure un errore leggibile. La casualità arriva sempre da `casuale`.
 */
export function applica(stato: StatoPartita, attore: Attore, comando: Comando, casuale: Casuale): Risultato {
  try {
    if (comando.tipo === 'annulla') {
      richiedi(attore.tipo === 'master', 'Solo il Master può annullare.');
      const precedente = stato._undo[stato._undo.length - 1];
      richiedi(precedente, 'Non c\'è niente da annullare.');
      const s = JSON.parse(precedente) as StatoPartita;
      s._undo = stato._undo.slice(0, -1);
      aggiungiLog(s, 'Il Master ha annullato l\'ultima azione.');
      return { ok: true, stato: s, eventi: [] };
    }

    const { _undo, ...senzaUndo } = stato;
    const istantanea = JSON.stringify({ ...senzaUndo, _undo: [] });
    const s = JSON.parse(istantanea) as StatoPartita;
    s._undo = [..._undo, istantanea].slice(-MAX_UNDO);

    const eventi: EventoMotore[] = [];
    const faseIniziale = s.fase;
    esegui(s, attore, comando, casuale, eventi);
    if (s.fase !== faseIniziale) eventi.push({ tipo: 'faseCambiata', fase: s.fase });
    return { ok: true, stato: s, eventi };
  } catch (e) {
    if (e instanceof ErroreRegola) return { ok: false, errore: e.message };
    throw e;
  }
}

/** Chi compie l'azione: il giocatore stesso, oppure il Master "per conto di". */
function autore(attore: Attore, per: IdGiocatore | undefined): IdGiocatore {
  if (attore.tipo === 'giocatore') {
    richiedi(!per || per === attore.id, 'Puoi agire solo per te stesso.');
    return attore.id;
  }
  richiedi(per, 'Indica per quale giocatore stai agendo.');
  return per;
}

function esegui(s: StatoPartita, attore: Attore, c: Comando, casuale: Casuale, eventi: EventoMotore[]): void {
  if (!COMANDI_GIOCATORE.includes(c.tipo)) richiedi(attore.tipo === 'master', 'Solo il Master può farlo.');
  const fineRichiesta = ['iniziaNotte', 'chiamaProssimoPasso', 'terminaNotte', 'iniziaDiscussione', 'apriNomination',
    'avviaBallottaggio', 'apriVotoBallottaggio', 'eseguiRogo'] as TipoComando[];
  if (s.esitoProposto && fineRichiesta.includes(c.tipo))
    errore('C\'è un esito di vittoria da confermare o ignorare.');
  if (s.fase === 'fine' && c.tipo !== 'nuovaPartita') errore('La partita è finita.');

  switch (c.tipo) {
    // ——— Lobby ———
    case 'aggiungiGiocatore': {
      inFase(s, 'lobby');
      const nomePulito = c.nome.trim();
      richiedi(nomePulito.length >= 1 && nomePulito.length <= 24, 'Il nickname deve avere da 1 a 24 caratteri.');
      richiedi(!trovaGiocatore(s, c.id), 'Giocatore già presente.');
      richiedi(!s.giocatori.some((g) => g.nome.toLowerCase() === nomePulito.toLowerCase()), 'Nickname già usato.');
      s.giocatori.push({
        id: c.id, nome: nomePulito, posto: s.giocatori.length, ruolo: null, ruoloIniziale: null,
        vivo: true, haVisto: false, morte: null,
      });
      return;
    }
    case 'rimuoviGiocatore': {
      inFase(s, 'lobby');
      richiedi(trovaGiocatore(s, c.id), 'Giocatore inesistente.');
      s.giocatori = s.giocatori.filter((g) => g.id !== c.id);
      s.giocatori.forEach((g, i) => (g.posto = i));
      return;
    }
    case 'rinominaGiocatore': {
      const g = trovaGiocatore(s, c.id);
      richiedi(g, 'Giocatore inesistente.');
      const nomePulito = c.nome.trim();
      richiedi(nomePulito.length >= 1 && nomePulito.length <= 24, 'Il nickname deve avere da 1 a 24 caratteri.');
      richiedi(!s.giocatori.some((x) => x.id !== c.id && x.nome.toLowerCase() === nomePulito.toLowerCase()), 'Nickname già usato.');
      g.nome = nomePulito;
      return;
    }
    case 'riordinaGiocatori': {
      richiedi(
        c.ordine.length === s.giocatori.length && s.giocatori.every((g) => c.ordine.includes(g.id)),
        'L\'ordine deve contenere tutti i giocatori.',
      );
      for (const g of s.giocatori) g.posto = c.ordine.indexOf(g.id);
      s.giocatori.sort((a, b) => a.posto - b.posto);
      return;
    }
    case 'impostaComposizione': {
      inFase(s, 'lobby');
      s.composizione = Object.fromEntries(Object.entries(c.composizione).filter(([, n]) => n > 0));
      return;
    }
    case 'impostaImpostazioni': {
      s.impostazioni = unisciImpostazioni(s.impostazioni, c.impostazioni);
      return;
    }
    case 'aggiungiRuoloPersonalizzato': {
      inFase(s, 'lobby');
      const id = c.ruolo.id.startsWith('pers_') ? c.ruolo.id : `pers_${c.ruolo.id}`;
      richiedi(!registro(s).has(id), 'Esiste già un ruolo con questo id.');
      richiedi(c.ruolo.nome.trim(), 'Il ruolo deve avere un nome.');
      s.ruoliPersonalizzati.push(creaRuoloPersonalizzato({ ...c.ruolo, id }));
      return;
    }
    case 'rimuoviRuoloPersonalizzato': {
      inFase(s, 'lobby');
      s.ruoliPersonalizzati = s.ruoliPersonalizzati.filter((r) => r.id !== c.id);
      delete s.composizione[c.id];
      return;
    }
    case 'avviaPartita': {
      inFase(s, 'lobby');
      const v = validaComposizione(s.composizione, s.giocatori.length, registro(s), s.impostazioni.setEsteso);
      richiedi(v.errori.length === 0, v.errori.join(' '));
      const mazzo = Object.entries(s.composizione).flatMap(([id, n]) => Array<string>(n).fill(id));
      const mescolato = mescola(mazzo, casuale);
      s.giocatori.forEach((g, i) => {
        g.ruolo = g.ruoloIniziale = mescolato[i]!;
        g.vivo = true;
        g.haVisto = false;
      });
      s.fase = 'rivelazione';
      aggiungiLog(s, 'La partita è iniziata: i ruoli sono stati distribuiti.', true);
      aggiungiLog(s, `Ruoli: ${s.giocatori.map((g) => `${g.nome} = ${registro(s).get(g.ruolo!)!.nome}`).join('; ')}.`);
      return;
    }

    // ——— Rivelazione ———
    case 'confermaVisto': {
      inFase(s, 'rivelazione');
      const g = trovaGiocatore(s, autore(attore, c.per));
      richiedi(g, 'Giocatore inesistente.');
      g.haVisto = true;
      return;
    }

    // ——— Notte ———
    case 'iniziaNotte': {
      richiedi(['rivelazione', 'discussione', 'nomination', 'ballottaggio', 'rogo'].includes(s.fase), 'Non è il momento di iniziare la notte.');
      if (s.fase !== 'rivelazione' && s.fase !== 'rogo') {
        s.ultimoRogo = { giorno: s.giorno, id: null, aura: null };
        aggiungiLog(s, 'Oggi nessuno è andato al rogo.', true);
      }
      s.giorno += 1;
      s.fase = 'notte';
      s.votazione = null;
      s.ballottaggio = null;
      s.gufoBersagli = [];
      s.alba = null;
      s.notte = { numero: s.giorno, passi: [], corrente: -1, scelte: {}, forzature: {}, anteprima: null };
      s.notte.passi = calcolaPassi(s, casuale);
      aggiungiLog(s, `Scende la notte ${s.giorno}.`, true);
      return;
    }
    case 'chiamaProssimoPasso': {
      inFase(s, 'notte');
      const notte = s.notte!;
      richiedi(notte.corrente < notte.passi.length - 1, 'Tutti i ruoli sono già stati chiamati: termina la notte.');
      notte.corrente += 1;
      const passo = notte.passi[notte.corrente]!;
      for (const id of passo.attori) {
        const visti = new Set([...(s.compagniRivelati[id] ?? []), ...compagniNoti(s, trovaGiocatore(s, id)!).map((g) => g.id)]);
        s.compagniRivelati[id] = [...visti];
      }
      const nomeRuolo = registro(s).get(passo.ruolo)!.nome;
      aggiungiLog(s, `Chiamato: ${nomeRuolo}${passo.finto ? ' (nessuno in vita: attesa simulata)' : ` → ${elencoNomi(passo.attori.map((id) => nome(s, id)))}`}.`);
      if (passo.tipo === 'informazione' && !passo.finto) {
        const r = s.ultimoRogo && s.ultimoRogo.giorno === s.giorno - 1 ? s.ultimoRogo : null;
        for (const id of passo.attori)
          s.indagini.push({ notte: s.giorno, attore: id, fonte: 'medium', bersaglio: r?.id ?? null, aura: r?.aura ?? null });
      }
      eventi.push({ tipo: 'chiamata', giocatori: passo.attori, passo: passo.id, finto: passo.finto, attesaFintaMs: passo.attesaFintaMs });
      return;
    }
    case 'azioneNotturna': {
      inFase(s, 'notte');
      const chi = autore(attore, c.per);
      const passo = passoCorrente(s);
      richiedi(passo && passo.attori.includes(chi), 'Non è il tuo turno.');
      richiedi(passo.tipo === 'bersaglio', 'In questo passo non devi scegliere nessuno.');
      if (c.bersaglio !== null) richiedi(bersagliValidi(s, passo, chi).includes(c.bersaglio), 'Bersaglio non valido.');
      const scelte = (s.notte!.scelte[passo.id] ??= {});
      const indaga = passo.effetto === 'indaga' && s.impostazioni.veggenteRisultatoSubito;
      if (indaga) richiedi(!(chi in scelte), 'Hai già fatto la tua scelta.');
      scelte[chi] = c.bersaglio;
      if (indaga && c.bersaglio) registraIndagine(s, chi, c.bersaglio);
      aggiungiLog(s, `${nome(s, chi)} (${registro(s).get(passo.ruolo)!.nome}) sceglie ${nome(s, c.bersaglio)}.`);
      return;
    }
    case 'forzaBersaglio': {
      richiedi(s.fase === 'notte' || (s.fase === 'alba' && !s.alba?.confermata), 'Si può forzare solo durante la notte o prima di confermare l\'alba.');
      const passo = s.notte!.passi.find((p) => p.id === c.passo);
      richiedi(passo && passo.tipo === 'bersaglio', 'Passo inesistente o senza bersaglio.');
      richiedi(c.bersaglio === null || trovaGiocatore(s, c.bersaglio)?.vivo, 'Il bersaglio deve essere vivo.');
      s.notte!.forzature[c.passo] = c.bersaglio;
      const attoreP = passo.attori[0];
      if (passo.effetto === 'indaga' && s.impostazioni.veggenteRisultatoSubito && attoreP && c.bersaglio) {
        s.indagini = s.indagini.filter((i) => !(i.notte === s.giorno && i.attore === attoreP && i.fonte === 'indaga'));
        registraIndagine(s, attoreP, c.bersaglio);
      }
      if (s.fase === 'alba') s.notte!.anteprima = risolviNotte(s);
      aggiungiLog(s, `Il Master impone il bersaglio di ${registro(s).get(passo.ruolo)!.nome}: ${nome(s, c.bersaglio)}.`);
      return;
    }
    case 'terminaNotte': {
      inFase(s, 'notte');
      s.fase = 'alba';
      s.notte!.anteprima = risolviNotte(s);
      s.alba = { giorno: s.giorno, confermata: false, morti: [] };
      return;
    }
    case 'confermaAlba': {
      inFase(s, 'alba');
      richiedi(!s.alba!.confermata, 'L\'alba è già stata confermata.');
      const esito = risolviNotte(s);
      richiedi(!esito.lupiInDisaccordo, 'I lupi non sono d\'accordo: scegli tu il bersaglio (o nessuno).');
      s.notte!.anteprima = esito;
      for (const m of esito.morti) uccidiGiocatore(s, m.id, m.causa);
      for (const t of esito.trasformazioni) {
        const g = trovaGiocatore(s, t.id)!;
        g.ruolo = t.a;
        aggiungiLog(s, `${g.nome} (Mitomane) diventa ${registro(s).get(t.a)!.nome}.`);
      }
      for (const sv of esito.salvati)
        aggiungiLog(s, `${nome(s, sv.id)} scampa ai lupi (${sv.motivo === 'guardia' ? 'grazie alla Guardia' : 'immune ai lupi'}).`);
      for (const [guardia, protetto] of Object.entries(esito.protetti)) s.guardiaUltimo[guardia] = protetto;
      // Con la guardia che non agisce stanotte, il vincolo "non due notti di fila" si azzera.
      for (const guardia of Object.keys(s.guardiaUltimo)) if (!(guardia in esito.protetti)) delete s.guardiaUltimo[guardia];
      s.gufoBersagli = esito.gufo;
      if (!s.impostazioni.veggenteRisultatoSubito) {
        for (const p of s.notte!.passi.filter((p) => p.effetto === 'indaga' && !p.finto)) {
          const b = p.id in s.notte!.forzature ? s.notte!.forzature[p.id] : s.notte!.scelte[p.id]?.[p.attori[0]!];
          if (b && p.attori[0]) registraIndagine(s, p.attori[0], b);
        }
      }
      for (const sp of esito.sceltePersonalizzate)
        aggiungiLog(s, `Ruolo personalizzato (${nome(s, sp.attore)}) ha scelto ${nome(s, sp.bersaglio)}: applica l'effetto a mano.`);
      s.alba!.confermata = true;
      s.alba!.morti = esito.morti.map((m) => m.id);
      aggiungiLog(
        s,
        esito.morti.length
          ? `All'alba il villaggio scopre che stanotte ${esito.morti.length > 1 ? 'ci hanno lasciato' : 'ci ha lasciato'} ${elencoNomi(esito.morti.map((m) => nome(s, m.id)))}.`
          : 'All\'alba il villaggio si sveglia: stanotte nessuno ci ha lasciato.',
        true,
      );
      proponiVittoria(s, eventi);
      return;
    }

    // ——— Giorno ———
    case 'iniziaDiscussione': {
      inFase(s, 'alba');
      richiedi(s.alba!.confermata, 'Prima conferma l\'alba.');
      s.fase = 'discussione';
      return;
    }
    case 'apriNomination': {
      richiedi(
        s.fase === 'discussione' || (s.fase === 'alba' && s.alba?.confermata) || (s.fase === 'nomination' && !s.votazione?.aperta),
        'Non è il momento della votazione.',
      );
      s.fase = 'nomination';
      s.votazione = { tipo: 'nomination', aperta: true, voti: {}, ammessi: null, posti: 2, sicuri: [], turno: 0, esito: null };
      aggiungiLog(s, 'Si vota chi mandare al ballottaggio.', true);
      return;
    }
    case 'voto': {
      richiedi(s.votazione?.aperta, 'Non c\'è una votazione aperta.');
      richiedi(s.fase === 'nomination' || s.ballottaggio?.sottofase === 'voto', 'Non c\'è una votazione aperta.');
      const chi = autore(attore, c.per);
      richiedi(votantiAmmessi(s).includes(chi), 'Non puoi votare.');
      if (c.bersaglio === null) richiedi(astensionePermessa(s), 'L\'astensione non è permessa.');
      else richiedi(bersagliVoto(s, chi).includes(c.bersaglio), 'Voto non valido.');
      s.votazione.voti[chi] = c.bersaglio;
      return;
    }
    case 'chiudiVotazione': {
      richiedi(s.votazione?.aperta, 'Non c\'è una votazione aperta.');
      const v = s.votazione;
      v.aperta = false;
      v.esito = calcolaEsito(s, casuale);
      const dettaglio = Object.entries(v.voti).map(([da, a]) => `${nome(s, da)} → ${a ? nome(s, a) : 'astenuto'}`).join('; ');
      aggiungiLog(s, `Voti (${v.tipo}${v.turno ? `, turno ${v.turno + 1}` : ''}): ${dettaglio || 'nessun voto'}.`, true);
      if (v.esito.tipo === 'candidati') aggiungiLog(s, `Al ballottaggio: ${elencoNomi(v.esito.candidati.map((id) => nome(s, id)))}.`, true);
      if (v.esito.tipo === 'condannato') aggiungiLog(s, v.esito.id ? `Il villaggio condanna ${nome(s, v.esito.id)}.` : 'Nessuno viene condannato.', true);
      if (v.esito.tipo === 'pareggio') aggiungiLog(s, `Pareggio fra ${elencoNomi(v.esito.pari.map((id) => nome(s, id)))}.`, true);
      return;
    }
    case 'ripetiVoto': {
      const v = s.votazione;
      richiedi(v && !v.aperta && v.esito?.tipo === 'pareggio' && v.esito.rivoto, 'Non si può ripetere il voto ora.');
      s.votazione = {
        tipo: v.tipo, aperta: true, voti: {}, ammessi: v.esito.pari, posti: v.esito.posti,
        sicuri: v.esito.sicuri, turno: v.turno + 1, esito: null,
      };
      aggiungiLog(s, `Si rivota fra ${elencoNomi(v.esito.pari.map((id) => nome(s, id)))}.`, true);
      return;
    }
    case 'scegliCandidati': {
      inFase(s, 'nomination');
      richiedi(s.votazione && !s.votazione.aperta, 'Prima chiudi la votazione.');
      richiedi(c.candidati.length > 0 && c.candidati.every((id) => trovaGiocatore(s, id)?.vivo), 'Candidati non validi.');
      s.votazione.esito = { tipo: 'candidati', candidati: [...new Set(c.candidati)] };
      aggiungiLog(s, `Il Master manda al ballottaggio: ${elencoNomi(c.candidati.map((id) => nome(s, id)))}.`, true);
      return;
    }
    case 'avviaBallottaggio': {
      inFase(s, 'nomination');
      const e = s.votazione?.esito;
      richiedi(e?.tipo === 'candidati', 'Servono i candidati al ballottaggio.');
      s.fase = 'ballottaggio';
      s.ballottaggio = { candidati: e.candidati, sottofase: 'difesa' };
      s.votazione = null;
      return;
    }
    case 'apriVotoBallottaggio': {
      inFase(s, 'ballottaggio');
      richiedi(s.ballottaggio?.sottofase === 'difesa', 'Il voto è già stato aperto.');
      s.ballottaggio.sottofase = 'voto';
      s.votazione = {
        tipo: 'ballottaggio', aperta: true, voti: {}, ammessi: s.ballottaggio.candidati,
        posti: 1, sicuri: [], turno: 0, esito: null,
      };
      aggiungiLog(s, 'Si vota chi mandare al rogo.', true);
      return;
    }
    case 'scegliCondannato': {
      inFase(s, 'ballottaggio');
      richiedi(s.votazione && !s.votazione.aperta, 'Prima chiudi la votazione.');
      richiedi(c.id === null || s.ballottaggio!.candidati.includes(c.id), 'Il condannato deve essere un candidato.');
      s.votazione.esito = { tipo: 'condannato', id: c.id };
      aggiungiLog(s, c.id ? `Il Master decide: va al rogo ${nome(s, c.id)}.` : 'Il Master decide: oggi nessuno va al rogo.', true);
      return;
    }
    case 'eseguiRogo': {
      inFase(s, 'ballottaggio');
      const e = s.votazione?.esito;
      richiedi(e?.tipo === 'condannato', 'Non c\'è ancora un condannato.');
      s.fase = 'rogo';
      if (e.id) {
        const g = trovaGiocatore(s, e.id)!;
        uccidiGiocatore(s, e.id, 'rogo');
        s.ultimoRogo = { giorno: s.giorno, id: e.id, aura: defDi(s, g)!.aura };
        aggiungiLog(s, `${g.nome} finisce sul rogo.`, true);
        proponiVittoria(s, eventi);
      } else {
        s.ultimoRogo = { giorno: s.giorno, id: null, aura: null };
        aggiungiLog(s, 'Oggi nessuno va al rogo.', true);
      }
      return;
    }

    // ——— Override ———
    case 'uccidi': {
      richiedi(s.fase !== 'lobby', 'La partita non è iniziata.');
      const g = trovaGiocatore(s, c.id);
      richiedi(g?.vivo, 'Il giocatore non è vivo.');
      uccidiGiocatore(s, c.id, 'master');
      aggiungiLog(s, `Il Master elimina ${g.nome}.`, true);
      proponiVittoria(s, eventi);
      return;
    }
    case 'resuscita': {
      const g = trovaGiocatore(s, c.id);
      richiedi(g && !g.vivo && s.fase !== 'lobby', 'È ancora in gioco.');
      g.vivo = true;
      g.morte = null;
      aggiungiLog(s, `Il Master riporta in vita ${g.nome}.`, true);
      proponiVittoria(s, eventi);
      return;
    }
    case 'confermaVittoria': {
      richiedi(s.esitoProposto, 'Nessun esito da confermare.');
      termina(s, s.esitoProposto);
      return;
    }
    case 'ignoraVittoria': {
      richiedi(s.esitoProposto, 'Nessun esito da ignorare.');
      aggiungiLog(s, 'Il Master ignora l\'esito proposto e la partita continua.');
      s.esitoProposto = null;
      return;
    }
    case 'terminaPartita': {
      richiedi(s.fase !== 'lobby' && s.fase !== 'fine', 'Non c\'è una partita in corso.');
      termina(s, c.vittoria);
      return;
    }
    case 'nuovaPartita': {
      inFase(s, 'fine');
      // Stessi giocatori, stesso tavolo, stessa composizione: si riparte dalla lobby.
      const nuova = creaPartita(s.impostazioni);
      nuova.composizione = s.composizione;
      nuova.ruoliPersonalizzati = s.ruoliPersonalizzati;
      nuova.giocatori = s.giocatori.map((g) => ({
        id: g.id, nome: g.nome, posto: g.posto, ruolo: null, ruoloIniziale: null, vivo: true, haVisto: false, morte: null,
      }));
      Object.assign(s, { ...nuova, _undo: s._undo });
      aggiungiLog(s, 'Nuova partita con gli stessi giocatori.', true);
      return;
    }
    case 'annulla':
      return; // gestito in `applica`
    default: {
      const sconosciuto: never = c;
      errore(`Comando sconosciuto: ${(sconosciuto as { tipo: string }).tipo}.`);
    }
  }
}

function inFase(s: StatoPartita, fase: StatoPartita['fase']): void {
  richiedi(s.fase === fase, `Comando non valido in questa fase (${s.fase}).`);
}

function registraIndagine(s: StatoPartita, attore: IdGiocatore, bersaglio: IdGiocatore): void {
  const g = trovaGiocatore(s, bersaglio)!;
  s.indagini.push({ notte: s.giorno, attore, fonte: 'indaga', bersaglio, aura: defDi(s, g)!.aura });
}

function uccidiGiocatore(s: StatoPartita, id: IdGiocatore, causa: CausaMorte): void {
  const g = trovaGiocatore(s, id)!;
  g.vivo = false;
  g.morte = { giorno: s.giorno, causa };
  const cause: Record<CausaMorte, string> = {
    lupi: 'vittima dei lupi', veggente: 'per mano del Veggente', rogo: 'sul rogo', master: 'per decisione del Master',
  };
  aggiungiLog(s, `${g.nome} (${defDi(s, g)!.nome}) muore: ${cause[causa]}.`);
}

function proponiVittoria(s: StatoPartita, eventi: EventoMotore[]): void {
  const v = controllaVittoria(s);
  s.esitoProposto = v;
  if (v) {
    aggiungiLog(s, `Esito proposto: vince ${v.fazione}. ${v.motivo}`);
    eventi.push({ tipo: 'vittoriaProposta', vittoria: v });
  }
}

function termina(s: StatoPartita, v: Vittoria): void {
  s.vittoria = v;
  s.esitoProposto = null;
  s.fase = 'fine';
  aggiungiLog(s, `Fine della partita. ${v.motivo}`, true);
}
