import type {
  EngineContext,
  EngineResult,
  EndpointSpec,
  NormalizedBalance,
  NormalizedUsageRecord,
  TemplateSpec,
} from "./types";
import {
  buildAuth,
  interpolate,
  interpolateRecord,
  mapBalance,
  mapUsage,
  pick,
} from "./mapping";

const DEFAULT_MAX_PAGES = 50;

interface FetchOutcome {
  status: number;
  json: unknown;
  ok: boolean;
}

async function doFetch(
  url: string,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body?: unknown,
): Promise<FetchOutcome> {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "User-Agent": "TokenBoard/0.1 (+https://github.com/tokenboard)",
      ...headers,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    // Never cache — these are live billing endpoints.
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json, ok: res.ok };
}

function buildUrl(
  endpoint: EndpointSpec,
  ctx: EngineContext,
  query: Record<string, string | number | string[]>,
  cursorValue?: string | number,
): string {
  const base = ctx.baseUrlOverride ?? endpoint.baseUrl;
  const url = new URL(interpolate(endpoint.path, ctx, "1d", endpoint), base);

  const merged: Record<string, string | number | string[]> = {
    ...query,
  };
  const pagination = endpoint.pagination;
  if (cursorValue !== undefined && pagination.cursorParam) {
    merged[pagination.cursorParam] = cursorValue;
  }
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      // Repeated params (e.g. group_by=x&group_by=y)
      for (const item of v) url.searchParams.append(k, String(item));
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Execute one endpoint, following its pagination strategy until exhausted
 * or maxPages is reached. Returns normalized records + page count.
 */
async function runEndpoint(
  template: TemplateSpec,
  endpoint: EndpointSpec,
  ctx: EngineContext,
  bucketWidth: string,
): Promise<{
  usage: NormalizedUsageRecord[];
  balances: NormalizedBalance[];
  pages: number;
  lastStatus: number | null;
}> {
  const usage: NormalizedUsageRecord[] = [];
  const balances: NormalizedBalance[] = [];
  const { headers: authHeaders, query: authQuery } = buildAuth(template, ctx);

  const staticQuery = interpolateRecord(
    endpoint.query ?? {},
    ctx,
    bucketWidth,
    endpoint,
  );
  const staticHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(endpoint.headers ?? {})) {
    staticHeaders[k] = interpolate(v, ctx, bucketWidth, endpoint);
  }

  const headers = {
    ...authHeaders,
    ...staticHeaders,
    ...(ctx.headers ?? {}),
  };
  const query = {
    ...authQuery,
    ...staticQuery,
    ...(ctx.query ?? {}),
  } as Record<string, string | number | string[]>;

  const pagination = endpoint.pagination;
  const maxPages = pagination.maxPages ?? DEFAULT_MAX_PAGES;
  const isPaged = pagination.type !== "none";

  let cursor: string | number | undefined =
    pagination.type === "page" ? (pagination.firstPage ?? 1) : undefined;
  let pages = 0;
  let lastStatus: number | null = null;

  for (let i = 0; i < maxPages; i++) {
    const url = buildUrl(endpoint, ctx, query, cursor);
    const isPost = endpoint.method === "POST";
    const body = isPost
      ? interpolateRecord(
          (endpoint.body ?? {}) as Record<string, string | number | string[]>,
          ctx,
          bucketWidth,
          endpoint,
        )
      : undefined;

    const outcome = await doFetch(
      url,
      endpoint.method,
      headers,
      body,
    );
    pages++;
    lastStatus = outcome.status;

    if (!outcome.ok) {
      const message =
        typeof outcome.json === "object" && outcome.json
          ? JSON.stringify(outcome.json).slice(0, 300)
          : String(outcome.json ?? "").slice(0, 300);
      throw new Error(`HTTP ${outcome.status}: ${message}`);
    }

    // Map this page's payload.
    if (endpoint.as === "balance" && template.mapping.balance) {
      const b = mapBalance(outcome.json, template.mapping.balance);
      if (b) balances.push(b);
    } else if (template.mapping.usage) {
      usage.push(...mapUsage(outcome.json, template.mapping.usage, bucketWidth));
    }

    if (!isPaged) break;

    // Advance pagination.
    if (pagination.type === "page") {
      // Heuristic: stop when a page returns no rows.
      if (template.mapping.usage) {
        const rows = mapUsage(outcome.json, template.mapping.usage, bucketWidth);
        if (rows.length === 0) break;
      } else {
        break;
      }
      cursor = (Number(cursor) || 1) + 1;
    } else {
      // cursor / time: read next cursor from response.
      const hasMore = pagination.hasMorePath
        ? pick(outcome.json, pagination.hasMorePath)
        : undefined;
      const next = pagination.cursorPath
        ? pick(outcome.json, pagination.cursorPath)
        : undefined;
      if (hasMore !== undefined && hasMore !== true) break;
      if (next === undefined || next === null || next === "") break;
      cursor = next as string | number;
    }
  }

  return { usage, balances, pages, lastStatus };
}

/**
 * Run an entire template against a provider, aggregating every endpoint.
 * This is the single entry point used by the sync runner and the "test" API.
 */
export async function runTemplate(
  template: TemplateSpec,
  ctx: EngineContext,
  bucketWidth = "1d",
): Promise<EngineResult> {
  const usage: NormalizedUsageRecord[] = [];
  const balances: NormalizedBalance[] = [];
  let pagesFetched = 0;
  let lastHttpStatus: number | null = null;

  for (const endpoint of template.endpoints) {
    const res = await runEndpoint(template, endpoint, ctx, bucketWidth);
    usage.push(...res.usage);
    balances.push(...res.balances);
    pagesFetched += res.pages;
    lastHttpStatus = res.lastStatus;
  }

  return { usage, balances, pagesFetched, lastHttpStatus };
}
