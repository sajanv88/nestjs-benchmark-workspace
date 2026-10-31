import { setTimeout as sleep } from "node:timers/promises";
import * as v from "valibot";
import { ADAPTER_URLS, type Adapter } from "./config.js";

const POLL_MS = 250;
const WAIT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 2_000;

const Health = v.object({ status: v.literal("ok"), adapter: v.string(), node: v.string() });

export type HealthResult = { ok: true; node: string } | { ok: false; error: string };

async function probe(adapter: Adapter): Promise<HealthResult> {
  try {
    const res = await fetch(`${ADAPTER_URLS[adapter]}/health`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const parsed = v.safeParse(Health, await res.json());
    if (!parsed.success) return { ok: false, error: "unexpected health response" };
    if (parsed.output.adapter !== adapter) {
      return { ok: false, error: `serving ${parsed.output.adapter}, expected ${adapter}` };
    }
    return { ok: true, node: parsed.output.node };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function waitForHealth(adapter: Adapter): Promise<HealthResult> {
  const deadline = Date.now() + WAIT_MS;
  let last = await probe(adapter);
  while (!last.ok && Date.now() < deadline) {
    await sleep(POLL_MS);
    last = await probe(adapter);
  }
  return last;
}
