import { NextRequest } from "next/server";

import { handle } from "@/lib/utils/api";
import { getTrend, type UsageFilter } from "@/lib/db/queries";
import { nowSec, rangeToSeconds } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Time series for the trend chart. Supports day/hour bucketing. */
export async function GET(req: NextRequest) {
  return handle(() => {
    const sp = req.nextUrl.searchParams;
    const range = sp.get("range") ?? "30d";
    const to = sp.get("to") ? Number(sp.get("to")) : nowSec();
    const from = sp.get("from") ? Number(sp.get("from")) : to - rangeToSeconds(range);
    const bucket = sp.get("bucket") === "hour" ? "hour" : "day";
    const filter: UsageFilter = {
      from,
      to,
      providerId: sp.get("providerId") ?? undefined,
      apiKeyId: sp.get("apiKeyId") ?? undefined,
    };
    return { range, bucket, points: getTrend(filter, bucket) };
  });
}
