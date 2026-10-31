import * as v from "valibot";

export const ADAPTERS = ["express", "fastify", "node"] as const;
export type Adapter = (typeof ADAPTERS)[number];

// Compose DNS names: the runner reaches the apps over the compose network, so the host and
// the Docker socket stay out of it.
export const ADAPTER_URLS = {
  express: "http://bench-express:3001",
  fastify: "http://bench-fastify:3002",
  node: "http://bench-node:3003",
} as const satisfies Record<Adapter, string>;

export const ROUTES = [
  { id: "GET /", method: "GET", path: "/" },
  { id: "GET /users/:id", method: "GET", path: "/users/42" },
  {
    id: "POST /echo",
    method: "POST",
    path: "/echo",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "nuvui", tags: ["charts", "tables"], nested: { count: 3 } }),
  },
] as const;
export type Route = (typeof ROUTES)[number];
export type RouteId = Route["id"];

const seconds = (max: number, fallback: number) =>
  v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(max)), fallback);

// Defaults mirror the shape of the PR's wrk run: 100 connections, 3s warm-up, 8s per route.
export const RunConfig = v.strictObject({
  connections: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000)), 100),
  warmupSeconds: seconds(30, 3),
  measureSeconds: seconds(60, 8),
  rounds: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9)), 3),
});
export type RunConfig = v.InferOutput<typeof RunConfig>;
