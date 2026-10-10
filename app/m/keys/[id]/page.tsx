import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { providers } from "@/lib/db/schema";
import {
  getSummary,
  getTrend,
  getKeyBreakdown,
  getModelBreakdown,
  getBalanceHistory,
} from "@/lib/db/queries";
import { resolveTemplate } from "@/lib/providers/resolve";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";
import { fmtCompact, fmtMoneyMulti, fmtNumber, relativeTime } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export default async function MobileKeyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = db.select().from(providers).where(eq(providers.id, id)).get();
  if (!row) notFound();

  const summary = getSummary({ providerId: id });
  const trend = getTrend({ providerId: id }, "day");
  const keys = getKeyBreakdown(id);
  const models = getModelBreakdown({ providerId: id });
  const balance = getBalanceHistory(id);
  const resolved = await resolveTemplate(row.templateId);

  return (
    <>
      <header className="m-topbar">
        <Link href="/m/keys" className="fs-13 muted">
          ← 返回
        </Link>
        <span className="m-title" style={{ fontSize: 15 }}>
          {row.name}
        </span>
        <span style={{ width: 40 }} />
      </header>

      <div className="m-body">
        <div className="fs-12 faint mb-16">
          {resolved.spec.name} · {row.templateId} · {relativeTime(row.lastSyncedAt)}
        </div>

        <div className="grid grid-2 mb-16" style={{ gap: 10 }}>
          <div className="card">
            <h3 className="card-title">总 Token</h3>
            <div className="stat-value num" style={{ fontSize: 20 }}>
              {fmtCompact(summary.totalTokens)}
            </div>
          </div>
          <div className="card">
            <h3 className="card-title">成本</h3>
            <div className="stat-value num" style={{ fontSize: 20 }}>
              {fmtMoneyMulti(summary.costsByCurrency)}
            </div>
          </div>
        </div>

        <div className="card mb-16">
          <h3 className="card-title">用量趋势</h3>
          {trend.length > 0 ? (
            <LineChart
              series={[
                {
                  name: "输入",
                  tone: 2,
                  points: trend.map((t) => ({ x: t.bucketStart, y: t.inputTokens })),
                },
                {
                  name: "输出",
                  tone: 0,
                  points: trend.map((t) => ({ x: t.bucketStart, y: t.outputTokens })),
                },
              ]}
              valueFormat="compact"
              height={160}
            />
          ) : (
            <div className="muted fs-13 center" style={{ padding: "16px 0" }}>
              暂无数据
            </div>
          )}
        </div>

        {keys.length > 0 && (
          <div className="card mb-16">
            <h3 className="card-title">按平台 Key 拆分</h3>
            <BarChart
              data={keys.map((k) => ({ label: k.apiKeyId, value: k.totalTokens }))}
              valueFormat="compact"
            />
          </div>
        )}

        {models.length > 0 && (
          <div className="card mb-16">
            <h3 className="card-title">模型分布</h3>
            <BarChart
              data={models.map((m) => ({ label: m.model, value: m.totalTokens }))}
              valueFormat="compact"
            />
          </div>
        )}

        {balance.length > 1 && (
          <div className="card mb-16">
            <h3 className="card-title">余额变化</h3>
            <LineChart
              series={[
                {
                  name: "余额",
                  tone: 0,
                  points: balance.map((b) => ({ x: b.capturedAt, y: b.amount })),
                },
              ]}
              valueFormat="decimal"
              height={150}
            />
          </div>
        )}

        <div className="fs-12 faint center">
          输入 {fmtNumber(summary.inputTokens)} · 输出 {fmtNumber(summary.outputTokens)} ·{" "}
          {fmtNumber(summary.requests)} 次请求
        </div>
      </div>
    </>
  );
}
