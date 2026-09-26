# Lupus in Tabula – note per Claude

- Parla in italiano; interfaccia e nomi di dominio in italiano (codice: identificatori in italiano per il dominio).
- Le regole di gioco sono in `RULES.md`: è la fonte di verità del motore. Se cambi una regola, aggiorna prima RULES.md.
- Il motore (`packages/engine`) è puro: niente I/O, niente `Math.random` (la casualità si inietta con `Casuale`).
- Architettura scelta dall'utente (2026-09-26): **il telefono del Master fa da server** (WebRTC via PeerJS, app statica su GitHub Pages). Niente modalità "un telefono che passa di mano". Il server Node resta come alternativa (rete locale/cloud).
- La logica della partita ospitata è `Stanza` (engine): la usano sia `packages/server` sia `packages/client/src/rete/p2p/host.ts`. Cambia lì, non duplicare.
- Chi ospita è l'autorità; agli altri arrivano solo viste filtrate (`vistaPer`). Ogni nuovo dato segreto richiede un test di filtraggio.
- Testi rivolti alle persone: forma neutra, senza indovinare il genere dal nome ("finisce sul rogo", "ci ha lasciato").
- Si lavora per milestone e ci si ferma a fine milestone per mostrare il risultato.
- Grafica originale: non copiare illustrazioni, logo o carte di dV Giochi.
- Dev server: configurazioni `lupus-server`, `lupus-client`, `lupus-pages` (build statica in `/dist/`) in `D:\Claude\.claude\launch.json`. Dopo aver creato file nuovi, riavviare Vite (cache di Tailwind).
