import { readFileSync } from "node:fs";

function readCgroup(file: string): string | null {
  try {
    return readFileSync(`/sys/fs/cgroup/${file}`, "utf8").trim();
  } catch {
    return null;
  }
}

function cpuLimit(): number | null {
  const [quota, period] = readCgroup("cpu.max")?.split(" ") ?? [];
  if (!quota || !period || quota === "max") return null;
  return Number(quota) / Number(period);
}

function memoryLimit(): number | null {
  const value = readCgroup("memory.max");
  return !value || value === "max" ? null : Number(value);
}

// Read from the kernel, not config, so the results show what the container really ran under.
export const limits = { cpus: cpuLimit(), memoryBytes: memoryLimit() };
