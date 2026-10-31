import { parseArgs } from "node:util";
import * as v from "valibot";
import { runBenchmark } from "./benchmark.js";
import { RunConfig } from "./config.js";
import type { BenchEvent } from "./events.js";

// Results go to stdout as JSON, progress to stderr, so stdout can be redirected to a file.
function progress(event: BenchEvent): void {
  switch (event.type) {
    case "route-started":
      process.stderr.write(
        `round ${event.round} [${event.routeIndex}] ${event.adapter} ${event.route}\n`,
      );
      return;
    case "route-finished":
      process.stderr.write(`  median so far: ${event.medianRps} req/s\n`);
      return;
    case "error":
      process.stderr.write(`  ERROR ${event.adapter}: ${event.message}\n`);
      return;
    case "run-started":
    case "adapter-started":
    case "sample":
    case "run-finished":
      return;
  }
}

const { values } = parseArgs({
  options: {
    connections: { type: "string" },
    warmup: { type: "string" },
    measure: { type: "string" },
    rounds: { type: "string" },
  },
});

const input = Object.fromEntries(
  Object.entries({
    connections: values.connections,
    warmupSeconds: values.warmup,
    measureSeconds: values.measure,
    rounds: values.rounds,
  }).flatMap(([key, value]) => (value === undefined ? [] : [[key, Number(value)]])),
);

const config = v.safeParse(RunConfig, input);
if (!config.success) {
  process.stderr.write(`Invalid options: ${v.summarize(config.issues)}\n`);
  process.exit(1);
}

const result = await runBenchmark(config.output, progress);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
