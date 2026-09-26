# Lupus in Tabula – Regole implementate dall'app

> Documento di riferimento per il motore (`packages/engine`). Ogni regola ha un **default**;
> dove indicato **⚙︎ variante**, il Master può cambiarla nelle impostazioni della partita.
> Le interpretazioni sui punti ambigui sono state confermate (vedi §11).

---

## 1. Concetti di base

| Termine | Significato |
|---|---|
| **Master** | Il moderatore. Non è un giocatore, vede tutto, avanza le fasi a mano. L'app **non avanza mai da sola**. |
| **Giocatore** | Una persona al tavolo, con un posto (ordine del giro) e un ruolo segreto. |
| **Fazione** | Squadra con cui si vince: `villaggio`, `lupi`, `criceto` (solitario), `personalizzata`. |
| **Aura** | Ciò che vedono Veggente/Medium/Cartomante: `lupo` oppure `non_lupo`. |
| **Lupo mannaro "vero"** | Ruolo con `contaComeLupo = true`. Solo questi contano per la parità e per la vittoria del villaggio. |
| **Vivo / morto** | Un morto diventa spettatore: vede solo le informazioni pubbliche. |

---

## 2. Fazioni e condizioni di vittoria

La vittoria si controlla **dopo ogni morte**: alla conferma dell'alba e dopo il rogo (anche dopo un'uccisione manuale del Master).
L'app **propone** l'esito, il Master lo **conferma** (o lo ignora e continua).

Siano:
- `L` = numero di vivi con `contaComeLupo = true`
- `A` = numero degli altri vivi che contano per la parità (tutti i vivi tranne i lupi veri, esclusi i ruoli con `contaPerParita = false`, es. Mortovivo)

Ordine di controllo:
1. **Villaggio** vince se `L = 0`.
2. **Lupi** vincono se `L ≥ A` (e `L > 0`).
3. Altrimenti la partita continua.

Quando la partita finisce (per 1 o 2):
- **Criceto mannaro**: se è vivo, **vince solo lui** e tutti gli altri perdono (anche la fazione che aveva "vinto").
- Chi vince con una fazione vince anche **da morto** (es. un villico morto vince se vince il villaggio).
- L'Indemoniato e la Mucca mannara vincono con i lupi, ma **contano come "altri"** (`A`) nella parità.
- Caso limite *tutti morti* (`L = 0` e `A = 0`): vince il villaggio (regola 1 ha precedenza).

Esempi:
- 1 lupo + 1 villico vivi → `1 ≥ 1` → **vincono i lupi**.
- 2 lupi + 2 villici → **vincono i lupi** (parità).
- 1 lupo + 1 villico + 1 indemoniato → `1 ≥ 2` falso → si continua.

---

## 3. Svolgimento della partita (macchina a stati)

```
LOBBY → RIVELAZIONE → NOTTE(n) → ALBA(n) → [FINE?] → DISCUSSIONE → NOMINATION → BALLOTTAGGIO(difesa → voto)
      → ROGO → [FINE?] → NOTTE(n+1) → ...
```

Ogni freccia è un comando del Master (`prossimaFase`). Il motore rifiuta i comandi non validi nella fase corrente.

### 3.1 Lobby
- I giocatori entrano con codice stanza / QR + nickname. Il Master può **espellere**, **rinominare**, **riordinare i posti**.
- Il Master sceglie la **composizione** (ruolo → quantità). Validazione:
  - **Errore** (blocca l'avvio): numero ruoli ≠ numero giocatori; nessun lupo vero; Massoni presenti ma meno di 2; ruolo presente in quantità superiore al suo `massimo`.
  - **Avviso** (non blocca): meno di 8 giocatori; ruolo sotto il suo `minGiocatoriConsigliato`; composizione sbilanciata (vedi §7).
- Assegnazione: mescolamento **Fisher–Yates** con numeri casuali **crittograficamente sicuri** (`crypto.getRandomValues`). Il motore non genera casualità da solo: riceve un generatore/seme dall'esterno, così i test sono ripetibili.

### 3.2 Rivelazione del ruolo
- Ogni giocatore tiene premuto per vedere la carta, poi preme **"Ho visto"**.
- Il Master vede chi ha confermato; può avviare la notte anche se manca qualcuno.

### 3.3 Notte
- Il Master chiama i ruoli **uno alla volta** nell'ordine configurato (§5). Il chiamato riceve vibrazione + schermata di azione; gli altri vedono la schermata "finta" (anti-indizi).
- Se un ruolo è **morto o assente** in partita, il passo **non viene saltato in modo visibile**: il Master lo "chiama" comunque e l'app simula un'attesa casuale (default 6–12 s ⚙︎) prima di permettere di andare avanti.
- Le azioni vengono **raccolte** durante la notte e **risolte tutte insieme all'alba** (§4): l'ordine di chiamata non cambia il risultato.
- Le **informazioni** (Veggente, Cartomante, Medium) vengono mostrate al giocatore **subito** dopo la scelta, perché non dipendono dalle altre azioni (l'aura non cambia durante la notte: la trasformazione del Mitomane avviene all'alba). ⚙︎ variante: "mostra le informazioni solo all'alba".
- Il Master può **forzare** un bersaglio, **annullare** l'ultima azione (undo) o chiudere un passo senza azione.

### 3.4 Prima notte (default ⚙︎)
| Cosa | Default | Variante |
|---|---|---|
| Lupi si riconoscono | sì | – |
| Lupi sbranano | **no** | sì |
| Massoni si riconoscono | sì | – |
| Mucca mannara vede i lupi | sì | – |
| Mitomane sceglie | sì | – |
| Veggente / Cartomante agiscono | **sì** | no |
| Guardia agisce | no (inutile se i lupi non uccidono; si attiva automaticamente se "lupi sbranano la prima notte" = sì) | – |
| Gufo agisce | sì | no |

### 3.5 Alba
- Il Master vede un'**anteprima** (chi muore e perché, chi è stato salvato, trasformazioni, bersaglio del Gufo) e la **conferma**.
- Annuncio pubblico: solo i **nomi** dei morti (oppure "Stanotte non è morto nessuno"). La **causa non viene mai annunciata** (lupi e Veggente-sul-Criceto sembrano uguali).
- Ruolo dei morti: ⚙︎ `nascosto` (**default**, regola classica) / `solo fazione` / `ruolo completo`.
- Controllo vittoria.

### 3.6 Discussione
- Timer opzionale gestito dal Master (avvia / pausa / +30 s / stop). Allo scadere il timer suona/vibra solo sul dispositivo del Master.

### 3.7 Nomination (primo voto)
- Votano **tutti i vivi** che possono votare (non il Mortovivo). Si vota **un altro giocatore vivo** (⚙︎ permettere l'auto-voto: default no). ⚙︎ astensione permessa: default **sì**.
- Il voto si può **cambiare** finché il Master non chiude la votazione. Il Master vede i voti in diretta; i giocatori vedono ⚙︎ solo il conteggio a fine voto (**default**) / i voti in diretta.
- Chi va al **ballottaggio**:
  1. I **2 più votati** (con almeno 1 voto).
  2. **+** il bersaglio del **Gufo** (se vivo e non già tra i candidati). Il Gufo non "ruba" un posto: si aggiunge.
  3. **Pareggio** che coinvolge il 2° posto (o il 1° con 3+ a pari merito) ⚙︎:
     - `tutti` — vanno tutti i pari merito (**default**)
     - `rivoto` — nuovo voto solo fra i pari merito per il posto conteso
     - `master` — sceglie il Master
     - `sorteggio` — estrazione casuale
  4. Se ha ricevuto voti **un solo giocatore** e non c'è Gufo, ⚙︎ `il Master aggiunge un secondo candidato` (**default**) / `rogo diretto` (va al ballottaggio da solo e il voto finale si salta).
  5. Se **nessuno** riceve voti: il Master sceglie se passare alla notte senza rogo o ripetere il voto.

### 3.8 Ballottaggio
- **Difesa**: ogni candidato parla (timer opzionale per candidato, ordine del giro).
- **Voto finale** fra i soli candidati. ⚙︎ i candidati **non votano** (**default**) / votano anche loro. Astensione ⚙︎ (default sì).
- Il più votato va al **rogo**. **Pareggio** ⚙︎:
  - `rivoto` — nuovo voto fra i pari merito; se c'è di nuovo pareggio decide il Master (**default**)
  - `master` — decide il Master
  - `sorteggio` — estrazione casuale
  - `nessuno` — nessun morto oggi

### 3.9 Rogo
- Il condannato muore (fiamma animata). Ruolo rivelato secondo la stessa opzione dell'alba.
- Il suo esito (lupo / non lupo) viene memorizzato per il **Medium** della notte seguente.
- Controllo vittoria. Poi inizia la notte successiva.

---

## 4. Risoluzione della notte (all'alba)

Il motore applica questi passi **in quest'ordine fisso**, indipendente dall'ordine di chiamata. Tutte le azioni fatte nella notte valgono **anche se chi le ha fatte muore in quella stessa notte** (simultaneità).

1. **Mitomane** (solo 1ª notte): calcola il nuovo ruolo (applicato al passo 6).
2. **Bersaglio dei lupi**: se tutti i lupi vivi hanno scelto la stessa persona → quella. Se non c'è accordo → decide il Master (vede i voti dei lupi e sceglie; ⚙︎ variante: vince la maggioranza, a parità decide il Master). Se nessun lupo ha scelto → nessuna vittima.
3. **Protezione**: se il bersaglio dei lupi è protetto dalla Guardia → salvo.
4. **Immunità**: se il bersaglio è il **Criceto mannaro** → non muore (i lupi non lo sanno; il Master sì).
5. **Veggenti** (Veggente, Cartomante, Mitomane-diventato-veggente): se hanno indicato il **Criceto mannaro**, il Criceto **muore** — la Guardia **non** lo salva (protegge solo dai lupi).
6. **Applica**: morti, trasformazione del Mitomane, bersaglio del Gufo per il giorno dopo.
7. Registra tutto nel log con la causa (visibile solo al Master e nella schermata finale "cosa è successo davvero").

Il Master può sempre sovrascrivere l'esito prima di confermare l'alba.

---

## 5. Ordine di chiamata (default ⚙︎ riordinabile)

**Prima notte:** Lupi (riconoscimento) → Mucca mannara → Massoni → Mitomane → Veggente → Cartomante → Gufo → ruoli personalizzati

**Notti successive:** Veggente → Cartomante → Medium → Guardia → Gufo → Lupi → ruoli personalizzati

Il Mitomane diventato lupo viene chiamato con i lupi dalla 2ª notte (e vede i compagni); se diventato veggente viene chiamato come un secondo "Veggente" separato (i due veggenti non si conoscono).

---

## 6. Ruoli

### 6.1 Schema di un ruolo (registro data-driven)

Ogni ruolo è un oggetto nel registro `packages/engine/src/ruoli.ts`. Aggiungere un ruolo = aggiungere una definizione; il motore non va toccato finché si usano tipi di azione esistenti.

```ts
interface DefinizioneRuolo {
  id: string;                    // 'veggente'
  nome: string;                  // 'Veggente'
  set: 'base' | 'esteso' | 'personalizzato';
  fazione: 'villaggio' | 'lupi' | 'criceto' | 'personalizzata';
  aura: 'lupo' | 'non_lupo';     // cosa vede il Veggente
  contaComeLupo: boolean;        // conta come lupo per parità / vittoria villaggio
  contaPerParita: boolean;       // false = non conta tra gli "altri" (es. Mortovivo)
  puoVotare: boolean;
  notti: 'mai' | 'tutte' | 'solo_prima' | 'dalla_seconda';
  azione:
    | { tipo: 'nessuna' }
    | { tipo: 'bersaglio'; effetto: 'uccidi_branco' | 'proteggi' | 'indaga' | 'gufo' | 'copia' | 'manuale';
        vincoli: { nonSeStesso?: boolean; nonStessoDueNottiDiFila?: boolean; nonCompagni?: boolean } }
    | { tipo: 'informazione'; effetto: 'medium' }           // nessuna scelta, riceve un'informazione
    | { tipo: 'riconoscimento' };                           // vede i membri dei gruppi in `conosce`
  collettivo: boolean;           // chiamati tutti insieme (lupi, massoni) o uno per uno
  gruppo?: string;               // gruppo segreto di appartenenza ('lupi', 'massoni')
  conosce?: string[];            // gruppi di cui vede i membri (Mucca mannara: ['lupi'])
  immunitaLupi?: boolean;        // Criceto
  muoreSeIndagato?: boolean;     // Criceto
  minimo?: number; massimo?: number;       // quantità ammesse in composizione
  minGiocatoriConsigliato: number;
  peso: number;                  // per il bilanciamento (positivo = aiuta il villaggio)
  descrizione: string;           // testo breve per la carta
  obiettivo: string;             // "Vinci quando…"
  istruzioniNotte?: string;      // testi contestuali con segnaposti {compagni}, {vincoli} (§6.4)
  istruzioniPrimaNotte?: string;
  istruzioniGiorno: string;
  immagine: string;              // chiave dell'illustrazione (sostituibile dal Master)
}
```

### 6.2 Set base

| Ruolo | Fazione | Aura | Notti | Azione | Note / vincoli | Min giocatori |
|---|---|---|---|---|---|---|
| **Villico** | villaggio | non lupo | mai | – | Nessun potere. | – |
| **Lupo mannaro** | lupi | lupo | tutte (1ª: solo riconoscimento ⚙︎) | bersaglio collettivo (`uccidi_branco`) | Ogni lupo vede gli altri lupi e il **voto dei compagni in tempo reale**. Non può scegliere un lupo vero. | – |
| **Veggente** | villaggio | non lupo | tutte (⚙︎ dalla 2ª) | bersaglio (`indaga`) | Scopre "lupo / non lupo" di un vivo (non se stesso). Indicare il Criceto lo uccide. | – |
| **Medium** | villaggio | non lupo | dalla seconda | informazione | Scopre l'aura di chi è andato al rogo il giorno prima (oppure "ieri nessuno è andato al rogo"). | 9 |
| **Guardia del corpo** | villaggio | non lupo | dalla seconda (§3.4) | bersaglio (`proteggi`) | Protegge dai lupi. Non se stessa. ⚙︎ non la stessa persona due notti di fila (default **sì**, vietato). | 9 |
| **Gufo** | villaggio | non lupo | tutte | bersaglio (`gufo`) | Il bersaglio va direttamente al ballottaggio il giorno dopo (se vivo). ⚙︎ può indicare se stesso (default no). | 10 |
| **Massone** (≥2) | villaggio | non lupo | solo prima | riconoscimento | Si riconoscono tra loro. | 10 |
| **Indemoniato** | lupi | **non lupo** | mai | – | Vince con i lupi, ma non li conosce e loro non conoscono lui. Conta come "altro" nella parità. | 10 |
| **Criceto mannaro** | criceto | non lupo | mai | – | Immune ai lupi. Muore se indicato da un veggente. Se vivo a fine partita vince solo lui. Max 1. | 12 |
| **Mitomane** | villaggio (finché non cambia) | non lupo | solo prima | bersaglio (`copia`) | Se indica un **lupo** → diventa Lupo mannaro; se indica il **Veggente** → diventa un secondo Veggente; altrimenti → Villico. Riceve il nuovo ruolo sul telefono all'alba. ⚙︎ variante "copia qualsiasi ruolo". | 11 |

**Mitomane – dettagli** ✔ confermato
- La trasformazione vale dall'alba della prima notte: se quella notte il Veggente lo indica, lo vede ancora "non lupo".
- Diventato lupo: dalla 2ª notte vota con il branco e **i lupi vedono che si è aggiunto** (sul telefono compare il nuovo compagno).
- Il Veggente originale **non** sa di essere stato copiato.
- Se indica Mucca mannara, Indemoniato, Criceto o Cartomante → diventa Villico (solo "Lupo mannaro" e "Veggente" contano).

### 6.3 Set esteso (attivabile dal Master)

| Ruolo | Fazione | Aura | Notti | Azione | Note |
|---|---|---|---|---|---|
| **Cartomante** | villaggio | non lupo | tutte | bersaglio (`indaga`) | Un secondo veggente chiamato separatamente. Anche lei uccide il Criceto. |
| **Mucca mannara** | lupi | **non lupo** | solo prima | riconoscimento (vede i lupi) | Conosce i lupi, loro non conoscono lei. Vince con i lupi, conta come "altro" nella parità. I lupi possono sbranarla. |
| **Mortovivo** | villaggio | non lupo | mai | – | Vedi sotto. |
| **Ruolo personalizzato** | a scelta | a scelta | a scelta (sì/no) | `manuale` | Creato dal Master con un editor (nome, fazione, aura, agisce di notte sì/no, descrizione, "conta come lupo"). L'app **mostra solo la scelta** al Master, che applica gli effetti a mano (uccidi/resuscita/nota nel log). |

**Mortovivo** ✔ confermato
- È in gioco e partecipa alla discussione, **non vota** (`puoVotare = false`) e **non conta** nella parità (`contaPerParita = false`), perché è "già morto".
- **Può** essere votato e mandato al rogo, e può essere sbranato.
- Quando viene ucciso diventa **Fantasma**: spettatore come un normale morto.
- Vince con il villaggio.

### 6.4 La carta del giocatore e le istruzioni

Ogni giocatore vede, come **elemento principale dello schermo**, la carta del suo personaggio:
- **Immagine** del personaggio grande (campo `immagine` del ruolo). L'app contiene illustrazioni **originali**; il Master può **sostituire l'immagine di ogni ruolo** con una propria (es. la foto delle carte fisiche possedute), salvata solo sul suo server/dispositivo per uso privato e **mai inclusa nel codice**.
- **Nome**, **fazione** e **obiettivo** ("Vinci quando…").
- **Istruzioni contestuali**: il motore genera per ogni giocatore, a ogni fase, un testo su *cosa fare adesso*, con i nomi veri inseriti. Esempi:
  - Lupo, notte: *"Scegli con il branco chi sbranare stanotte. I tuoi compagni: Anna, Luca. Vedete i voti degli altri in tempo reale: mettetevi d'accordo, altrimenti decide il Master."*
  - Lupo, 1ª notte: *"Guarda bene i tuoi compagni: Anna, Luca. Stanotte non si sbrana."*
  - Guardia: *"Scegli chi proteggere dai lupi stanotte. Non puoi scegliere te stesso né Marco (protetto ieri)."*
  - Lupo, giorno: *"Difendi i compagni senza farti notare. Vota come un villico qualsiasi."*
  - Chi non è chiamato di notte vede lo stesso testo per tutti ("È notte… completa il piccolo compito mentre aspetti"), così lo schermo non tradisce nessuno.
- I testi stanno nella definizione del ruolo (`obiettivo`, `istruzioniNotte`, `istruzioniPrimaNotte`, `istruzioniGiorno`) con segnaposti come `{compagni}` e `{ieri}`, quindi si possono modificare senza toccare il motore.

---

## 7. Composizione e bilanciamento

### Suggerimento automatico (default)

| Giocatori | Composizione suggerita |
|---|---|
| 8 | 2 Lupi, Veggente, 5 Villici |
| 9 | 2 Lupi, Veggente, Medium, 5 Villici |
| 10 | 2 Lupi, Indemoniato, Veggente, Medium, Guardia, 4 Villici |
| 11 | 2 Lupi, Indemoniato, Veggente, Medium, Guardia, Mitomane, 4 Villici |
| 12 | 3 Lupi, Indemoniato, Veggente, Medium, Guardia, Gufo, 2 Massoni, 2 Villici |
| 13 | 3 Lupi, Indemoniato, Veggente, Medium, Guardia, Gufo, 2 Massoni, Criceto, 2 Villici |
| 14 | 3 Lupi, Indemoniato, Veggente, Medium, Guardia, Gufo, 2 Massoni, Criceto, Mitomane, 2 Villici |
| 15–18 | 4 Lupi + i ruoli di 14 + Villici |
| 19–24 | 5 Lupi + i ruoli di 14 + Villici |

### Avviso di sbilanciamento
Somma dei `peso` dei ruoli (lupo −5, villico +1, veggente +7, medium/guardia +3, massone/gufo +2, indemoniato/mucca −3, criceto −2, mitomane/mortovivo 0, cartomante +5). L'avviso compare se:
- i lupi veri sono meno di 1/6 o più di 1/3 dei giocatori, oppure
- il valore assoluto della somma dei pesi supera `max(5, 0,35 × giocatori)`.

Preset salvabili (es. "Classica 10", "Serata 14").

---

## 8. Cosa vede chi (viste filtrate)

Principio: **ogni client riceve solo ciò che il suo proprietario deve sapere**. La vista viene calcolata dal motore (`vistaPer(stato, destinatario)`) e testata.

| Informazione | Master | Giocatore vivo | Giocatore morto |
|---|---|---|---|
| Elenco giocatori, posti, vivi/morti, connessione | ✔ | ✔ | ✔ |
| Il proprio ruolo | – | ✔ | ✔ |
| Ruoli degli altri | ✔ tutti | solo compagni noti (lupi↔lupi, massoni↔massoni, mucca→lupi) | ✘ (⚙︎ solo quelli rivelati) |
| Scelte notturne | ✔ in diretta | solo le proprie + voti del branco (se lupo) | ✘ |
| Risultati delle indagini | ✔ | solo i propri | ✘ (non riceve più nulla di segreto) |
| Chi è chiamato di notte | ✔ | solo se è lui (gli altri vedono la schermata finta) | ✘ |
| Voti nomination/ballottaggio | ✔ in diretta | ⚙︎ a fine voto / in diretta | come i vivi |
| Causa delle morti | ✔ | ✘ | ✘ |
| Log completo | ✔ | a fine partita | a fine partita |

Anche il **tempo** non deve tradire: tutte le schermate notturne sono identiche per struttura, animazioni e luminosità; il server invia a tutti lo stesso evento "passo notturno" (con l'azione vera solo nella vista del chiamato).

---

## 9. Poteri del Master (override)

- Forzare/cambiare qualsiasi bersaglio notturno, anche dopo la scelta del giocatore.
- **Undo** dell'ultima azione (pila di azioni annullabili fino all'inizio della fase corrente).
- Uccidere o resuscitare manualmente un giocatore (causa registrata come "decisione del Master").
- Chiudere votazioni, scegliere in caso di pareggio, ignorare l'esito di vittoria proposto.
- Pausa della partita.
- Ogni override finisce nel log.

---

## 10. Riepilogo delle impostazioni (default)

| Chiave | Default |
|---|---|
| `primaNotte.lupiUccidono` | `false` |
| `primaNotte.veggenteAgisce` | `true` |
| `primaNotte.gufoAgisce` | `true` |
| `lupi.disaccordo` | `master` (alternativa: `maggioranza`) |
| `veggente.risultatoSubito` | `true` |
| `guardia.nonStessoDueNotti` | `true` |
| `gufo.puoSeStesso` | `false` |
| `rivelaRuoloMorti` | `nascosto` (`fazione`, `ruolo`) |
| `nomination.autovoto` | `false` |
| `nomination.astensione` | `true` |
| `nomination.pareggio` | `tutti` (`rivoto`, `master`, `sorteggio`) |
| `nomination.unSoloVotato` | `master_aggiunge` (`rogo_diretto`) |
| `voti.visibiliInDiretta` | `false` |
| `ballottaggio.candidatiVotano` | `false` |
| `ballottaggio.pareggio` | `rivoto_poi_master` (`master`, `sorteggio`, `nessuno`) |
| `attesaFinta` | 6–12 s |
| `setEsteso` | `false` |
| `suoni.master` / `suoni.giocatori` | `true` / `false` |

---

## 11. Decisioni confermate (2026-09-26)

1. **Tutti morti** contemporaneamente → vince il villaggio.
2. **Un solo votato** in nomination senza Gufo → il Master aggiunge un secondo candidato (default; variante: rogo diretto).
3. **Mitomane**: trasformazione all'alba, i lupi vedono il nuovo compagno, copia solo Lupo/Veggente.
4. **Mortovivo**: non vota, non conta nella parità, può essere votato/ucciso, diventa Fantasma.
5. **Guardia** attiva solo dalla 2ª notte (se i lupi non sbranano la 1ª).
6. **Informazioni del Veggente** mostrate subito (non all'alba); una volta scelto, il bersaglio non si può cambiare.
7. **Pareggio al ballottaggio**: rivoto, poi decide il Master.
8. **Carta del giocatore** con immagine grande del personaggio e istruzioni contestuali (§6.4).
