import { eq } from "drizzle-orm";

import { db, sqlite } from "@/lib/db/client";
import {
  balanceSnapshots,
  providers,
  syncLogs,
  usageRecords,
} from "@/lib/db/schema";
import { seal } from "@/lib/crypto/secretbox";
import { setSetting, SETTING_KEYS } from "@/lib/utils/settings";
import { DAY, nowSec } from "@/lib/utils/time";

/**
 * Demo mode: seed a realistic dataset so the dashboard is fully populated
 * without any real API keys. Enabled via POST /api/demo { enabled: true }.
 *
 * Data spans ~45 days across 4 providers, multiple platform-side keys and
 * models, with per-key token/cost breakdowns and balance history.
 */

interface DemoProvider {
  name: string;
  templateId: string;
  granularity: "per_key" | "org";
  keys: string[];
  models: Array<{ name: string; inPrice: number; outPrice: number; weight: number }>;
  currency: string;
  balance: number;
  /** Only balance-category templates produce balance snapshots. */
  hasBalance: boolean;
  /** Only providers that report cache tokens should show cache values. */
  hasCache: boolean;
  /**
   * Set false for templates with no usage endpoint at all (balance-only).
   * Defaults to true so balance platforms like DeepSeek still show usage.
   */
  usage?: boolean;
}

const DEMO_PROVIDERS: DemoProvider[] = [
  {
    name: "我的 OpenAI 组织",
    templateId: "openai.admin",
    granularity: "per_key",
    keys: ["生产环境", "测试环境", "批处理任务"],
    models: [
      { name: "gpt-4o", inPrice: 2.5, outPrice: 10, weight: 0.4 },
      { name: "gpt-4o-mini", inPrice: 0.15, outPrice: 0.6, weight: 0.35 },
      { name: "o1", inPrice: 15, outPrice: 60, weight: 0.15 },
      { name: "gpt-4.1", inPrice: 2, outPrice: 8, weight: 0.1 },
    ],
    currency: "USD",
    balance: 0,
    hasBalance: false,
    hasCache: false,
  },
  {
    name: "Claude 团队账号",
    templateId: "anthropic.admin",
    granularity: "per_key",
    keys: ["Claude Code", "客服机器人", "内部工具"],
    models: [
      { name: "claude-sonnet-4", inPrice: 3, outPrice: 15, weight: 0.55 },
      { name: "claude-opus-4", inPrice: 15, outPrice: 75, weight: 0.2 },
      { name: "claude-haiku-3.5", inPrice: 0.8, outPrice: 4, weight: 0.25 },
    ],
    currency: "USD",
    balance: 0,
    hasBalance: false,
    hasCache: true,
  },
  {
    name: "DeepSeek 官方",
    templateId: "deepseek.balance",
    granularity: "org",
    keys: ["主账号"],
    models: [
      { name: "deepseek-chat", inPrice: 0.27, outPrice: 1.1, weight: 0.6 },
      { name: "deepseek-reasoner", inPrice: 0.55, outPrice: 2.19, weight: 0.4 },
    ],
    currency: "CNY",
    balance: 386.42,
    hasBalance: true,
    hasCache: false,
  },
  {
    name: "OpenRouter 聚合",
    templateId: "openrouter.key",
    granularity: "per_key",
    keys: ["默认可路由"],
    models: [
      { name: "anthropic/claude-sonnet-4", inPrice: 3, outPrice: 15, weight: 0.5 },
      { name: "google/gemini-2.5-pro", inPrice: 1.25, outPrice: 10, weight: 0.3 },
      { name: "meta-llama/llama-3.3-70b", inPrice: 0.12, outPrice: 0.3, weight: 0.2 },
    ],
    currency: "USD",
    balance: 57.18,
    hasBalance: true,
    hasCache: false,
    // OpenRouter's key endpoint only exposes credit balance, no usage.
    usage: false,
  },
];

// Deterministic pseudo-random so demo screenshots are stable-ish per run.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const DEMO_KEY_FAKE = "sk-tokenboard-demo-000000000000000000000000";

export function seedDemo(): { providers: number; records: number } {
  resetDemo();

  const rand = rng(20261010);
  const now = nowSec();
  const today = Math.floor(now / DAY) * DAY;
  const days = 45;
  let recordCount = 0;

  const insertUsage = sqlite.prepare(`
    INSERT OR REPLACE INTO usage_records (
      provider_id, bucket_start, bucket_end, bucket_width,
      model, api_key_id, project_id, user_id, workspace_id,
      input_tokens, cached_input_tokens, cache_creation_tokens, output_tokens,
      total_tokens, requests, cost_amount, currency, raw, synced_at
    ) VALUES (
      @providerId, @bucketStart, @bucketEnd, '1d',
      @model, @apiKeyId, NULL, NULL, NULL,
      @inputTokens, @cachedInputTokens, @cacheCreationTokens, @outputTokens,
      @totalTokens, @requests, @costAmount, @currency, NULL, @syncedAt
    )
  `);

  const tx = sqlite.transaction(() => {
    for (const dp of DEMO_PROVIDERS) {
      const providerId = `demo_${dp.templateId.replace(/\./g, "_")}`;
      const sealed = seal(DEMO_KEY_FAKE, providerId);
      const mask = DEMO_KEY_FAKE.slice(-4);

      db.insert(providers)
        .values({
          id: providerId,
          name: dp.name,
          templateId: dp.templateId,
          baseUrl: null,
          credentialEnc: sealed.enc,
          credentialIv: sealed.iv,
          credentialTag: sealed.tag,
          credentialMeta: JSON.stringify({
            keyPrefix: "sk-tokenboard",
            keyLast4: mask,
            demo: true,
          }),
          config: "{}",
          granularity: dp.granularity,
          status: "ok",
          lastError: null,
          lastSyncedAt: now - 3600,
          enabled: 1,
          createdAt: now - days * DAY,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();

      // Usage per day × per key × per model.
      // Most templates report token usage. `usage: false` marks balance-only
      // templates that expose no usage endpoint at all.
      for (let d = dp.usage === false ? -1 : days - 1; d >= 0; d--) {
        const bucketStart = today - d * DAY;
        // Weekend dip + gentle growth trend + noise.
        const dow = new Date(bucketStart * 1000).getUTCDay();
        const weekendFactor = dow === 0 || dow === 6 ? 0.45 : 1;
        const growth = 1 + (days - d) / (days * 2.2);
        const dayScale = weekendFactor * growth * (0.75 + rand() * 0.5);

        for (const keyName of dp.keys) {
          for (const m of dp.models) {
            const baseRequests = 40 + Math.floor(rand() * 260);
            const requests = Math.max(
              1,
              Math.round(baseRequests * dayScale * m.weight),
            );
            const inPerReq = 400 + Math.floor(rand() * 2600);
            const outPerReq = 120 + Math.floor(rand() * 900);
            const inputTokens = requests * inPerReq;
            const outputTokens = requests * outPerReq;
            // ~35% of input is cache-read for providers that support it.
            const cachedInputTokens = dp.hasCache
              ? Math.round(inputTokens * 0.35)
              : 0;
            const cacheCreationTokens = dp.hasCache
              ? Math.round(inputTokens * 0.08)
              : 0;
            const uncached = inputTokens - cachedInputTokens;

            const cost =
              (uncached / 1_000_000) * m.inPrice +
              (cachedInputTokens / 1_000_000) * m.inPrice * 0.1 +
              (cacheCreationTokens / 1_000_000) * m.inPrice * 1.25 +
              (outputTokens / 1_000_000) * m.outPrice;

            const totalTokens =
              inputTokens + cachedInputTokens + cacheCreationTokens + outputTokens;

            insertUsage.run({
              providerId,
              bucketStart,
              bucketEnd: bucketStart + DAY,
              model: m.name,
              apiKeyId: `${providerId}:${keyName}`,
              inputTokens: uncached,
              cachedInputTokens,
              cacheCreationTokens,
              outputTokens,
              totalTokens,
              requests,
              costAmount: Number(cost.toFixed(6)),
              currency: dp.currency,
              syncedAt: now - 1800,
            });
            recordCount++;
          }
        }
      }

      // Balance history: gentle drawdown. Only for balance-category templates.
      if (dp.hasBalance) {
        for (let d = days - 1; d >= 0; d -= 3) {
          const capturedAt = today - d * DAY;
          const drawdown = (days - d) * (dp.balance * 0.004) * (0.7 + rand() * 0.6);
          db.insert(balanceSnapshots)
            .values({
              providerId,
              amount: Number(
                (dp.balance + (days - d) * 2.3 - drawdown).toFixed(2),
              ),
              currency: dp.currency,
              granted:
                dp.templateId === "deepseek.balance"
                  ? Number((dp.balance * 0.2).toFixed(2))
                  : null,
              topUp: dp.balance * 0.3,
              isAvailable: 1,
              capturedAt,
            })
            .run();
        }
      }

      // A couple of sync log entries.
      for (let i = 0; i < 5; i++) {
        const startedAt = now - i * 6 * 3600;
        db.insert(syncLogs)
          .values({
            providerId,
            trigger: i === 0 ? "manual" : "schedule",
            status: i === 4 ? "error" : "success",
            httpStatus: i === 4 ? 401 : 200,
            recordsUpserted: i === 4 ? 0 : recordCount ? 12 + i : 0,
            pagesFetched: i === 4 ? 0 : 1 + i,
            durationMs: 320 + Math.floor(rand() * 1800),
            errorMessage: i === 4 ? "HTTP 401: 凭据已失效（演示数据）" : null,
            startedAt,
            finishedAt: startedAt + 1,
          })
          .run();
      }
    }
  });
  tx();

  setSetting(SETTING_KEYS.demoEnabled, true);
  return { providers: DEMO_PROVIDERS.length, records: recordCount };
}

/** Remove all demo rows and reset the demo flag. Real user data is untouched. */
export function resetDemo(): void {
  const demoProviderIds = db
    .select({ id: providers.id })
    .from(providers)
    .all()
    .filter((p) => p.id.startsWith("demo_"))
    .map((p) => p.id);
  if (demoProviderIds.length > 0) {
    for (const id of demoProviderIds) {
      db.delete(usageRecords).where(eq(usageRecords.providerId, id)).run();
      db.delete(balanceSnapshots).where(eq(balanceSnapshots.providerId, id)).run();
      db.delete(syncLogs).where(eq(syncLogs.providerId, id)).run();
      db.delete(providers).where(eq(providers.id, id)).run();
    }
  }
  setSetting(SETTING_KEYS.demoEnabled, false);
}

export function isDemoEnabled(): boolean {
  const row = db
    .select({ id: providers.id })
    .from(providers)
    .all()
    .some((p) => p.id.startsWith("demo_"));
  return row;
}
