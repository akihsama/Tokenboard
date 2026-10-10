import { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { providerTemplates } from "@/lib/db/schema";
import { fail, handle } from "@/lib/utils/api";
import { listTemplates } from "@/lib/providers/resolve";
import { validateTemplate } from "@/lib/providers/schema";
import { nowSec } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseTemplateId: z.string().nullable().optional(),
  spec: z.record(z.unknown()),
  enabled: z.boolean().optional(),
});

export async function GET() {
  return handle(() => ({ templates: listTemplates() }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("参数校验失败", 422, parsed.error.flatten());

  return handle(() => {
    // Validate the spec before persisting (JSONPath syntax, required fields).
    const spec = validateTemplate({
      ...parsed.data.spec,
      id: parsed.data.id,
      name: parsed.data.name,
    });
    const now = nowSec();
    db.insert(providerTemplates)
      .values({
        id: parsed.data.id,
        name: parsed.data.name,
        category: spec.category,
        source: "user",
        baseTemplateId: parsed.data.baseTemplateId ?? null,
        spec: JSON.stringify(spec),
        enabled: parsed.data.enabled === false ? 0 : 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: providerTemplates.id,
        set: {
          name: parsed.data.name,
          category: spec.category,
          baseTemplateId: parsed.data.baseTemplateId ?? null,
          spec: JSON.stringify(spec),
          enabled: parsed.data.enabled === false ? 0 : 1,
          updatedAt: now,
        },
      })
      .run();
    return { template: spec };
  });
}
