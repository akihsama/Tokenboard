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
  getUsageRows,
} from "@/lib/db/queries";
import { resolveTemplate } from "@/lib/providers/resolve";
import { PageHead, Card, Stat, Tag, LinkButton } from "@/components/ui";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";
import KeyActions from "./KeyActions";
import {
  fmtCompact,
  fmtMoney,
  fmtMoneyMulti,
  fmtNumber,
  relativeTime,
  fmtDate,
} from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export default async function KeyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = db.select().from(providers).where(eq(providers.id, id)).get();
  if (!row) notFound();

  const summary = getSummary({ providerId: id });
  const trend = getTrend({ providerId: id }, "day");
  const keyRows = getKeyBreakdown(id);
  const models = getModelBreakdown({ providerId: id });
  const balance = getBalanceHistory(id);
  const recent = getUsageRows({ providerId: id }, 30);
  const resolved = await resolveTemplate(row.templateId);
  const meta = JSON.parse(row.credentialMeta) as Record<string, unknown>;

  return (
    <>
      <PageHead
        title={row.name}
        sub={`${resolved.spec.name} · ${row.templateId}`}
        actions={
          <>
            <LinkButton href="/keys">← 返回列表</LinkButton>
            <KeyActions providerId={id} />
          </>
        }
      />

      <div className="grid grid-4 mb-16">
        <Stat
          label="总 Token"
          value={fmtCompact(summary.totalTokens)}
          sub={`输入 ${fmtCompact(summary.inputTokens)} · 输出 ${fmtCompact(summary.outputTokens)}`}
        />
        <Stat label="成本" value={fmtMoneyMulti(summary.costsByCurrency)} sub={`${fmtNumber(summary.requests)} 次请求`} />
        <Stat
          label="缓存读取"
          value={fmtCompact(summary.cachedInputTokens)}
          sub={`缓存创建 ${fmtCompact(summary.cacheCreationTokens)}`}
        />
        <Stat
          label="最近同步"
          value={<span style={{ fontSize: 20 }}>{relativeTime(row.lastSyncedAt)}</span>}
          sub={`状态：${row.status === "ok" ? "正常" : row.status === "error" ? "异常" : "未知"}`}
        />
      </div>

      <div className="row wrap mb-16" style={{ gap: 8 }}>
        <Tag>Key: {String(meta.keyPrefix ?? "sk-")}…{String(meta.keyLast4 ?? "****")}</Tag>
        <Tag>
          {resolved.spec.supportsPerKey ? "支持按 Key 拆分" : "平台级 / 账户级"}
        </Tag>
        <Tag>{resolved.spec.category === "balance" ? "余额类" : "用量类"}</Tag>
        {row.lastError && <Tag solid>{row.lastError.slice(0, 40)}</Tag>}
      </div>

      <Card title="用量趋势（按天）" className="mb-16">
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
            height={240}
          />
        ) : (
          <div className="muted fs-13 center" style={{ padding: "32px 0" }}>
            暂无用量数据
          </div>
        )}
      </Card>

      <div className="grid grid-2 mb-16">
        <Card title="按平台 Key 拆分">
          {keyRows.length > 0 ? (
            <BarChart
              data={keyRows.map((k) => ({ label: k.apiKeyId, value: k.totalTokens }))}
              valueFormat="compact"
            />
          ) : (
            <div className="muted fs-13">该平台未返回按 Key 分组的数据</div>
          )}
        </Card>
        <Card title="模型分布">
          {models.length > 0 ? (
            <BarChart
              data={models.map((m) => ({ label: m.model, value: m.totalTokens }))}
              valueFormat="compact"
            />
          ) : (
            <div className="muted fs-13">暂无数据</div>
          )}
        </Card>
      </div>

      {balance.length > 1 && (
        <Card title="余额变化" className="mb-16">
          <LineChart
            series={[
              {
                name: "余额",
                tone: 0,
                points: balance.map((b) => ({ x: b.capturedAt, y: b.amount })),
              },
            ]}
            valueFormat="decimal"
            height={200}
          />
        </Card>
      )}

      <Card title="最近记录">
        {recent.length === 0 ? (
          <div className="muted fs-13">暂无记录</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>模型</th>
                  <th>平台 Key</th>
                  <th className="num">输入</th>
                  <th className="num">缓存</th>
                  <th className="num">输出</th>
                  <th className="num">总 Token</th>
                  <th className="num">成本</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.bucketStart)}</td>
                    <td className="mono fs-12">{r.model ?? "—"}</td>
                    <td className="mono fs-12">{r.apiKeyId ?? "—"}</td>
                    <td className="num">{fmtNumber(r.inputTokens)}</td>
                    <td className="num">{fmtNumber(r.cachedInputTokens)}</td>
                    <td className="num">{fmtNumber(r.outputTokens)}</td>
                    <td className="num strong">{fmtNumber(r.totalTokens)}</td>
                    <td className="num">
                      {r.costAmount != null
                        ? fmtMoney(r.costAmount, r.currency ?? "USD")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-16 fs-12 faint">
        <Link href="/keys">← 返回 Key 列表</Link>
      </div>
    </>
  );
}
