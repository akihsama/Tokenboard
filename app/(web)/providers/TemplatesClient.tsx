"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SAMPLE = {
  id: "my-platform.usage",
  name: "我的平台",
  version: 1,
  category: "usage",
  description: "自定义平台用量模板",
  auth: { type: "bearer", valueTemplate: "Bearer {{key}}" },
  endpoints: [
    {
      id: "usage",
      method: "GET",
      baseUrl: "https://api.my-platform.com",
      path: "/v1/usage",
      query: { start: "{{window.startUnix}}", end: "{{window.endUnix}}" },
      pagination: { type: "none" },
      as: "usage",
    },
  ],
  mapping: {
    usage: {
      recordsPath: "$.data[*]",
      fields: {
        bucketStart: "$.timestamp",
        inputTokens: "$.input_tokens",
        outputTokens: "$.output_tokens",
        model: "$.model",
        apiKeyId: "$.api_key_id",
      },
      timeUnit: "unix_seconds",
    },
  },
};

export default function TemplatesClient({
  templates,
}: {
  templates: Array<{
    id: string;
    name: string;
    category: string;
    source: string;
    enabled: boolean;
    baseTemplateId: string | null;
    spec: unknown;
  }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [text, setText] = useState(JSON.stringify(SAMPLE, null, 2));
  const [testKey, setTestKey] = useState("");

  // Exposed so the parent can pass a template to prefill (reserved for future use).
  void templates;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const spec = JSON.parse(text);
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: spec.id,
          name: spec.name,
          spec,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "保存失败");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败（请检查 JSON 格式）");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setTestMsg(null);
    try {
      const spec = JSON.parse(text);
      const res = await fetch(`/api/templates/${encodeURIComponent(spec.id)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: testKey, windowDays: 3 }),
      });
      const json = await res.json();
      setTestMsg(
        json.ok
          ? `测试通过：HTTP ${json.data.httpStatus}，读到 ${json.data.usageRecords} 条用量、${json.data.balances.length} 条余额`
          : `测试失败：${json.error}`,
      );
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "测试失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + 新建自定义模板
      </button>

      {open && (
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: 760 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">自定义平台模板</h2>
            <p className="muted fs-13" style={{ marginTop: 0 }}>
              用声明式 JSON 描述请求方式与字段映射。保存前会做 schema 校验。
            </p>

            <div className="field">
              <label>模板 JSON</label>
              <textarea
                className="textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="field">
              <label>测试用 API Key（可选，不会保存）</label>
              <input
                className="input mono"
                type="password"
                placeholder="sk-..."
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
              />
              <span className="hint">
                填入后点「测试」会用该 Key 试跑模板，不会写入数据库。
              </span>
            </div>

            {error && <div className="tag" style={{ color: "var(--text-strong)" }}>{error}</div>}
            {testMsg && <div className="tag mt-8">{testMsg}</div>}

            <div className="modal-actions">
              <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
                取消
              </button>
              <button
                className="btn"
                onClick={test}
                disabled={busy || !testKey}
              >
                {busy ? "…" : "测试"}
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "保存中…" : "保存模板"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
