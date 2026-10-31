import type { Adapter, RouteId } from "@repo/types";

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
] as const satisfies readonly {
  id: RouteId;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}[];
export type Route = (typeof ROUTES)[number];
