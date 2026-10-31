import { runBenchmark } from "./benchmark.js";
import type { RunConfig } from "./config.js";
import type { BenchEvent } from "./events.js";
import { writeResults } from "./results-file.js";

export type SequencedEvent = { id: number; event: BenchEvent };
type Listener = (event: SequencedEvent) => void;

export type RunManager = {
  /** Returns false if a run is already active. */
  start: (config: RunConfig) => boolean;
  /** Returns false if there is nothing to stop. */
  stop: () => boolean;
  isRunning: () => boolean;
  /**
   * Replays what the subscriber missed: everything after `lastEventId` when reconnecting, the
   * current run for a new subscriber, and nothing for a new subscriber between runs.
   */
  subscribe: (lastEventId: number | null, listener: Listener) => () => void;
};

export function createRunManager(resultsPath: string): RunManager {
  let active: AbortController | null = null;
  let history: SequencedEvent[] = [];
  let nextId = 1;
  const listeners = new Set<Listener>();

  const publish = (event: BenchEvent): void => {
    const sequenced = { id: nextId, event };
    nextId += 1;
    history.push(sequenced);
    for (const listener of listeners) listener(sequenced);
  };

  const run = async (config: RunConfig, signal: AbortSignal): Promise<void> => {
    const fail = (prefix: string, error: unknown): void => {
      const message = error instanceof Error ? error.message : String(error);
      publish({ type: "error", message: `${prefix}: ${message}` });
    };
    try {
      const result = await runBenchmark(config, publish, signal);
      // Only a clean, complete run replaces the last good results.
      if (result.status === "completed") {
        await writeResults(resultsPath, result).catch((error: unknown) => {
          fail("results not saved", error);
        });
      }
    } catch (error) {
      fail("run failed", error);
    } finally {
      active = null;
    }
  };

  return {
    start(config) {
      if (active) return false;
      const controller = new AbortController();
      active = controller;
      history = [];
      void run(config, controller.signal);
      return true;
    },
    stop() {
      if (!active) return false;
      active.abort();
      return true;
    },
    isRunning: () => active !== null,
    subscribe(lastEventId, listener) {
      const after = lastEventId ?? (active ? 0 : nextId - 1);
      for (const item of history) {
        if (item.id > after) listener(item);
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
