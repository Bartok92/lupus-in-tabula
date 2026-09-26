import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Composizione, ImpostazioniParziali, Vittoria, VoceLog } from '@lupus/engine';

// ——— Schema ———

export const profili = sqliteTable('profili', {
  idDispositivo: text('id_dispositivo').primaryKey(),
  nickname: text('nickname').notNull(),
  partite: integer('partite').notNull().default(0),
  vittorie: text('vittorie', { mode: 'json' }).$type<Record<string, number>>().notNull(),
  aggiornato: integer('aggiornato').notNull(),
});

export const preset = sqliteTable('preset', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull().unique(),
  composizione: text('composizione', { mode: 'json' }).$type<Composizione>().notNull(),
  impostazioni: text('impostazioni', { mode: 'json' }).$type<ImpostazioniParziali>(),
  creato: integer('creato').notNull(),
});

export const storico = sqliteTable('storico', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  codice: text('codice').notNull(),
  iniziata: integer('iniziata').notNull(),
  finita: integer('finita').notNull(),
  vittoria: text('vittoria', { mode: 'json' }).$type<Vittoria>().notNull(),
  giocatori: text('giocatori', { mode: 'json' }).$type<{ nome: string; ruolo: string | null; vivo: boolean }[]>().notNull(),
  log: text('log', { mode: 'json' }).$type<VoceLog[]>().notNull(),
});

/** Istantanee delle partite in corso, per sopravvivere a un riavvio del server. */
export const istantanee = sqliteTable('istantanee', {
  codice: text('codice').primaryKey(),
  dati: text('dati').notNull(),
  aggiornato: integer('aggiornato').notNull(),
});

const DDL = `
CREATE TABLE IF NOT EXISTS profili (
  id_dispositivo TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  partite INTEGER NOT NULL DEFAULT 0,
  vittorie TEXT NOT NULL DEFAULT '{}',
  aggiornato INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS preset (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  composizione TEXT NOT NULL,
  impostazioni TEXT,
  creato INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS storico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codice TEXT NOT NULL,
  iniziata INTEGER NOT NULL,
  finita INTEGER NOT NULL,
  vittoria TEXT NOT NULL,
  giocatori TEXT NOT NULL,
  log TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS istantanee (
  codice TEXT PRIMARY KEY,
  dati TEXT NOT NULL,
  aggiornato INTEGER NOT NULL
);
`;

export type Db = BetterSQLite3Database;

/** Apre (o crea) il database. `percorso = ':memory:'` per i test. */
export function apriDb(percorso: string): { db: Db; chiudi: () => void } {
  if (percorso !== ':memory:') mkdirSync(dirname(percorso), { recursive: true });
  const sqlite = new Database(percorso);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(DDL);
  return { db: drizzle(sqlite), chiudi: () => sqlite.close() };
}
