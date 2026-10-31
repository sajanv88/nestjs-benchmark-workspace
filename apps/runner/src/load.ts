import { lookup } from "node:dns/promises";
import type { EventEmitter } from "node:events";
import type { Adapter } from "@repo/types";
import autocannon, { type Result } from "autocannon";
import { ADAPTER_URLS, type Route } from "./config.js";

export type LoadRequest = {
  adapter: Adapter;
  route: Route;
  connections: number;
  seconds: number;
  signal: AbortSignal;
  onSample?: (rps: number) => void;
};

export type LoadResult =
  | { ok: true; samples: number[]; meanRps: number }
  | { ok: false; error: string };

// autocannon counts every response in `counter` and `requests`, so any failure disqualifies
// the run: otherwise a fast stream of 500s would read as throughput.
function failureOf(result: Result): string | null {
  const { errors, timeouts, non2xx, requests } = result;
  if (errors > 0 || timeouts > 0 || non2xx > 0) {
    return `${errors} errors, ${timeouts} timeouts, ${non2xx} non-2xx responses`;
  }
  // No errors can also mean nothing connected in time. That's a failure, not 0 req/s.
  return requests.total === 0 ? "no responses received" : null;
}

// autocannon retries a dead target in a tight loop and resolves the hostname on every attempt.
// Those lookups fill libuv's small thread pool, which then starves the health check of the next
// adapter, so one dead app takes a healthy one down with it. Resolving once avoids that.
async function resolveOrigin(adapter: Adapter): Promise<string> {
  const { hostname, port } = new URL(ADAPTER_URLS[adapter]);
  const { address } = await lookup(hostname, { family: 4 });
  return `http://${address}:${port}`;
}

export async function runLoad(request: LoadRequest): Promise<LoadResult> {
  if (request.signal.aborted) return { ok: false, error: "stopped" };

  try {
    return await fire(request, await resolveOrigin(request.adapter));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function fire(request: LoadRequest, origin: string): Promise<LoadResult> {
  const { route, connections, seconds, signal, onSample } = request;

  return new Promise((resolve) => {
    const samples: number[] = [];

    const instance = autocannon(
      {
        url: `${origin}${route.path}`,
        method: route.method,
        connections,
        duration: seconds,
        bailout: 1,
        ...("body" in route ? { body: route.body, headers: route.headers } : {}),
      },
      (error, result) => {
        signal.removeEventListener("abort", stop);
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

    const stop = (): void => instance.stop();
    signal.addEventListener("abort", stop, { once: true });

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
