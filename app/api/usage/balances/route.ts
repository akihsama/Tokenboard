import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { balanceSnapshots, providers } from "@/lib/db/schema";
import { handle } from "@/lib/utils/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current balance per provider + optional history for one provider. */
export async function GET(req: NextRequest) {
  return handle(() => {
    const providerId = req.nextUrl.searchParams.get("providerId");
    const rows = db.select().from(providers).all();

    const current = rows.map((p) => {
      const latest = db
        .select()
        .from(balanceSnapshots)
        .where(eq(balanceSnapshots.providerId, p.id))
        .orderBy(desc(balanceSnapshots.capturedAt))
        .limit(1)
        .get();
      return {
        providerId: p.id,
        providerName: p.name,
        amount: latest?.amount ?? null,
        currency: latest?.currency ?? null,
        granted: latest?.granted ?? null,
        topUp: latest?.topUp ?? null,
        isAvailable: latest?.isAvailable === 1,
        capturedAt: latest?.capturedAt ?? null,
      };
    });

    let history: Array<{ amount: number; capturedAt: number }> | undefined;
    if (providerId) {
      history = db
        .select({
          amount: balanceSnapshots.amount,
          capturedAt: balanceSnapshots.capturedAt,
        })
        .from(balanceSnapshots)
        .where(eq(balanceSnapshots.providerId, providerId))
        .orderBy(balanceSnapshots.capturedAt)
        .all();
    }

    return { current, history };
  });
}
