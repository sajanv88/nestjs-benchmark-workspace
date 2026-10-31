import { rename, writeFile } from "node:fs/promises";
import type { RunResult } from "./events.js";

// Written to a temp file and renamed, so a reader never sees half a document.
export async function writeResults(path: string, result: RunResult): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`);
  await rename(temporary, path);
}
