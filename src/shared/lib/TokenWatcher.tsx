import { useEffect, useRef } from "react";
import { useAppDispatch } from "./hooks";
import { logout, setToken } from "../../features/auth/model/authSlice";
import { jwtDecode } from "jwt-decode";
import { clearAccessToken, getAccessToken, subscribeAccessToken } from "./accessTokenStore";
import { refreshAccessToken } from "../services/api";

interface JwtPayload {
  exp: number;
}

const TokenWatcher = () => {
  const dispatch = useAppDispatch();
  const timerRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleRefresh = (token: string | null) => {
    clearTimer();
    if (!token || token.split(".").length !== 3) return;

    try {
      const decoded: JwtPayload = jwtDecode(token);
      const expMs = decoded.exp * 1000;
      const bufferMs = 60_000;
      const delay = Math.max(expMs - Date.now() - bufferMs, 5_000);

      timerRef.current = window.setTimeout(async () => {
        if (refreshingRef.current) return;
        refreshingRef.current = true;
        try {
          const next = await refreshAccessToken();
          dispatch(setToken(next));
        } catch (err) {
          clearAccessToken();
          dispatch(logout());
          window.location.href = "/auth";
        } finally {
          refreshingRef.current = false;
        }
      }, delay);
    } catch (err) {
      clearAccessToken();
      dispatch(logout());
      window.location.href = "/auth";
    }
  };

  useEffect(() => {
    scheduleRefresh(getAccessToken());
    const unsubscribe = subscribeAccessToken((next) => scheduleRefresh(next));

    return () => {
      clearTimer();
      unsubscribe();
    };
  }, [dispatch]);

  return null;
};

export default TokenWatcher;
