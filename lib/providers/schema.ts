import { z } from "zod";

const authSpec = z.object({
  type: z.enum(["bearer", "header", "query", "none"]),
  headerName: z.string().optional(),
  queryName: z.string().optional(),
  valueTemplate: z.string().optional(),
});

const paginationSpec = z.object({
  type: z.enum(["none", "cursor", "page", "time"]),
  cursorParam: z.string().optional(),
  cursorPath: z.string().optional(),
  hasMorePath: z.string().optional(),
  firstPage: z.number().optional(),
  maxPages: z.number().int().positive().max(500).optional(),
});

const endpointSpec = z.object({
  id: z.string().min(1),
  method: z.enum(["GET", "POST"]),
  baseUrl: z.string().url(),
  path: z.string().min(1),
  query: z.record(z.union([z.string(), z.number(), z.array(z.string())])).optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  pagination: paginationSpec,
  as: z.enum(["usage", "balance", "cost"]),
});

const balanceMapping = z.object({
  amount: z.string().min(1),
  currency: z.string().optional(),
  granted: z.string().optional(),
  topUp: z.string().optional(),
  isAvailable: z.string().optional(),
  coerce: z.record(z.enum(["number", "string", "boolean"])).optional(),
  defaultCurrency: z.string().optional(),
});

const usageMapping = z.object({
  recordsPath: z.string().min(1),
  bucketStartFromParent: z.string().optional(),
  bucketEndFromParent: z.string().optional(),
  fields: z.object({
    bucketStart: z.string().min(1),
    bucketEnd: z.string().optional(),
    inputTokens: z.string().optional(),
    cachedInputTokens: z.string().optional(),
    cacheCreationTokens: z.string().optional(),
    outputTokens: z.string().optional(),
    requests: z.string().optional(),
    cost: z.string().optional(),
    currency: z.string().optional(),
    model: z.string().optional(),
    apiKeyId: z.string().optional(),
    projectId: z.string().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  }),
  timeUnit: z.enum(["unix_seconds", "unix_ms", "iso8601"]),
  costMode: z.boolean().optional(),
});

export const templateSpecSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9._-]+$/i, "id 只能包含字母数字与 . _ -"),
  name: z.string().min(1),
  version: z.number().int().nonnegative().default(1),
  category: z.enum(["balance", "usage", "cost"]),
  docs: z.string().optional(),
  description: z.string().optional(),
  match: z
    .object({
      keyPrefix: z.string().optional(),
      keyLength: z.number().optional(),
      baseUrlHint: z.string().optional(),
    })
    .optional(),
  auth: authSpec,
  endpoints: z.array(endpointSpec).min(1),
  mapping: z.object({
    balance: balanceMapping.optional(),
    usage: usageMapping.optional(),
  }),
  supportsPerKey: z.boolean().optional(),
  setup: z
    .object({
      requiresOrgId: z.boolean().optional(),
      note: z.string().optional(),
    })
    .optional(),
});

export type TemplateSpecInput = z.infer<typeof templateSpecSchema>;

/** Validate a template spec, throwing a ZodError with a readable message. */
export function validateTemplate(spec: unknown) {
  return templateSpecSchema.parse(spec);
}
