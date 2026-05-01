import { Database } from 'bun:sqlite';
import { DB_PATH } from './config';

export const db = new Database(DB_PATH, { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

export const storeGet = db.query<{ value: string }, [string]>(
  'SELECT value FROM store WHERE key = ?'
);

export const storePut = db.query<unknown, [string, string]>(
  'INSERT INTO store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

export const storeDel = db.query<unknown, [string]>(
  'DELETE FROM store WHERE key = ?'
);
