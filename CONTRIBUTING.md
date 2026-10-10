# 贡献指南

感谢你有兴趣为 TokenBoard 做贡献！

## 开发环境

```bash
pnpm install
pnpm gen-key          # 生成主密钥，写入 .env
pnpm dev              # http://localhost:3000
```

提交前请确保以下命令通过：

```bash
pnpm typecheck        # 类型检查
pnpm build            # 生产构建
```

## 提交新的平台模板 ⭐

这是最有价值的贡献方式。如果你适配了某个平台，直接把模板 PR 到
`lib/providers/templates/` 即可，不需要改任何引擎代码。

要求：

1. 文件名格式：`<平台>.<类型>.json`，例如 `moonshot.balance.json`。
2. `id` 与文件名去掉 `.json` 后一致。
3. 必须通过保存时的 zod 校验（可用 UI 的「新建自定义模板」先验证）。
4. 建议填写 `match`（keyPrefix / baseUrlHint）以便自动识别。
5. 在模板里用 `docs` 字段附上该平台官方接口文档地址。
6. 在 PR 描述里说明：接口地址、鉴权方式、响应结构，以及是否支持按 Key 拆分。

## 代码规范

- TypeScript strict 模式，不使用 `any`（必要时用 `unknown` + 收窄）。
- 保持现有目录结构与命名约定。
- 新增 UI 组件请沿用 `app/globals.css` 的黑白设计变量，不要引入彩色。
- 涉及数据库变更请同步更新 `lib/db/schema.ts` 与 `lib/db/migrate.ts`。

## 提交 PR

- 一个 PR 聚焦一件事，避免混杂无关改动。
- 描述清楚「改了什么」和「为什么」。
- 如果是 UI 改动，附上截图。

## 报告问题

请使用 Issue 模板，并尽量提供：

- 复现步骤
- 期望行为 vs 实际行为
- 平台 / 模板 ID
- 相关日志（**请先脱敏，不要贴出真实 API Key**）
