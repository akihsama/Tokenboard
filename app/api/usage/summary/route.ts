import { NextRequest } from "next/server";

import { handle } from "@/lib/utils/api";
import { getSummary, getKeyBreakdown, type UsageFilter } from "@/lib/db/queries";
import { nowSec, rangeToSeconds } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aggregate totals across all providers, plus a per-provider breakdown. */
export async function GET(req: NextRequest) {
  return handle(() => {
    const sp = req.nextUrl.searchParams;
    const range = sp.get("range") ?? "30d";
    const to = sp.get("to") ? Number(sp.get("to")) : nowSec();
    const from = sp.get("from") ? Number(sp.get("from")) : to - rangeToSeconds(range);
    const filter: UsageFilter = { from, to };

    const summary = getSummary(filter);
    const providerId = sp.get("providerId");
    const keyBreakdown = providerId ? getKeyBreakdown(providerId) : undefined;
    return { range, from, to, summary, keyBreakdown };
  });
}
