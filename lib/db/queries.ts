import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  balanceSnapshots,
  providers,
  usageRecords,
} from "@/lib/db/schema";
import { nowSec, rangeToSeconds, DAY } from "@/lib/utils/time";

export interface UsageFilter {
  providerId?: string;
  apiKeyId?: string;
  from?: number;
  to?: number;
  model?: string;
}

export interface SummaryRow {
  providerId: string;
  providerName: string;
  templateId: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  cost: number;
  currency: string;
}

export interface OverallSummary {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
  /**
   * Cost split by currency. Costs in different currencies are never additive,
   * so the UI sums per-currency and renders e.g. "¥12.34 + $5.67".
   */
  costsByCurrency: { currency: string; amount: number }[];
  providerCount: number;
  perProvider: SummaryRow[];
}

function baseConditions(filter: UsageFilter) {
  const conds = [];
  if (filter.providerId) conds.push(eq(usageRecords.providerId, filter.providerId));
  if (filter.apiKeyId) conds.push(eq(usageRecords.apiKeyId, filter.apiKeyId));
  if (filter.model) conds.push(eq(usageRecords.model, filter.model));
  if (filter.from) conds.push(gte(usageRecords.bucketStart, filter.from));
  if (filter.to) conds.push(lte(usageRecords.bucketStart, filter.to));
  return conds;
}

/** Aggregate usage, optionally per provider. */
export function getSummary(filter: UsageFilter = {}): OverallSummary {
  const conds = baseConditions(filter);
  const where = conds.length ? and(...conds) : undefined;

  const rows = db
    .select({
      providerId: usageRecords.providerId,
      inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}),0)`,
      cachedInputTokens: sql<number>`coalesce(sum(${usageRecords.cachedInputTokens}),0)`,
      cacheCreationTokens: sql<number>`coalesce(sum(${usageRecords.cacheCreationTokens}),0)`,
      outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}),0)`,
      totalTokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}),0)`,
      requests: sql<number>`coalesce(sum(${usageRecords.requests}),0)`,
      cost: sql<number>`coalesce(sum(${usageRecords.costAmount}),0)`,
      currency: sql<string>`coalesce(max(${usageRecords.currency}),'USD')`,
    })
    .from(usageRecords)
    .where(where)
    .groupBy(usageRecords.providerId)
    .all();

  const providerRows = db.select().from(providers).all();
  const nameById = new Map(providerRows.map((p) => [p.id, p]));

  const perProvider: SummaryRow[] = rows.map((r) => ({
    providerId: r.providerId,
    providerName: nameById.get(r.providerId)?.name ?? r.providerId,
    templateId: nameById.get(r.providerId)?.templateId ?? "",
    inputTokens: r.inputTokens,
    cachedInputTokens: r.cachedInputTokens,
    cacheCreationTokens: r.cacheCreationTokens,
    outputTokens: r.outputTokens,
    totalTokens: r.totalTokens,
    requests: r.requests,
    cost: r.cost,
    currency: r.currency,
  }));

  const total = perProvider.reduce(
    (acc, r) => {
      acc.totalTokens += r.totalTokens;
      acc.inputTokens += r.inputTokens;
      acc.cachedInputTokens += r.cachedInputTokens;
      acc.cacheCreationTokens += r.cacheCreationTokens;
      acc.outputTokens += r.outputTokens;
      acc.requests += r.requests;
      acc.cost += r.cost;
      return acc;
    },
    {
      totalTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheCreationTokens: 0,
      outputTokens: 0,
      requests: 0,
      cost: 0,
    },
  );

  // Split cost by currency — different currencies must not be summed together.
  const byCurrency = new Map<string, number>();
  for (const r of perProvider) {
    const cur = (r.currency || "USD").toUpperCase();
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + r.cost);
  }
  const costsByCurrency = [...byCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    ...total,
    costsByCurrency,
    providerCount: perProvider.length,
    perProvider: perProvider.sort((a, b) => b.totalTokens - a.totalTokens),
  };
}

export interface TrendPoint {
  bucketStart: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

/** Time series aggregated by bucket (day/week), optionally split by provider. */
export function getTrend(
  filter: UsageFilter = {},
  bucket: "day" | "hour" = "day",
): TrendPoint[] {
  const conds = baseConditions(filter);
  const where = conds.length ? and(...conds) : undefined;
  const divisor = bucket === "hour" ? 3600 : DAY;

  const rows = db
    .select({
      bucket: sql<number>`cast(${usageRecords.bucketStart} / ${divisor} as integer) * ${divisor}`,
      inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}),0)`,
      cachedInputTokens: sql<number>`coalesce(sum(${usageRecords.cachedInputTokens}),0)`,
      cacheCreationTokens: sql<number>`coalesce(sum(${usageRecords.cacheCreationTokens}),0)`,
      outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}),0)`,
      totalTokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}),0)`,
      cost: sql<number>`coalesce(sum(${usageRecords.costAmount}),0)`,
    })
    .from(usageRecords)
    .where(where)
    .groupBy(sql`cast(${usageRecords.bucketStart} / ${divisor} as integer)`)
    .orderBy(sql`cast(${usageRecords.bucketStart} / ${divisor} as integer)`)
    .all();

  return rows.map((r) => ({
    bucketStart: r.bucket,
    inputTokens: r.inputTokens,
    cachedInputTokens: r.cachedInputTokens,
    cacheCreationTokens: r.cacheCreationTokens,
    outputTokens: r.outputTokens,
    totalTokens: r.totalTokens,
    cost: r.cost,
  }));
}

/** Per-platform-key breakdown for a single provider (the per-key view). */
export interface KeyBreakdownRow {
  apiKeyId: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
}

export function getKeyBreakdown(providerId: string): KeyBreakdownRow[] {
  const rows = db
    .select({
      apiKeyId: sql<string>`coalesce(${usageRecords.apiKeyId},'(未归属)')`,
      totalTokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}),0)`,
      inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}),0)`,
      outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}),0)`,
      requests: sql<number>`coalesce(sum(${usageRecords.requests}),0)`,
      cost: sql<number>`coalesce(sum(${usageRecords.costAmount}),0)`,
    })
    .from(usageRecords)
    .where(eq(usageRecords.providerId, providerId))
    .groupBy(sql`coalesce(${usageRecords.apiKeyId},'(未归属)')`)
    .all();
  return rows.sort((a, b) => b.totalTokens - a.totalTokens);
}

/** Model distribution for charts. */
export function getModelBreakdown(filter: UsageFilter = {}): Array<{
  model: string;
  totalTokens: number;
  cost: number;
}> {
  const conds = baseConditions(filter);
  const where = conds.length ? and(...conds) : undefined;
  const rows = db
    .select({
      model: sql<string>`coalesce(${usageRecords.model},'(未知)')`,
      totalTokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}),0)`,
      cost: sql<number>`coalesce(sum(${usageRecords.costAmount}),0)`,
    })
    .from(usageRecords)
    .where(where)
    .groupBy(sql`coalesce(${usageRecords.model},'(未知)')`)
    .all();
  return rows.sort((a, b) => b.totalTokens - a.totalTokens);
}

/** Detail rows for a table view. */
export function getUsageRows(
  filter: UsageFilter = {},
  limit = 200,
): Array<{
  id: number;
  providerId: string;
  bucketStart: number;
  model: string | null;
  apiKeyId: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  costAmount: number | null;
  currency: string | null;
}> {
  const conds = baseConditions(filter);
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select({
      id: usageRecords.id,
      providerId: usageRecords.providerId,
      bucketStart: usageRecords.bucketStart,
      model: usageRecords.model,
      apiKeyId: usageRecords.apiKeyId,
      inputTokens: usageRecords.inputTokens,
      cachedInputTokens: usageRecords.cachedInputTokens,
      cacheCreationTokens: usageRecords.cacheCreationTokens,
      outputTokens: usageRecords.outputTokens,
      totalTokens: usageRecords.totalTokens,
      requests: usageRecords.requests,
      costAmount: usageRecords.costAmount,
      currency: usageRecords.currency,
    })
    .from(usageRecords)
    .where(where)
    .orderBy(desc(usageRecords.bucketStart))
    .limit(limit)
    .all();
}

export interface ProviderWithLatest {
  provider: typeof providers.$inferSelect;
  latestBalance: { amount: number; currency: string; capturedAt: number } | null;
  totals: {
    totalTokens: number;
    cost: number;
    requests: number;
    /** Dominant currency of this provider's cost records (for display). */
    currency: string;
  };
}

/** Provider list enriched with latest balance + totals (for the Keys page). */
export function getProvidersWithStats(): ProviderWithLatest[] {
  const rows = db.select().from(providers).orderBy(providers.createdAt).all();
  return rows.map((p) => {
    const bal = db
      .select()
      .from(balanceSnapshots)
      .where(eq(balanceSnapshots.providerId, p.id))
      .orderBy(desc(balanceSnapshots.capturedAt))
      .limit(1)
      .get();
    const totals = db
      .select({
        totalTokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}),0)`,
        cost: sql<number>`coalesce(sum(${usageRecords.costAmount}),0)`,
        requests: sql<number>`coalesce(sum(${usageRecords.requests}),0)`,
        currency: sql<string>`coalesce(max(${usageRecords.currency}),'USD')`,
      })
      .from(usageRecords)
      .where(eq(usageRecords.providerId, p.id))
      .get();
    return {
      provider: p,
      latestBalance: bal
        ? { amount: bal.amount, currency: bal.currency, capturedAt: bal.capturedAt }
        : null,
      totals: totals ?? {
        totalTokens: 0,
        cost: 0,
        requests: 0,
        currency: "USD",
      },
    };
  });
}

export function getBalanceHistory(providerId: string): Array<{
  amount: number;
  capturedAt: number;
}> {
  return db
    .select({
      amount: balanceSnapshots.amount,
      capturedAt: balanceSnapshots.capturedAt,
    })
    .from(balanceSnapshots)
    .where(eq(balanceSnapshots.providerId, providerId))
    .orderBy(balanceSnapshots.capturedAt)
    .all();
}

/** Default time filter: last N days. */
export function defaultRange(range = "30d"): { from: number; to: number } {
  const to = nowSec();
  return { from: to - rangeToSeconds(range), to };
}

export { inArray, eq, and };
