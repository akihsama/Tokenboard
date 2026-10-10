import { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { providerTemplates, providers } from "@/lib/db/schema";
import { fail, handle } from "@/lib/utils/api";
import { validateTemplate } from "@/lib/providers/schema";
import { setSetting } from "@/lib/utils/settings";
import { nowSec } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  version: z.number().optional(),
  mode: z.enum(["merge", "overwrite"]).optional(),
  settings: z.record(z.unknown()).optional(),
  templates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        baseTemplateId: z.string().nullable().optional(),
        spec: z.record(z.unknown()),
        enabled: z.boolean().optional(),
      }),
    )
    .optional(),
  providers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        templateId: z.string(),
        baseUrl: z.string().nullable().optional(),
        credentialMeta: z.record(z.unknown()).optional(),
        config: z.record(z.unknown()).optional(),
        granularity: z.string().optional(),
        enabled: z.boolean().optional(),
        credentialEnc: z.string().optional(),
        credentialIv: z.string().optional(),
        credentialTag: z.string().optional(),
      }),
    )
    .optional(),
});

/** Import configuration previously produced by GET /api/export. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("导入文件格式不正确", 422, parsed.error.flatten());

  return handle(() => {
    const data = parsed.data;
    const mode = data.mode ?? "merge";
    let templatesImported = 0;
    let providersImported = 0;
    let providersSkipped = 0;

    if (data.settings) {
      for (const [k, v] of Object.entries(data.settings)) {
        // Never import a foreign master-key fingerprint — it would break decryption.
        if (k === "security.master_key_fingerprint") continue;
        setSetting(k, v);
      }
    }

    const now = nowSec();
    for (const t of data.templates ?? []) {
      const spec = validateTemplate(t.spec);
      db.insert(providerTemplates)
        .values({
          id: t.id,
          name: t.name,
          category: spec.category,
          source: "user",
          baseTemplateId: t.baseTemplateId ?? null,
          spec: JSON.stringify(spec),
          enabled: t.enabled === false ? 0 : 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: providerTemplates.id,
          set: {
            name: t.name,
            category: spec.category,
            baseTemplateId: t.baseTemplateId ?? null,
            spec: JSON.stringify(spec),
            updatedAt: now,
          },
        })
        .run();
      templatesImported++;
    }

    for (const p of data.providers ?? []) {
      const existing = db
        .select({ id: providers.id })
        .from(providers)
        .all()
        .find((row) => row.id === p.id);
      if (existing && mode === "merge") {
        providersSkipped++;
        continue;
      }
      if (!p.credentialEnc || !p.credentialIv || !p.credentialTag) {
        // No secret included — skip, since a keyless provider cannot sync.
        providersSkipped++;
        continue;
      }
      db.insert(providers)
        .values({
          id: p.id,
          name: p.name,
          templateId: p.templateId,
          baseUrl: p.baseUrl ?? null,
          credentialEnc: p.credentialEnc,
          credentialIv: p.credentialIv,
          credentialTag: p.credentialTag,
          credentialMeta: JSON.stringify(p.credentialMeta ?? {}),
          config: JSON.stringify(p.config ?? {}),
          granularity: p.granularity ?? "per_key",
          status: "unknown",
          enabled: p.enabled === false ? 0 : 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: providers.id,
          set: {
            name: p.name,
            templateId: p.templateId,
            baseUrl: p.baseUrl ?? null,
            credentialEnc: p.credentialEnc,
            credentialIv: p.credentialIv,
            credentialTag: p.credentialTag,
            credentialMeta: JSON.stringify(p.credentialMeta ?? {}),
            config: JSON.stringify(p.config ?? {}),
            updatedAt: now,
          },
        })
        .run();
      providersImported++;
    }

    return { templatesImported, providersImported, providersSkipped };
  });
}
