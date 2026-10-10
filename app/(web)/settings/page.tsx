import { allSettings, SETTING_KEYS } from "@/lib/utils/settings";
import { isDemoEnabled } from "@/lib/demo/seed";
import { PageHead, Card, Tag } from "@/components/ui";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = allSettings();
  const demo = isDemoEnabled();
  const hasEnvKey = Boolean(process.env.TOKENBOARD_MASTER_KEY);

  return (
    <>
      <PageHead
        title="设置"
        sub="同步计划、安全与数据导入导出"
      />

      <div className="grid grid-2 mb-16">
        <Card title="主密钥（加密密钥）">
          <div className="row-between mb-8">
            <span className="fs-13">来源</span>
            <Tag>{hasEnvKey ? "环境变量" : "data/master.key"}</Tag>
          </div>
          <p className="fs-13 muted" style={{ margin: 0 }}>
            你的 API Key 使用 AES-256-GCM 加密后存储，主密钥仅存在于服务端。
            <strong className="strong"> 主密钥丢失将导致已保存的 Key 无法解密</strong>
            ，请妥善备份。
          </p>
          <div className="hint mt-8">
            生产环境推荐设置环境变量 <code className="mono">TOKENBOARD_MASTER_KEY</code>，
            用 <code className="mono">pnpm gen-key</code> 生成。
          </div>
        </Card>

        <Card title="数据与隐私">
          <ul className="fs-13 muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>所有数据保存在本地 SQLite 文件，不会上传到任何第三方。</li>
            <li>API Key 明文只在同步时于内存中短暂存在，不落日志、不回传前端。</li>
            <li>前端仅展示掩码后的 Key 前缀与后四位。</li>
          </ul>
        </Card>
      </div>

      <SettingsClient
        initial={{
          syncCron: String(settings[SETTING_KEYS.syncCron] ?? "0 */6 * * *"),
          syncEnabled: Boolean(settings[SETTING_KEYS.syncEnabled] ?? true),
          demoEnabled: demo,
        }}
      />
    </>
  );
}
