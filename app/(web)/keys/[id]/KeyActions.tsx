"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function KeyActions({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "sync" | "test" | "delete">("");
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy("sync");
    setMsg(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const json = await res.json();
      const r = json?.data?.results?.[0];
      setMsg(
        json.ok
          ? r?.status === "success"
            ? `同步成功，写入 ${r.recordsUpserted} 条`
            : `同步失败：${r?.error ?? "未知错误"}`
          : json.error,
      );
      router.refresh();
    } catch {
      setMsg("同步请求失败");
    } finally {
      setBusy("");
    }
  }

  async function test() {
    setBusy("test");
    setMsg(null);
    try {
      const res = await fetch(`/api/keys/${providerId}/test`, { method: "POST" });
      const json = await res.json();
      setMsg(
        json.ok
          ? `连接正常，HTTP ${json.data.httpStatus}，读到 ${json.data.usageRecords} 条用量、${json.data.balances.length} 条余额`
          : `测试失败：${json.error}`,
      );
    } catch {
      setMsg("测试请求失败");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!confirm("确定删除这个 Key 及其全部历史数据？此操作不可恢复。")) return;
    setBusy("delete");
    try {
      await fetch(`/api/keys/${providerId}`, { method: "DELETE" });
      router.push("/keys");
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="row wrap">
      {msg && <span className="fs-12 muted">{msg}</span>}
      <button className="btn btn-sm" onClick={test} disabled={busy !== ""}>
        {busy === "test" ? "测试中…" : "测试连接"}
      </button>
      <button className="btn btn-sm btn-primary" onClick={sync} disabled={busy !== ""}>
        {busy === "sync" ? "同步中…" : "立即同步"}
      </button>
      <button className="btn btn-sm btn-danger" onClick={remove} disabled={busy !== ""}>
        删除
      </button>
    </div>
  );
}
