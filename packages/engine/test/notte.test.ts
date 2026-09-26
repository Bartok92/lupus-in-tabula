import { describe, expect, it } from 'vitest';
import { giocatore, MASTER } from '../src/index.js';
import { DIECI, Tavolo } from './tavolo.js';

describe('passi della notte', () => {
  it('prima notte: lupi si riconoscono senza sbranare, veggente agisce, guardia e medium no', () => {
    const t = new Tavolo(DIECI);
    t.m({ tipo: 'iniziaNotte' });
    const passi = t.s.notte!.passi;
    expect(passi.map((p) => p.id)).toEqual(['lupo', 'veggente:Veggente']);
    expect(passi[0]!.tipo).toBe('riconoscimento');
  });

  it('notti successive: ordine configurato, lupi sbranano', () => {
    const t = new Tavolo(DIECI);
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'iniziaNotte' });
    expect(t.s.notte!.passi.map((p) => p.id)).toEqual(['veggente:Veggente', 'medium:Medium', 'guardia:Guardia', 'lupo']);
    expect(t.s.notte!.passi[3]!.tipo).toBe('bersaglio');
  });

  it('un ruolo morto viene comunque chiamato, con attesa finta', () => {
    const t = new Tavolo(DIECI);
    t.notte();
    t.m({ tipo: 'uccidi', id: 'Veggente' });
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'iniziaNotte' });
    const eventi = t.m({ tipo: 'chiamaProssimoPasso' });
    const passo = t.s.notte!.passi[0]!;
    expect(passo.id).toBe('veggente:Veggente');
    expect(passo.finto).toBe(true);
    expect(passo.attesaFintaMs).toBeGreaterThanOrEqual(6000);
    expect(passo.attesaFintaMs).toBeLessThanOrEqual(12000);
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'chiamata', giocatori: [], finto: true }));
  });

  it('la prima notte con "lupi sbranano" attiva anche la guardia', () => {
    const t = new Tavolo(DIECI, { primaNotte: { lupiUccidono: true } });
    t.m({ tipo: 'iniziaNotte' });
    expect(t.s.notte!.passi.map((p) => p.id)).toContain('guardia:Guardia');
  });

  it('solo il giocatore chiamato può agire, e solo nel suo passo', () => {
    const t = new Tavolo(DIECI);
    t.m({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'chiamaProssimoPasso' }); // lupi
    expect(t.rifiuta(giocatore('Veggente'), { tipo: 'azioneNotturna', bersaglio: 'Lupo1' })).toMatch(/turno/);
    expect(t.rifiuta(giocatore('Lupo1'), { tipo: 'azioneNotturna', bersaglio: 'Villico1' })).toMatch(/non devi scegliere/);
  });
});

describe('risoluzione della notte', () => {
  function secondaNotte(ruoli = DIECI, imp = {}) {
    const t = new Tavolo(ruoli, imp);
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    return t;
  }

  it('i lupi uccidono la vittima', () => {
    const t = secondaNotte();
    t.notte({ Lupo1: 'Villico1' });
    expect(t.vivo('Villico1')).toBe(false);
    expect(t.s.alba!.morti).toEqual(['Villico1']);
  });

  it('Guardia sulla vittima: nessun morto', () => {
    const t = secondaNotte();
    t.notte({ Lupo1: 'Villico1', Guardia: 'Villico1' });
    expect(t.vivo('Villico1')).toBe(true);
    expect(t.s.alba!.morti).toEqual([]);
    expect(t.s.notte!.anteprima!.salvati).toEqual([{ id: 'Villico1', motivo: 'guardia' }]);
  });

  it('la Guardia non può proteggere se stessa né la stessa persona due notti di fila', () => {
    const t = secondaNotte();
    t.notte({ Guardia: 'Villico1' });
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' }); // guardia
    expect(t.rifiuta(giocatore('Guardia'), { tipo: 'azioneNotturna', bersaglio: 'Guardia' })).toMatch(/non valido/);
    expect(t.rifiuta(giocatore('Guardia'), { tipo: 'azioneNotturna', bersaglio: 'Villico1' })).toMatch(/non valido/);
    t.g('Guardia', { tipo: 'azioneNotturna', bersaglio: 'Villico2' });
  });

  it('con la variante disattivata la Guardia può ripetere la stessa persona', () => {
    const t = secondaNotte(DIECI, { guardiaNonStessoDueNotti: false });
    t.notte({ Guardia: 'Villico1' });
    t.m({ tipo: 'iniziaDiscussione' });
    t.notte({ Guardia: 'Villico1', Lupo1: 'Villico1' });
    expect(t.vivo('Villico1')).toBe(true);
  });

  it('i lupi non possono scegliere un altro lupo', () => {
    const t = secondaNotte();
    t.m({ tipo: 'iniziaNotte' });
    for (let i = 0; i < 4; i++) t.m({ tipo: 'chiamaProssimoPasso' });
    expect(t.rifiuta(giocatore('Lupo1'), { tipo: 'azioneNotturna', bersaglio: 'Lupo2' })).toMatch(/non valido/);
  });

  it('lupi in disaccordo: il Master deve decidere prima di confermare l\'alba', () => {
    const t = secondaNotte();
    t.iniziaNotteERiconosci({ Lupo1: 'Villico1', Lupo2: 'Villico2' });
    t.m({ tipo: 'terminaNotte' });
    expect(t.s.notte!.anteprima!.lupiInDisaccordo).toBe(true);
    expect(t.rifiuta(MASTER, { tipo: 'confermaAlba' })).toMatch(/d'accordo/);
    t.m({ tipo: 'forzaBersaglio', passo: 'lupo', bersaglio: 'Villico2' });
    t.m({ tipo: 'confermaAlba' });
    expect(t.vivo('Villico2')).toBe(false);
    expect(t.vivo('Villico1')).toBe(true);
  });

  it('variante maggioranza: con 3 lupi vince la scelta di 2', () => {
    const ruoli = { ...DIECI, Villico4: 'lupo' };
    const t = secondaNotte(ruoli, { lupiDisaccordo: 'maggioranza' });
    t.notte({ Lupo1: 'Villico1', Lupo2: 'Villico1', Villico4: 'Villico2' });
    expect(t.vivo('Villico1')).toBe(false);
    expect(t.vivo('Villico2')).toBe(true);
  });

  it('i lupi non uccidono il Criceto mannaro', () => {
    const t = secondaNotte({ ...DIECI, Villico4: 'criceto' });
    t.notte({ Lupo1: 'Villico4' });
    expect(t.vivo('Villico4')).toBe(true);
    expect(t.s.notte!.anteprima!.salvati).toEqual([{ id: 'Villico4', motivo: 'immunita' }]);
  });

  it('Veggente sul Criceto: il Criceto muore all\'alba, anche se protetto dalla Guardia', () => {
    const t = new Tavolo({ ...DIECI, Villico4: 'criceto' });
    t.notte({ Veggente: 'Villico4' });
    expect(t.vivo('Villico4')).toBe(false);
    expect(t.s.giocatori.find((g) => g.id === 'Villico4')!.morte!.causa).toBe('veggente');

    const t2 = secondaNotte({ ...DIECI, Villico4: 'criceto' });
    t2.notte({ Veggente: 'Villico4', Guardia: 'Villico4', Lupo1: 'Villico4' });
    expect(t2.vivo('Villico4')).toBe(false);
  });

  it('il Veggente riceve subito l\'aura e non può cambiare scelta', () => {
    const t = new Tavolo(DIECI);
    t.m({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.g('Veggente', { tipo: 'azioneNotturna', bersaglio: 'Lupo2' });
    expect(t.vista('Veggente').indagini).toEqual([{ notte: 1, fonte: 'indaga', bersaglio: 'Lupo2', aura: 'lupo' }]);
    expect(t.rifiuta(giocatore('Veggente'), { tipo: 'azioneNotturna', bersaglio: 'Villico1' })).toMatch(/già/);
  });

  it('il Veggente vede l\'Indemoniato come "non lupo"', () => {
    const t = new Tavolo(DIECI);
    t.notte({ Veggente: 'Indemoniato' });
    expect(t.s.indagini.at(-1)!.aura).toBe('non_lupo');
  });

  it('il Medium scopre l\'aura di chi è andato al rogo il giorno prima', () => {
    const t = new Tavolo(DIECI);
    t.notte();
    t.giorno(
      { Villico1: 'Lupo1', Villico2: 'Lupo1', Villico3: 'Villico4', Veggente: 'Villico4' },
      { Villico1: 'Lupo1', Villico2: 'Lupo1', Villico3: 'Lupo1' },
    );
    expect(t.vivo('Lupo1')).toBe(false);
    t.m({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' }); // medium
    const ind = t.vista('Medium').indagini;
    expect(ind).toEqual([{ notte: 2, fonte: 'medium', bersaglio: 'Lupo1', aura: 'lupo' }]);
    expect(t.vista('Medium').istruzioni.testo).toMatch(/Lupo1 ERA un lupo/);
  });

  it('il Medium sa che ieri nessuno è andato al rogo', () => {
    const t = new Tavolo(DIECI);
    t.notte();
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    expect(t.vista('Medium').indagini[0]!.bersaglio).toBeNull();
    expect(t.vista('Medium').istruzioni.testo).toMatch(/nessuno è andato al rogo/);
  });

  it('le azioni valgono anche se chi le compie muore la stessa notte', () => {
    const t = secondaNotte();
    t.notte({ Lupo1: 'Guardia', Guardia: 'Villico1' });
    expect(t.vivo('Guardia')).toBe(false);
    // la protezione era comunque valida: se i lupi avessero scelto Villico1 sarebbe sopravvissuto
    expect(t.s.notte!.anteprima!.protetti).toEqual({ Guardia: 'Villico1' });
  });

  it('il Master può forzare un bersaglio anche all\'alba, prima di confermare', () => {
    const t = secondaNotte();
    t.notte({ Lupo1: 'Villico1' }, { conferma: false });
    t.m({ tipo: 'forzaBersaglio', passo: 'lupo', bersaglio: null });
    expect(t.s.notte!.anteprima!.morti).toEqual([]);
    t.m({ tipo: 'confermaAlba' });
    expect(t.vivo('Villico1')).toBe(true);
  });
});

describe('Mitomane', () => {
  const RUOLI = { ...DIECI, Villico4: 'mitomane' };

  it('diventa lupo se indica un lupo, e dalla notte dopo caccia con il branco', () => {
    const t = new Tavolo(RUOLI);
    t.notte({ Villico4: 'Lupo1', Veggente: 'Villico4' });
    // La trasformazione avviene all'alba: il Veggente lo vedeva ancora "non lupo"
    expect(t.s.indagini.at(-1)).toMatchObject({ bersaglio: 'Villico4', aura: 'non_lupo' });
    expect(t.ruolo('Villico4')).toBe('lupo');
    expect(t.vista('Villico4').io.ruoloCambiato).toBe(true);
    expect(t.vista('Villico4').istruzioni.testo).toMatch(/ora sei Lupo mannaro/);
    // Non conosce ancora i compagni (e loro non conoscono lui) fino alla chiamata dei lupi
    expect(t.vista('Villico4').compagni).toEqual([]);
    expect(t.vista('Lupo1').compagni.map((c) => c.id)).toEqual(['Lupo2']);

    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'iniziaNotte' });
    const lupi = t.s.notte!.passi.find((p) => p.id === 'lupo')!;
    expect(lupi.attori).toEqual(['Lupo1', 'Lupo2', 'Villico4']);
    while (t.s.notte!.passi[t.s.notte!.corrente]?.id !== 'lupo') t.m({ tipo: 'chiamaProssimoPasso' });
    expect(t.vista('Villico4').compagni.map((c) => c.id).sort()).toEqual(['Lupo1', 'Lupo2']);
    expect(t.vista('Lupo1').compagni.map((c) => c.id).sort()).toEqual(['Lupo2', 'Villico4']);
    // Ora conta come lupo per la vittoria
    expect(t.s.giocatori.filter((g) => g.ruolo === 'lupo')).toHaveLength(3);
  });

  it('diventa un secondo veggente, chiamato separatamente', () => {
    const t = new Tavolo(RUOLI);
    t.notte({ Villico4: 'Veggente' });
    expect(t.ruolo('Villico4')).toBe('veggente');
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'iniziaNotte' });
    expect(t.s.notte!.passi.map((p) => p.id)).toEqual(
      expect.arrayContaining(['veggente:Veggente', 'veggente:Villico4']),
    );
  });

  it('diventa villico in tutti gli altri casi', () => {
    const t = new Tavolo(RUOLI);
    t.notte({ Villico4: 'Indemoniato' });
    expect(t.ruolo('Villico4')).toBe('villico');
  });
});

describe('Gufo', () => {
  it('il bersaglio del Gufo si aggiunge ai due più votati', () => {
    const t = new Tavolo({ ...DIECI, Villico4: 'gufo' });
    t.notte({ Villico4: 'Villico3' });
    expect(t.s.gufoBersagli).toEqual(['Villico3']);
    t.m({ tipo: 'iniziaDiscussione' });
    t.m({ tipo: 'apriNomination' });
    t.g('Villico1', { tipo: 'voto', bersaglio: 'Lupo1' });
    t.g('Villico2', { tipo: 'voto', bersaglio: 'Lupo1' });
    t.g('Lupo1', { tipo: 'voto', bersaglio: 'Villico1' });
    t.m({ tipo: 'chiudiVotazione' });
    expect(t.s.votazione!.esito).toEqual({ tipo: 'candidati', candidati: ['Lupo1', 'Villico1', 'Villico3'] });
  });

  it('il Gufo non può indicare se stesso (default)', () => {
    const t = new Tavolo({ ...DIECI, Villico4: 'gufo' });
    t.m({ tipo: 'iniziaNotte' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    t.m({ tipo: 'chiamaProssimoPasso' });
    expect(t.rifiuta(giocatore('Villico4'), { tipo: 'azioneNotturna', bersaglio: 'Villico4' })).toMatch(/non valido/);
  });
});
