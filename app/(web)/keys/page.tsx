import Link from "next/link";

import { getProvidersWithStats } from "@/lib/db/queries";
import { listTemplates } from "@/lib/providers/resolve";
import { PageHead, Card, StatusDot, Tag, LinkButton, Empty } from "@/components/ui";
import { fmtCompact, fmtMoney, relativeTime } from "@/lib/utils/time";
import KeysClient from "./KeysClient";

export const dynamic = "force-dynamic";

export default function KeysPage() {
  const rows = getProvidersWithStats();
  const templates = listTemplates();

  return (
    <>
      <PageHead
        title="API Keys"
        sub="每个 Key 独立统计，也可在总览查看全部 Key 的汇总"
        actions={<KeysClient templates={templates} />}
      />

      {rows.length === 0 ? (
        <Empty title="还没有添加任何 Key">
          点击右上角「添加 Key」，选择平台模板并填入 API Key 即可开始统计。
          <div className="mt-16">
            <LinkButton href="/settings">或先开启演示模式体验</LinkButton>
          </div>
        </Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名称</th>
              <th>平台</th>
              <th>状态</th>
              <th className="num">总 Token</th>
              <th className="num">成本</th>
              <th className="num">余额</th>
              <th>最近同步</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ provider: p, latestBalance, totals }) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/keys/${p.id}`} className="strong">
                    {p.name}
                  </Link>
                  <div className="fs-12 faint mono">
                    {String(
                      (JSON.parse(p.credentialMeta) as Record<string, unknown>)
                        .keyPrefix ?? "sk-",
                    )}
                    …
                    {String(
                      (JSON.parse(p.credentialMeta) as Record<string, unknown>)
                        .keyLast4 ?? "****",
                    )}
                  </div>
                </td>
                <td>
                  <Tag>{p.templateId}</Tag>
                </td>
                <td>
                  <StatusDot status={p.status} />
                  {p.lastError && (
                    <div className="fs-12 faint" style={{ maxWidth: 200 }}>
                      {p.lastError.slice(0, 60)}
                    </div>
                  )}
                </td>
                <td className="num strong">{fmtCompact(totals.totalTokens)}</td>
                <td className="num">{fmtMoney(totals.cost, totals.currency)}</td>
                <td className="num">
                  {latestBalance
                    ? fmtMoney(latestBalance.amount, latestBalance.currency)
                    : "—"}
                </td>
                <td className="fs-12 muted nowrap">
                  {relativeTime(p.lastSyncedAt)}
                </td>
                <td>
                  <Link href={`/keys/${p.id}`} className="btn btn-sm">
                    详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Card title="说明" className="mt-16">
        <ul className="fs-13 muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>
            <strong className="strong">单 Key 用量</strong>：在支持按 API Key 分组的平台上（如
            OpenAI、Anthropic），会拆分出每个平台侧 Key 的用量。
          </li>
          <li>
            <strong className="strong">总量汇总</strong>：首页总览展示所有 Key 的合计用量与成本。
          </li>
          <li>
            <strong className="strong">余额类平台</strong>：DeepSeek、OpenRouter 等返回余额而非用量，
            会记录为余额快照并绘制变化曲线。
          </li>
        </ul>
      </Card>
    </>
  );
}
