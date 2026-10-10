import type {
  NormalizedUsageRecord,
  NormalizedBalance,
} from "@/lib/providers/types";

/**
 * Normalization helpers shared between the sync runner and the demo seeder.
 * The provider engine already emits normalized records; these utilities cover
 * the demo/seed path and any future manual-import path.
 */

export function emptyRecord(
  bucketStart: number,
  bucketEnd: number,
): NormalizedUsageRecord {
  return {
    bucketStart,
    bucketEnd,
    model: null,
    apiKeyId: null,
    projectId: null,
    userId: null,
    workspaceId: null,
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requests: 0,
    costAmount: null,
    currency: null,
    raw: null,
  };
}

/** Sum a list of records into a single aggregate. */
export function aggregate(
  records: NormalizedUsageRecord[],
): Pick<
  NormalizedUsageRecord,
  | "inputTokens"
  | "cachedInputTokens"
  | "cacheCreationTokens"
  | "outputTokens"
  | "totalTokens"
  | "requests"
  | "costAmount"
> {
  const acc = {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requests: 0,
    costAmount: 0,
  };
  for (const r of records) {
    acc.inputTokens += r.inputTokens;
    acc.cachedInputTokens += r.cachedInputTokens;
    acc.cacheCreationTokens += r.cacheCreationTokens;
    acc.outputTokens += r.outputTokens;
    acc.totalTokens += r.totalTokens;
    acc.requests += r.requests;
    acc.costAmount += r.costAmount ?? 0;
  }
  return acc;
}

export function balance(
  amount: number,
  currency = "USD",
  extra: Partial<NormalizedBalance> = {},
): NormalizedBalance {
  return {
    amount,
    currency,
    granted: null,
    topUp: null,
    isAvailable: true,
    ...extra,
  };
}
