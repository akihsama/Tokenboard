import { eq, sql } from "drizzle-orm";

import { db, sqlite } from "@/lib/db/client";
import {
  balanceSnapshots,
  providers,
  syncLogs,
  usageRecords,
  type ProviderRow,
} from "@/lib/db/schema";
import { open } from "@/lib/crypto/secretbox";
import { runTemplate } from "@/lib/providers/engine";
import type {
  EngineContext,
  NormalizedUsageRecord,
  TemplateSpec,
} from "@/lib/providers/types";
import { resolveTemplate } from "@/lib/providers/resolve";
import { nowSec, DAY } from "@/lib/utils/time";

export interface SyncOptions {
  windowStart?: number;
  windowEnd?: number;
  bucketWidth?: string;
  trigger?: "manual" | "schedule" | "on_create" | "demo";
}

export interface SyncOutcome {
  providerId: string;
  providerName: string;
  status: "success" | "error";
  recordsUpserted: number;
  balancesCaptured: number;
  pagesFetched: number;
  httpStatus: number | null;
  error?: string;
}

/** Prepared upsert statement, lazily created (idempotent via unique index). */
let insertStmt: ReturnType<typeof sqlite.prepare> | null = null;

function upsertStatement() {
  if (!insertStmt) {
    insertStmt = sqlite.prepare(`
      INSERT INTO usage_records (
        provider_id, bucket_start, bucket_end, bucket_width,
        model, api_key_id, project_id, user_id, workspace_id,
        input_tokens, cached_input_tokens, cache_creation_tokens, output_tokens,
        total_tokens, requests, cost_amount, currency, raw, synced_at
      ) VALUES (
        @providerId, @bucketStart, @bucketEnd, @bucketWidth,
        @model, @apiKeyId, @projectId, @userId, @workspaceId,
        @inputTokens, @cachedInputTokens, @cacheCreationTokens, @outputTokens,
        @totalTokens, @requests, @costAmount, @currency, @raw, @syncedAt
      )
      ON CONFLICT (provider_id, bucket_start, bucket_width,
        coalesce(model, ''), coalesce(api_key_id, ''), coalesce(project_id, ''),
        coalesce(user_id, ''), coalesce(workspace_id, ''))
      DO UPDATE SET
        bucket_end = excluded.bucket_end,
        input_tokens = excluded.input_tokens,
        cached_input_tokens = excluded.cached_input_tokens,
        cache_creation_tokens = excluded.cache_creation_tokens,
        output_tokens = excluded.output_tokens,
        total_tokens = excluded.total_tokens,
        requests = excluded.requests,
        cost_amount = coalesce(excluded.cost_amount, usage_records.cost_amount),
        currency = coalesce(excluded.currency, usage_records.currency),
        raw = excluded.raw,
        synced_at = excluded.synced_at
    `);
  }
  return insertStmt;
}

/** Upsert a batch of normalized usage records. Returns rows written. */
export function upsertUsage(
  providerId: string,
  records: NormalizedUsageRecord[],
  bucketWidth: string,
): number {
  if (records.length === 0) return 0;
  const syncedAt = nowSec();
  const stmt = upsertStatement();
  let count = 0;
  const tx = sqlite.transaction(() => {
    for (const r of records) {
      stmt.run({
        providerId,
        bucketStart: r.bucketStart,
        bucketEnd: r.bucketEnd,
        bucketWidth,
        model: r.model,
        apiKeyId: r.apiKeyId,
        projectId: r.projectId,
        userId: r.userId,
        workspaceId: r.workspaceId,
        inputTokens: r.inputTokens,
        cachedInputTokens: r.cachedInputTokens,
        cacheCreationTokens: r.cacheCreationTokens,
        outputTokens: r.outputTokens,
        totalTokens: r.totalTokens,
        requests: r.requests,
        costAmount: r.costAmount,
        currency: r.currency,
        raw: r.raw ? JSON.stringify(r.raw) : null,
        syncedAt,
      });
      count++;
    }
  });
  tx();
  return count;
}

/** Incremental sync window for a provider. */
function resolveWindow(
  provider: ProviderRow,
  opts: SyncOptions,
): { start: number; end: number } {
  const end = opts.windowEnd ?? nowSec();
  if (opts.windowStart) return { start: opts.windowStart, end };
  const last = provider.lastSyncedAt ? provider.lastSyncedAt - DAY : end - 30 * DAY;
  return { start: Math.max(last, end - 90 * DAY), end };
}

/**
 * Sync a single provider: decrypt credential → run template → persist.
 * Never throws; failures land in the outcome and the sync log.
 */
export async function syncProvider(
  provider: ProviderRow,
  opts: SyncOptions = {},
): Promise<SyncOutcome> {
  const startedAt = nowSec();
  const trigger = opts.trigger ?? "manual";
  const bucketWidth = opts.bucketWidth ?? "1d";

  const outcome: SyncOutcome = {
    providerId: provider.id,
    providerName: provider.name,
    status: "success",
    recordsUpserted: 0,
    balancesCaptured: 0,
    pagesFetched: 0,
    httpStatus: null,
  };

  let template: TemplateSpec;
  try {
    template = (await resolveTemplate(provider.templateId)).spec;
  } catch (err) {
    outcome.status = "error";
    outcome.error = err instanceof Error ? err.message : String(err);
    logSync(provider.id, trigger, outcome, startedAt);
    return outcome;
  }

  let key: string;
  let credential: Record<string, string>;
  try {
    key = open(
      {
        enc: provider.credentialEnc,
        iv: provider.credentialIv,
        tag: provider.credentialTag,
      },
      provider.id,
    );
    const meta = safeJson(provider.credentialMeta) as Record<string, unknown>;
    credential = Object.fromEntries(
      Object.entries(meta).map(([k, v]) => [k, String(v ?? "")]),
    );
  } catch (err) {
    outcome.status = "error";
    outcome.error = `凭据解密失败：${err instanceof Error ? err.message : String(err)}`;
    logSync(provider.id, trigger, outcome, startedAt);
    return outcome;
  }

  const { start, end } = resolveWindow(provider, opts);
  const config = safeJson(provider.config) as {
    headers?: Record<string, string>;
    query?: Record<string, string | number | string[]>;
    credential?: Record<string, string>;
  };

  const ctx: EngineContext = {
    key,
    credential: { ...credential, ...(config.credential ?? {}) },
    headers: config.headers,
    query: config.query,
    window: { startUnix: start, endUnix: end },
    baseUrlOverride: provider.baseUrl ?? undefined,
  };

  try {
    const result = await runTemplate(template, ctx, bucketWidth);
    outcome.pagesFetched = result.pagesFetched;
    outcome.httpStatus = result.lastHttpStatus;
    outcome.recordsUpserted = upsertUsage(provider.id, result.usage, bucketWidth);

    for (const b of result.balances) {
      db.insert(balanceSnapshots)
        .values({
          providerId: provider.id,
          amount: b.amount,
          currency: b.currency,
          granted: b.granted,
          topUp: b.topUp,
          isAvailable: b.isAvailable === null ? null : b.isAvailable ? 1 : 0,
          capturedAt: nowSec(),
        })
        .run();
      outcome.balancesCaptured++;
    }

    db.update(providers)
      .set({
        status: "ok",
        lastError: null,
        lastSyncedAt: nowSec(),
        updatedAt: nowSec(),
      })
      .where(eq(providers.id, provider.id))
      .run();
  } catch (err) {
    outcome.status = "error";
    outcome.error = err instanceof Error ? err.message : String(err);
    db.update(providers)
      .set({
        status: "error",
        lastError: outcome.error.slice(0, 500),
        updatedAt: nowSec(),
      })
      .where(eq(providers.id, provider.id))
      .run();
  }

  logSync(provider.id, trigger, outcome, startedAt);
  return outcome;
}

function logSync(
  providerId: string,
  trigger: string,
  outcome: SyncOutcome,
  startedAt: number,
): void {
  db.insert(syncLogs)
    .values({
      providerId,
      trigger,
      status: outcome.status,
      httpStatus: outcome.httpStatus,
      recordsUpserted: outcome.recordsUpserted,
      pagesFetched: outcome.pagesFetched,
      durationMs: Math.max(0, (nowSec() - startedAt) * 1000),
      errorMessage: outcome.error ?? null,
      startedAt,
      finishedAt: nowSec(),
    })
    .run();
}

function safeJson(value: string | null): unknown {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/** Sync every enabled provider, with a small concurrency cap. */
export async function syncAll(opts: SyncOptions = {}): Promise<SyncOutcome[]> {
  const rows = db.select().from(providers).where(eq(providers.enabled, 1)).all();
  const results: SyncOutcome[] = [];
  const limit = 3;
  for (let i = 0; i < rows.length; i += limit) {
    const slice = rows.slice(i, i + limit);
    const settled = await Promise.all(
      slice.map((p) => syncProvider(p, { ...opts, trigger: opts.trigger ?? "manual" })),
    );
    results.push(...settled);
  }
  return results;
}

/** Cheap existence check used to decide whether to seed demo data. */
export function hasAnyUsage(): boolean {
  const row = db.select({ n: sql<number>`count(*)` }).from(usageRecords).get();
  return (row?.n ?? 0) > 0;
}
