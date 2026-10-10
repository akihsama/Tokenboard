import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, handle } from "@/lib/utils/api";
import { resolveTemplate } from "@/lib/providers/resolve";
import { runTemplate } from "@/lib/providers/engine";
import { nowSec, DAY } from "@/lib/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  key: z.string().min(1, "请填写用于测试的 API Key"),
  baseUrl: z.string().url().optional(),
  credential: z.record(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  query: z.record(z.union([z.string(), z.number(), z.array(z.string())])).optional(),
  windowDays: z.number().int().positive().max(90).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Try a template against a throwaway key without saving anything.
 * Useful when authoring a custom template in the UI.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("参数校验失败", 422, parsed.error.flatten());

  return handle(async () => {
    const template = (await resolveTemplate(id)).spec;
    const end = nowSec();
    const days = parsed.data.windowDays ?? 3;
    const result = await runTemplate(
      template,
      {
        key: parsed.data.key,
        credential: parsed.data.credential ?? {},
        headers: parsed.data.headers,
        query: parsed.data.query,
        window: { startUnix: end - days * DAY, endUnix: end },
        baseUrlOverride: parsed.data.baseUrl,
      },
      "1d",
    );
    return {
      pagesFetched: result.pagesFetched,
      httpStatus: result.lastHttpStatus,
      usageRecords: result.usage.length,
      balances: result.balances,
      sample: result.usage.slice(0, 5),
    };
  });
}
