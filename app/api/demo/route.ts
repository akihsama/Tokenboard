import { NextRequest } from "next/server";

import { handle } from "@/lib/utils/api";
import { seedDemo, resetDemo, isDemoEnabled } from "@/lib/demo/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET current demo status. */
export async function GET() {
  return handle(() => ({ enabled: isDemoEnabled() }));
}

/**
 * Toggle demo mode.
 *   POST { enabled: true }  → seed demo data (idempotent, replaces prior demo rows)
 *   POST { enabled: false } → remove only demo rows (real data untouched)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const enabled = body?.enabled !== false;
  return handle(() => {
    if (enabled) {
      const result = seedDemo();
      return { enabled: true, ...result };
    }
    resetDemo();
    return { enabled: false };
  });
}
