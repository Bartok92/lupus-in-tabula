import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { suggerisciComposizione } from '@lupus/engine';
import { attendi, avvia, stanzaConGiocatori, type Ambiente } from './aiuti.js';

let amb: Ambiente | undefined;
afterEach(async () => {
  await amb?.chiudi();
  amb = undefined;
});

async function avviaPartita(n = 8, opz: { idDispositivo?: boolean } = {}) {
  amb ??= await avvia();
  const s = await stanzaConGiocatori(amb, n, opz);
  await s.master.ok({ tipo: 'impostaComposizione', composizione: suggerisciComposizione(n) });
  await s.master.ok({ tipo: 'avviaPartita' });
  await s.master.attendiVista((p) => p.vista.fase === 'rivelazione');
  return s;
}

describe('stanze', () => {
  it('crea una stanza con codice non ambiguo e token del Master lungo', async () => {
    amb = await avvia();
    const { codice, tokenMaster } = await amb.creaStanza();
    expect(codice).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(tokenMaster.length).toBeGreaterThanOrEqual(40);
    const info = await (await fetch(`${amb.url}/api/stanze/${codice.toLowerCase()}`)).json();
    expect(info).toMatchObject({ codice, fase: 'lobby', giocatori: 0, accettaNuovi: true });
    expect((await fetch(`${amb.url}/api/stanze/ZZZZZZ`)).status).toBe(404);
  });

  it('il Master deve usare il token giusto', async () => {
    amb = await avvia();
    const { codice } = await amb.creaStanza();
    const r = await amb.client().master(codice, 'token-sbagliato');
    expect(r).toMatchObject({ ok: false });
  });

  it('lobby: i giocatori entrano e il Master li vede collegati in tempo reale', async () => {
    amb = await avvia();
    const { codice, master, giocatori } = await stanzaConGiocatori(amb, 3);
    const p = master.ultimo!;
    expect(p.vista.tipo).toBe('master');
    expect(p.vista.giocatori.map((g) => g.nome)).toEqual(['Giocatore1', 'Giocatore2', 'Giocatore3']);
    expect(Object.values(p.connessi)).toEqual([true, true, true]);
    // Anche i giocatori vedono la lista
    await giocatori[0]!.attendiVista((x) => x.vista.giocatori.length === 3);
    // Nickname duplicato, codice sbagliato
    expect(await amb.client().entra(codice, 'giocatore1')).toMatchObject({ ok: false, errore: 'Nickname già usato.' });
    expect(await amb.client().entra('AAAAAA', 'Zeta')).toMatchObject({ ok: false });
  });

  it('il Master può espellere un giocatore: riceve "espulso" e il suo token non vale più', async () => {
    amb = await avvia();
    const { codice, master, giocatori } = await stanzaConGiocatori(amb, 2);
    const vittima = giocatori[1]!;
    await master.ok({ tipo: 'rimuoviGiocatore', id: vittima.idGiocatore! });
    await attendi(() => vittima.espulso, 2000, 'espulsione');
    expect((await vittima.comando({ tipo: 'confermaVisto' })).ok).toBe(false);
    const r = await amb.client().entra(codice, undefined, { token: vittima.token });
    expect(r.ok).toBe(false);
  });
});

describe('assegnazione dei ruoli e viste', () => {
  it('ogni giocatore riceve solo il proprio ruolo, il Master li vede tutti', async () => {
    const { master, giocatori } = await avviaPartita(8);
    const ruoliMaster = master.vistaMaster.giocatori.map((g) => g.ruolo);
    expect(ruoliMaster.filter((r) => r === 'lupo')).toHaveLength(2);
    for (const g of giocatori) {
      const p = await g.attendiVista((x) => x.vista.fase === 'rivelazione');
      const v = g.vistaGiocatore;
      expect(v.tipo).toBe('giocatore');
      expect(v.io.ruolo!.id).toBe(master.vistaMaster.giocatori.find((x) => x.id === g.idGiocatore)!.ruolo);
      expect(v.giocatori.every((x) => x.rivelato === null)).toBe(true);
      expect(v.compagni).toEqual([]);
      expect(JSON.stringify(p)).not.toMatch(/tokenMaster|_undo|ruoloIniziale|"scelte"/);
      expect(p.attesaRimanenteMs).toBe(0);
    }
  });

  it('dopo l\'avvio non entrano nuovi giocatori', async () => {
    const { codice } = await avviaPartita(8);
    expect(await amb!.client().entra(codice, 'Ritardatario')).toMatchObject({ ok: false, errore: expect.stringMatching(/già iniziata/) });
  });

  it('un giocatore non può usare comandi del Master né agire per altri', async () => {
    const { giocatori } = await avviaPartita(8);
    const g = giocatori[0]!;
    expect(await g.comando({ tipo: 'iniziaNotte' })).toMatchObject({ ok: false, errore: expect.stringMatching(/Solo il Master/) });
    expect(await g.comando({ tipo: 'confermaVisto', per: giocatori[1]!.idGiocatore })).toMatchObject({ ok: false });
    expect(await g.timer({ azione: 'stop' })).toMatchObject({ ok: false });
    // Dati malformati
    expect(await g.socket.emitWithAck('comando', { tipo: 'rinominaGiocatore', id: 5 } as never)).toMatchObject({ ok: false, errore: 'Comando non valido.' });
    expect(await g.socket.emitWithAck('comando', { tipo: 'formattaDisco' } as never)).toMatchObject({ ok: false });
    expect(await g.socket.emitWithAck('comando', null as never)).toMatchObject({ ok: false });
  });
});

describe('riconnessione', () => {
  it('chi si scollega rientra con il token nello stesso posto e con lo stesso ruolo', async () => {
    const { codice, master, giocatori } = await avviaPartita(8);
    const g = giocatori[3]!;
    await g.attendiVista((x) => x.vista.fase === 'rivelazione');
    const ruolo = g.vistaGiocatore.io.ruolo!.id;
    const { token, idGiocatore } = g;
    g.chiudi();
    await master.attendiVista((p) => p.connessi[idGiocatore!] === false, 'il Master vede la disconnessione');

    const nuovo = amb!.client();
    const r = await nuovo.entra(codice, undefined, { token });
    expect(r).toMatchObject({ ok: true, idGiocatore, token });
    await nuovo.attendiVista((p) => p.vista.fase === 'rivelazione');
    expect(nuovo.vistaGiocatore.io.ruolo!.id).toBe(ruolo);
    await master.attendiVista((p) => p.connessi[idGiocatore!] === true, 'il Master vede la riconnessione');
  });

  it('rientra anche con lo stesso id dispositivo (se il token è andato perso)', async () => {
    const { codice, giocatori } = await avviaPartita(8, { idDispositivo: true });
    const vecchio = giocatori[0]!;
    vecchio.chiudi();
    const r = await amb!.client().entra(codice, undefined, { idDispositivo: 'dispositivo-1-abcdef' });
    expect(r).toMatchObject({ ok: true, idGiocatore: vecchio.idGiocatore });
  });

  it('le partite sopravvivono al riavvio del server', async () => {
    const cartella = mkdtempSync(join(tmpdir(), 'lupus-'));
    const percorsoDb = join(cartella, 'lupus.sqlite');
    try {
      amb = await avvia({ percorsoDb });
      const { codice, tokenMaster, master, giocatori } = await stanzaConGiocatori(amb, 8);
      await master.ok({ tipo: 'impostaComposizione', composizione: suggerisciComposizione(8) });
      await master.ok({ tipo: 'avviaPartita' });
      await master.ok({ tipo: 'iniziaNotte' });
      const ruoli = (await master.attendiVista((p) => p.vista.fase === 'notte')).vista.giocatori.map((g) => (g as { ruolo: string }).ruolo);
      const token = giocatori[5]!.token;
      await amb.chiudi();

      amb = await avvia({ percorsoDb });
      const m2 = amb.client();
      expect(await m2.master(codice, tokenMaster)).toEqual({ ok: true });
      const p = await m2.attendiVista((x) => x.vista.fase === 'notte');
      expect(p.vista.giocatori.map((g) => (g as { ruolo: string }).ruolo)).toEqual(ruoli);
      const g2 = amb.client();
      expect(await g2.entra(codice, undefined, { token })).toMatchObject({ ok: true });
      await g2.attendiVista((x) => x.vista.fase === 'notte');
      expect(g2.vistaGiocatore.io.ruolo!.id).toBe(ruoli[5]);
    } finally {
      await amb?.chiudi();
      amb = undefined;
      rmSync(cartella, { recursive: true, force: true });
    }
  });
});

describe('notte', () => {
  it('chi viene chiamato riceve la vibrazione; i ruoli morti hanno un\'attesa finta imposta dal server', async () => {
    let adesso = 1_000_000;
    amb = await avvia({ ora: () => adesso });
    const { master, giocatori } = await stanzaConGiocatori(amb, 8);
    await master.ok({ tipo: 'impostaComposizione', composizione: suggerisciComposizione(8) });
    await master.ok({ tipo: 'avviaPartita' });
    const ruoli = (await master.attendiVista((p) => p.vista.fase === 'rivelazione')).vista.giocatori as { id: string; ruolo: string }[];
    const veggente = ruoli.find((g) => g.ruolo === 'veggente')!.id;
    const lupi = ruoli.filter((g) => g.ruolo === 'lupo').map((g) => g.id);
    const client = (id: string) => giocatori.find((g) => g.idGiocatore === id)!;

    // Notte 1: lupi (riconoscimento) e veggente vengono chiamati e vibrano
    await master.ok({ tipo: 'iniziaNotte' });
    await master.ok({ tipo: 'chiamaProssimoPasso' });
    await attendi(() => lupi.every((id) => client(id).chiamate === 1), 2000, 'vibrazione lupi');
    await master.ok({ tipo: 'chiamaProssimoPasso' });
    await attendi(() => client(veggente).chiamate === 1, 2000, 'vibrazione veggente');
    expect(giocatori.filter((g) => g.chiamate > 0)).toHaveLength(3);
    await master.ok({ tipo: 'terminaNotte' });
    await master.ok({ tipo: 'confermaAlba' });

    // Il veggente muore: la notte dopo il suo passo è finto e il Master deve aspettare
    await master.ok({ tipo: 'uccidi', id: veggente });
    await master.ok({ tipo: 'iniziaDiscussione' });
    await master.ok({ tipo: 'iniziaNotte' });
    await master.ok({ tipo: 'chiamaProssimoPasso' });
    const p = await master.attendiVista((x) => x.attesaRimanenteMs > 0);
    expect(p.attesaRimanenteMs).toBeGreaterThanOrEqual(6000);
    expect(client(veggente).chiamate).toBe(1);
    const troppoPresto = await master.comando({ tipo: 'chiamaProssimoPasso' });
    expect(troppoPresto).toMatchObject({ ok: false, errore: expect.stringMatching(/Aspetta ancora/) });
    adesso += 12_001;
    await master.ok({ tipo: 'chiamaProssimoPasso' });
    // I giocatori non ricevono mai l'informazione sull'attesa
    for (const g of giocatori) expect(g.ultimo!.attesaRimanenteMs).toBe(0);
  });

  it('timer della discussione visibile a tutti; pausa e ripresa', async () => {
    let adesso = 5_000_000;
    amb = await avvia({ ora: () => adesso });
    const { master, giocatori } = await stanzaConGiocatori(amb, 2);
    expect(await master.timer({ azione: 'avvia', secondi: 90, etichetta: 'Discussione' })).toEqual({ ok: true });
    await giocatori[0]!.attendiVista((p) => p.timer?.rimanenteMs === 90_000);
    adesso += 30_000;
    await master.timer({ azione: 'pausa' });
    await giocatori[1]!.attendiVista((p) => p.timer?.inPausa === true && p.timer.rimanenteMs === 60_000);
    adesso += 100_000;
    await master.timer({ azione: 'riprendi' });
    await master.timer({ azione: 'aggiungi', secondi: 30 });
    await giocatori[0]!.attendiVista((p) => p.timer?.inPausa === false && p.timer.rimanenteMs === 90_000);
    await master.timer({ azione: 'stop' });
    await giocatori[0]!.attendiVista((p) => p.timer === null);
  });
});

describe('protezioni', () => {
  it('limita la frequenza delle richieste per connessione', async () => {
    amb = await avvia({ eventiAlSecondo: 2 });
    const { codice } = await amb.creaStanza();
    const c = amb.client();
    await c.entra(codice, 'Veloce');
    const risposte = await Promise.all(Array.from({ length: 10 }, () => c.comando({ tipo: 'confermaVisto' })));
    expect(risposte.filter((r) => !r.ok && r.errore.startsWith('Troppe richieste')).length).toBeGreaterThanOrEqual(5);
  });

  it('blocca chi prova a indovinare i codici delle stanze', async () => {
    amb = await avvia();
    const c = amb.client();
    const risposte = [];
    for (let i = 0; i < 15; i++) risposte.push(await c.entra(`ZZZZ${i}`, 'Curioso'));
    expect(risposte.at(-1)).toMatchObject({ ok: false, errore: expect.stringMatching(/Troppi tentativi/) });
  });

  it('le stanze inattive scadono e chi è collegato viene avvisato', async () => {
    let adesso = 10_000_000;
    amb = await avvia({ ora: () => adesso, scadenzaMs: 60_000 });
    const { codice, giocatori } = await stanzaConGiocatori(amb, 1);
    adesso += 30_000;
    amb.srv.pulisciStanze();
    expect(amb.srv.gestore.trova(codice)).toBeDefined();
    adesso += 61_000;
    amb.srv.pulisciStanze();
    expect(amb.srv.gestore.trova(codice)).toBeUndefined();
    await attendi(() => giocatori[0]!.espulso, 2000, 'avviso di scadenza');
    expect((await fetch(`${amb.url}/api/stanze/${codice}`)).status).toBe(404);
  });
});

describe('flusso di partita', () => {
  it('il timer si azzera quando cambia la fase', async () => {
    const { master, giocatori } = await avviaPartita(8);
    await master.timer({ azione: 'avvia', secondi: 60, etichetta: 'Prova' });
    await giocatori[0]!.attendiVista((p) => p.timer !== null);
    await master.ok({ tipo: 'iniziaNotte' });
    await giocatori[0]!.attendiVista((p) => p.vista.fase === 'notte' && p.timer === null, 'timer azzerato');
  });

  it('nuova partita con gli stessi giocatori: si torna in lobby e lo storico si salva di nuovo', async () => {
    const { master, giocatori } = await avviaPartita(8, { idDispositivo: true });
    const finisci = async () => {
      for (const lupo of master.vistaMaster.giocatori.filter((g) => g.ruolo === 'lupo')) await master.ok({ tipo: 'uccidi', id: lupo.id });
      await master.ok({ tipo: 'confermaVittoria' });
    };
    await finisci();
    await master.ok({ tipo: 'nuovaPartita' });
    await giocatori[0]!.attendiVista((p) => p.vista.fase === 'lobby' && p.vista.giocatori.length === 8);
    await master.ok({ tipo: 'avviaPartita' });
    await master.attendiVista((p) => p.vista.fase === 'rivelazione');
    await finisci();
    const storico = (await (await fetch(`${amb!.url}/api/storico`)).json()) as unknown[];
    expect(storico).toHaveLength(2);
    const profilo = await (await fetch(`${amb!.url}/api/profilo/dispositivo-1-abcdef`)).json();
    expect(profilo).toMatchObject({ partite: 2 });
  });
});

describe('storico, statistiche e preset', () => {
  it('a fine partita salva lo storico e aggiorna le statistiche dei profili', async () => {
    const { master } = await avviaPartita(8, { idDispositivo: true });
    const ruoli = master.vistaMaster.giocatori;
    for (const lupo of ruoli.filter((g) => g.ruolo === 'lupo')) await master.ok({ tipo: 'uccidi', id: lupo.id });
    await master.attendiVista((p) => (p.vista as { esitoProposto: unknown }).esitoProposto !== null);
    await master.ok({ tipo: 'confermaVittoria' });

    const indice = ruoli.findIndex((g) => g.ruolo === 'villico');
    const profilo = await (await fetch(`${amb!.url}/api/profilo/dispositivo-${indice + 1}-abcdef`)).json();
    expect(profilo).toMatchObject({ nickname: `Giocatore${indice + 1}`, partite: 1, vittorie: { villaggio: 1 } });
    const indiceLupo = ruoli.findIndex((g) => g.ruolo === 'lupo');
    const profiloLupo = await (await fetch(`${amb!.url}/api/profilo/dispositivo-${indiceLupo + 1}-abcdef`)).json();
    expect(profiloLupo).toMatchObject({ partite: 1, vittorie: {} });

    const storico = (await (await fetch(`${amb!.url}/api/storico`)).json()) as { vittoria: { fazione: string } }[];
    expect(storico).toHaveLength(1);
    expect(storico[0]!.vittoria.fazione).toBe('villaggio');
  });

  it('i preset si salvano solo con un token da Master', async () => {
    amb = await avvia();
    const { tokenMaster } = await amb.creaStanza();
    const corpo = JSON.stringify({ nome: 'Classica 10', composizione: suggerisciComposizione(10) });
    const headers = { 'content-type': 'application/json' };
    expect((await fetch(`${amb.url}/api/preset`, { method: 'POST', headers, body: corpo })).status).toBe(403);
    const r = await fetch(`${amb.url}/api/preset`, { method: 'POST', headers: { ...headers, 'x-token-master': tokenMaster }, body: corpo });
    expect(r.status).toBe(200);
    const lista = await (await fetch(`${amb.url}/api/preset`)).json();
    expect(lista).toEqual([expect.objectContaining({ nome: 'Classica 10', composizione: suggerisciComposizione(10) })]);
  });
});
