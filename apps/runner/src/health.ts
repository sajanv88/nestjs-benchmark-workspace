import { setTimeout as sleep } from "node:timers/promises";
import * as v from "valibot";
import { ADAPTER_URLS, type Adapter } from "./config.js";
import type { RunEnvironment } from "./events.js";

const POLL_MS = 250;
const WAIT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 2_000;

const Health = v.object({
  status: v.literal("ok"),
  adapter: v.string(),
  node: v.string(),
  cpus: v.nullable(v.number()),
  memoryBytes: v.nullable(v.number()),
});

export type HealthResult = { ok: true; environment: RunEnvironment } | { ok: false; error: string };

async function probe(adapter: Adapter, signal: AbortSignal): Promise<HealthResult> {
  try {
    const res = await fetch(`${ADAPTER_URLS[adapter]}/health`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
    const parsed = v.safeParse(Health, await res.json());
    if (!parsed.success) return { ok: false, error: "unexpected health response" };
    const { adapter: serving, node, cpus, memoryBytes } = parsed.output;
    if (serving !== adapter) {
      return { ok: false, error: `serving ${serving}, expected ${adapter}` };
    }
    return { ok: true, environment: { node, cpus, memoryBytes } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function waitForHealth(adapter: Adapter, signal: AbortSignal): Promise<HealthResult> {
  const deadline = Date.now() + WAIT_MS;
  let last = await probe(adapter, signal);
  while (!last.ok && !signal.aborted && Date.now() < deadline) {
    await sleep(POLL_MS);
    last = await probe(adapter, signal);
  }
  return last;
}
