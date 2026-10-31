"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  VisuallyHidden,
} from "@nuvui/react";
import { ROUTE_IDS, type RunResult } from "@repo/types";
import { useState } from "react";
import { BenchmarkChart } from "@/components/benchmark-chart/benchmark-chart";
import { BenchmarkStats } from "@/components/benchmark-stats/benchmark-stats";
import { RunActions } from "@/components/run-actions/run-actions";
import { RunMessage } from "@/components/run-message/run-message";
import { RunProgress } from "@/components/run-progress/run-progress";
import { RunSettings } from "@/components/run-settings/run-settings";
import { useBenchmark } from "@/hooks/use-benchmark";
import {
  ADAPTER_LABELS,
  chartMax,
  chartRows,
  measurementsOf,
  type RouteFilter,
  summarize,
  type Unit,
} from "@/lib/benchmark-data";
import type { BenchmarkState } from "@/lib/benchmark-state";
import { formatDateTime } from "@/lib/format";
import "./benchmark-showcase.scss";

const DOCS_URL = "https://nuvui.nuvraxis.com/docs";
const PR_URL = "https://github.com/nestjs/nest/pull/18063";

function routeFilterOf(value: string): RouteFilter {
  return ROUTE_IDS.find((route) => route === value) ?? "all";
}

function statusText({ connection, errors, run }: BenchmarkState): string {
  if (run.status === "running") {
    if (run.stopping) return "Stopping the run.";
    if (!run.adapter || !run.route) return "Run started.";
    return `Measuring ${ADAPTER_LABELS[run.adapter]}, ${run.route}.`;
  }
  if (run.status === "finished") {
    return run.outcome === "completed" ? "Run finished." : "Run ended early.";
  }
  if (errors.length > 0) return "The run failed.";
  return connection === "offline" ? "The runner isn't running." : "";
}

type BenchmarkShowcaseProps = {
  initialResult: RunResult | null;
  runnerUrl: string;
};

export function BenchmarkShowcase({ initialResult, runnerUrl }: BenchmarkShowcaseProps) {
  const { state, run, stop } = useBenchmark(runnerUrl, initialResult);
  const [filter, setFilter] = useState<RouteFilter>("all");
  const [unit, setUnit] = useState<Unit>("rps");

  const { connection, result, run: runState } = state;
  const running = runState.status === "running" ? runState : null;
  const saved = measurementsOf(result);
  const shown = running?.measurements ?? saved;

  const rows = chartRows(shown, filter, unit);
  const max = Math.max(chartMax(rows), chartMax(chartRows(saved, filter, unit)));
  const hasNumbers = Object.keys(shown).length > 0;
  const title =
    unit === "rps"
      ? "Requests per second by adapter and route"
      : "Requests per second as a multiple of Nest + Express";

  const settings = running?.config ?? result?.config ?? null;

  return (
    <div className="benchmark-showcase">
      <header className="benchmark-showcase__header">
        <div className="benchmark-showcase__intro">
          <h1 className="benchmark-showcase__title">NestJS HTTP adapters, measured live</h1>
          <p className="benchmark-showcase__lead">
            The same three routes on Nest + Express, Nest + Fastify and Nest + Node, one at a time,
            on this machine. A full run takes about 5 minutes.
          </p>
        </div>
        <RunActions
          canRun={connection === "online" && !running}
          canStop={Boolean(running) && !running?.stopping}
          onRun={run}
          onStop={stop}
        />
      </header>

      {/* Bar widths and tiles change every second, so milestones are announced here instead. */}
      <VisuallyHidden role="status">{statusText(state)}</VisuallyHidden>

      {running ? <RunProgress run={running} /> : null}
      <RunMessage state={state} />
      {hasNumbers ? (
        <BenchmarkStats
          summary={summarize(shown, filter)}
          filter={filter}
          live={Boolean(running)}
        />
      ) : null}

      <Card aria-busy={Boolean(running) && !hasNumbers}>
        <CardHeader>
          <CardTitle asChild>
            <h2>{title}</h2>
          </CardTitle>
          <CardDescription>
            {running
              ? "Live. Each bar follows the latest second, then settles on the median."
              : result
                ? `Last run: ${formatDateTime(result.finishedAt)}. Median across rounds.`
                : "Median across rounds."}
          </CardDescription>
        </CardHeader>
        <CardContent className="benchmark-showcase__chart">
          <div className="benchmark-showcase__filters">
            <ToggleGroup
              className="benchmark-showcase__routes"
              type="single"
              variant="ghost"
              size="sm"
              aria-label="Route"
              value={filter}
              onValueChange={(value) => {
                if (value) setFilter(routeFilterOf(value));
              }}
            >
              <ToggleGroupItem value="all">All routes</ToggleGroupItem>
              {ROUTE_IDS.map((route) => (
                <ToggleGroupItem key={route} value={route}>
                  {route}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <ToggleGroup
              type="single"
              size="sm"
              aria-label="Unit"
              value={unit}
              onValueChange={(value) => {
                if (value) setUnit(value === "relative" ? "relative" : "rps");
              }}
            >
              <ToggleGroupItem value="rps">Requests/s</ToggleGroupItem>
              <ToggleGroupItem value="relative">vs Nest + Express</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {hasNumbers ? (
            <BenchmarkChart rows={rows} unit={unit} max={max} title={title} />
          ) : running || connection === "connecting" ? (
            <Skeleton className="benchmark-showcase__skeleton-chart" />
          ) : (
            <Empty>
              <EmptyTitle>
                {connection === "offline" ? "The runner isn't running" : "No results yet"}
              </EmptyTitle>
              <EmptyDescription>
                {connection === "offline" ? (
                  <>
                    Start it with <code>docker compose up -d --wait</code> and this page connects by
                    itself.
                  </>
                ) : (
                  "Press Run benchmark to measure the three adapters on this machine."
                )}
              </EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>

      <footer className="benchmark-showcase__footer">
        {settings ? (
          <RunSettings config={settings} environment={result?.environment ?? null} />
        ) : null}
        <p className="benchmark-showcase__note">
          These numbers are relative to this machine. They aren't comparable to the PR's M1 Pro
          results, and multiples like these also shift with how the load is generated, so read the
          order, not the exact ratio.
        </p>
        <p className="benchmark-showcase__links">
          <a className="benchmark-showcase__link" href={DOCS_URL}>
            Built with nuvui
          </a>
          <a className="benchmark-showcase__link" href={PR_URL}>
            nestjs/nest pull request 18063
          </a>
        </p>
      </footer>
    </div>
  );
}
