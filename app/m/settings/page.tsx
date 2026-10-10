import Link from "next/link";

import { allSettings, SETTING_KEYS } from "@/lib/utils/settings";
import { isDemoEnabled } from "@/lib/demo/seed";

export const dynamic = "force-dynamic";

export default function MobileSettings() {
  const settings = allSettings();
  const demo = isDemoEnabled();

  return (
    <>
      <header className="m-topbar">
        <span className="m-title">设置</span>
        <Link href="/" className="fs-12 muted">
          桌面版
        </Link>
      </header>

      <div className="m-body">
        <div className="card mb-16">
          <h3 className="card-title">同步计划</h3>
          <div className="row-between fs-13">
            <span className="muted">Cron 表达式</span>
            <span className="mono">
              {String(settings[SETTING_KEYS.syncCron] ?? "0 */6 * * *")}
            </span>
          </div>
          <div className="row-between fs-13 mt-8">
            <span className="muted">后台定时同步</span>
            <span>
              {settings[SETTING_KEYS.syncEnabled] !== false ? "已启用" : "已关闭"}
            </span>
          </div>
          <div className="hint mt-8">
            修改请前往
            <Link href="/settings" style={{ textDecoration: "underline" }}>
              {" "}
              桌面版设置
            </Link>
            。
          </div>
        </div>

        <div className="card mb-16">
          <h3 className="card-title">演示模式</h3>
          <p className="fs-13 muted" style={{ marginTop: 0 }}>
            当前状态：<strong className="strong">{demo ? "已开启" : "未开启"}</strong>
          </p>
          <Link href="/settings" className="btn btn-sm">
            前往桌面版管理
          </Link>
        </div>

        <div className="card">
          <h3 className="card-title">数据</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            <a className="btn btn-sm" href="/api/export" download>
              导出配置
            </a>
            <Link href="/api/logs" className="btn btn-sm">
              查看日志 API
            </Link>
          </div>
          <div className="hint mt-8">
            数据保存在本地，Key 已加密存储，不会上传第三方。
          </div>
        </div>
      </div>
    </>
  );
}
