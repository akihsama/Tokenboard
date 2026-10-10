import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

/**
 * Resolve the runtime data directory. Defaults to ./data relative to the
 * project root; override with DATA_DIR (handy for Docker volume mounts).
 */
function resolveDataDir(): string {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const DATA_DIR = resolveDataDir();
export const DB_PATH = path.join(DATA_DIR, "tokenboard.db");

// Reuse a single connection across hot reloads / route handlers.
const globalForDb = globalThis as unknown as {
  __tokenboardSqlite?: Database.Database;
};

function createConnection(): Database.Database {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

export const sqlite = globalForDb.__tokenboardSqlite ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__tokenboardSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
export { schema };
