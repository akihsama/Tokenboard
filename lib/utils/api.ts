import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
  details?: unknown;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  error: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json({ ok: false, error, details }, { status });
}

/** Wrap a route handler body so thrown errors become structured 500s. */
export async function handle<T>(
  fn: () => Promise<T> | T,
): Promise<NextResponse<ApiSuccess<T>> | NextResponse<ApiFailure>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return fail("参数校验失败", 422, err.flatten());
    }
    const message = err instanceof Error ? err.message : "未知错误";
    // Avoid leaking stack traces to the client.
    console.error("[api]", message);
    return fail(message, 500);
  }
}
