import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

export const DEMO_USER_ID = 1;

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export function openDatabase(filename: string): Db {
  if (filename !== ':memory:') {
    mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  db.prepare('INSERT OR IGNORE INTO users (id, name, created_at) VALUES (?, ?, ?)').run(
    DEMO_USER_ID,
    'Demo learner',
    timestamp(),
  );
  return db;
}

export function timestamp(date = new Date()): string {
  return date.toISOString();
}
