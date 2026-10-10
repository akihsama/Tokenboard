import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { providers, syncLogs } from "@/lib/db/schema";
import { PageHead, Card, Tag, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export default function LogsPage() {
  const logs = db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).limit(200).all();
  const providerRows = db.select().from(providers).all();
  const nameById = new Map(providerRows.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHead title="同步日志" sub="记录每次同步的时间、结果与写入条数" />

      {logs.length === 0 ? (
        <Empty title="暂无同步日志">添加 Key 或手动触发同步后，这里会显示记录。</Empty>
      ) : (
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>平台 / Key</th>
                  <th>触发</th>
                  <th>结果</th>
                  <th className="num">HTTP</th>
                  <th className="num">写入</th>
                  <th className="num">页数</th>
                  <th className="num">耗时</th>
                  <th>错误</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap fs-12">
                      {fmtDate(l.startedAt)}{" "}
                      <span className="faint">
                        {new Date(l.startedAt * 1000).toISOString().slice(11, 16)}
                      </span>
                    </td>
                    <td className="fs-13">
                      {l.providerId ? (nameById.get(l.providerId) ?? l.providerId) : "全部"}
                    </td>
                    <td>
                      <Tag>
                        {l.trigger === "manual"
                          ? "手动"
                          : l.trigger === "schedule"
                            ? "定时"
                            : l.trigger === "on_create"
                              ? "新建"
                              : l.trigger}
                      </Tag>
                    </td>
                    <td>
                      <Tag solid={l.status === "error"}>
                        {l.status === "success" ? "成功" : l.status === "error" ? "失败" : "部分"}
                      </Tag>
                    </td>
                    <td className="num">{l.httpStatus ?? "—"}</td>
                    <td className="num">{l.recordsUpserted}</td>
                    <td className="num">{l.pagesFetched}</td>
                    <td className="num">{l.durationMs}ms</td>
                    <td className="fs-12 faint" style={{ maxWidth: 260 }}>
                      {l.errorMessage ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
