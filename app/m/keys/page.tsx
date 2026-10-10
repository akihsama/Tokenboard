import Link from "next/link";

import { getProvidersWithStats } from "@/lib/db/queries";
import { StatusDot } from "@/components/ui";
import { fmtCompact, fmtMoney, relativeTime } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export default function MobileKeys() {
  const rows = getProvidersWithStats();

  return (
    <>
      <header className="m-topbar">
        <span className="m-title">API Keys</span>
        <span className="fs-12 faint">{rows.length} 个</span>
      </header>

      <div className="m-body">
        {rows.length === 0 && (
          <div className="empty">
            <div className="empty-title">还没有 Key</div>
            <div className="muted fs-13">请在桌面版添加</div>
          </div>
        )}

        {rows.map(({ provider: p, latestBalance, totals }) => {
          const meta = JSON.parse(p.credentialMeta) as Record<string, unknown>;
          return (
            <Link key={p.id} href={`/m/keys/${p.id}`} className="m-list-item">
              <div className="row-between">
                <span className="strong">{p.name}</span>
                <StatusDot status={p.status} />
              </div>
              <div className="fs-12 faint mono mt-8">
                {String(meta.keyPrefix ?? "sk-")}…{String(meta.keyLast4 ?? "****")}
              </div>
              <div className="row-between mt-8 fs-12">
                <span className="muted">{p.templateId}</span>
                <span className="num strong">{fmtCompact(totals.totalTokens)}</span>
              </div>
              <div className="row-between mt-8 fs-12 muted">
                <span>{relativeTime(p.lastSyncedAt)}</span>
                <span className="num">
                  {latestBalance
                    ? `余额 ${fmtMoney(latestBalance.amount, latestBalance.currency)}`
                    : fmtMoney(totals.cost, totals.currency)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
