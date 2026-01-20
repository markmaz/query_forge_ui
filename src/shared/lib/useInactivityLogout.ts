// src/shared/lib/useInactivityLogout.ts
import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from './hooks'; // your typed redux hook
import { logout } from '../../features/auth/model/authSlice'; // adjust path

type Options = {
  timeoutMs?: number;     // total idle window
  warnMs?: number;        // show warning when this much remains
  onWarn?: (msLeft: number) => void;
  deadlineKey?: string;   // localStorage key for cross-tab sync
  logoutKey?: string;     // localStorage key for cross-tab logout
  redirectTo?: string;
};

export function useInactivityLogout({
  timeoutMs = 30 * 60 * 1000,
  warnMs = 60 * 1000,
  onWarn,
  deadlineKey = 'app:idleDeadline',
  logoutKey = 'app:logoutPing',
  redirectTo = '/login',
}: Options = {}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const deadlineRef = useRef<number>(Date.now() + timeoutMs);
  const warnedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const schedule = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);

    const msLeft = deadlineRef.current - Date.now();
    if (onWarn && !warnedRef.current && msLeft <= warnMs) {
      warnedRef.current = true;
      onWarn(msLeft);
    }

    timerRef.current = window.setTimeout(() => {
      // broadcast + logout
      localStorage.setItem(logoutKey, String(Date.now()));
      dispatch(logout());
      navigate(redirectTo, { replace: true });
    }, Math.max(0, msLeft));
  }, [dispatch, navigate, onWarn, warnMs, redirectTo, logoutKey]);

  const reset = useCallback(() => {
    warnedRef.current = false;
    deadlineRef.current = Date.now() + timeoutMs;
    localStorage.setItem(deadlineKey, String(deadlineRef.current)); // sync other tabs
    schedule();
  }, [timeoutMs, deadlineKey, schedule]);

  useEffect(() => {
    const activity = () => {
      if (document.visibilityState === 'hidden') return;
      reset();
    };
    const winEvents: (keyof WindowEventMap)[] = [
        'mousemove',
        'mousedown',
        'keydown',
        'scroll',
        'touchstart',
        'pointerdown',
    ];
    winEvents.forEach(ev => window.addEventListener(ev, activity, { passive: true }));
    const onVisibility = () => activity();
    document.addEventListener('visibilitychange', onVisibility);

    // cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === deadlineKey && e.newValue) {
        const n = Number(e.newValue);
        if (!Number.isNaN(n)) {
          deadlineRef.current = n;
          schedule();
        }
      } else if (e.key === logoutKey && e.newValue) {
        dispatch(logout());
        navigate(redirectTo, { replace: true });
      }
    };
    window.addEventListener('storage', onStorage);

    reset();

    return () => {
        winEvents.forEach(ev => window.removeEventListener(ev, activity));
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('storage', onStorage);
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [reset, schedule, dispatch, navigate, deadlineKey, logoutKey, redirectTo]);

  return { reset };
}
