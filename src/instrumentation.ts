import type { Instrumentation } from "next";

/**
 * Server-side error capture. Next.js calls onRequestError for every uncaught
 * server error (renders, route handlers, server actions, proxy) — one
 * structured line per error so Vercel's Observability page and log search can
 * actually group and alert on them, instead of failures scattering across
 * unstructured console noise. Swap-in point for a provider SDK (Sentry,
 * Rollbar) later: report from here.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      source: "onRequestError",
      message: error.message,
      digest: (error as { digest?: string }).digest,
      stack: error.stack?.split("\n").slice(0, 6).join("\n"),
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    }),
  );
};
