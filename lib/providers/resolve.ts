import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { providerTemplates } from "@/lib/db/schema";
import { validateTemplate } from "./schema";
import { getBuiltin, builtinTemplates } from "./registry";
import type { TemplateSpec } from "./types";

export interface ResolvedTemplate {
  spec: TemplateSpec;
  source: "builtin" | "user";
  dbId?: string;
}

/** Deep-merge a partial user override on top of a base template. */
function deepMerge<T>(base: T, override: Partial<T>): T {
  if (
    typeof base !== "object" ||
    base === null ||
    Array.isArray(base) ||
    typeof override !== "object" ||
    override === null ||
    Array.isArray(override)
  ) {
    return (override === undefined ? base : (override as T)) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = deepMerge((base as Record<string, unknown>)[k], v as never);
  }
  return out as T;
}

/**
 * Resolve a template id to its effective spec.
 *  - If the id exists as a user template it wins (optionally merged over a base).
 *  - Otherwise fall back to the built-in registry.
 */
export async function resolveTemplate(id: string): Promise<ResolvedTemplate> {
  const row = db
    .select()
    .from(providerTemplates)
    .where(eq(providerTemplates.id, id))
    .get();

  if (row) {
    let spec = JSON.parse(row.spec) as TemplateSpec;
    if (row.baseTemplateId) {
      const base = getBuiltin(row.baseTemplateId);
      if (base) spec = deepMerge(base, spec as Partial<TemplateSpec>);
    }
    return {
      spec: validateTemplate(spec) as TemplateSpec,
      source: "user",
      dbId: row.id,
    };
  }

  const builtin = getBuiltin(id);
  if (!builtin) throw new Error(`模板不存在：${id}`);
  return { spec: builtin, source: "builtin" };
}

/** List every template available (user templates shadow built-ins by id). */
export function listTemplates(): Array<{
  id: string;
  name: string;
  category: string;
  source: "builtin" | "user";
  enabled: boolean;
  spec: TemplateSpec;
  baseTemplateId: string | null;
}> {
  const userRows = db.select().from(providerTemplates).all();
  const userIds = new Set(userRows.map((r) => r.id));

  const builtins = builtinTemplates()
    .filter((b) => !userIds.has(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      source: "builtin" as const,
      enabled: true,
      spec: b,
      baseTemplateId: null,
    }));

  const users = userRows.map((r) => {
    const spec = JSON.parse(r.spec) as TemplateSpec;
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      source: "user" as const,
      enabled: r.enabled === 1,
      spec: r.baseTemplateId
        ? (deepMerge(getBuiltin(r.baseTemplateId) ?? {}, spec) as TemplateSpec)
        : spec,
      baseTemplateId: r.baseTemplateId,
    };
  });

  return [...builtins, ...users].sort((a, b) => {
    if (a.source !== b.source) return a.source === "builtin" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
