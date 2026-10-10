import { bootstrap } from "@/lib/bootstrap";

/**
 * Ensure the database is ready before rendering a page or handling a request.
 *
 * `instrumentation.ts` covers server start, but during `next dev` and in some
 * serverless cold paths we call this defensively — it is idempotent.
 */
export function ensureReady(): void {
  bootstrap();
}
