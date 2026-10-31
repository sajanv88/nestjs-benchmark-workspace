"use client";

import { BenchEvent, type RunConfig, type RunResult } from "@repo/types";
import { useCallback, useEffect, useReducer } from "react";
import * as v from "valibot";
import {
  type BenchmarkState,
  benchmarkReducer,
  initialBenchmarkState,
} from "@/lib/benchmark-state";

const NAMED_EVENTS = [
  "run-started",
  "adapter-started",
  "route-started",
  "sample",
  "route-finished",
  "run-finished",
] as const;

/** What's left out takes the runner's default. */
type RunRequest = Partial<RunConfig>;

export type UseBenchmark = {
  state: BenchmarkState;
  run: (request: RunRequest) => void;
  stop: () => void;
};

export function useBenchmark(runnerUrl: string, initialResult: RunResult | null): UseBenchmark {
  const [state, dispatch] = useReducer(benchmarkReducer, initialResult, initialBenchmarkState);

  useEffect(() => {
    const source = new EventSource(`${runnerUrl}/events`);

    const onMessage = (message: MessageEvent<string>): void => {
      const event = v.safeParse(BenchEvent, JSON.parse(message.data));
      if (event.success) dispatch({ type: "event", event: event.output });
      else dispatch({ type: "failed", message: "The runner sent something unexpected." });
    };

    // "error" is both a runner event, which carries data, and the browser's own signal that
    // the connection dropped, which doesn't. The browser reconnects by itself.
    const onError = (event: Event): void => {
      if (event instanceof MessageEvent) onMessage(event);
      else dispatch({ type: "disconnected" });
    };

    const onOpen = (): void => dispatch({ type: "connected" });

    source.addEventListener("open", onOpen);
    source.addEventListener("error", onError);
    for (const name of NAMED_EVENTS) source.addEventListener(name, onMessage);

    return () => source.close();
  }, [runnerUrl]);

  const post = useCallback(
    async (path: "/run" | "/stop", refused: string, body: RunRequest = {}): Promise<void> => {
      try {
        const response = await fetch(`${runnerUrl}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) dispatch({ type: "failed", message: refused });
      } catch {
        dispatch({ type: "failed", message: "The runner didn't answer." });
      }
    },
    [runnerUrl],
  );

  const run = useCallback(
    (request: RunRequest) => {
      void post("/run", "A run is already active.", request);
    },
    [post],
  );

  const stop = useCallback(() => {
    dispatch({ type: "stopping" });
    void post("/stop", "There was no run to stop.");
  }, [post]);

  return { state, run, stop };
}
