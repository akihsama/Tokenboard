import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { providers, syncLogs } from "@/lib/db/schema";
import { Tag } from "@/components/ui";
import { fmtDate } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export default function MobileLogs() {
  const logs = db
    .select()
    .from(syncLogs)
    .orderBy(desc(syncLogs.startedAt))
    .limit(60)
    .all();
  const nameById = new Map(
    db.select().from(providers).all().map((p) => [p.id, p.name]),
  );

  return (
    <>
      <header className="m-topbar">
        <span className="m-title">同步日志</span>
        <span className="fs-12 faint">{logs.length} 条</span>
      </header>

      <div className="m-body">
        {logs.length === 0 && (
          <div className="empty">
            <div className="empty-title">暂无日志</div>
          </div>
        )}
        {logs.map((l) => (
          <div key={l.id} className="m-list-item">
            <div className="row-between">
              <span className="strong fs-13">
                {l.providerId ? (nameById.get(l.providerId) ?? l.providerId) : "全部"}
              </span>
              <Tag solid={l.status === "error"}>
                {l.status === "success" ? "成功" : l.status === "error" ? "失败" : "部分"}
              </Tag>
            </div>
            <div className="row-between mt-8 fs-12 muted">
              <span className="nowrap">
                {fmtDate(l.startedAt)}{" "}
                {new Date(l.startedAt * 1000).toISOString().slice(11, 16)}
              </span>
              <span className="num">
                写入 {l.recordsUpserted} · {l.durationMs}ms
              </span>
            </div>
            {l.errorMessage && (
              <div className="fs-12 faint mt-8">{l.errorMessage.slice(0, 80)}</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
