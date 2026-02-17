import axios from "axios";

export type ServiceError = Error & {
  status?: number;
  details?: unknown;
};

type ErrorPayload = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

function normalizeMessage(payload: ErrorPayload | undefined): string | null {
  if (!payload) return null;
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  return null;
}

export function toServiceError(error: unknown, fallbackMessage: string): ServiceError {
  const serviceError = new Error(fallbackMessage) as ServiceError;

  if (!axios.isAxiosError(error)) {
    return serviceError;
  }

  const payload = (error.response?.data ?? undefined) as ErrorPayload | undefined;
  serviceError.status = error.response?.status;
  serviceError.details = payload?.details ?? payload;
  serviceError.message = normalizeMessage(payload) ?? error.message ?? fallbackMessage;
  return serviceError;
}

