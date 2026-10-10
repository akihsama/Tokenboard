import { listTemplates } from "@/lib/providers/resolve";
import { getProvidersWithStats } from "@/lib/db/queries";
import { PageHead, Card, Tag, Empty } from "@/components/ui";
import TemplatesClient from "./TemplatesClient";

export const dynamic = "force-dynamic";

export default function ProvidersPage() {
  const templates = listTemplates();
  const providers = getProvidersWithStats();
  const builtinCount = templates.filter((t) => t.source === "builtin").length;
  const userCount = templates.length - builtinCount;

  return (
    <>
      <PageHead
        title="平台模板"
        sub="内置主流平台模板，也可自定义模板适配任意平台的用量接口"
        actions={<TemplatesClient templates={templates} />}
      />

      <div className="grid grid-3 mb-16">
        <div className="card">
          <h3 className="card-title">模板总数</h3>
          <div className="stat-value num">{templates.length}</div>
          <div className="stat-sub">
            内置 {builtinCount} · 自定义 {userCount}
          </div>
        </div>
        <div className="card">
          <h3 className="card-title">已接入平台</h3>
          <div className="stat-value num">{providers.length}</div>
          <div className="stat-sub">配置中的 API Key 数量</div>
        </div>
        <div className="card">
          <h3 className="card-title">适配方式</h3>
          <div className="stat-value" style={{ fontSize: 17 }}>
            声明式 JSON 模板
          </div>
          <div className="stat-sub">改参数即可适配，无需改代码</div>
        </div>
      </div>

      <Card title="模板列表" className="mb-16">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>模板 ID</th>
                <th>名称</th>
                <th>类型</th>
                <th>来源</th>
                <th>按 Key 拆分</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="mono fs-12">{t.id}</td>
                  <td className="strong">{t.name}</td>
                  <td>
                    <Tag>
                      {t.category === "balance"
                        ? "余额"
                        : t.category === "cost"
                          ? "费用"
                          : "用量"}
                    </Tag>
                  </td>
                  <td>
                    <Tag solid={t.source === "user"}>
                      {t.source === "builtin" ? "内置" : "自定义"}
                    </Tag>
                  </td>
                  <td className="fs-12 muted">
                    {t.spec.supportsPerKey ? "是" : "否"}
                  </td>
                  <td className="fs-12 muted" style={{ maxWidth: 360 }}>
                    {t.spec.description ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="如何适配非主流平台？">
        <ol className="fs-13 muted" style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
          <li>
            点击右上角「新建自定义模板」，或在下方模板列表中点「复制内置模板」作为起点。
          </li>
          <li>
            设置 <code className="mono">endpoints[0].baseUrl</code> 与{" "}
            <code className="mono">path</code> 为目标平台的用量接口地址。
          </li>
          <li>
            用 JSONPath 修改 <code className="mono">mapping</code>，把返回字段映射到标准字段
            （bucketStart / inputTokens / outputTokens / requests / model / apiKeyId 等）。
          </li>
          <li>
            选择 <code className="mono">timeUnit</code>（unix_seconds / unix_ms / iso8601）
            与分页方式（none / cursor / page / time）。
          </li>
          <li>保存后用「测试」填入该平台 Key 试跑一次，通过即可在添加 Key 时选用。</li>
        </ol>
      </Card>

      {userCount === 0 && (
        <Empty title="还没有自定义模板" >
          如果目标平台不在内置列表中，创建自定义模板即可接入。
        </Empty>
      )}
    </>
  );
}
