import type { Config } from "drizzle-kit";

const dataDir = process.env.DATA_DIR ?? "./data";

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: `${dataDir}/tokenboard.db`,
  },
} satisfies Config;
