import axios from "axios";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/accessTokenStore";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

if (!API_URL) {
  // Fail fast so you don’t silently call undefined baseURL
  // (You can remove this if you prefer)
  // eslint-disable-next-line no-console
  console.warn("Missing VITE_API_URL. Add it to your .env file.");
}

let currentWorkspaceId: string | null = null;

const storedWorkspaceId = localStorage.getItem("workspaceId");
if (storedWorkspaceId) {
  currentWorkspaceId = storedWorkspaceId;
}

// api.ts
export function setApiWorkspaceId(workspaceId: string | null) {
  currentWorkspaceId = workspaceId;

  if (workspaceId) {
    localStorage.setItem("workspaceId", workspaceId);
  } else {
    localStorage.removeItem("workspaceId");
  }
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

  if (currentWorkspaceId) {
    config.headers["X-Workspace-Id"] = currentWorkspaceId;
  } else {
    // optional: ensure we don't accidentally send a stale header
    delete (config.headers as any)["X-Workspace-Id"];
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status !== 401 || !original) {
      return Promise.reject(error);
    }

    const url = String(original.url ?? "");
    if (original._retry || url.includes("/auth/refresh") || url.includes("/auth/login") || url.includes("/otp/verify")) {
      clearAccessToken();
      window.location.href = "/auth";
      return Promise.reject(error);
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
      window.location.href = "/auth";
      return Promise.reject(refreshErr);
    }
  }
);

export default api;