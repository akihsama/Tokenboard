import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handle } from "@/lib/utils/api";
import {
  allSettings,
  setSetting,
  SETTING_KEYS,
} from "@/lib/utils/settings";
import { masterKeyFingerprint } from "@/lib/crypto/secretbox";
import { restartScheduler } from "@/lib/sync/scheduler";
import { isDemoEnabled } from "@/lib/demo/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => {
    const settings = allSettings();
    // Never expose the fingerprint value itself, just whether it is set.
    const fingerprint = settings[SETTING_KEYS.masterKeyFingerprint];
    return {
      settings,
      security: {
        masterKeyConfigured: true,
        masterKeySource: process.env.TOKENBOARD_MASTER_KEY
          ? "env"
          : "data/master.key",
        fingerprintStable:
          fingerprint === undefined || fingerprint === masterKeyFingerprint(),
      },
      demoEnabled: isDemoEnabled(),
    };
  });
}

const patchSchema = z.object({
  syncCron: z.string().optional(),
  syncEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("参数校验失败", 422, parsed.error.flatten());

  return handle(() => {
    if (parsed.data.syncCron !== undefined) {
      setSetting(SETTING_KEYS.syncCron, parsed.data.syncCron);
    }
    if (parsed.data.syncEnabled !== undefined) {
      setSetting(SETTING_KEYS.syncEnabled, parsed.data.syncEnabled);
    }
    restartScheduler();
    return { settings: allSettings() };
  });
}
