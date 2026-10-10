import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/lib/db/client";
import {
  balanceSnapshots,
  providers,
  syncLogs,
  usageRecords,
  type ProviderRow,
} from "@/lib/db/schema";
import { maskSecret, seal } from "@/lib/crypto/secretbox";
import { resolveTemplate } from "@/lib/providers/resolve";
import { nowSec } from "@/lib/utils/time";

export interface CreateProviderInput {
  name: string;
  templateId: string;
  key: string;
  baseUrl?: string;
  config?: Record<string, unknown>;
  credential?: Record<string, string>;
  syncNow?: boolean;
}

export interface PublicProvider {
  id: string;
  name: string;
  templateId: string;
  baseUrl: string | null;
  credentialMeta: Record<string, unknown>;
  config: Record<string, unknown>;
  granularity: string;
  status: string;
  lastError: string | null;
  lastSyncedAt: number | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

function safeJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Strip secrets before sending a provider to the client. */
export function toPublic(row: ProviderRow): PublicProvider {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    baseUrl: row.baseUrl,
    credentialMeta: safeJson(row.credentialMeta),
    config: safeJson(row.config),
    granularity: row.granularity,
    status: row.status,
    lastError: row.lastError,
    lastSyncedAt: row.lastSyncedAt,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createProvider(
  input: CreateProviderInput,
): Promise<ProviderRow> {
  // Validate the template exists before we persist anything.
  await resolveTemplate(input.templateId);

  const id = nanoid(16);
  const { prefix, last4 } = maskSecret(input.key);
  const sealed = seal(input.key, id);
  const now = nowSec();

  db.insert(providers)
    .values({
      id,
      name: input.name.trim() || input.templateId,
      templateId: input.templateId,
      baseUrl: input.baseUrl ?? null,
      credentialEnc: sealed.enc,
      credentialIv: sealed.iv,
      credentialTag: sealed.tag,
      credentialMeta: JSON.stringify({
        keyPrefix: prefix,
        keyLast4: last4,
        ...(input.credential ?? {}),
      }),
      config: JSON.stringify(input.config ?? {}),
      granularity: "per_key",
      status: "unknown",
      enabled: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return db.select().from(providers).where(eq(providers.id, id)).get()!;
}

export function updateProvider(
  id: string,
  patch: {
    name?: string;
    baseUrl?: string | null;
    config?: Record<string, unknown>;
    enabled?: boolean;
    key?: string;
    credential?: Record<string, string>;
  },
): ProviderRow | undefined {
  const existing = db.select().from(providers).where(eq(providers.id, id)).get();
  if (!existing) return undefined;

  const update: Partial<typeof providers.$inferInsert> = { updatedAt: nowSec() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.baseUrl !== undefined) update.baseUrl = patch.baseUrl;
  if (patch.config !== undefined) update.config = JSON.stringify(patch.config);
  if (patch.enabled !== undefined) update.enabled = patch.enabled ? 1 : 0;

  if (patch.key) {
    const sealed = seal(patch.key, id);
    const { prefix, last4 } = maskSecret(patch.key);
    update.credentialEnc = sealed.enc;
    update.credentialIv = sealed.iv;
    update.credentialTag = sealed.tag;
    const meta = safeJson(existing.credentialMeta);
    update.credentialMeta = JSON.stringify({
      ...meta,
      keyPrefix: prefix,
      keyLast4: last4,
    });
  } else if (patch.credential) {
    const meta = safeJson(existing.credentialMeta);
    update.credentialMeta = JSON.stringify({ ...meta, ...patch.credential });
  }

  db.update(providers).set(update).where(eq(providers.id, id)).run();
  return db.select().from(providers).where(eq(providers.id, id)).get();
}

export function deleteProvider(id: string): boolean {
  const existing = db.select().from(providers).where(eq(providers.id, id)).get();
  if (!existing) return false;
  db.delete(usageRecords).where(eq(usageRecords.providerId, id)).run();
  db.delete(balanceSnapshots).where(eq(balanceSnapshots.providerId, id)).run();
  db.delete(syncLogs).where(eq(syncLogs.providerId, id)).run();
  db.delete(providers).where(eq(providers.id, id)).run();
  return true;
}

export function listProviders(): PublicProvider[] {
  return db
    .select()
    .from(providers)
    .orderBy(providers.createdAt)
    .all()
    .map(toPublic);
}

export function getProvider(id: string): PublicProvider | undefined {
  const row = db.select().from(providers).where(eq(providers.id, id)).get();
  return row ? toPublic(row) : undefined;
}
