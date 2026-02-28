import axios from "axios";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/accessTokenStore";
import {
  buildWorkspaceAccessDeniedDetail,
  dispatchWorkspaceAccessDenied,
  isWorkspaceAccessDeniedResponse,
  redirectToWorkspacePicker,
} from "../lib/workspaceAccess";

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const API_URL =
  import.meta.env.DEV && rawApiUrl?.match(/^https?:\/\/localhost:5000\/api\/v1\/?$/i)
    ? "/api/v1"
    : rawApiUrl;
const getLocalStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

if (!API_URL) {
  // Fail fast so you don’t silently call undefined baseURL
  // (You can remove this if you prefer)
  // eslint-disable-next-line no-console
  console.warn("Missing VITE_API_URL. Add it to your .env file.");
}

let currentWorkspaceId: string | null = null;
let currentUserId: string | null = null;

// api.ts
export function setApiWorkspaceId(workspaceId: string | null) {
  currentWorkspaceId = workspaceId;
  const storage = getLocalStorage();

  if (workspaceId) {
    storage?.setItem("workspaceId", workspaceId);
  } else {
    storage?.removeItem("workspaceId");
  }
}

export function getApiWorkspaceId() {
  return currentWorkspaceId;
}

export function setApiUserId(userId: string | null) {
  currentUserId = userId;
}

export function getApiUserId() {
  return currentUserId;
}
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let refreshPromise: Promise<string> | null = null;
const AUTH_PATH_PREFIX = API_URL?.includes("/api/v1") ? "" : "/api/v1";
const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(authorization|token|password|secret|api[_-]?key|cookie)/i;

export class RemovedAdminEndpointError extends Error {
  readonly status = 404;
  readonly code = "feature_unavailable";
  readonly endpoint: string;

  constructor(endpoint: string) {
    super("Feature unavailable.");
    this.name = "RemovedAdminEndpointError";
    this.endpoint = endpoint;
  }
}

export class WorkspaceAccessDeniedError extends Error {
  readonly status = 403;
  readonly code = "workspace_access_denied";
  readonly requestedWorkspaceId: string | null;

  constructor(requestedWorkspaceId: string | null) {
    super("You no longer have access to this workspace.");
    this.name = "WorkspaceAccessDeniedError";
    this.requestedWorkspaceId = requestedWorkspaceId;
  }
}

function normalizeEndpointPath(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.pathname.replace(/\/+$/g, "") || "/";
  } catch {
    return url.replace(/[?#].*$/, "").replace(/\/+$/g, "") || "/";
  }
}

export function isRemovedAdminEndpointPath(url?: string | null): boolean {
  if (!url) return false;
  const path = normalizeEndpointPath(String(url)).replace(/^\/api\/v1(?=\/|$)/, "");
  if (path === "/admin") return true;
  return path.startsWith("/admin/headers/");
}

function redactSensitiveInPlace(value: unknown, depth = 0): void {
  if (value == null || depth > 5) return;

  if (Array.isArray(value)) {
    value.forEach((item) => redactSensitiveInPlace(item, depth + 1));
    return;
  }

  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  Object.keys(record).forEach((key) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      record[key] = REDACTED;
      return;
    }
    redactSensitiveInPlace(record[key], depth + 1);
  });
}

export function redactAxiosErrorForLogs(error: unknown): unknown {
  if (!error || typeof error !== "object") return error;
  const e = error as Record<string, unknown>;

  const config = e.config as Record<string, unknown> | undefined;
  if (config) {
    redactSensitiveInPlace(config.headers);
    redactSensitiveInPlace(config.params);
    redactSensitiveInPlace(config.data);
  }

  const response = e.response as Record<string, unknown> | undefined;
  if (response) {
    redactSensitiveInPlace(response.headers);
    redactSensitiveInPlace(response.data);
    const responseConfig = response.config as Record<string, unknown> | undefined;
    if (responseConfig) {
      redactSensitiveInPlace(responseConfig.headers);
      redactSensitiveInPlace(responseConfig.params);
      redactSensitiveInPlace(responseConfig.data);
    }
  }

  return error;
}

export async function refreshAccessToken(): Promise<string> {
  const res = await refreshClient.post(`${AUTH_PATH_PREFIX}/auth/refresh`, null, { withCredentials: true });
  const next = (res.data as any)?.access_token;
  if (!next) {
    throw new Error("Refresh did not return access_token");
  }
  setAccessToken(next);
  return next;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  // Axios v1: headers might be undefined, so ensure it exists
  config.headers = config.headers ?? {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const explicitWorkspaceId =
    (config.headers as any)["X-Workspace-Id"] ?? (config.headers as any)["x-workspace-id"];

  if (explicitWorkspaceId) {
    config.headers["X-Workspace-Id"] = String(explicitWorkspaceId);
    delete (config.headers as any)["x-workspace-id"];
  } else if (currentWorkspaceId) {
    config.headers["X-Workspace-Id"] = currentWorkspaceId;
  } else {
    // optional: ensure we don't accidentally send a stale header
    delete (config.headers as any)["X-Workspace-Id"];
    delete (config.headers as any)["x-workspace-id"];
  }

  if (currentUserId) {
    config.headers["X-User-Id"] = currentUserId;
  } else {
    delete (config.headers as any)["X-User-Id"];
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const endpoint = String(original?.url ?? error?.response?.config?.url ?? "");
    const responseData = error?.response?.data;
    const rejectWithRedacted = (err: unknown) => {
      redactAxiosErrorForLogs(err);
      return Promise.reject(err);
    };

    if (isWorkspaceAccessDeniedResponse(status, responseData)) {
      const requestedWorkspaceId =
        String(
          original?.headers?.["X-Workspace-Id"] ??
            original?.headers?.["x-workspace-id"] ??
            currentWorkspaceId ??
            ""
        ) || null;
      const detail = buildWorkspaceAccessDeniedDetail(requestedWorkspaceId);
      dispatchWorkspaceAccessDenied(detail);
      setApiWorkspaceId(null);
      redirectToWorkspacePicker();
      return rejectWithRedacted(new WorkspaceAccessDeniedError(requestedWorkspaceId));
    }

    if (status === 404 && isRemovedAdminEndpointPath(endpoint)) {
      return rejectWithRedacted(new RemovedAdminEndpointError(endpoint));
    }

    if (status !== 401 || !original) {
      return rejectWithRedacted(error);
    }

    const url = String(original.url ?? "");
    if (original._retry || url.includes("/auth/refresh") || url.includes("/auth/login") || url.includes("/otp/verify")) {
      clearAccessToken();
      if (typeof window !== "undefined") window.location.href = "/auth";
      return rejectWithRedacted(error);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      const newToken = await refreshPromise;
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      clearAccessToken();
      if (typeof window !== "undefined") window.location.href = "/auth";
      return rejectWithRedacted(refreshErr);
    }
  }
);

export default api;
