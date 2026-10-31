import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  // One JSON line per unhandled error. The digest matches what error.tsx shows the user.
  console.error(
    JSON.stringify({
      level: "error",
      msg: error instanceof Error ? error.message : String(error),
      digest: (error as { digest?: string }).digest,
      method: request.method,
      path: request.path,
      routeType: context.routeType,
      routePath: context.routePath,
    }),
  );
};
