import type { Adapter, BenchEvent, RouteId, RunConfig, RunResult, RunStatus } from "@repo/types";
import { ADAPTER_LABELS, type Measurements, measurementKey } from "./benchmark-data";

export type Connection = "connecting" | "online" | "offline";

export type RunState =
  | { status: "idle" }
  | {
      status: "running";
      config: RunConfig;
      routesPerRound: number;
      round: number;
      routeIndex: number;
      adapter: Adapter | null;
      route: RouteId | null;
      measurements: Measurements;
      stopping: boolean;
    }
  | { status: "finished"; outcome: RunStatus };

export type BenchmarkState = {
  connection: Connection;
  run: RunState;
  /** What the chart shows between runs: the saved file, then each run that reached the end. */
  result: RunResult | null;
  errors: readonly string[];
};

export type BenchmarkAction =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "event"; event: BenchEvent }
  | { type: "stopping" }
  | { type: "failed"; message: string };

function reduceEvent(state: BenchmarkState, event: BenchEvent): BenchmarkState {
  const { run } = state;

  if (event.type === "run-started") {
    const { config, routesPerRound } = event;
    return {
      ...state,
      errors: [],
      run: {
        status: "running",
        config,
        routesPerRound,
        round: 1,
        routeIndex: 0,
        adapter: null,
        route: null,
        measurements: {},
        stopping: false,
      },
    };
  }

  if (event.type === "error") {
    const where = [event.adapter && ADAPTER_LABELS[event.adapter], event.route].filter(Boolean);
    const prefix = where.length > 0 ? `${where.join(", ")}: ` : "";
    return { ...state, errors: [...state.errors, `${prefix}${event.message}.`] };
  }

  if (event.type === "run-finished") {
    const { result } = event;
    return {
      ...state,
      run: { status: "finished", outcome: result.status },
      // A stopped run proves nothing, so the last run that got to the end stays on screen.
      result: result.status === "stopped" ? state.result : result,
    };
  }

  if (run.status !== "running") return state;

  switch (event.type) {
    case "adapter-started":
      return { ...state, run: { ...run, adapter: event.adapter, round: event.round } };
    case "route-started":
      return {
        ...state,
        run: {
          ...run,
          adapter: event.adapter,
          route: event.route,
          round: event.round,
          routeIndex: event.routeIndex,
        },
      };
    case "sample": {
      const key = measurementKey(event.adapter, event.route);
      return {
        ...state,
        run: { ...run, measurements: { ...run.measurements, [key]: event.rps } },
      };
    }
    case "route-finished": {
      const key = measurementKey(event.adapter, event.route);
      return {
        ...state,
        run: { ...run, measurements: { ...run.measurements, [key]: event.medianRps } },
      };
    }
  }
}

export function benchmarkReducer(state: BenchmarkState, action: BenchmarkAction): BenchmarkState {
  switch (action.type) {
    case "connected":
      return { ...state, connection: "online" };
    case "disconnected":
      // The run-finished event will never come, so a run in progress has to end here.
      return state.run.status === "running"
        ? {
            ...state,
            connection: "offline",
            run: { status: "finished", outcome: "stopped" },
            errors: [...state.errors, "Lost the runner during the run."],
          }
        : { ...state, connection: "offline" };
    case "event":
      return reduceEvent(state, action.event);
    case "stopping":
      return state.run.status === "running"
        ? { ...state, run: { ...state.run, stopping: true } }
        : state;
    case "failed":
      return { ...state, errors: [...state.errors, action.message] };
  }
}

export function initialBenchmarkState(result: RunResult | null): BenchmarkState {
  return { connection: "connecting", run: { status: "idle" }, result, errors: [] };
}
