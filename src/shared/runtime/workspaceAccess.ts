export const WORKSPACE_ACCESS_DENIED_EVENT = "qf:workspace-access-denied";
export const WORKSPACE_TELEMETRY_EVENT = "qf:telemetry";
export const WORKSPACE_PICKER_ROUTE = "/settings";

export type WorkspaceAccessDeniedDetail = {
  route: string;
  requested_workspace_id: string | null;
  timestamp: string;
};

export type WorkspaceAccessDeniedTelemetry = WorkspaceAccessDeniedDetail & {
  user_id: string | null;
};

const normalizeMessage = (value: unknown): string => String(value ?? "").toLowerCase();

export function isWorkspaceAccessDeniedResponse(status?: number, data?: unknown): boolean {
  if (status !== 403) return false;
  const body = (data ?? {}) as Record<string, unknown>;
  const message = normalizeMessage(body.error ?? body.message ?? "");
  return message.includes("access to this workspace");
}

export function buildWorkspaceAccessDeniedDetail(
  requestedWorkspaceId: string | null,
  route?: string
): WorkspaceAccessDeniedDetail {
  return {
    route: route ?? (typeof window !== "undefined" ? window.location.pathname : ""),
    requested_workspace_id: requestedWorkspaceId ?? null,
    timestamp: new Date().toISOString(),
  };
}

export function dispatchWorkspaceAccessDenied(detail: WorkspaceAccessDeniedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<WorkspaceAccessDeniedDetail>(WORKSPACE_ACCESS_DENIED_EVENT, { detail }));
}

export function redirectToWorkspacePicker() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === WORKSPACE_PICKER_ROUTE) return;
  window.location.href = WORKSPACE_PICKER_ROUTE;
}

export function emitWorkspaceAccessDeniedTelemetry(payload: WorkspaceAccessDeniedTelemetry) {
  if (typeof window === "undefined") return;

  const eventPayload = {
    event: "workspace_access_denied",
    ...payload,
  };

  const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push(eventPayload);
  }

  window.dispatchEvent(
    new CustomEvent(WORKSPACE_TELEMETRY_EVENT, {
      detail: eventPayload,
    })
  );
}
