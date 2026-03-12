import { useEffect, useState } from "react";
import { getAppVersion, type AppVersionPayload } from "../services/appVersionApi";

type UseAppVersionState = {
  data: AppVersionPayload | null;
  loading: boolean;
  error: Error | null;
};

let cachedVersionPayload: AppVersionPayload | null = null;
let inFlightVersionRequest: Promise<AppVersionPayload> | null = null;

function loadVersion(): Promise<AppVersionPayload> {
  if (cachedVersionPayload) {
    return Promise.resolve(cachedVersionPayload);
  }

  if (!inFlightVersionRequest) {
    inFlightVersionRequest = getAppVersion()
      .then((payload) => {
        cachedVersionPayload = payload;
        return payload;
      })
      .finally(() => {
        inFlightVersionRequest = null;
      });
  }

  return inFlightVersionRequest;
}

export function useAppVersion() {
  const [state, setState] = useState<UseAppVersionState>(() => ({
    data: cachedVersionPayload,
    loading: cachedVersionPayload === null,
    error: null,
  }));

  useEffect(() => {
    let mounted = true;

    if (cachedVersionPayload) {
      setState({ data: cachedVersionPayload, loading: false, error: null });
      return () => {
        mounted = false;
      };
    }

    setState((previous) => ({ ...previous, loading: true }));

    loadVersion()
      .then((payload) => {
        if (!mounted) return;
        setState({ data: payload, loading: false, error: null });
      })
      .catch((error) => {
        if (!mounted) return;
        const normalized = error instanceof Error ? error : new Error("Unable to load app version.");
        setState({ data: null, loading: false, error: normalized });
      });

    return () => {
      mounted = false;
    };
  }, []);

  const versionText = state.data?.version?.trim() || "unknown";

  return {
    versionText,
    raw: state.data,
    isLoading: state.loading,
    isError: Boolean(state.error),
  };
}

export function __resetAppVersionCacheForTests() {
  cachedVersionPayload = null;
  inFlightVersionRequest = null;
}
