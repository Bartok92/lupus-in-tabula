import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stanza, type MessaggioHost, type MessaggioOspite, type PacchettoVista, type VistaGiocatore, type VistaMaster } from '@lupus/engine';
import type { CanaleVersoHost, CanaleVersoOspite } from '../src/rete/trasporto';
import { HostLocale, type ArchivioHost, type Profilo } from '../src/rete/p2p/host';
import { TrasportoOspite } from '../src/rete/p2p/ospite';

// "Cavo" finto tra due telefoni: i messaggi passano come JSON e arrivano in modo asincrono, come in WebRTC.
function cavo(): { versoOspite: CanaleVersoOspite; versoHost: CanaleVersoHost; taglia: () => void } {
  const lato = <In,>() => ({ messaggio: [] as ((m: In) => void)[], chiusura: [] as (() => void)[] });
  const h = lato<MessaggioOspite>();
  const o = lato<MessaggioHost>();
  let aperto = true;
  const taglia = () => {
    if (!aperto) return;
    aperto = false;
    queueMicrotask(() => [...h.chiusura, ...o.chiusura].forEach((f) => f()));
  };
  return {
    versoOspite: {
      invia: (m) => aperto && queueMicrotask(() => o.messaggio.forEach((f) => f(JSON.parse(JSON.stringify(m))))),
      suMessaggio: (cb) => h.messaggio.push(cb),
      suChiusura: (cb) => h.chiusura.push(cb),
      chiudi: taglia,
    },
    versoHost: {
      invia: (m) => aperto && queueMicrotask(() => h.messaggio.forEach((f) => f(JSON.parse(JSON.stringify(m))))),
      suMessaggio: (cb) => o.messaggio.push(cb),
      suChiusura: (cb) => o.chiusura.push(cb),
      chiudi: taglia,
    },
    taglia,
  };
}

function archivioInMemoria(): ArchivioHost & { dati: Map<string, unknown> } {
  const dati = new Map<string, unknown>();
  return {
    dati,
    salvaPartita: async (c, d) => void dati.set(`partita:${c}`, d),
    caricaPartita: async (c) => dati.get(`partita:${c}`) as string | undefined,
    profilo: async (id) => dati.get(`profilo:${id}`) as Profilo | undefined,
    salvaProfilo: async (id, p) => void dati.set(`profilo:${id}`, p),
    aggiungiStorico: async (v) => void dati.set('storico', [v, ...((dati.get('storico') as unknown[]) ?? [])]),
  };
}

/** Un telefono di un amico, con l'ultima vista ricevuta. */
class Amico {
  viste: PacchettoVista[] = [];
  chiamate = 0;
  espulso = false;
  cavi: ReturnType<typeof cavo>[] = [];
  t: TrasportoOspite;
  id?: string;
  token?: string;

  constructor(host: HostLocale, public nome: string, public idDispositivo = `disp-${nome}-00000000`) {
    this.t = new TrasportoOspite('X', async () => {
      const c = cavo();
      this.cavi.push(c);
      host.accogli(c.versoOspite);
      return c.versoHost;
    }, 20);
    this.t.ascolta({ vista: (p) => this.viste.push(p), chiamata: () => this.chiamate++, espulso: () => (this.espulso = true) });
  }
  get v(): VistaGiocatore {
    return this.viste.at(-1)!.vista as VistaGiocatore;
  }
  async entra(extra: { token?: string } = {}) {
    const r = await this.t.entraComeGiocatore('X', { nickname: this.nome, idDispositivo: this.idDispositivo, ...extra });
    if (r.ok) Object.assign(this, { id: r.idGiocatore, token: r.token });
    return r;
  }
}

const attendi = async (cond: () => boolean) => {
  for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 2));
  expect(cond()).toBe(true);
};

let amici: Amico[] = [];
afterEach(() => {
  amici.forEach((a) => a.t.chiudi());
  amici = [];
  vi.useRealTimers();
});

async function tavolo(n: number, archivio = archivioInMemoria()) {
  const stanza = Stanza.nuova({}, 'X');
  const host = new HostLocale(stanza, archivio);
  let master: PacchettoVista | null = null;
  host.ascolta({ vista: (p) => (master = p) });
  amici = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena'].slice(0, n).map((nome) => new Amico(host, nome));
  for (const a of amici) expect((await a.entra()).ok).toBe(true);
  await attendi(() => amici.every((a) => a.viste.at(-1)?.vista.giocatori.length === n));
  return { host, stanza, archivio, master: () => master! };
}

describe('il telefono del Master ospita la partita', () => {
  it('gli amici entrano e ricevono la lobby; il Master li vede collegati', async () => {
    const { master } = await tavolo(3);
    const m = master().vista as VistaMaster;
    expect(m.giocatori.map((g) => g.nome)).toEqual(['Anna', 'Bruno', 'Carla']);
    expect(Object.values(master().connessi)).toEqual([true, true, true]);
    expect(amici[0]!.v.tipo).toBe('giocatore');
    expect(amici[0]!.viste.at(-1)!.profilo).toEqual({ partite: 0, vittorie: {} });
  });

  it('distribuisce i ruoli: ognuno vede solo il proprio', async () => {
    const { host, master } = await tavolo(3);
    await host.comando({ tipo: 'impostaComposizione', composizione: { lupo: 1, villico: 2 } });
    expect((await host.comando({ tipo: 'avviaPartita' })).ok).toBe(true);
    await attendi(() => amici.every((a) => a.v.fase === 'rivelazione'));
    const ruoli = (master().vista as VistaMaster).giocatori.map((g) => g.ruolo);
    for (const a of amici) {
      expect(a.v.io.ruolo!.id).toBe(ruoli[(master().vista as VistaMaster).giocatori.findIndex((g) => g.id === a.id)]);
      expect(JSON.stringify(a.viste.at(-1))).not.toMatch(/"ruoloIniziale"|_undo|"scelte"/);
      expect(a.v.giocatori.every((g) => g.rivelato === null)).toBe(true);
    }
  });

  it('un amico non può usare i comandi del Master né mandare dati malformati', async () => {
    await tavolo(2);
    expect(await amici[0]!.t.comando({ tipo: 'avviaPartita' })).toMatchObject({ ok: false, errore: expect.stringMatching(/Solo il Master/) });
    expect(await amici[0]!.t.comando({ tipo: 'boh' } as never)).toMatchObject({ ok: false, errore: 'Comando non valido.' });
    expect(await amici[0]!.t.timer({ azione: 'stop' })).toMatchObject({ ok: false });
  });

  it('chi perde il collegamento rientra da solo con il token nello stesso posto', async () => {
    const { master } = await tavolo(2);
    const anna = amici[0]!;
    const { id, token } = anna;
    anna.cavi.at(-1)!.taglia();
    await attendi(() => master().connessi[id!] === false);
    // il trasporto ritenta da solo; poi l'app si ripresenta con il token
    await attendi(() => anna.cavi.length === 2);
    const r = await anna.entra({ token });
    expect(r).toMatchObject({ ok: true, idGiocatore: id, token });
    await attendi(() => master().connessi[id!] === true);
  }, 10_000);

  it('il Master può togliere un amico dal tavolo', async () => {
    const { host } = await tavolo(2);
    await host.comando({ tipo: 'rimuoviGiocatore', id: amici[1]!.id! });
    await attendi(() => amici[1]!.espulso);
    expect(await amici[1]!.t.comando({ tipo: 'confermaVisto' })).toMatchObject({ ok: false });
  });

  it('di notte vibra solo il telefono di chi viene chiamato', async () => {
    const { host, master } = await tavolo(3);
    await host.comando({ tipo: 'impostaComposizione', composizione: { lupo: 1, veggente: 1, villico: 1 } });
    await host.comando({ tipo: 'avviaPartita' });
    await host.comando({ tipo: 'iniziaNotte' });
    await host.comando({ tipo: 'chiamaProssimoPasso' }); // il lupo (riconoscimento)
    const lupo = (master().vista as VistaMaster).giocatori.find((g) => g.ruolo === 'lupo')!.id;
    await attendi(() => amici.find((a) => a.id === lupo)!.chiamate === 1);
    expect(amici.filter((a) => a.chiamate > 0)).toHaveLength(1);
  });

  it('se l\'app del Master si chiude, la partita riparte dall\'archivio e gli amici rientrano', async () => {
    const archivio = archivioInMemoria();
    const { host } = await tavolo(3, archivio);
    await host.comando({ tipo: 'impostaComposizione', composizione: { lupo: 1, villico: 2 } });
    await host.comando({ tipo: 'avviaPartita' });
    await host.salvaSubito();
    const ruoloAnna = (host.stanza.stato.giocatori.find((g) => g.id === amici[0]!.id)!).ruolo;
    host.chiudi();

    const host2 = new HostLocale(Stanza.deserializza((await archivio.caricaPartita('X'))!), archivio);
    const anna = new Amico(host2, 'Anna');
    amici.push(anna);
    const r = await anna.entra({ token: amici[0]!.token });
    expect(r).toMatchObject({ ok: true, idGiocatore: amici[0]!.id });
    await attendi(() => anna.viste.length > 0);
    expect(anna.v.io.ruolo!.id).toBe(ruoloAnna);
  });

  it('a fine partita aggiorna statistiche e storico sul telefono del Master', async () => {
    const { host, archivio } = await tavolo(3);
    await host.comando({ tipo: 'impostaComposizione', composizione: { lupo: 1, villico: 2 } });
    await host.comando({ tipo: 'avviaPartita' });
    const lupo = host.stanza.stato.giocatori.find((g) => g.ruolo === 'lupo')!;
    await host.comando({ tipo: 'uccidi', id: lupo.id });
    await host.comando({ tipo: 'confermaVittoria' });
    const villico = amici.find((a) => a.id !== lupo.id)!;
    expect(await archivio.profilo(villico.idDispositivo)).toMatchObject({ partite: 1, vittorie: { villaggio: 1 } });
    expect(archivio.dati.get('storico')).toHaveLength(1);
    await attendi(() => villico.viste.at(-1)!.profilo?.partite === 1);
  });
});
