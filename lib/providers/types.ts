/**
 * Provider template types.
 *
 * A Template is pure declarative JSON describing:
 *   - how to authenticate
 *   - which HTTP endpoints to call (with pagination)
 *   - how to map the response JSON into TokenBoard's normalized shape
 *
 * The Engine (engine.ts) is the single interpreter. Adding a new platform
 * means shipping a new JSON file — never editing the engine.
 */

export type TemplateCategory = "balance" | "usage" | "cost";

export type AuthType = "bearer" | "header" | "query" | "none";

export interface AuthSpec {
  type: AuthType;
  /** For type=header: which header carries the secret. */
  headerName?: string;
  /** For type=query: which query param carries the secret. */
  queryName?: string;
  /**
   * Template string that produces the auth value.
   * e.g. "Bearer {{key}}" (default for bearer) or "{{key}}".
   */
  valueTemplate?: string;
}

export type PaginationType = "none" | "cursor" | "page" | "time";

export interface PaginationSpec {
  type: PaginationType;
  /** Query param that receives the cursor / page number. */
  cursorParam?: string;
  /** JSONPath to the next-cursor value in the response. */
  cursorPath?: string;
  /** JSONPath to a boolean "has more" flag (Anthropic style). */
  hasMorePath?: string;
  /** Starting page number for type=page. */
  firstPage?: number;
  /** Hard cap on pages fetched per endpoint (protects against loops). */
  maxPages?: number;
}

export interface EndpointSpec {
  id: string;
  method: "GET" | "POST";
  baseUrl: string;
  path: string;
  /** Static query params. Values may contain {{tokens}}. */
  query?: Record<string, string | number | string[]>;
  /** Static headers. Values may contain {{tokens}}. */
  headers?: Record<string, string>;
  /** Optional JSON body for POST. Values may contain {{tokens}}. */
  body?: unknown;
  pagination: PaginationSpec;
  /**
   * How to interpret the returned payload.
   *   "usage"   → extract record array via mapping.recordsPath
   *   "balance" → extract scalar fields via mapping.balance
   *   "cost"    → like usage but cost-oriented (grouped rows)
   */
  as: "usage" | "balance" | "cost";
}

export interface BalanceMapping {
  amount: string;
  currency?: string;
  granted?: string;
  topUp?: string;
  isAvailable?: string;
  /** Type coercion per field, e.g. { amount: "number" }. */
  coerce?: Record<string, "number" | "string" | "boolean">;
  /** Default currency when the API does not return one. */
  defaultCurrency?: string;
}

export interface UsageFieldMapping {
  bucketStart: string;
  bucketEnd?: string;
  inputTokens?: string;
  cachedInputTokens?: string;
  cacheCreationTokens?: string;
  outputTokens?: string;
  requests?: string;
  cost?: string;
  currency?: string;
  model?: string;
  apiKeyId?: string;
  projectId?: string;
  userId?: string;
  workspaceId?: string;
}

export interface UsageMapping {
  /** JSONPath to the array of per-bucket result objects. */
  recordsPath: string;
  /** JSONPath to the enclosing bucket start (when results are nested in buckets). */
  bucketStartFromParent?: string;
  bucketEndFromParent?: string;
  fields: UsageFieldMapping;
  /** How to read timestamps. */
  timeUnit: "unix_seconds" | "unix_ms" | "iso8601";
  /** Cost rows store a float amount rather than token counts. */
  costMode?: boolean;
}

export interface TemplateSpec {
  id: string;
  name: string;
  version: number;
  category: TemplateCategory;
  docs?: string;
  description?: string;
  /** Heuristics for auto-detecting the platform from a pasted key. */
  match?: {
    keyPrefix?: string;
    keyLength?: number;
    baseUrlHint?: string;
  };
  auth: AuthSpec;
  endpoints: EndpointSpec[];
  mapping: {
    balance?: BalanceMapping;
    usage?: UsageMapping;
  };
  /** Hint for the UI: can this template split usage per platform-side API key? */
  supportsPerKey?: boolean;
  /** Fields the user is expected to fill in (rendered as a form). */
  setup?: {
    /** Whether an org id / extra credential field is required. */
    requiresOrgId?: boolean;
    note?: string;
  };
}

/** Normalized output the engine produces before persistence. */
export interface NormalizedUsageRecord {
  bucketStart: number;
  bucketEnd: number;
  model: string | null;
  apiKeyId: string | null;
  projectId: string | null;
  userId: string | null;
  workspaceId: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  costAmount: number | null;
  currency: string | null;
  raw: unknown;
}

export interface NormalizedBalance {
  amount: number;
  currency: string;
  granted: number | null;
  topUp: number | null;
  isAvailable: boolean | null;
}

export interface EngineResult {
  usage: NormalizedUsageRecord[];
  balances: NormalizedBalance[];
  pagesFetched: number;
  lastHttpStatus: number | null;
}

/** Runtime context handed to the engine for one provider. */
export interface EngineContext {
  key: string;
  /** Arbitrary extra values available to {{credential.xxx}} tokens. */
  credential: Record<string, string>;
  /** User overrides from providers.config. */
  headers?: Record<string, string>;
  query?: Record<string, string | number | string[]>;
  /** Sync window (unix seconds). */
  window: { startUnix: number; endUnix: number };
  baseUrlOverride?: string;
}

export const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
