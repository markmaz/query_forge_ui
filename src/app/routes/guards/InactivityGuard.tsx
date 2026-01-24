import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useAppDispatch } from "../../../shared/lib/hooks";
import { performLogout } from "../../../features/auth/model/authSlice";

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

  const clear = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const triggerTimeout = () => {
    dispatch(performLogout());
    onTimeout?.();
    navigate(redirectTo, { replace: true });
  };

  const start = () => {
    clear();
    timerRef.current = window.setTimeout(triggerTimeout, timeoutMs);
  };

  useEffect(() => {
    // Activity events on window
    const events: (keyof WindowEventMap)[] = [
      "click",
      "mousemove",
      "keydown",
      "scroll",
      "focus",
      "touchstart",
    ];
    const onActivity = () => start();

    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    // Page visibility on document (NOT window)
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // kick off
    start();

    return () => {
      clear();
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [timeoutMs, redirectTo]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
