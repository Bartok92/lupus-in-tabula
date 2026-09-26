import { describe, expect, it } from 'vitest';
import { giocatore, MASTER, type ImpostazioniParziali } from '../src/index.js';
import { DIECI, Tavolo } from './tavolo.js';

function allaNomination(imp: ImpostazioniParziali = {}) {
  const t = new Tavolo(DIECI, imp);
  t.notte();
  t.m({ tipo: 'iniziaDiscussione' });
  t.m({ tipo: 'apriNomination' });
  return t;
}

function vota(t: Tavolo, voti: Record<string, string | null>) {
  for (const [da, a] of Object.entries(voti)) t.g(da, { tipo: 'voto', bersaglio: a });
}

describe('nomination', () => {
  it('vanno al ballottaggio i due più votati', () => {
    const t = allaNomination();
    vota(t, { Villico1: 'Lupo1', Villico2: 'Lupo1', Villico3: 'Lupo2', Lupo1: 'Villico1', Lupo2: 'Villico1', Veggente: 'Lupo1' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'candidati', candidati: ['Lupo1', 'Villico1'] });
  });

  it('si può cambiare voto finché la votazione è aperta, non dopo', () => {
    const t = allaNomination();
    t.g('Villico1', { tipo: 'voto', bersaglio: 'Lupo1' });
    t.g('Villico1', { tipo: 'voto', bersaglio: 'Lupo2' });
    expect(t.s.votazione!.voti.Villico1).toBe('Lupo2');
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.rifiuta(giocatore('Villico1'), { tipo: 'voto', bersaglio: 'Lupo1' })).toMatch(/votazione aperta/);
  });

  it('non si può votare se stessi (default) né un morto; l\'astensione è permessa', () => {
    const t = allaNomination();
    expect(t.rifiuta(giocatore('Villico1'), { tipo: 'voto', bersaglio: 'Villico1' })).toMatch(/non valido/);
    t.m({ tipo: 'uccidi', id: 'Villico4' });
    expect(t.rifiuta(giocatore('Villico1'), { tipo: 'voto', bersaglio: 'Villico4' })).toMatch(/non valido/);
    expect(t.rifiuta(giocatore('Villico4'), { tipo: 'voto', bersaglio: 'Villico1' })).toMatch(/Non puoi votare/);
    t.g('Villico1', { tipo: 'voto', bersaglio: null });
    expect(t.s.votazione!.voti.Villico1).toBeNull();
  });

  it('un giocatore non può votare per un altro', () => {
    const t = allaNomination();
    expect(t.rifiuta(giocatore('Villico1'), { tipo: 'voto', bersaglio: 'Lupo1', per: 'Villico2' })).toMatch(/solo per te/);
  });

  it('pareggio per il secondo posto: default "tutti" → vanno tutti i pari merito', () => {
    const t = allaNomination();
    vota(t, { Villico1: 'Lupo1', Villico2: 'Lupo1', Villico3: 'Lupo2', Veggente: 'Villico1', Medium: 'Villico2' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'candidati', candidati: ['Lupo1', 'Lupo2', 'Villico1', 'Villico2'] });
  });

  it('pareggio con variante "rivoto": si rivota fra i pari per il posto conteso', () => {
    const t = allaNomination({ nomination: { pareggio: 'rivoto' } });
    vota(t, { Villico1: 'Lupo1', Villico2: 'Lupo1', Villico3: 'Lupo2', Veggente: 'Villico1' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'pareggio', sicuri: ['Lupo1'], pari: ['Lupo2', 'Villico1'], posti: 1, rivoto: true });
    t.m({ tipo: 'ripetiVoto' });
    expect(t.rifiuta(giocatore('Villico2'), { tipo: 'voto', bersaglio: 'Lupo1' })).toMatch(/non valido/);
    vota(t, { Villico1: 'Lupo2', Villico2: 'Lupo2' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'candidati', candidati: ['Lupo1', 'Lupo2'] });
  });

  it('pareggio con variante "master": decide il Master', () => {
    const t = allaNomination({ nomination: { pareggio: 'master' } });
    vota(t, { Villico1: 'Lupo1', Villico2: 'Lupo1', Villico3: 'Lupo2', Veggente: 'Villico1' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toMatchObject({ tipo: 'pareggio', rivoto: false });
    expect(t.rifiuta(MASTER, { tipo: 'avviaBallottaggio' })).toMatch(/candidati/);
    t.m({ tipo: 'scegliCandidati', candidati: ['Lupo1', 'Villico1'] });
    t.m({ tipo: 'avviaBallottaggio' });
    expect(t.s.ballottaggio!.candidati).toEqual(['Lupo1', 'Villico1']);
  });

  it('pareggio con variante "sorteggio": sceglie a caso esattamente i posti mancanti', () => {
    const t = allaNomination({ nomination: { pareggio: 'sorteggio' } });
    vota(t, { Villico1: 'Lupo1', Villico2: 'Lupo1', Villico3: 'Lupo2', Veggente: 'Villico1' });
    t.m({ tipo: 'chiudiVotazione' });
    const e = t.s.votazione!.esito!;
    expect(e.tipo).toBe('candidati');
    if (e.tipo === 'candidati') {
      expect(e.candidati).toHaveLength(2);
      expect(e.candidati[0]).toBe('Lupo1');
      expect(['Lupo2', 'Villico1']).toContain(e.candidati[1]);
    }
  });

  it('un solo votato: di default il Master deve aggiungere un secondo candidato', () => {
    const t = allaNomination();
    vota(t, { Villico1: 'Lupo1', Villico2: 'Lupo1' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'serveSecondo', sicuri: ['Lupo1'] });
  });

  it('un solo votato con variante "rogo diretto": ballottaggio con un solo candidato', () => {
    const t = allaNomination({ nomination: { unSoloVotato: 'rogo_diretto' } });
    vota(t, { Villico1: 'Lupo1' });
    t.m({ tipo: 'chiudiVotazione' });
    t.m({ tipo: 'avviaBallottaggio' });
    t.m({ tipo: 'apriVotoBallottaggio' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'condannato', id: 'Lupo1' });
  });

  it('nessun voto: nessun candidato, si può passare alla notte', () => {
    const t = allaNomination();
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'nessuno' });
    t.m({ tipo: 'iniziaNotte' });
    expect(t.s.ultimoRogo).toEqual({ giorno: 1, id: null, aura: null });
  });

  it('il Mortovivo non vota', () => {
    const t = new Tavolo({ ...DIECI, Villico4: 'mortovivo' }, { setEsteso: true });
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'apriNomination' });
    expect(t.rifiuta(giocatore('Villico4'), { tipo: 'voto', bersaglio: 'Lupo1' })).toMatch(/Non puoi votare/);
    expect(t.vista('Villico4').istruzioni.testo).toMatch(/Non puoi votare/);
  });
});

describe('ballottaggio', () => {
  function alBallottaggio(imp: ImpostazioniParziali = {}) {
    const t = allaNomination(imp);
    vota(t, { Villico1: 'Lupo1', Villico2: 'Villico3' });
    t.m({ tipo: 'chiudiVotazione' });
    t.m({ tipo: 'avviaBallottaggio' });
    t.m({ tipo: 'apriVotoBallottaggio' });
    return t;
  }

  it('i candidati non votano (default) e si vota solo fra i candidati', () => {
    const t = alBallottaggio();
    expect(t.s.ballottaggio!.candidati).toEqual(['Lupo1', 'Villico3']);
    expect(t.rifiuta(giocatore('Lupo1'), { tipo: 'voto', bersaglio: 'Villico3' })).toMatch(/Non puoi votare/);
    expect(t.rifiuta(giocatore('Villico1'), { tipo: 'voto', bersaglio: 'Villico2' })).toMatch(/non valido/);
  });

  it('il più votato va al rogo', () => {
    const t = alBallottaggio();
    vota(t, { Villico1: 'Lupo1', Villico2: 'Lupo1', Lupo2: 'Villico3' });
    t.m({ tipo: 'chiudiVotazione' });
    t.m({ tipo: 'eseguiRogo' });
    expect(t.vivo('Lupo1')).toBe(false);
    expect(t.s.ultimoRogo).toEqual({ giorno: 1, id: 'Lupo1', aura: 'lupo' });
  });

  it('pareggio (default): prima si rivota, al secondo pareggio decide il Master', () => {
    const t = alBallottaggio();
    vota(t, { Villico1: 'Lupo1', Villico2: 'Villico3' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toMatchObject({ tipo: 'pareggio', rivoto: true });
    t.m({ tipo: 'ripetiVoto' });
    vota(t, { Villico1: 'Lupo1', Villico2: 'Villico3' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toMatchObject({ tipo: 'pareggio', rivoto: false });
    expect(t.rifiuta(MASTER, { tipo: 'ripetiVoto' })).toMatch(/ripetere/);
    t.m({ tipo: 'scegliCondannato', id: 'Villico3' });
    t.m({ tipo: 'eseguiRogo' });
    expect(t.vivo('Villico3')).toBe(false);
  });

  it('pareggio con variante "nessuno": nessun morto', () => {
    const t = alBallottaggio({ ballottaggio: { pareggio: 'nessuno' } });
    vota(t, { Villico1: 'Lupo1', Villico2: 'Villico3' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'condannato', id: null });
    t.m({ tipo: 'eseguiRogo' });
    expect(t.vivo('Lupo1') && t.vivo('Villico3')).toBe(true);
  });

  it('pareggio con variante "sorteggio": muore uno dei due', () => {
    const t = alBallottaggio({ ballottaggio: { pareggio: 'sorteggio' } });
    vota(t, { Villico1: 'Lupo1', Villico2: 'Villico3' });
    t.m({ tipo: 'chiudiVotazione' });
    t.m({ tipo: 'eseguiRogo' });
    expect([t.vivo('Lupo1'), t.vivo('Villico3')].filter((v) => !v)).toHaveLength(1);
  });

  it('tutti astenuti = pareggio fra tutti i candidati', () => {
    const t = alBallottaggio();
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toMatchObject({ tipo: 'pareggio', pari: ['Lupo1', 'Villico3'] });
  });
});
