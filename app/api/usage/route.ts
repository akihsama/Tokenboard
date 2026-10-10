import { NextRequest } from "next/server";

import { handle } from "@/lib/utils/api";
import {
  getKeyBreakdown,
  getModelBreakdown,
  getUsageRows,
  type UsageFilter,
} from "@/lib/db/queries";
import { rangeToSeconds } from "@/lib/utils/time";
import { nowSec } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFilter(req: NextRequest): UsageFilter & { range: string } {
  const sp = req.nextUrl.searchParams;
  const range = sp.get("range") ?? "30d";
  const to = sp.get("to") ? Number(sp.get("to")) : nowSec();
  const from = sp.get("from")
    ? Number(sp.get("from"))
    : to - rangeToSeconds(range);
  return {
    providerId: sp.get("providerId") ?? undefined,
    apiKeyId: sp.get("apiKeyId") ?? undefined,
    model: sp.get("model") ?? undefined,
    from,
    to,
    range,
  };
}

export async function GET(req: NextRequest) {
  return handle(() => {
    const filter = parseFilter(req);
    const { range: _range, ...f } = filter;
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 200);
    const include = req.nextUrl.searchParams.get("include") ?? "rows";
    const out: Record<string, unknown> = { filter: f };
    if (include.includes("rows")) out.rows = getUsageRows(f, limit);
    if (include.includes("keys") && f.providerId) {
      out.keyBreakdown = getKeyBreakdown(f.providerId);
    }
    if (include.includes("models")) out.modelBreakdown = getModelBreakdown(f);
    return out;
  });
}
