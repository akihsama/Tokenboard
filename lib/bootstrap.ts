import { migrate } from "./db/migrate";
import { ensureDefaultSettings, setSetting, getSetting, SETTING_KEYS } from "./utils/settings";
import { masterKeyFingerprint } from "@/lib/crypto/secretbox";
import { startScheduler } from "./sync/scheduler";

/**
 * One-time boot work: create tables, seed settings, verify the master key,
 * and (self-hosted only) start the cron scheduler.
 *
 * Guarded so it runs exactly once per process even with hot reload.
 */
const globalForBoot = globalThis as unknown as { __tokenboardBooted?: boolean };

export function bootstrap(): void {
  if (globalForBoot.__tokenboardBooted) return;
  globalForBoot.__tokenboardBooted = true;

  migrate();
  ensureDefaultSettings();

  // Record the master-key fingerprint so a key change is detectable later.
  const fingerprint = masterKeyFingerprint();
  const stored = getSetting<string>(SETTING_KEYS.masterKeyFingerprint);
  if (stored === undefined) {
    setSetting(SETTING_KEYS.masterKeyFingerprint, fingerprint);
  } else if (stored !== fingerprint) {
    console.error(
      "[boot] ⚠️  主密钥指纹与数据库记录不一致！已保存的 API Key 将无法解密。" +
        "请恢复原来的 TOKENBOARD_MASTER_KEY，或删除数据库中的 providers 后重新添加。",
    );
  }

  // node-cron only works with a long-running process; skip on Vercel.
  if (!process.env.VERCEL) {
    try {
      startScheduler();
    } catch (err) {
      console.error("[boot] 调度器启动失败：", err);
    }
  }
}
