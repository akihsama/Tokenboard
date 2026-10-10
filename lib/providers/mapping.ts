import { JSONPath } from "jsonpath-plus";

import type {
  BalanceMapping,
  NormalizedBalance,
  NormalizedUsageRecord,
  UsageMapping,
  UsageFieldMapping,
  EndpointSpec,
  EngineContext,
  TemplateSpec,
} from "./types";
import { TOKEN_PATTERN } from "./types";
import { bucketSeconds, toUnixSeconds } from "@/lib/utils/time";

/** Evaluate a JSONPath expression, returning a scalar (first match) or undefined. */
export function pick(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  try {
    const result = JSONPath({ path, json: obj as object, wrap: false });
    return result as unknown;
  } catch {
    return undefined;
  }
}

/** Evaluate a JSONPath expression always returning an array of matches. */
export function pickAll(obj: unknown, path: string): unknown[] {
  try {
    const result = JSONPath({ path, json: obj as object, wrap: true });
    return Array.isArray(result) ? (result as unknown[]) : [];
  } catch {
    return [];
  }
}

function coerce(value: unknown, to: "number" | "string" | "boolean"): unknown {
  if (value === null || value === undefined) return undefined;
  switch (to) {
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
      return Number.isFinite(n) ? n : undefined;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const s = String(value).toLowerCase();
      return s === "true" || s === "1" || s === "yes";
    }
    default:
      return String(value);
  }
}

const num = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const str = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
};

export function mapBalance(
  payload: unknown,
  mapping: BalanceMapping,
): NormalizedBalance | null {
  const coerceMap = mapping.coerce ?? {};
  const read = (path: string | undefined, key: string): unknown => {
    const raw = pick(payload, path);
    return coerceMap[key] ? coerce(raw, coerceMap[key] as never) : raw;
  };

  const amountRaw = read(mapping.amount, "amount");
  const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  if (!Number.isFinite(amount)) return null;

  const currencyRaw = read(mapping.currency, "currency");
  const grantedRaw = read(mapping.granted, "granted");
  const topUpRaw = read(mapping.topUp, "topUp");
  const availRaw = read(mapping.isAvailable, "isAvailable");

  return {
    amount,
    currency: currencyRaw ? String(currencyRaw) : (mapping.defaultCurrency ?? "USD"),
    granted: grantedRaw === undefined || grantedRaw === null ? null : num(grantedRaw),
    topUp: topUpRaw === undefined || topUpRaw === null ? null : num(topUpRaw),
    isAvailable:
      availRaw === undefined || availRaw === null ? null : coerce(availRaw, "boolean") === true,
  };
}

function readTime(value: unknown, unit: UsageMapping["timeUnit"]): number | null {
  if (value === null || value === undefined) return null;
  if (unit === "iso8601") {
    const ms = Date.parse(String(value));
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return toUnixSeconds(n);
}

/**
 * Extract normalized usage records from an endpoint payload.
 *
 * Handles the common nesting pattern where the API returns
 * `{ data: [{ start_time, end_time, results: [...] }] }` — we read the bucket
 * timestamps from the parent when the result rows don't carry their own.
 */
export function mapUsage(
  payload: unknown,
  mapping: UsageMapping,
  bucketWidth: string,
): NormalizedUsageRecord[] {
  const rows = pickAll(payload, mapping.recordsPath);
  const out: NormalizedUsageRecord[] = [];
  const bw = bucketSeconds(bucketWidth);

  for (const row of rows) {
    const f: UsageFieldMapping = mapping.fields;
    let start = readTime(pick(row, f.bucketStart), mapping.timeUnit);
    let end = f.bucketEnd ? readTime(pick(row, f.bucketEnd), mapping.timeUnit) : null;

    // Fallback: bucket timestamps may live on the parent object, not the row.
    if (start === null && mapping.bucketStartFromParent) {
      start = readTime(pick(payload, mapping.bucketStartFromParent), mapping.timeUnit);
    }
    if (end === null && mapping.bucketEndFromParent) {
      end = readTime(pick(payload, mapping.bucketEndFromParent), mapping.timeUnit);
    }
    if (start === null) continue;
    if (end === null) end = start + bw;

    const inputTokens = num(pick(row, f.inputTokens));
    const cachedInputTokens = num(pick(row, f.cachedInputTokens));
    const cacheCreationTokens = num(pick(row, f.cacheCreationTokens));
    const outputTokens = num(pick(row, f.outputTokens));
    const requests = num(pick(row, f.requests));
    const costRaw = pick(row, f.cost);
    const costAmount =
      costRaw === undefined || costRaw === null || costRaw === ""
        ? null
        : num(costRaw);

    out.push({
      bucketStart: start,
      bucketEnd: end,
      model: str(pick(row, f.model)),
      apiKeyId: str(pick(row, f.apiKeyId)),
      projectId: str(pick(row, f.projectId)),
      userId: str(pick(row, f.userId)),
      workspaceId: str(pick(row, f.workspaceId)),
      inputTokens,
      cachedInputTokens,
      cacheCreationTokens,
      outputTokens,
      totalTokens:
        inputTokens + cachedInputTokens + cacheCreationTokens + outputTokens,
      requests,
      costAmount,
      currency: str(pick(row, f.currency)),
      raw: row,
    });
  }
  return out;
}

/** Substitute {{tokens}} in a string using the engine context. */
export function interpolate(
  value: string,
  ctx: EngineContext,
  bucketWidth: string,
  endpoint: EndpointSpec,
): string {
  const bw = bucketSeconds(bucketWidth);
  const vars: Record<string, string> = {
    key: ctx.key,
    "window.startUnix": String(ctx.window.startUnix),
    "window.endUnix": String(ctx.window.endUnix),
    "window.startIso": new Date(ctx.window.startUnix * 1000).toISOString(),
    "window.endIso": new Date(ctx.window.endUnix * 1000).toISOString(),
    "window.bucketWidth": bucketWidth,
    "window.bucketSeconds": String(bw),
    "endpoint.baseUrl": ctx.baseUrlOverride ?? endpoint.baseUrl,
  };
  for (const [k, v] of Object.entries(ctx.credential)) {
    vars[`credential.${k}`] = v;
  }
  return value.replace(TOKEN_PATTERN, (_m, name: string) => vars[name] ?? "");
}

export function interpolateRecord(
  record: Record<string, string | number | string[]>,
  ctx: EngineContext,
  bucketWidth: string,
  endpoint: EndpointSpec,
): Record<string, string | number | string[]> {
  const out: Record<string, string | number | string[]> = {};
  for (const [k, v] of Object.entries(record)) {
    if (Array.isArray(v)) {
      out[k] = v.map((item) => interpolate(String(item), ctx, bucketWidth, endpoint));
    } else if (typeof v === "number") {
      out[k] = v;
    } else {
      out[k] = interpolate(String(v), ctx, bucketWidth, endpoint);
    }
  }
  return out;
}

/** Build the auth header/query for a template. */
export function buildAuth(
  template: TemplateSpec,
  ctx: EngineContext,
): { headers: Record<string, string>; query: Record<string, string> } {
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  const auth = template.auth;
  if (!auth || auth.type === "none") return { headers, query };

  const value = interpolate(
    auth.valueTemplate ?? (auth.type === "bearer" ? "Bearer {{key}}" : "{{key}}"),
    ctx,
    "1d",
    { id: "auth", method: "GET", baseUrl: "", path: "", pagination: { type: "none" }, as: "usage" },
  );

  switch (auth.type) {
    case "bearer":
      headers[auth.headerName ?? "Authorization"] = value;
      break;
    case "header":
      headers[auth.headerName ?? "Authorization"] = value;
      break;
    case "query":
      query[auth.queryName ?? "api_key"] = value;
      break;
  }
  return { headers, query };
}
