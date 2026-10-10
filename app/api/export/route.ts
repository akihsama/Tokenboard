import { NextRequest } from "next/server";

import { db } from "@/lib/db/client";
import { providerTemplates, providers } from "@/lib/db/schema";
import { handle } from "@/lib/utils/api";
import { allSettings } from "@/lib/utils/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export configuration as JSON.
 *   ?includeSecrets=true → include encrypted credential blobs (still AES-256-GCM
 *   ciphertext bound to the provider id, so only decryptable with the same
 *   master key). Default false: metadata only, for safe sharing/backup of setup.
 */
export async function GET(req: NextRequest) {
  const includeSecrets =
    req.nextUrl.searchParams.get("includeSecrets") === "true";

  return handle(() => {
    const providerRows = db.select().from(providers).all();
    const templateRows = db.select().from(providerTemplates).all();

    const exportedProviders = providerRows.map((p) => {
      const base = {
        id: p.id,
        name: p.name,
        templateId: p.templateId,
        baseUrl: p.baseUrl,
        credentialMeta: JSON.parse(p.credentialMeta),
        config: JSON.parse(p.config),
        granularity: p.granularity,
        enabled: p.enabled === 1,
      };
      if (!includeSecrets) return base;
      return {
        ...base,
        credentialEnc: p.credentialEnc,
        credentialIv: p.credentialIv,
        credentialTag: p.credentialTag,
      };
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      includeSecrets,
      settings: allSettings(),
      templates: templateRows.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        baseTemplateId: t.baseTemplateId,
        spec: JSON.parse(t.spec),
        enabled: t.enabled === 1,
      })),
      providers: exportedProviders,
    };
  });
}
