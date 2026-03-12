import { useEffect, useRef, useState } from "react";

const TIMER_TICK_MS = 250;

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function useExecutionTimer(running: boolean, startedAtMs: number | null): string {
  const [label, setLabel] = useState("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const stopInterval = () => {
      if (intervalRef.current == null) {
        return;
      }
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };

    const updateLabel = () => {
      if (startedAtMs == null) {
        setLabel("");
        return;
      }
      setLabel(formatElapsed(Date.now() - startedAtMs));
    };

    updateLabel();

    if (running && startedAtMs != null) {
      stopInterval();
      intervalRef.current = window.setInterval(updateLabel, TIMER_TICK_MS);
    } else {
      stopInterval();
    }

    return () => {
      stopInterval();
    };
  }, [running, startedAtMs]);

  return label;
}
