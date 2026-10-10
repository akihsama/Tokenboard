import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handle } from "@/lib/utils/api";
import { createProvider, listProviders } from "@/lib/providers/service";
import { syncProvider } from "@/lib/sync/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1, "请填写名称"),
  templateId: z.string().min(1, "请选择平台模板"),
  key: z.string().min(1, "请填写 API Key"),
  baseUrl: z.string().url().optional(),
  config: z.record(z.unknown()).optional(),
  credential: z.record(z.string()).optional(),
  syncNow: z.boolean().optional(),
});

export async function GET() {
  return handle(() => ({ providers: listProviders() }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return fail("参数校验失败", 422, parsed.error.flatten());
  }

  return handle(async () => {
    const row = await createProvider(parsed.data);
    let sync = null;
    if (parsed.data.syncNow !== false) {
      sync = await syncProvider(row, { trigger: "on_create" });
    }
    return { providerId: row.id, sync };
  });
}
