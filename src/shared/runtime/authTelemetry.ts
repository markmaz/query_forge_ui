export const AUTH_TELEMETRY_EVENT = "qf:auth-telemetry";

export type AuthTelemetryEventType =
  | "auth_login_failure"
  | "auth_reset_request_failure"
  | "auth_invite_validation_failure";

type AuthTelemetryPayload = {
  event: AuthTelemetryEventType;
  status_code: number | null;
  timestamp: string;
};

const normalizeStatusCode = (statusCode?: number | null): number | null =>
  typeof statusCode === "number" && Number.isFinite(statusCode) ? statusCode : null;

export function emitAuthTelemetry(event: AuthTelemetryEventType, statusCode?: number | null) {
  if (typeof window === "undefined") return;

  const payload: AuthTelemetryPayload = {
    event,
    status_code: normalizeStatusCode(statusCode),
    timestamp: new Date().toISOString(),
  };

  const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push(payload);
  }

  window.dispatchEvent(
    new CustomEvent<AuthTelemetryPayload>(AUTH_TELEMETRY_EVENT, {
      detail: payload,
    })
  );
}
