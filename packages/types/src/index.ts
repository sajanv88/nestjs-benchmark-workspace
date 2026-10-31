import * as v from "valibot";

// Emitted to dist rather than exported as source, because Node runs the runner's compiled
// output and can't load TypeScript from a dependency.

export const ADAPTERS = ["express", "fastify", "node"] as const;
export const Adapter = v.picklist(ADAPTERS);
export type Adapter = v.InferOutput<typeof Adapter>;

export const ROUTE_IDS = ["GET /", "GET /users/:id", "POST /echo"] as const;
export const RouteId = v.picklist(ROUTE_IDS);
export type RouteId = v.InferOutput<typeof RouteId>;

const whole = (min: number, max: number) =>
  v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));

// Defaults mirror the shape of the PR's wrk run: 100 connections, 3s warm-up, 8s per route.
export const RunConfig = v.strictObject({
  connections: v.optional(whole(1, 1000), 100),
  warmupSeconds: v.optional(whole(1, 30), 3),
  measureSeconds: v.optional(whole(1, 60), 8),
  rounds: v.optional(whole(1, 9), 3),
});
export type RunConfig = v.InferOutput<typeof RunConfig>;

const RoundResult = v.object({
  /** Median of the per-second samples: the number this round contributes. */
  rps: v.number(),
  /** autocannon's own mean, kept as a cross-check on the samples. */
  meanRps: v.number(),
  samples: v.array(v.number()),
});
export type RoundResult = v.InferOutput<typeof RoundResult>;

const RouteResult = v.object({
  adapter: Adapter,
  route: RouteId,
  /** Median across rounds. */
  medianRps: v.number(),
  rounds: v.array(RoundResult),
});
export type RouteResult = v.InferOutput<typeof RouteResult>;

/** What the apps reported about themselves, for the page's settings footer. */
const RunEnvironment = v.object({
  node: v.string(),
  cpus: v.nullable(v.number()),
  memoryBytes: v.nullable(v.number()),
});
export type RunEnvironment = v.InferOutput<typeof RunEnvironment>;

/** `partial`: reached the end, but at least one route or adapter failed. */
const RunStatus = v.picklist(["completed", "partial", "stopped"]);
export type RunStatus = v.InferOutput<typeof RunStatus>;

export const RunResult = v.object({
  status: RunStatus,
  startedAt: v.string(),
  finishedAt: v.string(),
  config: v.object({
    connections: v.number(),
    warmupSeconds: v.number(),
    measureSeconds: v.number(),
    rounds: v.number(),
  }),
  environment: v.nullable(RunEnvironment),
  results: v.array(RouteResult),
});
export type RunResult = v.InferOutput<typeof RunResult>;

export const BenchEvent = v.variant("type", [
  v.object({
    type: v.literal("run-started"),
    config: RunResult.entries.config,
    routesPerRound: v.number(),
  }),
  v.object({ type: v.literal("adapter-started"), adapter: Adapter, round: v.number() }),
  v.object({
    type: v.literal("route-started"),
    adapter: Adapter,
    route: RouteId,
    round: v.number(),
    /** 1-based position within the round. */
    routeIndex: v.number(),
  }),
  v.object({ type: v.literal("sample"), adapter: Adapter, route: RouteId, rps: v.number() }),
  v.object({
    type: v.literal("route-finished"),
    adapter: Adapter,
    route: RouteId,
    round: v.number(),
    /** Median of the rounds finished so far, so the live bars settle on the final number. */
    medianRps: v.number(),
  }),
  v.object({ type: v.literal("run-finished"), result: RunResult }),
  v.object({
    type: v.literal("error"),
    adapter: v.exactOptional(Adapter),
    route: v.exactOptional(RouteId),
    round: v.exactOptional(v.number()),
    message: v.string(),
  }),
]);
export type BenchEvent = v.InferOutput<typeof BenchEvent>;
