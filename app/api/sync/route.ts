import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handle } from "@/lib/utils/api";
import { syncAll, syncProvider } from "@/lib/sync/runner";
import { db } from "@/lib/db/client";
import { providers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  providerId: z.string().optional(),
  windowStart: z.number().optional(),
  windowEnd: z.number().optional(),
  bucketWidth: z.enum(["1m", "1h", "1d"]).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return fail("参数校验失败", 422, parsed.error.flatten());

  return handle(async () => {
    const { providerId, ...opts } = parsed.data;
    if (providerId) {
      const row = db
        .select()
        .from(providers)
        .where(eq(providers.id, providerId))
        .get();
      if (!row) throw new Error("未找到该 Key");
      const result = await syncProvider(row, { ...opts, trigger: "manual" });
      return { results: [result] };
    }
    const results = await syncAll({ ...opts, trigger: "manual" });
    return { results };
  });
}

/** GET returns the last sync status for a lightweight status endpoint. */
export async function GET() {
  return handle(async () => {
    const rows = db.select().from(providers).all();
    return {
      providers: rows.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        lastSyncedAt: p.lastSyncedAt,
        lastError: p.lastError,
      })),
    };
  });
}
