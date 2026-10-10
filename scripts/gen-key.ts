/**
 * Generate a base64-encoded 32-byte master key.
 *   pnpm gen-key
 * Put the output into TOKENBOARD_MASTER_KEY in your .env, then keep it safe.
 */
import crypto from "node:crypto";

const key = crypto.randomBytes(32).toString("base64");
console.log("\n在 .env 中设置：\n");
console.log(`TOKENBOARD_MASTER_KEY=${key}\n`);
console.log(
  "⚠️  请妥善备份该密钥 — 丢失后已保存的 API Key 将无法解密。\n",
);
