/**
 * Create the SQLite schema. Idempotent — safe to run repeatedly.
 *   pnpm db:migrate
 */
import { migrate } from "../lib/db/migrate";
import { DB_PATH } from "../lib/db/client";

migrate();
console.log(`[migrate] 数据库已就绪：${DB_PATH}`);
