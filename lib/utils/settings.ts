import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { nowSec } from "@/lib/utils/time";

export const SETTING_KEYS = {
  syncCron: "sync.cron",
  syncEnabled: "sync.enabled",
  demoEnabled: "demo.enabled",
  masterKeyFingerprint: "security.master_key_fingerprint",
} as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  [SETTING_KEYS.syncCron]: process.env.SYNC_CRON ?? "0 */6 * * *",
  [SETTING_KEYS.syncEnabled]: true,
  [SETTING_KEYS.demoEnabled]: false,
};

export function getSetting<T = unknown>(key: string): T | undefined {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

export function setSetting(key: string, value: unknown): void {
  const encoded = JSON.stringify(value);
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  if (existing) {
    db.update(settings)
      .set({ value: encoded, updatedAt: nowSec() })
      .where(eq(settings.key, key))
      .run();
  } else {
    db.insert(settings)
      .values({ key, value: encoded, updatedAt: nowSec() })
      .run();
  }
}

/** Seed defaults for any missing setting. Safe to call repeatedly. */
export function ensureDefaultSettings(): void {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (getSetting(key) === undefined) setSetting(key, value);
  }
}

export function allSettings(): Record<string, unknown> {
  const rows = db.select().from(settings).all();
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
}
