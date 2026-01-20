import axios from "axios";

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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("Token");

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
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("Token");
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

export default api;