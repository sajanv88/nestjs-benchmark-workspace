import {
  ADAPTERS,
  type Adapter,
  type BenchEvent,
  type RoundResult,
  type RouteResult,
  type RunConfig,
  type RunEnvironment,
  type RunResult,
} from "@repo/types";
import { ROUTES, type Route } from "./config.js";
import { waitForHealth } from "./health.js";
import { runLoad } from "./load.js";

export type Emit = (event: BenchEvent) => void;

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  const lower = sorted[middle - 1] ?? upper;
  return Math.round(sorted.length % 2 === 0 ? (lower + upper) / 2 : upper);
}

type RouteRun = { adapter: Adapter; route: Route; round: number };

async function measureRoute(
  { adapter, route, round }: RouteRun,
  config: RunConfig,
  emit: Emit,
  signal: AbortSignal,
): Promise<RoundResult | null> {
  const { connections } = config;
  const fail = (message: string): null => {
    emit({ type: "error", adapter, route: route.id, round, message });
    return null;
  };

  const warmup = await runLoad({
    adapter,
    route,
    connections,
    seconds: config.warmupSeconds,
    signal,
  });
  if (signal.aborted) return null;
  if (!warmup.ok) return fail(`warm-up failed: ${warmup.error}`);

  const run = await runLoad({
    adapter,
    route,
    connections,
    seconds: config.measureSeconds,
    signal,
    onSample: (rps) => emit({ type: "sample", adapter, route: route.id, rps }),
  });
  if (signal.aborted) return null;
  if (!run.ok) return fail(`measured run failed: ${run.error}`);

  return { rps: median(run.samples), meanRps: run.meanRps, samples: run.samples };
}

/**
 * Runs every adapter and route in sequence, never in parallel, for each round. A failure is
 * reported through `emit` and skips that route or adapter, so one dead app can't end a run.
 * Aborting `signal` ends the current load within a second; a cut-short route is not counted.
 */
export async function runBenchmark(
  config: RunConfig,
  emit: Emit,
  signal: AbortSignal,
): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const results: RouteResult[] = ADAPTERS.flatMap((adapter) =>
    ROUTES.map((route) => ({ adapter, route: route.id, medianRps: 0, rounds: [] })),
  );
  let environment: RunEnvironment | null = null;
  let failed = false;
  const report: Emit = (event) => {
    if (event.type === "error") failed = true;
    emit(event);
  };

  report({ type: "run-started", config, routesPerRound: ADAPTERS.length * ROUTES.length });

  for (let round = 1; round <= config.rounds && !signal.aborted; round += 1) {
    for (const [position, adapter] of ADAPTERS.entries()) {
      if (signal.aborted) break;
      report({ type: "adapter-started", adapter, round });

      const health = await waitForHealth(adapter, signal);
      if (signal.aborted) break;
      if (!health.ok) {
        report({ type: "error", adapter, round, message: `not healthy: ${health.error}` });
        continue;
      }
      environment = health.environment;

      for (const [offset, route] of ROUTES.entries()) {
        if (signal.aborted) break;
        const routeIndex = position * ROUTES.length + offset + 1;
        report({ type: "route-started", adapter, route: route.id, round, routeIndex });

        const outcome = await measureRoute({ adapter, route, round }, config, report, signal);
        const entry = results.find((r) => r.adapter === adapter && r.route === route.id);
        if (!outcome || !entry) continue;

        entry.rounds.push(outcome);
        entry.medianRps = median(entry.rounds.map((r) => r.rps));
        report({
          type: "route-finished",
          adapter,
          route: route.id,
          round,
          medianRps: entry.medianRps,
        });
      }
    }
  }

  const stopped = signal.aborted;
  const result: RunResult = {
    status: stopped ? "stopped" : failed ? "partial" : "completed",
    startedAt,
    finishedAt: new Date().toISOString(),
    config,
    environment,
    results: results.filter((r) => r.rounds.length > 0),
  };
  report({ type: "run-finished", result });
  return result;
}
