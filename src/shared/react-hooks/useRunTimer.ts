import { useCallback, useEffect, useRef, useState } from "react";

export function useRunTimer() {
  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const tickRef = useRef<number | null>(null);
  const runStartRef = useRef<number | null>(null);

  const clearTick = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTick();
    runStartRef.current = null;
  }, [clearTick]);

  const start = useCallback(() => {
    clearTick();
    runStartRef.current = performance.now();
    setElapsedMilliseconds(0);
    tickRef.current = window.setInterval(() => {
      if (runStartRef.current == null) {
        return;
      }
      setElapsedMilliseconds(performance.now() - runStartRef.current);
    }, 100);
  }, [clearTick]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { elapsedMs: elapsedMilliseconds, start, stop };
}
