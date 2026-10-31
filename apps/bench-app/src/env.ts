import * as v from "valibot";

const Env = v.object({
  BENCH_ADAPTER: v.picklist(["express", "fastify", "node"]),
  PORT: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1), v.maxValue(65535)),
});

export const env = v.parse(Env, process.env);
