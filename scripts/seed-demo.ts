/**
 * Seed the demo dataset (same as POST /api/demo { enabled: true }).
 *   pnpm seed:demo
 */
import { migrate } from "../lib/db/migrate";
import { ensureDefaultSettings } from "../lib/utils/settings";
import { seedDemo } from "../lib/demo/seed";

migrate();
ensureDefaultSettings();
const result = seedDemo();
console.log(
  `[seed] 已生成演示数据：${result.providers} 个平台，${result.records} 条用量记录`,
);
