import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { syncLogs } from "@/lib/db/schema";
import { handle } from "@/lib/utils/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Paginated sync log listing, optionally filtered by provider. */
export async function GET(req: NextRequest) {
  return handle(() => {
    const sp = req.nextUrl.searchParams;
    const providerId = sp.get("providerId");
    const limit = Math.min(Number(sp.get("limit") ?? 100), 500);
    const offset = Number(sp.get("offset") ?? 0);

    const base = db.select().from(syncLogs);
    const rows = providerId
      ? base.where(eq(syncLogs.providerId, providerId)).orderBy(desc(syncLogs.startedAt)).limit(limit).offset(offset).all()
      : base.orderBy(desc(syncLogs.startedAt)).limit(limit).offset(offset).all();

    return { logs: rows };
  });
}
