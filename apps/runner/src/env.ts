import * as v from "valibot";

const Env = v.object({
  // Loopback by default. Compose sets 0.0.0.0, because a process bound to loopback inside a
  // container can't be reached through a published port; compose publishes on 127.0.0.1.
  HOST: v.optional(v.string(), "127.0.0.1"),
  PORT: v.optional(
    v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1), v.maxValue(65535)),
    "4000",
  ),
  RESULTS_PATH: v.optional(v.string(), "/data/latest.json"),
  ALLOWED_ORIGINS: v.optional(
    v.pipe(
      v.string(),
      v.transform((value) => value.split(",").map((origin) => origin.trim())),
    ),
    "http://localhost:3000,http://127.0.0.1:3000",
  ),
});

export const env = v.parse(Env, process.env);
