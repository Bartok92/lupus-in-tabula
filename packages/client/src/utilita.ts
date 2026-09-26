import type { EsitoVoto, IdGiocatore, VoceLog } from '@lupus/engine';

export function nomeDi(giocatori: { id: IdGiocatore; nome: string }[], id: IdGiocatore | null | undefined): string {
  if (!id) return 'nessuno';
  return giocatori.find((g) => g.id === id)?.nome ?? '?';
}

export function elenco(nomi: string[]): string {
  if (nomi.length === 0) return 'nessuno';
  if (nomi.length === 1) return nomi[0]!;
  return `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

export function plurale(n: number, singolare: string, plurale: string): string {
  return `${n} ${n === 1 ? singolare : plurale}`;
}

/** Verbo del pulsante di conferma per ogni tipo di azione notturna. */
export const VERBO_AZIONE: Record<string, string> = {
  uccidi_branco: 'Sbrana',
  proteggi: 'Proteggi',
  indaga: 'Scruta',
  gufo: 'Indica',
  copia: 'Imita',
  manuale: 'Scegli',
};

/** Frase pubblica con l'esito di una votazione. */
export function testoEsito(e: EsitoVoto | null, nomi: { id: string; nome: string }[]): string {
  if (!e) return '';
  const n = (ids: string[]) => elenco(ids.map((id) => nomeDi(nomi, id)));
  switch (e.tipo) {
    case 'candidati': return `Al ballottaggio: ${n(e.candidati)}.`;
    case 'condannato': return e.id ? `Il villaggio condanna ${nomeDi(nomi, e.id)}.` : 'Oggi nessuno va al rogo.';
    case 'pareggio': return `Pareggio fra ${n(e.pari)}: ${e.rivoto ? 'si rivota' : 'decide il Master'}.`;
    case 'serveSecondo': return `Solo ${n(e.sicuri)} ha ricevuto voti: il Master sceglie il secondo candidato.`;
    case 'nessuno': return 'Nessuno ha ricevuto voti.';
  }
}

const NOMI_FASE: Record<string, string> = {
  lobby: 'Lobby', rivelazione: 'Carte', notte: 'Notte', alba: 'Alba', discussione: 'Giorno',
  nomination: 'Voto', ballottaggio: 'Ballottaggio', rogo: 'Rogo', fine: 'Fine',
};

export function etichettaFase(l: Pick<VoceLog, 'fase' | 'giorno'>): string {
  const nome = NOMI_FASE[l.fase] ?? l.fase;
  return l.giorno ? `${nome} ${l.giorno}` : nome;
}

/** Cronaca completa in testo semplice, per l'esportazione. */
export function testoCronaca(log: VoceLog[]): string {
  return log.map((l) => `[${etichettaFase(l)}] ${l.testo}`).join('\n');
}
