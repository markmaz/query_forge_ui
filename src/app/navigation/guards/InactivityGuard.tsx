import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useAppDispatch } from "../../../shared/runtime/hooks";
import { performLogout } from "../../../features/identity/model/authSlice";

type InactivityGuardProps = {
  timeoutMs?: number;
  redirectTo: string;
  onTimeout?: () => void;
};

export default function InactivityGuard({
  timeoutMs = 30 * 60 * 1000,
  redirectTo,
  onTimeout,
}: InactivityGuardProps) {
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);

  const dispatch = useAppDispatch();

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerTimeout = useCallback(() => {
    dispatch(performLogout());
    onTimeout?.();
    navigate(redirectTo, { replace: true });
  }, [dispatch, navigate, onTimeout, redirectTo]);

  const start = useCallback(() => {
    clear();
    timerRef.current = window.setTimeout(triggerTimeout, timeoutMs);
  }, [clear, timeoutMs, triggerTimeout]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      "click",
      "mousemove",
      "keydown",
      "scroll",
      "focus",
      "touchstart",
    ];
    const onActivity = () => {
      start();
    };

    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      clear();
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [clear, start]);

  return null;
}
