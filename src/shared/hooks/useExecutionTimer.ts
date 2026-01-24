import { useEffect, useRef, useState } from "react";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function useExecutionTimer(running: boolean, startedAtMs: number | null): string {
  const [label, setLabel] = useState("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (startedAtMs == null) {
        setLabel("");
        return;
      }
      setLabel(formatElapsed(Date.now() - startedAtMs));
    };

    update();

    if (running && startedAtMs != null) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(update, 250);
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, startedAtMs]);

  return label;
}
