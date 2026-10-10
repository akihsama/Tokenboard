import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { providers } from "@/lib/db/schema";
import { fail, handle } from "@/lib/utils/api";
import { resolveTemplate } from "@/lib/providers/resolve";
import { runTemplate } from "@/lib/providers/engine";
import { open } from "@/lib/crypto/secretbox";
import { nowSec, DAY } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Test connectivity for a saved provider without persisting usage.
 * Runs the template over a small 1-day window and reports the raw outcome.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const row = db.select().from(providers).where(eq(providers.id, id)).get();
  if (!row) return fail("未找到该 Key", 404);

  return handle(async () => {
    const template = (await resolveTemplate(row.templateId)).spec;
    const key = open(
      { enc: row.credentialEnc, iv: row.credentialIv, tag: row.credentialTag },
      row.id,
    );
    const meta = JSON.parse(row.credentialMeta) as Record<string, unknown>;
    const config = JSON.parse(row.config) as {
      headers?: Record<string, string>;
      query?: Record<string, string | number | string[]>;
      credential?: Record<string, string>;
    };

    const end = nowSec();
    const result = await runTemplate(
      template,
      {
        key,
        credential: {
          ...Object.fromEntries(
            Object.entries(meta).map(([k, v]) => [k, String(v ?? "")]),
          ),
          ...(config.credential ?? {}),
        },
        headers: config.headers,
        query: config.query,
        window: { startUnix: end - DAY, endUnix: end },
        baseUrlOverride: row.baseUrl ?? undefined,
      },
      "1d",
    );

    return {
      ok: true,
      pagesFetched: result.pagesFetched,
      httpStatus: result.lastHttpStatus,
      usageRecords: result.usage.length,
      balances: result.balances,
      sample: result.usage.slice(0, 3),
    };
  });
}
