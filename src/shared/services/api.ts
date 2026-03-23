import axios from "axios";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "../runtime/accessTokenStore";
import {
  buildWorkspaceAccessDeniedDetail,
  dispatchWorkspaceAccessDenied,
  isWorkspaceAccessDeniedResponse,
  redirectToWorkspacePicker,
} from "../runtime/workspaceAccess";

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const API_URL =
  import.meta.env.DEV &&
  rawApiUrl?.match(/^https?:\/\/localhost:5000\/api\/v1\/?$/i)
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

function readWorkspaceIdFromStorage(): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  const camel = storage.getItem("workspaceId");
  if (typeof camel === "string" && camel.trim().length > 0) return camel.trim();
  const snake = storage.getItem("workspace_id");
  if (typeof snake === "string" && snake.trim().length > 0) return snake.trim();
  return null;
}

currentWorkspaceId = readWorkspaceIdFromStorage();

// api.ts
export function setApiWorkspaceId(workspaceId: string | null) {
  const normalized = typeof workspaceId === "string" ? workspaceId.trim() : "";
  currentWorkspaceId = normalized.length > 0 ? normalized : null;
  const storage = getLocalStorage();

  if (currentWorkspaceId) {
    storage?.setItem("workspaceId", currentWorkspaceId);
    storage?.setItem("workspace_id", currentWorkspaceId);
  } else {
    storage?.removeItem("workspaceId");
    storage?.removeItem("workspace_id");
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
const SENSITIVE_KEY_PATTERN =
  /(authorization|token|password|secret|api[_-]?key|cookie)/i;

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

export class MissingWorkspaceHeaderError extends Error {
  readonly status = 400;
  readonly code = "missing_workspace_header";
  readonly endpoint: string;

  constructor(endpoint: string) {
    super("Workspace-scoped request is missing X-Workspace-Id.");
    this.name = "MissingWorkspaceHeaderError";
    this.endpoint = endpoint;
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

const WORKSPACE_SCOPED_PREFIXES = [
  "/ai/suggest",
  "/query",
  "/query-tree",
  "/domains",
  "/workspace-tables",
  "/workspace-inventory",
  "/semantic",
  "/prompt-feedback",
  "/admin/prompt-feedback",
  "/executions",
  "/forge-insights",
  "/forge-match",
  "/dictionary",
  "/query-studio",
] as const;

function isWorkspaceScopedEndpoint(url: string): boolean {
  const path = normalizeEndpointPath(url).replace(/^\/api\/v1(?=\/|$)/, "");
  return WORKSPACE_SCOPED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function isRemovedAdminEndpointPath(url?: string | null): boolean {
  if (!url) return false;
  const path = normalizeEndpointPath(String(url)).replace(
    /^\/api\/v1(?=\/|$)/,
    "",
  );
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
    const responseConfig = response.config as
      | Record<string, unknown>
      | undefined;
    if (responseConfig) {
      redactSensitiveInPlace(responseConfig.headers);
      redactSensitiveInPlace(responseConfig.params);
      redactSensitiveInPlace(responseConfig.data);
    }
  }

  return error;
}

export async function refreshAccessToken(): Promise<string> {
  const res = await refreshClient.post(
    `${AUTH_PATH_PREFIX}/auth/refresh`,
    null,
    { withCredentials: true },
  );
  const refreshedWorkspaceId =
    (res.data as any)?.workspaceId ?? (res.data as any)?.workspace_id ?? null;
  if (
    typeof refreshedWorkspaceId === "string" &&
    refreshedWorkspaceId.trim().length > 0
  ) {
    setApiWorkspaceId(refreshedWorkspaceId.trim());
  }
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
    (config.headers as any)["X-Workspace-Id"] ??
    (config.headers as any)["x-workspace-id"];

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

  const requestUrl = String(config.url ?? "");
  const scopedWorkspaceId =
    (config.headers as any)["X-Workspace-Id"] ??
    (config.headers as any)["x-workspace-id"] ??
    null;
  if (isWorkspaceScopedEndpoint(requestUrl) && !scopedWorkspaceId) {
    const missingWorkspaceError = new MissingWorkspaceHeaderError(requestUrl);
    if (
      import.meta.env.DEV &&
      import.meta.env.VITE_STRICT_WORKSPACE_HEADER === "1"
    ) {
      throw missingWorkspaceError;
    }
    if (import.meta.env.MODE !== "test") {
      console.error(missingWorkspaceError.message, { endpoint: requestUrl });
    }
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
    const endpoint = String(
      original?.url ?? error?.response?.config?.url ?? "",
    );
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
            "",
        ) || null;
      const detail = buildWorkspaceAccessDeniedDetail(requestedWorkspaceId);
      dispatchWorkspaceAccessDenied(detail);
      setApiWorkspaceId(null);
      redirectToWorkspacePicker();
      return rejectWithRedacted(
        new WorkspaceAccessDeniedError(requestedWorkspaceId),
      );
    }

    if (status === 404 && isRemovedAdminEndpointPath(endpoint)) {
      return rejectWithRedacted(new RemovedAdminEndpointError(endpoint));
    }

    if (status !== 401 || !original) {
      return rejectWithRedacted(error);
    }

    const url = String(original.url ?? "");
    if (
      original._retry ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/login") ||
      url.includes("/otp/verify")
    ) {
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
  },
);

export default api;
