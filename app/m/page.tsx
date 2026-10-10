import Link from "next/link";

import {
  getSummary,
  getTrend,
  defaultRange,
} from "@/lib/db/queries";
import { isDemoEnabled } from "@/lib/demo/seed";
import LineChart from "@/components/charts/LineChart";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  fmtCompact,
  fmtMoney,
  fmtMoneyMulti,
  fmtNumber,
  relativeTime,
} from "@/lib/utils/time";
import { db } from "@/lib/db/client";
import { providers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default function MobileHome() {
  const { from, to } = defaultRange("30d");
  const summary = getSummary({ from, to });
  const trend = getTrend({ from, to }, "day");
  const rows = db.select().from(providers).all();
  const demo = isDemoEnabled();
  const lastSync = rows.reduce<number | null>((acc, p) => {
    if (!p.lastSyncedAt) return acc;
    return acc === null ? p.lastSyncedAt : Math.max(acc, p.lastSyncedAt);
  }, null);

  return (
    <>
      <header className="m-topbar">
        <span className="m-title">TokenBoard</span>
        <span className="row" style={{ gap: 8 }}>
          <ThemeToggle compact />
          <Link href="/" className="fs-12 muted">
            桌面版
          </Link>
        </span>
      </header>

      <div className="m-body">
        {demo && (
          <div className="banner" style={{ marginBottom: 14 }}>
            演示数据
          </div>
        )}

        <div className="grid grid-2 mb-16" style={{ gap: 10 }}>
          <div className="card">
            <h3 className="card-title">总 Token</h3>
            <div className="stat-value num" style={{ fontSize: 22 }}>
              {fmtCompact(summary.totalTokens)}
            </div>
          </div>
          <div className="card">
            <h3 className="card-title">总成本</h3>
            <div className="stat-value num" style={{ fontSize: 22 }}>
              {fmtMoneyMulti(summary.costsByCurrency)}
            </div>
          </div>
        </div>

        <div className="card mb-16">
          <div className="row-between mb-8">
            <h3 className="card-title" style={{ margin: 0 }}>
              近 30 天趋势
            </h3>
            <span className="fs-12 faint">
              最近同步 {relativeTime(lastSync)}
            </span>
          </div>
          {trend.length > 0 ? (
            <LineChart
              series={[
                {
                  name: "Token",
                  tone: 0,
                  points: trend.map((t) => ({ x: t.bucketStart, y: t.totalTokens })),
                },
              ]}
              valueFormat="compact"
              height={160}
            />
          ) : (
            <div className="muted fs-13 center" style={{ padding: "20px 0" }}>
              暂无数据
            </div>
          )}
        </div>

        <h3 className="card-title">平台</h3>
        {summary.perProvider.length === 0 && (
          <div className="empty">
            <div className="empty-title">暂无数据</div>
            <div className="muted fs-13">
              在桌面版添加 Key，或在设置中开启演示模式
            </div>
          </div>
        )}
        {summary.perProvider.map((p) => (
          <Link key={p.providerId} href={`/m/keys/${p.providerId}`} className="m-list-item">
            <div className="row-between">
              <span className="strong">{p.providerName}</span>
              <span className="num strong">{fmtCompact(p.totalTokens)}</span>
            </div>
            <div className="row-between mt-8 fs-12 muted">
              <span>{p.templateId}</span>
              <span className="num">{fmtMoney(p.cost, p.currency)}</span>
            </div>
          </Link>
        ))}

        <div className="fs-12 faint center mt-16">
          共 {rows.length} 个 Key · {fmtNumber(summary.requests)} 次请求
        </div>
      </div>
    </>
  );
}
