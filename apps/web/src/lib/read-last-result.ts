import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RunResult } from "@repo/types";
import * as v from "valibot";
import { env } from "@/env";

// next dev and next start both run in apps/web, and the runner writes to the repo's results/.
const defaultPath = (): string => join(process.cwd(), "..", "..", "results", "latest.json");

/** The last clean run, so the page has something to show while the runner is down. */
export async function readLastResult(): Promise<RunResult | null> {
  let text: string;
  try {
    text = await readFile(env().RESULTS_PATH ?? defaultPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  try {
    const parsed = v.safeParse(RunResult, JSON.parse(text));
    if (parsed.success) return parsed.output;
    console.warn("results file has an unexpected shape:", v.summarize(parsed.issues));
  } catch {
    console.warn("results file is not valid JSON");
  }
  return null;
}
