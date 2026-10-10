/**
 * Next.js instrumentation hook — runs once when the server starts.
 * See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrap } = await import("@/lib/bootstrap");
    bootstrap();
  }
}
