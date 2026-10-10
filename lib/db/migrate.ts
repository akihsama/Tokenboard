import { sqlite } from "./client";

/**
 * Create all tables if they do not exist.
 *
 * We use hand-written idempotent DDL instead of drizzle-kit's generated
 * migration files so a fresh clone / Docker container boots with zero extra
 * steps. The DDL mirrors lib/db/schema.ts exactly.
 *
 * The partial-expression unique index (with COALESCE) cannot be expressed in
 * the Drizzle table definition alone at runtime, so it is created here too.
 */
export function migrate(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS provider_templates (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      category         TEXT NOT NULL,
      source           TEXT NOT NULL DEFAULT 'user',
      base_template_id TEXT,
      spec             TEXT NOT NULL,
      enabled          INTEGER NOT NULL DEFAULT 1,
      created_at       INTEGER NOT NULL,
      updated_at       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS providers (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      template_id     TEXT NOT NULL,
      base_url        TEXT,
      credential_enc  TEXT NOT NULL,
      credential_iv   TEXT NOT NULL,
      credential_tag  TEXT NOT NULL,
      credential_meta TEXT NOT NULL DEFAULT '{}',
      config          TEXT NOT NULL DEFAULT '{}',
      granularity     TEXT NOT NULL DEFAULT 'per_key',
      status          TEXT NOT NULL DEFAULT 'unknown',
      last_error      TEXT,
      last_synced_at  INTEGER,
      enabled         INTEGER NOT NULL DEFAULT 1,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS providers_template_idx ON providers (template_id);

    CREATE TABLE IF NOT EXISTS usage_records (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id          TEXT NOT NULL,
      bucket_start         INTEGER NOT NULL,
      bucket_end           INTEGER NOT NULL,
      bucket_width         TEXT NOT NULL DEFAULT '1d',
      model                TEXT,
      api_key_id           TEXT,
      project_id           TEXT,
      user_id              TEXT,
      workspace_id         TEXT,
      input_tokens         INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens  INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens        INTEGER NOT NULL DEFAULT 0,
      total_tokens         INTEGER NOT NULL DEFAULT 0,
      requests             INTEGER NOT NULL DEFAULT 0,
      cost_amount          REAL,
      currency             TEXT,
      raw                  TEXT,
      synced_at            INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS usage_provider_bucket_idx ON usage_records (provider_id, bucket_start);
    CREATE INDEX IF NOT EXISTS usage_apikey_idx ON usage_records (api_key_id);
    CREATE INDEX IF NOT EXISTS usage_bucket_idx ON usage_records (bucket_start);
    CREATE UNIQUE INDEX IF NOT EXISTS usage_unique_idx ON usage_records (
      provider_id, bucket_start, bucket_width,
      coalesce(model, ''), coalesce(api_key_id, ''), coalesce(project_id, ''),
      coalesce(user_id, ''), coalesce(workspace_id, '')
    );

    CREATE TABLE IF NOT EXISTS balance_snapshots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id  TEXT NOT NULL,
      amount       REAL NOT NULL,
      currency     TEXT NOT NULL DEFAULT 'USD',
      granted      REAL,
      top_up       REAL,
      is_available INTEGER,
      captured_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS balance_provider_time_idx ON balance_snapshots (provider_id, captured_at);

    CREATE TABLE IF NOT EXISTS sync_logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id      TEXT,
      trigger          TEXT NOT NULL DEFAULT 'manual',
      status           TEXT NOT NULL,
      http_status      INTEGER,
      records_upserted INTEGER NOT NULL DEFAULT 0,
      pages_fetched    INTEGER NOT NULL DEFAULT 0,
      duration_ms      INTEGER NOT NULL DEFAULT 0,
      error_message    TEXT,
      started_at       INTEGER NOT NULL,
      finished_at      INTEGER
    );
    CREATE INDEX IF NOT EXISTS sync_logs_provider_time_idx ON sync_logs (provider_id, started_at);

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}
