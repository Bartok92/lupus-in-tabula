import { fileURLToPath } from 'node:url';
import { creaServer } from './app.js';

const PORTA = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB = process.env.LUPUS_DB ?? fileURLToPath(new URL('../data/lupus.sqlite', import.meta.url));
const DIST = process.env.LUPUS_CLIENT_DIST ?? fileURLToPath(new URL('../../client/dist', import.meta.url));
const SCADENZA_ORE = Number(process.env.LUPUS_SCADENZA_ORE ?? 6);

const server = await creaServer({ percorsoDb: DB, distClient: DIST, log: true, scadenzaMs: SCADENZA_ORE * 3600_000 });
await server.app.listen({ port: PORTA, host: HOST });

let chiusura = false;
for (const segnale of ['SIGINT', 'SIGTERM'] as const) {
  process.on(segnale, async () => {
    if (chiusura) return;
    chiusura = true;
    server.app.log.info('Salvo le partite in corso e chiudo…');
    await server.chiudi();
    process.exit(0);
  });
}
