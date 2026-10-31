import { Alert, AlertDescription, AlertTitle } from "@nuvui/react";
import type { BenchmarkState } from "@/lib/benchmark-state";

type RunMessageProps = {
  state: BenchmarkState;
};

const RUNNER_COMMAND = "docker compose up -d --wait";

// A dead app fails on every route of every round, which would be a wall of near-identical lines.
function firstErrorOf(errors: readonly string[]): string {
  const more = errors.length - 1;
  if (more === 0) return errors.join("");
  return `${errors[0]} And ${more} more ${more === 1 ? "failure" : "failures"}.`;
}

/** The one thing worth saying about the run. Several at once would compete for attention. */
export function RunMessage({ state }: RunMessageProps) {
  const { connection, errors, result, run } = state;

  if (errors.length > 0) {
    const finished = run.status === "finished";
    return (
      <Alert intent="danger">
        <AlertTitle>{finished ? "The run didn't finish cleanly" : "Something failed"}</AlertTitle>
        <AlertDescription>
          {firstErrorOf(errors)}
          {finished ? " A run with failures doesn't replace the saved results." : ""}
        </AlertDescription>
      </Alert>
    );
  }

  if (run.status === "finished" && run.outcome === "stopped") {
    return (
      <Alert intent="info">
        <AlertTitle>Run stopped</AlertTitle>
        <AlertDescription>
          Nothing from it was saved.{result ? " The chart is back on the last full run." : ""}
        </AlertDescription>
      </Alert>
    );
  }

  if (run.status === "finished") {
    return (
      <Alert intent="success">
        <AlertTitle>Run finished</AlertTitle>
        <AlertDescription>The chart shows the median of each route across rounds.</AlertDescription>
      </Alert>
    );
  }

  if (connection === "offline" && result) {
    return (
      <Alert intent="warning">
        <AlertTitle>The runner isn't running</AlertTitle>
        <AlertDescription>
          This is the last saved run. To measure again, start it with <code>{RUNNER_COMMAND}</code>{" "}
          and this page connects by itself.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
