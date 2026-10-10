<div align="center">

# TokenBoard

**开源的大模型 API Token 用量与成本看板**

聚合 OpenAI、Anthropic Claude、DeepSeek、OpenRouter 等平台的用量，
每个 Key 单独统计，也能看所有 Key 的汇总。非主流平台用模板自己适配。

[![CI](https://github.com/USERNAME/tokenboard/actions/workflows/ci.yml/badge.svg)](https://github.com/USERNAME/tokenboard/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)

</div>

---

## 为什么需要它

大模型 API 的用量分散在各个平台后台：OpenAI 一个页面、Claude 一个页面、DeepSeek 又一个页面。
想看"这个月一共烧了多少钱""哪个 Key 最费"就得来回切换登录。

**TokenBoard 把它们的用量拉到一起**，用一个本地部署的看板统一展示。你的 API Key 只存在你自己的机器上，加密保存，不上传任何第三方。

## 功能

- **多平台聚合**：内置 OpenAI、Anthropic Claude、DeepSeek、OpenRouter 模板，外加两个通用模板。
- **单 Key + 总量**：每个 Key 独立看用量、成本、趋势、余额；首页看全部 Key 的汇总。
- **按平台 Key 拆分**：在支持按 API Key 分组的平台（OpenAI / Anthropic）上，能拆出每个平台侧 Key 的用量。
- **自定义模板适配非主流平台**：用声明式 JSON 定义请求方式与字段映射，改参数就能适配，**无需改代码**。
- **余额监控**：DeepSeek、OpenRouter 等返回余额的平台，会记录余额快照并绘制变化曲线。
- **两种界面**：桌面网站版 + H5 移动网页版（可后续套壳成小程序）。
- **青绿双主题**：日间（白色内容框）/ 夜间（黑色内容框）一键切换，可跟随系统，选择本地持久化且无闪烁。
- **演示模式**：没配真实 Key 也能一键生成模拟数据，预览完整界面。
- **后台定时同步**：自托管下图省事，也可手动触发。
- **导入导出**：配置一键备份 / 迁移。

## 快速开始

### 方式一：本地运行

```bash
git clone https://github.com/USERNAME/tokenboard.git
cd tokenboard
pnpm install

# 生成主密钥（用于加密你的 API Key），把输出写进 .env
pnpm gen-key
cp .env.example .env   # 然后填入上面生成的 TOKENBOARD_MASTER_KEY

pnpm dev               # 打开 http://localhost:3000
```

想先看看界面长什么样？在设置页打开「演示模式」，或直接：

```bash
pnpm seed:demo
```

### 方式二：Docker（推荐生产使用）

```bash
# 可选：设置主密钥（不设则首次启动自动生成在 data/master.key）
export TOKENBOARD_MASTER_KEY=$(openssl rand -base64 32)

cd docker
docker compose up -d
```

打开 `http://localhost:3000`。数据持久化在 `docker/data` 目录。

## 支持的平台

| 平台 | 模板 ID | 类型 | 按 Key 拆分 | 需要的凭据 |
|---|---|---|---|---|
| OpenAI | `openai.admin` | 用量 + 费用 | ✅ | **Admin** API Key（`sk-admin-...`） |
| Anthropic Claude | `anthropic.admin` | 用量 + 费用 | ✅ | **Admin** Key（`sk-ant-admin...`） |
| DeepSeek | `deepseek.balance` | 余额 | — | 普通 API Key |
| OpenRouter | `openrouter.key` | 余额 / 额度 | ✅ | 普通 API Key |
| 通用余额 | `generic.balance` | 余额 | — | 自定义 |
| 通用用量 | `generic.usage` | 用量 | 自定义 | 自定义 |

> **注意**：OpenAI 和 Anthropic 的用量接口需要**组织管理员**创建的 Admin Key。
> 普通项目 Key 无法访问用量数据，这是平台方的限制。

## 适配任意平台（核心功能）

TokenBoard 的核心是一个**声明式模板引擎**。一个模板就是一段 JSON，描述：

1. 怎么鉴权（`auth`）
2. 请求哪个接口、怎么分页（`endpoints`）
3. 怎么把返回的 JSON 映射成标准字段（`mapping`）

新增平台**不需要改任何代码**。在「平台模板」页点「新建自定义模板」，粘贴 JSON 即可。

### 模板结构示例

以 DeepSeek 余额接口为例：

```jsonc
{
  "id": "deepseek.balance",
  "name": "DeepSeek",
  "category": "balance",                        // balance | usage | cost
  "auth": {
    "type": "bearer",                           // bearer | header | query | none
    "valueTemplate": "Bearer {{key}}"           // {{key}} 会被替换成你的 Key
  },
  "endpoints": [
    {
      "id": "balance",
      "method": "GET",
      "baseUrl": "https://api.deepseek.com",
      "path": "/user/balance",
      "pagination": { "type": "none" },         // none | cursor | page | time
      "as": "balance"
    }
  ],
  "mapping": {
    "balance": {
      "amount": "$.balance_infos[0].total_balance",   // JSONPath 字段映射
      "currency": "$.balance_infos[0].currency",
      "coerce": { "amount": "number" }                // 字符串 "12.5" → 数字 12.5
    }
  }
}
```

### 用量类模板的映射

```jsonc
{
  "mapping": {
    "usage": {
      "recordsPath": "$.data[*].results[*]",     // 记录数组的 JSONPath
      "fields": {
        "bucketStart": "$.bucket_start_time",
        "inputTokens": "$.input_tokens",
        "outputTokens": "$.output_tokens",
        "requests": "$.num_model_requests",
        "model": "$.model",
        "apiKeyId": "$.api_key_id"               // 有它就支持按 Key 拆分
      },
      "timeUnit": "unix_seconds"                 // unix_seconds | unix_ms | iso8601
    }
  }
}
```

### 可用变量

请求里可以用 `{{...}}` 插值：

| 变量 | 含义 |
|---|---|
| `{{key}}` | 你的 API Key |
| `{{window.startUnix}}` / `{{window.endUnix}}` | 同步时间窗（Unix 秒）|
| `{{window.startIso}}` / `{{window.endIso}}` | 同步时间窗（ISO 8601）|
| `{{window.bucketWidth}}` | 分桶粒度（`1m`/`1h`/`1d`）|
| `{{credential.xxx}}` | 添加 Key 时填写的额外凭据（如组织 ID）|

### 通用模板快速改造

很多平台的余额接口长这样：`GET {baseUrl}/user/balance`。
直接复制 `generic.balance`，改两处即可：

- `endpoints[0].baseUrl` → 目标平台地址
- `mapping.balance.amount` 等 → 改成对应的 JSONPath

保存前会做 schema 校验，还能用「测试」按钮填一个真实 Key 试跑一次。

## 部署

### Docker（推荐）

见上方「快速开始 → 方式二」。适合长期运行、需要定时同步的场景。

### Vercel

可以部署，但有两个注意点：

1. **SQLite 无持久化**：Vercel 是无状态 Serverless，本地文件会在冷启动后丢失。
   生产建议用 Docker 自托管；如需在 Vercel 长期使用，可把数据层换成 Turso/libSQL。
2. **定时同步**：Vercel 没有常驻进程，`node-cron` 不生效。
   请在 Vercel 项目里配置 Cron Job，定时 `POST /api/sync`。

## 安全说明

- **加密**：API Key 使用 **AES-256-GCM** 加密后存入 SQLite，每条凭据独立随机 IV，
  并以 provider id 作为 AAD，防止密文被换绑。
- **主密钥**：来自环境变量 `TOKENBOARD_MASTER_KEY`，或本地 `data/master.key`（权限 600）。
  **主密钥丢失 = 已保存的 Key 无法解密**，请务必备份。
- **明文生命周期**：API Key 明文只在同步时于服务端内存中短暂存在，
  **不写日志、不回传前端**。前端只显示掩码（如 `sk-...a1b2`）。
- **数据不出本机**：所有数据保存在你本地的 SQLite 文件，不上传任何第三方。

## 技术栈

- **框架**：[Next.js 15](https://nextjs.org)（App Router）+ React 19 + TypeScript
- **数据库**：SQLite（[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)）+ [Drizzle ORM](https://orm.drizzle.team)
- **字段映射**：[jsonpath-plus](https://github.com/JSONPath-Plus/JSONPath)
- **定时任务**：[node-cron](https://github.com/node-cron/node-cron)
- **校验**：[zod](https://zod.dev)
- **图表**：自绘 SVG（零图表库依赖）

## 项目结构

```
tokenboard/
├── app/                    # Next.js App Router
│   ├── (web)/              # 桌面版页面
│   ├── m/                  # H5 移动版页面
│   └── api/                # REST API 路由
├── lib/
│   ├── db/                 # SQLite + Drizzle 数据层
│   ├── crypto/             # AES-256-GCM 加解密
│   ├── providers/          # ★ 模板引擎核心
│   │   └── templates/      # 内置平台模板（JSON）
│   ├── sync/               # 同步调度与归一化
│   └── demo/               # 演示数据生成
└── components/             # UI 组件、主题系统与自绘图表
    ├── theme/              # ★ 主题 Provider 与切换器
    ├── charts/             # 零依赖 SVG 图表
    ├── ui/                 # 基础组件
    ├── web/                # 桌面版外壳
    └── mobile/             # H5 版外壳
```

## 主题

界面使用**青绿（teal，主色 `#14A085`）**作为强调色，并提供日 / 夜两套主题：

| 主题 | 内容框 | 背景 | 触发方式 |
|---|---|---|---|
| 日间 `light` | 白色 | 浅灰 `#F7F8F8` | 侧边栏「主题」→ 日间 |
| 夜间 `dark` | 黑色 `#111817` | 近黑 `#0A0F0E` | 侧边栏「主题」→ 夜间 |
| 跟随系统 `system` | 随系统 | 随系统 | 侧边栏「主题」→ 跟随系统 |

- 所有颜色都以 CSS 变量定义在 `app/globals.css` 的 `:root` / `[data-theme="dark"]` 中，切换只需改 `<html data-theme>`。
- 选择写入 `localStorage`（键名 `tokenboard-theme`）；`app/layout.tsx` 内联的引导脚本在**首屏绘制前**就应用主题，避免闪白。
- 自绘图表（`components/charts/*`）读取 `--chart-1…4`，主系列自动使用主题青绿。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET/POST` | `/api/keys` | 列出 / 新增 API Key |
| `GET/PATCH/DELETE` | `/api/keys/[id]` | 单个 Key 的读写删 |
| `POST` | `/api/keys/[id]/test` | 测试连通性 |
| `POST/GET` | `/api/sync` | 触发同步 / 查询同步状态 |
| `GET` | `/api/usage` | 用量明细 |
| `GET` | `/api/usage/summary` | 汇总（总量 + 各平台）|
| `GET` | `/api/usage/trend` | 趋势时间序列 |
| `GET` | `/api/usage/balances` | 余额 |
| `GET/POST` | `/api/templates` | 模板列表 / 新建 |
| `GET/PATCH/DELETE` | `/api/templates/[id]` | 单个模板 |
| `POST` | `/api/templates/[id]/test` | 试跑模板 |
| `GET` | `/api/logs` | 同步日志 |
| `GET/PATCH` | `/api/settings` | 设置 |
| `GET` / `POST` | `/api/export` / `/api/import` | 配置导入导出 |
| `POST` | `/api/demo` | 演示模式开关 |

## Roadmap

- [x] 桌面版 + H5 移动版
- [x] 模板引擎 + 6 个内置模板
- [x] 单 Key / 汇总用量与余额
- [x] 演示模式
- [x] Docker / CI
- [x] 青绿双主题（日 / 夜，可跟随系统）
- [ ] 主题色自定义（当前固定青绿，可扩展为可选配色）
- [ ] 小程序壳（复用 `/api/*`）
- [ ] 更多内置平台模板（欢迎 PR）
- [ ] 用量告警（超额 / 异常波动通知）

## 贡献

欢迎提交新的平台模板！如果你适配了某个平台，直接把 JSON 模板 PR 到 `lib/providers/templates/` 即可。

其他改进也欢迎 Issue / PR。提交前请确保 `pnpm typecheck` 和 `pnpm build` 通过。

## License

本项目以 [GNU General Public License v3.0](./LICENSE)（GPL-3.0）发布。

- ✅ **可付费售卖**：GPL 允许就软件的复制与分发收取费用。
- ✅ **可商用**：商业用途不受限制。
- ✅ **后续改动免费**：任何人获得本程序后，都有权免费获取其源代码与改动。
- ⚠️ **卖出后概不负责**：本程序按「现状」提供，**不提供任何担保**（详见 LICENSE 第 11、12 条），作者不对使用后果承担责任。
- 🔁 **衍生代码必须开源**：任何基于本项目的修改、衍生作品在分发时，必须以 GPL-3.0 同样开源（copyleft）。

> 你是版权所有者，可同时提供专有授权；但公开分发的版本须遵守 GPL-3.0。
>
> 完整条款见 [LICENSE](./LICENSE)。
