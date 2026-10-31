import type { RunConfig, RunEnvironment } from "@repo/types";
import { formatMemory } from "@/lib/format";
import "./run-settings.scss";

type RunSettingsProps = {
  config: RunConfig;
  environment: RunEnvironment | null;
};

export function RunSettings({ config, environment }: RunSettingsProps) {
  const { connections, measureSeconds, rounds, warmupSeconds } = config;
  const settings = [
    ["Connections", String(connections)],
    ["Warm-up", `${warmupSeconds} s per route`],
    ["Measured", `${measureSeconds} s per route`],
    ["Rounds", String(rounds)],
    ...(environment?.cpus
      ? [["CPU limit", `${environment.cpus} ${environment.cpus === 1 ? "core" : "cores"} per app`]]
      : []),
    ...(environment?.memoryBytes
      ? [["Memory limit", `${formatMemory(environment.memoryBytes)} per app`]]
      : []),
    ...(environment ? [["Node", environment.node]] : []),
  ];

  return (
    <dl className="run-settings">
      {settings.map(([name, value]) => (
        <div key={name} className="run-settings__item">
          <dt className="run-settings__name">{name}</dt>
          <dd className="run-settings__value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
