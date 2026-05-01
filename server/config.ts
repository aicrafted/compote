import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR ?? '/data';
export const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, 'compote.db');
export const DIST_DIR = path.resolve(process.cwd(), 'dist');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(path.join(DATA_DIR, 'catalog'), { recursive: true });
mkdirSync(path.join(DATA_DIR, 'bundles'), { recursive: true });
