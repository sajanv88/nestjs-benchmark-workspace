import { ADAPTERS, type Adapter, ROUTE_IDS, type RouteId, type RunResult } from "@repo/types";

export const ADAPTER_LABELS = {
  express: "Nest + Express",
  fastify: "Nest + Fastify",
  node: "Nest + Node",
} as const satisfies Record<Adapter, string>;

export type RouteFilter = "all" | RouteId;
export type Unit = "rps" | "relative";

/** Requests per second by adapter and route. A pair that hasn't been measured is absent. */
export type Measurements = Partial<Record<`${Adapter} ${RouteId}`, number>>;

export const measurementKey = (adapter: Adapter, route: RouteId) => `${adapter} ${route}` as const;

export function measurementsOf(result: RunResult | null): Measurements {
  const measurements: Measurements = {};
  for (const { adapter, route, medianRps } of result?.results ?? []) {
    measurements[measurementKey(adapter, route)] = medianRps;
  }
  return measurements;
}

export type ChartRow = { route: RouteId } & Record<Adapter, number | null>;

const routesOf = (filter: RouteFilter): readonly RouteId[] =>
  filter === "all" ? ROUTE_IDS : [filter];

/** One row per route, in requests per second or as a multiple of Nest + Express. */
export function chartRows(measurements: Measurements, filter: RouteFilter, unit: Unit): ChartRow[] {
  return routesOf(filter).map((route) => {
    const express = measurements[measurementKey("express", route)];
    const shownValue = (adapter: Adapter): number | null => {
      const rps = measurements[measurementKey(adapter, route)];
      if (rps === undefined) return null;
      if (unit === "rps") return rps;
      return express ? rps / express : null;
    };
    return {
      route,
      express: shownValue("express"),
      fastify: shownValue("fastify"),
      node: shownValue("node"),
    };
  });
}

/** Where the value axis ends. Taken from every number on screen, so bars grow into a fixed scale. */
export function chartMax(rows: readonly ChartRow[]): number {
  const values = rows.flatMap((row) => ADAPTERS.map((adapter) => row[adapter] ?? 0));
  return Math.max(...values, 0);
}

const geometricMean = (values: readonly number[]): number =>
  Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);

/**
 * How many times Nest + Express each adapter managed. Ratios are averaged geometrically, so a
 * route with high numbers doesn't outweigh the others. Only routes with both numbers count.
 */
function multipleOfExpress(
  measurements: Measurements,
  adapter: Adapter,
  routes: readonly RouteId[],
): number | null {
  const ratios = routes.flatMap((route) => {
    const value = measurements[measurementKey(adapter, route)];
    const express = measurements[measurementKey("express", route)];
    return value && express ? [value / express] : [];
  });
  return ratios.length > 0 ? geometricMean(ratios) : null;
}

export type Summary = {
  leader: Adapter | null;
  /** Nest + Node as a multiple of Nest + Express: 2 means twice as many requests. */
  nodeMultiple: number | null;
  /** How many routes have Nest + Express and at least one adapter to compare it with. */
  routeCount: number;
};

export function summarize(measurements: Measurements, filter: RouteFilter): Summary {
  const routes = routesOf(filter);
  const multiples = ADAPTERS.flatMap((adapter) => {
    const multiple = multipleOfExpress(measurements, adapter, routes);
    return multiple === null ? [] : [{ adapter, multiple }];
  });
  const leader = multiples.reduce<(typeof multiples)[number] | null>(
    (best, entry) => (!best || entry.multiple > best.multiple ? entry : best),
    null,
  );
  const others = ADAPTERS.filter((adapter) => adapter !== "express");
  const comparable = routes.filter(
    (route) =>
      measurements[measurementKey("express", route)] &&
      others.some((adapter) => measurements[measurementKey(adapter, route)]),
  );
  return {
    // One adapter on its own hasn't beaten anything yet.
    leader: multiples.length >= 2 ? (leader?.adapter ?? null) : null,
    nodeMultiple: multipleOfExpress(measurements, "node", routes),
    routeCount: comparable.length,
  };
}
