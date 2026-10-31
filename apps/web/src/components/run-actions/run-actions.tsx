"use client";

import { Button } from "@nuvui/react";
import { useLayoutEffect, useRef } from "react";
import "./run-actions.scss";

type RunActionsProps = {
  canRun: boolean;
  canStop: boolean;
  onRun: () => void;
  onStop: () => void;
};

export function RunActions({ canRun, canStop, onRun, onStop }: RunActionsProps) {
  const group = useRef<HTMLDivElement>(null);
  const runButton = useRef<HTMLButtonElement>(null);
  const stopButton = useRef<HTMLButtonElement>(null);

  // Each press ends up disabling the button that was pressed, which would drop a keyboard user
  // back to the top of the page. A layout effect runs before the browser lets go of that button.
  useLayoutEffect(() => {
    if (!group.current?.contains(document.activeElement)) return;
    const next = canStop ? stopButton.current : canRun ? runButton.current : group.current;
    next?.focus({ preventScroll: true });
  }, [canRun, canStop]);

  return (
    <div ref={group} className="run-actions" tabIndex={-1}>
      <Button ref={stopButton} intent="secondary" disabled={!canStop} onClick={onStop}>
        Stop
      </Button>
      <Button ref={runButton} disabled={!canRun} onClick={onRun}>
        Run benchmark
      </Button>
    </div>
  );
}
