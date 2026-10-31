"use client";

import { Badge, Progress } from "@nuvui/react";
import { useId } from "react";
import { ADAPTER_LABELS } from "@/lib/benchmark-data";
import type { RunState } from "@/lib/benchmark-state";
import "./run-progress.scss";

type RunProgressProps = {
  run: Extract<RunState, { status: "running" }>;
};

export function RunProgress({ run }: RunProgressProps) {
  const labelId = useId();
  const { adapter, config, round, route, routeIndex, routesPerRound, stopping } = run;
  // The bar covers the whole run, so it never goes backwards when a new round starts.
  const done = (round - 1) * routesPerRound + routeIndex;
  const total = config.rounds * routesPerRound;

  return (
    <section className="run-progress" aria-label="Run progress">
      <div className="run-progress__heading">
        <span id={labelId}>
          {stopping
            ? "Stopping"
            : `Round ${round} of ${config.rounds}, route ${routeIndex} of ${routesPerRound}`}
        </span>
        <span className="run-progress__active">
          {adapter ? <Badge intent="primary">{ADAPTER_LABELS[adapter]}</Badge> : null}
          {route ? <code className="run-progress__route">{route}</code> : null}
        </span>
      </div>
      <Progress
        aria-labelledby={labelId}
        value={done}
        max={total}
        getValueLabel={(value, max) => `Route ${value} of ${max}`}
      />
    </section>
  );
}
