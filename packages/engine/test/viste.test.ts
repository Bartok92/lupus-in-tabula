import { describe, expect, it } from 'vitest';
import { giocatore, MASTER, vistaPer, type VistaGiocatore, type VistaMaster } from '../src/index.js';
import { DIECI, Tavolo } from './tavolo.js';

const CON_MUCCA = { ...DIECI, Villico3: 'massone', Villico4: 'massone', Villico2: 'mucca' };

/** Controlli generali: nessun dato segreto altrui nella vista di un giocatore. */
function nessunSegretoAltrui(t: Tavolo, nome: string) {
  const v = t.vista(nome);
  const json = JSON.stringify(v);
  expect(json).not.toContain('_undo');
  expect(json).not.toContain('ruoloIniziale');
  expect(json).not.toContain('"causa"');
  expect(json).not.toContain('"forzature"');
  expect(json).not.toContain('"scelte"');
  // nessuna voce privata del log (prima della fine)
  if (v.fase !== 'fine') expect(v.log.every((l) => l.pubblico)).toBe(true);
  // i vivi non hanno ruolo rivelato
  expect(v.giocatori.filter((g) => g.vivo).every((g) => g.rivelato === null)).toBe(v.fase !== 'fine');
  // solo le proprie indagini
  const mie = t.s.indagini.filter((i) => i.attore === nome).length;
  expect(v.indagini.length).toBeLessThanOrEqual(mie);
}

describe('viste filtrate', () => {
  it('in lobby il giocatore non vede nessun ruolo, nemmeno il suo', () => {
    const t = new Tavolo(DIECI);
    // torna alla lobby con l'undo fino all'inizio
    while (t.s.fase !== 'lobby') t.m({ tipo: 'annulla' });
    expect(t.vista('Lupo1').io.ruolo).toBeNull();
    expect(t.vista('Lupo1').istruzioni.titolo).toBe('In attesa');
  });

  it('ogni giocatore vede la propria carta con immagine e obiettivo', () => {
    const t = new Tavolo(DIECI);
    const v = t.vista('Guardia');
    expect(v.io.ruolo).toMatchObject({ id: 'guardia', nome: 'Guardia del corpo', immagine: 'guardia' });
    expect(v.io.ruolo!.obiettivo).toMatch(/villaggio/);
    expect(v.compagni).toEqual([]);
  });

  it('i lupi vedono i compagni solo dopo essere stati chiamati, i villici mai', () => {
    const t = new Tavolo(DIECI);
    expect(t.vista('Lupo1').compagni).toEqual([]);
    t.m({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    expect(t.vista('Lupo1').compagni.map((c) => c.id)).toEqual(['Lupo2']);
    expect(t.vista('Lupo1').istruzioni.testo).toMatch(/Lupo2/);
    expect(t.vista('Villico1').compagni).toEqual([]);
    for (const n of Object.keys(DIECI)) nessunSegretoAltrui(t, n);
  });

  it('la Mucca mannara vede i lupi, i lupi non vedono lei; i massoni si vedono tra loro', () => {
    const t = new Tavolo(CON_MUCCA, { setEsteso: true });
    t.m({ tipo: 'iniziaNotte' });
    for (let i = 0; i < t.s.notte!.passi.length; i++) t.m({ tipo: 'chiamaProssimoPasso' });
    expect(t.vista('Villico2').compagni.map((c) => c.id).sort()).toEqual(['Lupo1', 'Lupo2']);
    expect(t.vista('Lupo1').compagni.map((c) => c.id)).toEqual(['Lupo2']);
    expect(t.vista('Villico3').compagni.map((c) => c.id)).toEqual(['Villico4']);
    expect(t.vista('Indemoniato').compagni).toEqual([]);
  });

  it('di notte solo il chiamato riceve l\'azione; gli altri ricevono la stessa struttura vuota', () => {
    const t = new Tavolo(DIECI);
    t.m({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' }); // veggente
    expect(t.vista('Veggente').notte!.azione).toMatchObject({ tipo: 'bersaglio', effetto: 'indaga' });
    expect(t.vista('Veggente').notte!.azione!.bersagliValidi).not.toContain('Veggente');
    for (const n of Object.keys(DIECI).filter((n) => n !== 'Veggente')) {
      expect(t.vista(n).notte).toEqual({ numero: 1, azione: null });
      expect(t.vista(n).istruzioni.titolo).toBe('Notte 1');
    }
  });

  it('i lupi vedono i voti dei compagni in tempo reale', () => {
    const t = new Tavolo(DIECI);
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'iniziaNotte' });
    while (t.s.notte!.passi[t.s.notte!.corrente]?.id !== 'lupo') t.m({ tipo: 'chiamaProssimoPasso' });
    t.g('Lupo1', { tipo: 'azioneNotturna', bersaglio: 'Villico1' });
    expect(t.vista('Lupo2').notte!.azione!.votiBranco).toEqual({ Lupo1: 'Villico1' });
    expect(t.vista('Lupo2').istruzioni.testo).toMatch(/Scegli con il branco/);
  });

  it('la Guardia vede nelle istruzioni chi ha protetto ieri', () => {
    const t = new Tavolo(DIECI);
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    t.notte({ Guardia: 'Villico2' });
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'iniziaNotte' });
    while (t.s.notte!.passi[t.s.notte!.corrente]?.id !== 'guardia:Guardia') t.m({ tipo: 'chiamaProssimoPasso' });
    expect(t.vista('Guardia').istruzioni.testo).toBe(
      'Scegli chi proteggere dai lupi stanotte. Non puoi scegliere te stesso né Villico2 (protetto ieri).',
    );
  });

  it('un morto non riceve più informazioni segrete', () => {
    const t = new Tavolo(DIECI);
    t.notte({ Veggente: 'Lupo1' });
    t.m({ tipo: 'uccidi', id: 'Veggente' });
    t.m({ tipo: 'uccidi', id: 'Lupo2' });
    const v = t.vista('Veggente');
    expect(v.io.vivo).toBe(false);
    expect(v.indagini).toEqual([]);
    expect(t.vista('Lupo2').compagni).toEqual([]);
    expect(v.istruzioni.titolo).toBe('Fuori dal gioco');
    // ma vede ancora il proprio ruolo
    expect(v.io.ruolo!.id).toBe('veggente');
  });

  it('ruolo dei morti: nascosto di default, rivelabile con l\'impostazione', () => {
    const t = new Tavolo(DIECI);
    t.m({ tipo: 'uccidi', id: 'Veggente' });
    expect(t.vista('Villico1').giocatori.find((g) => g.id === 'Veggente')!.rivelato).toBeNull();
    t.m({ tipo: 'impostaImpostazioni', impostazioni: { rivelaRuoloMorti: 'fazione' } });
    expect(t.vista('Villico1').giocatori.find((g) => g.id === 'Veggente')!.rivelato).toEqual({ fazione: 'villaggio', ruolo: null });
    t.m({ tipo: 'impostaImpostazioni', impostazioni: { rivelaRuoloMorti: 'ruolo' } });
    expect(t.vista('Villico1').giocatori.find((g) => g.id === 'Veggente')!.rivelato!.ruolo!.id).toBe('veggente');
  });

  it('i voti sono nascosti finché la votazione è aperta (default), poi pubblici', () => {
    const t = new Tavolo(DIECI);
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'apriNomination' });
    t.g('Villico1', { tipo: 'voto', bersaglio: 'Lupo1' });
    const aperta = t.vista('Villico2').votazione!;
    expect(aperta.voti).toBeNull();
    expect(aperta.votiDati).toBe(1);
    expect(t.vista('Villico1').votazione!.mioVoto).toBe('Lupo1');
    // il Master invece vede tutto in diretta
    expect((vistaPer(t.s, MASTER) as VistaMaster).votazione!.voti).toEqual({ Villico1: 'Lupo1' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.vista('Villico2').votazione!.voti).toEqual({ Villico1: 'Lupo1' });
  });

  it('la vista del Master contiene tutto tranne la pila di annullamento', () => {
    const t = new Tavolo(DIECI);
    const v = vistaPer(t.s, MASTER) as VistaMaster;
    expect(v.giocatori.map((g) => g.ruolo)).toContain('lupo');
    expect(JSON.stringify(v)).not.toContain('_undo');
    expect(v.annullabili).toBeGreaterThan(0);
  });

  it('a fine partita tutti vedono ruoli e log completo', () => {
    const t = new Tavolo(DIECI);
    t.m({ tipo: 'uccidi', id: 'Lupo1' });
    t.m({ tipo: 'uccidi', id: 'Lupo2' });
    t.m({ tipo: 'confermaVittoria' });
    const v: VistaGiocatore = t.vista('Villico1');
    expect(v.giocatori.every((g) => g.rivelato?.ruolo)).toBe(true);
    expect(v.log.some((l) => !l.pubblico)).toBe(true);
    expect(v.istruzioni.titolo).toBe('Hai vinto!');
  });

  it('un giocatore non può inviare comandi del Master', () => {
    const t = new Tavolo(DIECI);
    expect(t.rifiuta(giocatore('Lupo1'), { tipo: 'iniziaNotte' })).toMatch(/Solo il Master/);
    expect(t.rifiuta(giocatore('Lupo1'), { tipo: 'uccidi', id: 'Veggente' })).toMatch(/Solo il Master/);
    expect(t.rifiuta(giocatore('Lupo1'), { tipo: 'annulla' })).toMatch(/Solo il Master/);
  });
});
