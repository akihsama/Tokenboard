import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Resolve the master key (32 bytes) used to encrypt user API keys.
 *
 * Priority:
 *   1. TOKENBOARD_MASTER_KEY env var (base64) — recommended for production.
 *   2. data/master.key file — auto-generated on first boot (Docker volume).
 *
 * We deliberately do NOT derive the key from a passphrase: a weak password is
 * a false sense of security. Losing the master key means credentials are
 * unrecoverable, which is documented in the README.
 */
function resolveMasterKey(): Buffer {
  const fromEnv = process.env.TOKENBOARD_MASTER_KEY?.trim();
  if (fromEnv) {
    let buf: Buffer;
    try {
      buf = Buffer.from(fromEnv, "base64");
    } catch {
      throw new Error("TOKENBOARD_MASTER_KEY 不是合法的 base64");
    }
    if (buf.length !== KEY_BYTES) {
      throw new Error(
        `TOKENBOARD_MASTER_KEY 长度应为 32 字节（当前 ${buf.length} 字节）`,
      );
    }
    return buf;
  }

  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const keyPath = path.join(dataDir, "master.key");
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, "utf8").trim();
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== KEY_BYTES) {
      throw new Error("data/master.key 已损坏（长度不为 32 字节）");
    }
    return buf;
  }

  const generated = crypto.randomBytes(KEY_BYTES);
  fs.writeFileSync(keyPath, generated.toString("base64"), { mode: 0o600 });
  console.warn(
    "[crypto] 已自动生成主密钥 data/master.key。生产环境请改用 TOKENBOARD_MASTER_KEY 环境变量并妥善备份。",
  );
  return generated;
}

let cached: Buffer | null = null;

export function masterKey(): Buffer {
  if (!cached) cached = resolveMasterKey();
  return cached;
}

/** Stable fingerprint so we can detect a master-key change at boot. */
export function masterKeyFingerprint(): string {
  return crypto
    .createHash("sha256")
    .update(masterKey())
    .digest("hex")
    .slice(0, 16);
}

export interface SealedSecret {
  enc: string; // base64 ciphertext
  iv: string; // base64 nonce
  tag: string; // base64 auth tag
}

/**
 * Encrypt a secret with AES-256-GCM. `aad` (additional authenticated data)
 * binds the ciphertext to its owner — we pass the provider id so a ciphertext
 * cannot be swapped onto a different provider row.
 */
export function seal(plaintext: string, aad: string): SealedSecret {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, masterKey(), iv, {
    authTagLength: 16,
  });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    enc: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function open(sealed: SealedSecret, aad: string): string {
  const decipher = crypto.createDecipheriv(
    ALGO,
    masterKey(),
    Buffer.from(sealed.iv, "base64"),
    { authTagLength: 16 },
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(sealed.enc, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** Mask a secret for display: "sk-...a1b2". */
export function maskSecret(secret: string): { prefix: string; last4: string } {
  const last4 = secret.slice(-4);
  const prefix = secret.slice(0, Math.min(6, secret.length - 4));
  return { prefix, last4 };
}

/** Generate a fresh base64 master key (used by scripts/gen-key.ts). */
export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_BYTES).toString("base64");
}
