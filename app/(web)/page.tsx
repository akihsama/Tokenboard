import Link from "next/link";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { providers } from "@/lib/db/schema";
import {
  getSummary,
  getTrend,
  getModelBreakdown,
  defaultRange,
} from "@/lib/db/queries";
import { isDemoEnabled } from "@/lib/demo/seed";
import { PageHead, Stat, Card, Tag, Banner, LinkButton } from "@/components/ui";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";
import { fmtCompact, fmtMoney, fmtMoneyMulti, fmtNumber, relativeTime } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7d", label: "7 天" },
  { key: "30d", label: "30 天" },
  { key: "90d", label: "90 天" },
];

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range = "30d" } = await searchParams;
  const { from, to } = defaultRange(range);

  const summary = getSummary({ from, to });
  const trend = getTrend({ from, to }, "day");
  const models = getModelBreakdown({ from, to });
  const providerRows = db.select().from(providers).all();
  const demo = isDemoEnabled();

  const lastSync = providerRows.reduce<number | null>((acc, p) => {
    if (!p.lastSyncedAt) return acc;
    return acc === null ? p.lastSyncedAt : Math.max(acc, p.lastSyncedAt);
  }, null);

  const trendSeries = [
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
  ];

  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "30 天";

  return (
    <>
      <PageHead
        title="总览"
        sub={`最近 ${rangeLabel} 的 Token 用量与成本汇总`}
        actions={
          <>
            <div className="segmented">
              {RANGES.map((r) => (
                <Link key={r.key} href={`/?range=${r.key}`}>
                  <button className={r.key === range ? "active" : ""}>
                    {r.label}
                  </button>
                </Link>
              ))}
            </div>
            <LinkButton href="/keys" variant="primary">
              管理 Keys
            </LinkButton>
          </>
        }
      />

      {demo && (
        <Banner>
          <span>当前展示的是演示数据。</span>
          <Link href="/settings" style={{ textDecoration: "underline" }}>
            在设置中关闭
          </Link>
        </Banner>
      )}

      {providerRows.length === 0 && (
        <div className="empty mb-16">
          <div className="empty-title">还没有添加任何 API Key</div>
          <div className="muted">
            添加一个 Key 开始统计各平台用量，或先开启演示模式浏览界面效果。
          </div>
          <div className="row mt-16" style={{ justifyContent: "center" }}>
            <LinkButton href="/keys" variant="primary">
              添加 API Key
            </LinkButton>
            <LinkButton href="/settings">开启演示模式</LinkButton>
          </div>
        </div>
      )}

      <div className="grid grid-4 mb-16">
        <Stat
          label="总 Token 用量"
          value={fmtCompact(summary.totalTokens)}
          sub={`输入 ${fmtCompact(summary.inputTokens)} · 输出 ${fmtCompact(summary.outputTokens)}`}
        />
        <Stat
          label="总成本"
          value={fmtMoneyMulti(summary.costsByCurrency)}
          sub={`缓存读取 ${fmtCompact(summary.cachedInputTokens)} tokens`}
        />
        <Stat
          label="请求数"
          value={fmtCompact(summary.requests)}
          sub={`${summary.providerCount} 个平台`}
        />
        <Stat
          label="最近同步"
          value={<span style={{ fontSize: 20 }}>{relativeTime(lastSync)}</span>}
          sub={`${providerRows.length} 个 Key`}
        />
      </div>

      <div className="grid grid-2 mb-16">
        <Card title="用量趋势（按天）" className="span-2">
          {trend.length > 0 ? (
            <LineChart
              series={trendSeries}
              valueFormat="compact"
              height={260}
            />
          ) : (
            <div className="muted fs-13" style={{ padding: "40px 0", textAlign: "center" }}>
              暂无数据
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="各平台 Token 占比">
          <BarChart
            data={summary.perProvider.map((p) => ({
              label: p.providerName,
              value: p.totalTokens,
            }))}
            valueFormat="compact"
          />
        </Card>
        <Card title="模型用量 Top">
          <BarChart
            data={models.map((m) => ({ label: m.model, value: m.totalTokens }))}
            valueFormat="compact"
          />
        </Card>
      </div>

      <Card title="平台明细" className="mt-16">
        {summary.perProvider.length === 0 ? (
          <div className="muted fs-13">暂无数据</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>平台</th>
                <th className="num">输入</th>
                <th className="num">输出</th>
                <th className="num">总 Token</th>
                <th className="num">请求</th>
                <th className="num">成本</th>
              </tr>
            </thead>
            <tbody>
              {summary.perProvider.map((p) => (
                <tr key={p.providerId}>
                  <td>
                    <Link href={`/keys/${p.providerId}`} className="strong">
                      {p.providerName}
                    </Link>
                    <div className="fs-12 faint">{p.templateId}</div>
                  </td>
                  <td className="num">{fmtNumber(p.inputTokens)}</td>
                  <td className="num">{fmtNumber(p.outputTokens)}</td>
                  <td className="num strong">
                    {p.totalTokens > 0 ? fmtNumber(p.totalTokens) : "—"}
                  </td>
                  <td className="num">
                    {p.requests > 0 ? fmtNumber(p.requests) : "—"}
                  </td>
                  <td className="num">
                    {p.cost > 0 ? fmtMoney(p.cost, p.currency) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="row mt-16 fs-12 faint">
        <Tag>数据来源：各平台官方用量 / 余额接口</Tag>
        <Tag>支持自定义平台模板</Tag>
      </div>
    </>
  );
}
