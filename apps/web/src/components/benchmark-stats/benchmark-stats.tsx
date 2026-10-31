import { Stat, StatDescription, StatGroup, StatLabel, StatValue, Trend } from "@nuvui/react";
import { ADAPTER_LABELS, type RouteFilter, type Summary } from "@/lib/benchmark-data";
import { formatMultiple } from "@/lib/format";

function scopeOf(filter: RouteFilter, routeCount: number, live: boolean): string {
  const where = filter !== "all" ? `on ${filter}` : `averaged over ${routeCount} of 3 routes`;
  return live ? `${where}, so far` : where;
}

type BenchmarkStatsProps = {
  summary: Summary;
  filter: RouteFilter;
  /** Figures from a run still in progress, which can change. */
  live: boolean;
};

export function BenchmarkStats({ summary, filter, live }: BenchmarkStatsProps) {
  const { leader, nodeMultiple, routeCount } = summary;
  const scope = scopeOf(filter, routeCount, live);

  return (
    <section aria-label="Summary">
      <StatGroup>
        <Stat>
          <StatLabel>Leader</StatLabel>
          <StatValue>{leader ? ADAPTER_LABELS[leader] : "Not measured yet"}</StatValue>
          <StatDescription>
            {leader ? `Most requests per second, ${scope}` : "Waiting for a second adapter"}
          </StatDescription>
        </Stat>
        <Stat>
          <StatLabel>Nest + Node vs Nest + Express</StatLabel>
          <StatValue>{nodeMultiple ? formatMultiple(nodeMultiple) : "Not measured yet"}</StatValue>
          <StatDescription>
            {nodeMultiple ? (
              <>
                <Trend value={nodeMultiple - 1} /> more requests per second, {scope}
              </>
            ) : (
              "Waiting for both adapters"
            )}
          </StatDescription>
        </Stat>
      </StatGroup>
    </section>
  );
}
