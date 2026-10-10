"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card } from "@/components/ui";

export default function SettingsClient({
  initial,
}: {
  initial: { syncCron: string; syncEnabled: boolean; demoEnabled: boolean };
}) {
  const router = useRouter();
  const [cron, setCron] = useState(initial.syncCron);
  const [syncEnabled, setSyncEnabled] = useState(initial.syncEnabled);
  const [demo, setDemo] = useState(initial.demoEnabled);
  const [busy, setBusy] = useState<"" | "save" | "demo" | "sync">("");
  const [msg, setMsg] = useState<string | null>(null);

  async function saveSchedule() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCron: cron, syncEnabled }),
      });
      const json = await res.json();
      setMsg(json.ok ? "已保存同步设置" : `保存失败：${json.error}`);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  async function toggleDemo(next: boolean) {
    setBusy("demo");
    setMsg(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (json.ok) {
        setDemo(next);
        setMsg(
          next
            ? `已生成演示数据（${json.data.providers} 个平台 / ${json.data.records} 条记录）`
            : "已清除演示数据",
        );
        router.refresh();
      } else {
        setMsg(`操作失败：${json.error}`);
      }
    } finally {
      setBusy("");
    }
  }

  async function syncNow() {
    setBusy("sync");
    setMsg(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok) {
        const total = json.data.results.length;
        const ok = json.data.results.filter(
          (r: { status: string }) => r.status === "success",
        ).length;
        setMsg(`同步完成：${ok}/${total} 成功`);
        router.refresh();
      } else {
        setMsg(`同步失败：${json.error}`);
      }
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid grid-2">
      <Card title="同步计划">
        <div className="field">
          <label>Cron 表达式</label>
          <input
            className="input mono"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
          />
          <span className="hint">
            默认每 6 小时同步一次（0 */6 * * *）。自托管 / Docker 生效；
            Vercel 请改用 Cron Job 调用 POST /api/sync。
          </span>
        </div>
        <label className="row fs-13 mb-16" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => setSyncEnabled(e.target.checked)}
          />
          启用后台定时同步
        </label>
        <div className="row">
          <button className="btn btn-primary" onClick={saveSchedule} disabled={busy !== ""}>
            保存
          </button>
          <button className="btn" onClick={syncNow} disabled={busy !== ""}>
            {busy === "sync" ? "同步中…" : "立即全部同步"}
          </button>
        </div>
      </Card>

      <Card title="演示模式">
        <p className="fs-13 muted" style={{ marginTop: 0 }}>
          开启后会生成一份跨 45 天的多平台模拟数据（4 个平台、多个 Key 与模型），
          便于在未配置真实 Key 时预览完整界面。关闭只会移除演示数据，不影响真实数据。
        </p>
        <div className="row">
          <button
            className={`btn ${demo ? "" : "btn-primary"}`}
            onClick={() => toggleDemo(true)}
            disabled={busy !== ""}
          >
            {demo ? "重新生成演示数据" : "开启演示模式"}
          </button>
          {demo && (
            <button className="btn btn-danger" onClick={() => toggleDemo(false)} disabled={busy !== ""}>
              关闭并清除
            </button>
          )}
        </div>
      </Card>

      <Card title="导入 / 导出" className="span-2">
        <p className="fs-13 muted" style={{ marginTop: 0 }}>
          导出为 JSON，便于备份或迁移到另一台机器。默认导出不含加密后的凭据；如需完整迁移，
          可勾选包含凭据（仍为密文，且只有相同主密钥才能解密）。
        </p>
        <div className="row wrap mt-8">
          <a className="btn" href="/api/export" download>
            导出配置（不含凭据）
          </a>
          <a className="btn" href="/api/export?includeSecrets=true" download>
            导出配置（含凭据密文）
          </a>
          <ImportButton onDone={(m) => { setMsg(m); router.refresh(); }} />
        </div>
      </Card>

      {msg && (
        <div className="span-2">
          <div className="tag">{msg}</div>
        </div>
      )}
    </div>
  );
}

function ImportButton({ onDone }: { onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, mode: "merge" }),
      });
      const json = await res.json();
      onDone(
        json.ok
          ? `导入完成：模板 ${json.data.templatesImported}，Key ${json.data.providersImported}（跳过 ${json.data.providersSkipped}）`
          : `导入失败：${json.error}`,
      );
    } catch {
      onDone("导入失败：文件格式不正确");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="btn" style={{ cursor: "pointer" }}>
      {busy ? "导入中…" : "导入配置"}
      <input
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
    </label>
  );
}
