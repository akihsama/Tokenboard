"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface TemplateOption {
  id: string;
  name: string;
  category: string;
  source: string;
  spec: {
    docs?: string;
    description?: string;
    setup?: { note?: string; requiresOrgId?: boolean };
    match?: { keyPrefix?: string };
    supportsPerKey?: boolean;
  };
}

export default function KeysClient({
  templates,
}: {
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    templateId: templates[0]?.id ?? "",
    key: "",
    baseUrl: "",
    orgId: "",
    syncNow: true,
  });

  const selected = templates.find((t) => t.id === form.templateId);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || selected?.name || "未命名 Key",
          templateId: form.templateId,
          key: form.key,
          baseUrl: form.baseUrl || undefined,
          credential: form.orgId ? { orgId: form.orgId } : undefined,
          syncNow: form.syncNow,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "添加失败");
      setOpen(false);
      setForm({ ...form, name: "", key: "", orgId: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + 添加 Key
      </button>

      {open && (
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">添加 API Key</h2>
            <p className="muted fs-13" style={{ marginTop: 0 }}>
              Key 会在服务端加密存储，前端与日志中均不会出现明文。
            </p>

            <div className="field">
              <label>平台模板</label>
              <select
                className="select"
                value={form.templateId}
                onChange={(e) => setForm({ ...form, templateId: e.target.value })}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.source === "user" ? "（自定义）" : ""}
                  </option>
                ))}
              </select>
              {selected?.spec.description && (
                <span className="hint">{selected.spec.description}</span>
              )}
            </div>

            <div className="field">
              <label>名称（可选）</label>
              <input
                className="input"
                placeholder="例如：我的 OpenAI 组织"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="field">
              <label>API Key</label>
              <input
                className="input mono"
                type="password"
                placeholder={selected?.spec.match?.keyPrefix ?? "sk-..."}
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
              />
              {selected?.spec.setup?.note && (
                <span className="hint">{selected.spec.setup.note}</span>
              )}
            </div>

            {selected?.spec.setup?.requiresOrgId && (
              <div className="field">
                <label>组织 ID（Organization ID）</label>
                <input
                  className="input"
                  placeholder="org-..."
                  value={form.orgId}
                  onChange={(e) => setForm({ ...form, orgId: e.target.value })}
                />
              </div>
            )}

            <div className="field">
              <label>自定义 Base URL（可选，用于代理或非官方域名）</label>
              <input
                className="input"
                placeholder="https://api.example.com"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>

            <label className="row fs-13" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={form.syncNow}
                onChange={(e) => setForm({ ...form, syncNow: e.target.checked })}
              />
              添加后立即同步一次
            </label>

            {error && (
              <div className="tag" style={{ marginTop: 12, color: "var(--text-strong)" }}>
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={busy || !form.key || !form.templateId}
              >
                {busy ? "添加中…" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
