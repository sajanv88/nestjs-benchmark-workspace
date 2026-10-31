import type { Adapter, RouteId, RunConfig } from "./config.js";

export type RoundResult = {
  /** Median of the per-second samples: the number this round contributes. */
  rps: number;
  /** autocannon's own mean, kept as a cross-check on the samples. */
  meanRps: number;
  samples: number[];
};

export type RouteResult = {
  adapter: Adapter;
  route: RouteId;
  /** Median across rounds. */
  medianRps: number;
  rounds: RoundResult[];
};

export type RunResult = {
  startedAt: string;
  finishedAt: string;
  config: RunConfig;
  nodeVersion: string | null;
  results: RouteResult[];
};

export type BenchEvent =
  | { type: "run-started"; config: RunConfig; routesPerRound: number }
  | { type: "adapter-started"; adapter: Adapter; round: number }
  | {
      type: "route-started";
      adapter: Adapter;
      route: RouteId;
      round: number;
      /** 1-based position within the round. */
      routeIndex: number;
    }
  | { type: "sample"; adapter: Adapter; route: RouteId; rps: number }
  | {
      type: "route-finished";
      adapter: Adapter;
      route: RouteId;
      round: number;
      /** Median of the rounds finished so far, so the live bars settle on the final number. */
      medianRps: number;
    }
  | { type: "run-finished"; result: RunResult }
  | { type: "error"; adapter: Adapter; route?: RouteId; round: number; message: string };

export type Emit = (event: BenchEvent) => void;
