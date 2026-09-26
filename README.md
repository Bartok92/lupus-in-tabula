# Lupus in Tabula – app da cellulare

**👉 Gioca: https://bartok92.github.io/lupus-in-tabula/**

App per giocare a Lupus in Tabula con i telefoni: il **Master** crea la partita, gli amici **scansionano il QR** e giocano ciascuno dal proprio telefono. Regole e varianti: [RULES.md](RULES.md).

## Come si gioca a casa di amici

1. Il Master apre l'app (l'indirizzo di GitHub Pages) e la **installa** sul telefono: *Aggiungi a schermata Home*.
2. Tocca **Crea una partita**: il suo telefono diventa il **tavolo**. Aspetta la scritta *Tavolo aperto: si può entrare*.
3. Gli amici **scansionano il QR** (oppure il Master usa **Invita** e manda il link su WhatsApp) e scrivono il loro nome.
4. Il Master sceglie la composizione, distribuisce i ruoli e guida la partita dalla **regia**.

Da sapere:
- Il telefono del Master **tiene la partita**: deve restare sull'app per tutta la serata (lo schermo resta acceso da solo).
- Se un telefono si blocca o si ricarica la pagina, **rientra da solo** nello stesso posto con lo stesso ruolo. Se si chiude l'app del Master, basta riaprirla: la partita riparte da dov'era (*Le tue partite su questo telefono*) e gli amici si ricollegano.
- Serve internet (dati mobili o Wi-Fi) solo per "presentarsi": i dati della partita viaggiano **direttamente da telefono a telefono** (WebRTC, tramite il servizio pubblico gratuito PeerJS). Se su qualche rete mobile un amico non riesce a collegarsi, fatelo entrare nel Wi-Fi di casa.
- Chi non ha il telefono può giocare lo stesso: il Master lo aggiunge a mano e agisce **per conto suo** (tocca il nome nella tabella).

## Architettura

Monorepo pnpm + TypeScript:

| Pacchetto | Contenuto |
|---|---|
| `packages/engine` | Motore di gioco puro: regole, ruoli, viste filtrate, regia, **Stanza** (sessioni, riconnessione, attesa finta, timer). Gira identico nel browser e nel server. |
| `packages/client` | React + Vite + Tailwind + Zustand, PWA installabile. Contiene anche l'**host** della partita per il telefono del Master (`src/rete/p2p`). |
| `packages/server` | Node + Fastify + Socket.IO + SQLite: alternativa con un server vero (rete locale o cloud). |

L'app sceglie da sola dove vive la partita: se trova il server Node usa quello, altrimenti fa da tavolo il telefono del Master. Si può forzare con `?modo=p2p` o `?modo=server` nell'indirizzo.

## Pubblicare su GitHub Pages (gratis)

1. Crea un repository su GitHub e carica il progetto (ramo `main`).
2. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. A ogni `git push` il workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) esegue i test, compila l'app e la pubblica su `https://<utente>.github.io/<repository>/`.

## Sviluppo locale

Requisiti: Node ≥ 22, pnpm (`npm i -g pnpm`).

```bash
pnpm install
pnpm dev        # server su :3000, client su :5173 (con proxy verso il server)
pnpm test       # test di motore, server e client
pnpm typecheck
```

- Modalità "telefono del Master" in sviluppo: `http://localhost:5173/?modo=p2p`.
- Pagine utili: `#/styleguide` (design system e tutte le carte), `#/mockup`.
- Icone dell'app: si rigenerano da `packages/client/public/icona.svg` con `pnpm --filter @lupus/client exec pwa-assets-generator --override`.

### Server Node (opzionale: rete locale o cloud)

| Variabile | Default | Significato |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `HOST` | `0.0.0.0` | Interfaccia di ascolto |
| `LUPUS_DB` | `packages/server/data/lupus.sqlite` | Database SQLite (profili, preset, storico, partite in corso) |
| `LUPUS_CLIENT_DIST` | `packages/client/dist` | Client compilato da servire sulla stessa porta |
| `LUPUS_SCADENZA_ORE` | `6` | Dopo quante ore di inattività una stanza viene eliminata |

```bash
# fa entrare 6 giocatori finti (solo modalità server) nella stanza K7PQ2X per 30 minuti:
# confermano la carta, agiscono di notte e votano a caso
pnpm --filter @lupus/server exec tsx scripts/giocatori-finti.ts K7PQ2X 6 30
```
