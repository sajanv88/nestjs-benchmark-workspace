import { ADAPTERS, type Adapter, ROUTES, type Route, type RunConfig } from "./config.js";
import type { Emit, RoundResult, RouteResult, RunResult } from "./events.js";
import { waitForHealth } from "./health.js";
import { runLoad } from "./load.js";

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
): Promise<RoundResult | null> {
  const { connections } = config;
  const fail = (message: string): null => {
    emit({ type: "error", adapter, route: route.id, round, message });
    return null;
  };

  const warmup = await runLoad({ adapter, route, connections, seconds: config.warmupSeconds });
  if (!warmup.ok) return fail(`warm-up failed: ${warmup.error}`);

  const run = await runLoad({
    adapter,
    route,
    connections,
    seconds: config.measureSeconds,
    onSample: (rps) => emit({ type: "sample", adapter, route: route.id, rps }),
  });
  if (!run.ok) return fail(`measured run failed: ${run.error}`);

  return { rps: median(run.samples), meanRps: run.meanRps, samples: run.samples };
}

/**
 * Runs every adapter and route in sequence, never in parallel, for each round. A failure is
 * reported through `emit` and skips that route or adapter, so one dead app can't end a run.
 */
export async function runBenchmark(config: RunConfig, emit: Emit): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const results: RouteResult[] = ADAPTERS.flatMap((adapter) =>
    ROUTES.map((route) => ({ adapter, route: route.id, medianRps: 0, rounds: [] })),
  );
  let nodeVersion: string | null = null;

  emit({ type: "run-started", config, routesPerRound: ADAPTERS.length * ROUTES.length });

  for (let round = 1; round <= config.rounds; round += 1) {
    let routeIndex = 0;

    for (const adapter of ADAPTERS) {
      emit({ type: "adapter-started", adapter, round });

      const health = await waitForHealth(adapter);
      if (!health.ok) {
        emit({ type: "error", adapter, round, message: `not healthy: ${health.error}` });
        routeIndex += ROUTES.length;
        continue;
      }
      nodeVersion = health.node;

      for (const route of ROUTES) {
        routeIndex += 1;
        emit({ type: "route-started", adapter, route: route.id, round, routeIndex });

        const outcome = await measureRoute({ adapter, route, round }, config, emit);
        const entry = results.find((r) => r.adapter === adapter && r.route === route.id);
        if (!outcome || !entry) continue;

        entry.rounds.push(outcome);
        entry.medianRps = median(entry.rounds.map((r) => r.rps));
        emit({
          type: "route-finished",
          adapter,
          route: route.id,
          round,
          medianRps: entry.medianRps,
        });
      }
    }
  }

  const result: RunResult = {
    startedAt,
    finishedAt: new Date().toISOString(),
    config,
    nodeVersion,
    results: results.filter((r) => r.rounds.length > 0),
  };
  emit({ type: "run-finished", result });
  return result;
}
