import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * provider_templates — declarative adapter definitions.
 * `builtin` rows are mirrored from lib/providers/templates on boot;
 * `user` rows are created through the UI/API.
 */
export const providerTemplates = sqliteTable("provider_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // balance | usage | cost
  source: text("source").notNull().default("user"), // builtin | user
  baseTemplateId: text("base_template_id"),
  spec: text("spec").notNull(), // full template JSON
  enabled: integer("enabled").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * providers — a user-configured credential instance bound to a template.
 * The API key itself is stored as AES-256-GCM ciphertext; the plaintext
 * never leaves the server.
 */
export const providers = sqliteTable(
  "providers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    templateId: text("template_id").notNull(),
    baseUrl: text("base_url"),
    credentialEnc: text("credential_enc").notNull(), // base64 ciphertext
    credentialIv: text("credential_iv").notNull(), // base64 nonce
    credentialTag: text("credential_tag").notNull(), // base64 GCM tag
    credentialMeta: text("credential_meta").notNull().default("{}"), // { keyPrefix, keyLast4, orgId }
    config: text("config").notNull().default("{}"), // { headers, query, groupBy }
    granularity: text("granularity").notNull().default("per_key"), // per_key | org
    status: text("status").notNull().default("unknown"), // ok | error | unknown
    lastError: text("last_error"),
    lastSyncedAt: integer("last_synced_at"),
    enabled: integer("enabled").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("providers_template_idx").on(t.templateId)],
);

/**
 * usage_records — the core fact table.
 * One row per (provider, time bucket, dimension tuple). The unique index makes
 * sync idempotent: re-pulling an overlapping window updates instead of duplicating.
 */
export const usageRecords = sqliteTable(
  "usage_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    providerId: text("provider_id").notNull(),
    bucketStart: integer("bucket_start").notNull(), // unix seconds, UTC
    bucketEnd: integer("bucket_end").notNull(),
    bucketWidth: text("bucket_width").notNull().default("1d"), // 1m | 1h | 1d
    model: text("model"),
    apiKeyId: text("api_key_id"), // platform-side key id — the per-key split dimension
    projectId: text("project_id"),
    userId: text("user_id"),
    workspaceId: text("workspace_id"),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    cacheCreationTokens: integer("cache_creation_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    requests: integer("requests").notNull().default(0),
    costAmount: real("cost_amount"),
    currency: text("currency"),
    raw: text("raw"),
    syncedAt: integer("synced_at").notNull(),
  },
  (t) => [
    index("usage_provider_bucket_idx").on(t.providerId, t.bucketStart),
    index("usage_apikey_idx").on(t.apiKeyId),
    index("usage_bucket_idx").on(t.bucketStart),
    uniqueIndex("usage_unique_idx").on(
      t.providerId,
      t.bucketStart,
      t.bucketWidth,
      sql`coalesce(${t.model}, '')`,
      sql`coalesce(${t.apiKeyId}, '')`,
      sql`coalesce(${t.projectId}, '')`,
      sql`coalesce(${t.userId}, '')`,
      sql`coalesce(${t.workspaceId}, '')`,
    ),
  ],
);

/** balance_snapshots — point-in-time balance history (balance-category templates). */
export const balanceSnapshots = sqliteTable(
  "balance_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    providerId: text("provider_id").notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    granted: real("granted"),
    topUp: real("top_up"),
    isAvailable: integer("is_available"),
    capturedAt: integer("captured_at").notNull(),
  },
  (t) => [index("balance_provider_time_idx").on(t.providerId, t.capturedAt)],
);

/** sync_logs — audit trail for every sync attempt. */
export const syncLogs = sqliteTable(
  "sync_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    providerId: text("provider_id"),
    trigger: text("trigger").notNull().default("manual"), // manual | schedule | on_create | demo
    status: text("status").notNull(), // success | partial | error
    httpStatus: integer("http_status"),
    recordsUpserted: integer("records_upserted").notNull().default(0),
    pagesFetched: integer("pages_fetched").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
  },
  (t) => [index("sync_logs_provider_time_idx").on(t.providerId, t.startedAt)],
);

/** settings — key/value store. */
export const settings = sqliteTable(
  "settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(), // JSON-encoded
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key] })],
);

export type ProviderRow = typeof providers.$inferSelect;
export type ProviderTemplateRow = typeof providerTemplates.$inferSelect;
export type UsageRecordRow = typeof usageRecords.$inferSelect;
export type BalanceSnapshotRow = typeof balanceSnapshots.$inferSelect;
export type SyncLogRow = typeof syncLogs.$inferSelect;
