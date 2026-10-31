import type { EventEmitter } from "node:events";
import autocannon, { type Result } from "autocannon";
import { ADAPTER_URLS, type Adapter, type Route } from "./config.js";

export type LoadRequest = {
  adapter: Adapter;
  route: Route;
  connections: number;
  seconds: number;
  onSample?: (rps: number) => void;
};

export type LoadResult =
  | { ok: true; samples: number[]; meanRps: number }
  | { ok: false; error: string };

// autocannon counts every response in `counter` and `requests`, so any failure disqualifies
// the run: otherwise a fast stream of 500s would read as throughput.
function failureOf(result: Result): string | null {
  const { errors, timeouts, non2xx } = result;
  if (errors === 0 && timeouts === 0 && non2xx === 0) return null;
  return `${errors} errors, ${timeouts} timeouts, ${non2xx} non-2xx responses`;
}

export function runLoad(request: LoadRequest): Promise<LoadResult> {
  const { adapter, route, connections, seconds, onSample } = request;

  return new Promise((resolve) => {
    const samples: number[] = [];

    const instance = autocannon(
      {
        url: `${ADAPTER_URLS[adapter]}${route.path}`,
        method: route.method,
        connections,
        duration: seconds,
        bailout: 1,
        ...("body" in route ? { body: route.body, headers: route.headers } : {}),
      },
      (error, result) => {
        if (error) {
          resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
          return;
        }
        const failure = failureOf(result);
        if (failure) {
          resolve({ ok: false, error: failure });
          return;
        }
        if (samples.length === 0) {
          resolve({ ok: false, error: "no samples recorded" });
          return;
        }
        resolve({ ok: true, samples, meanRps: Math.round(result.requests.average) });
      },
    );

    // @types/autocannon declares this listener without its argument. On stopping, autocannon
    // 8 emits one more tick after resetting the counter, and can emit a late real one before
    // it, so only the first `seconds` ticks are samples: a trailing 0 is not a measurement.
    const emitter: EventEmitter = instance;
    emitter.on("tick", ({ counter }: { counter: number }) => {
      if (samples.length >= seconds) return;
      samples.push(counter);
      onSample?.(counter);
    });
  });
}
