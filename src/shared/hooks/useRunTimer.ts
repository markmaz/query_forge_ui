import { useCallback, useEffect, useRef, useState } from "react";

export function useRunTimer() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = performance.now();
    setElapsedMs(0);
    timerRef.current = window.setInterval(() => {
      if (startRef.current == null) return;
      setElapsedMs(performance.now() - startRef.current);
    }, 100);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { elapsedMs, start, stop };
}
