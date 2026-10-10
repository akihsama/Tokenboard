import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { providerTemplates } from "@/lib/db/schema";
import { fail, handle } from "@/lib/utils/api";
import { resolveTemplate } from "@/lib/providers/resolve";
import { validateTemplate } from "@/lib/providers/schema";
import { nowSec } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const resolved = await resolveTemplate(id);
    return { template: resolved.spec, source: resolved.source };
  });
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  spec: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  baseTemplateId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("参数校验失败", 422, parsed.error.flatten());

  return handle(() => {
    const existing = db
      .select()
      .from(providerTemplates)
      .where(eq(providerTemplates.id, id))
      .get();
    if (!existing) throw new Error("未找到该模板（内置模板不可直接修改，请复制为自定义模板）");

    const merged = validateTemplate({
      ...(parsed.data.spec ?? JSON.parse(existing.spec)),
      id,
      name: parsed.data.name ?? existing.name,
    });
    db.update(providerTemplates)
      .set({
        name: merged.name,
        category: merged.category,
        spec: JSON.stringify(merged),
        baseTemplateId:
          parsed.data.baseTemplateId !== undefined
            ? parsed.data.baseTemplateId
            : existing.baseTemplateId,
        enabled:
          parsed.data.enabled !== undefined
            ? parsed.data.enabled
              ? 1
              : 0
            : existing.enabled,
        updatedAt: nowSec(),
      })
      .where(eq(providerTemplates.id, id))
      .run();
    return { template: merged };
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handle(() => {
    const existing = db
      .select()
      .from(providerTemplates)
      .where(eq(providerTemplates.id, id))
      .get();
    if (!existing) throw new Error("未找到该模板（内置模板不可删除）");
    db.delete(providerTemplates).where(eq(providerTemplates.id, id)).run();
    return { deleted: true };
  });
}
