import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handle } from "@/lib/utils/api";
import {
  deleteProvider,
  getProvider,
  updateProvider,
} from "@/lib/providers/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  baseUrl: z.string().url().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  key: z.string().min(1).optional(),
  credential: z.record(z.string()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handle(() => {
    const provider = getProvider(id);
    if (!provider) throw new Error("未找到该 Key");
    return { provider };
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return fail("参数校验失败", 422, parsed.error.flatten());
  }
  return handle(() => {
    const updated = updateProvider(id, parsed.data);
    if (!updated) throw new Error("未找到该 Key");
    return { provider: getProvider(id) };
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handle(() => {
    const removed = deleteProvider(id);
    if (!removed) throw new Error("未找到该 Key");
    return { deleted: true };
  });
}
