import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { getDbPath, getVibeBugDir } from '../utils/paths.js';
import { mkdirSync, existsSync } from 'node:fs';

let cachedDb: ReturnType<typeof drizzle> | null = null;
let cachedSqlite: Database.Database | null = null;

export function getDatabase(projectRoot: string) {
  if (cachedDb) return cachedDb;

  const vibebugDir = getVibeBugDir(projectRoot);
  if (!existsSync(vibebugDir)) {
    mkdirSync(vibebugDir, { recursive: true });
  }

  const dbPath = getDbPath(projectRoot);
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  cachedSqlite = sqlite;
  cachedDb = drizzle(sqlite, { schema });

  return cachedDb;
}

export function closeDatabase(): void {
  if (cachedSqlite) {
    cachedSqlite.close();
    cachedSqlite = null;
    cachedDb = null;
  }
}
