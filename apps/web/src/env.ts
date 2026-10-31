import "server-only";
import * as v from "valibot";

const ServerEnv = v.object({
  RUNNER_URL: v.optional(v.pipe(v.string(), v.url()), "http://127.0.0.1:4000"),
  RESULTS_PATH: v.optional(v.string()),
});

export type ServerEnv = v.InferOutput<typeof ServerEnv>;

let parsed: ServerEnv | undefined;

export function env(): ServerEnv {
  parsed ??= v.parse(ServerEnv, process.env);
  return parsed;
}
