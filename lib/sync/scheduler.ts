import cron, { type ScheduledTask } from "node-cron";

import { getSetting, SETTING_KEYS } from "@/lib/utils/settings";
import { syncAll } from "./runner";

/**
 * Background sync scheduler (self-hosted / Docker only).
 *
 * On Vercel there is no long-running process, so this never starts; instead
 * configure a Vercel Cron Job to POST /api/sync on a schedule. See README.
 */
const globalForCron = globalThis as unknown as {
  __tokenboardCron?: ScheduledTask | null;
};

export function startScheduler(): void {
  if (globalForCron.__tokenboardCron) return;

  const enabled = getSetting<boolean>(SETTING_KEYS.syncEnabled) ?? true;
  if (!enabled) return;

  const expr =
    getSetting<string>(SETTING_KEYS.syncCron) ??
    process.env.SYNC_CRON ??
    "0 */6 * * *";

  if (!cron.validate(expr)) {
    console.error(`[scheduler] 无效的 cron 表达式：${expr}`);
    return;
  }

  globalForCron.__tokenboardCron = cron.schedule(expr, async () => {
    try {
      console.log("[scheduler] 开始定时同步…");
      const results = await syncAll({ trigger: "schedule" });
      const failed = results.filter((r) => r.status === "error").length;
      console.log(
        `[scheduler] 同步完成：${results.length} 个，失败 ${failed} 个`,
      );
    } catch (err) {
      console.error("[scheduler] 同步异常：", err);
    }
  });

  console.log(`[scheduler] 已启动，cron = ${expr}`);
}

export function restartScheduler(): void {
  if (globalForCron.__tokenboardCron) {
    globalForCron.__tokenboardCron.stop();
    globalForCron.__tokenboardCron = null;
  }
  startScheduler();
}
