export type AppVersionPayload = {
  version: string;
  [key: string]: unknown;
};

const VERSION_ENDPOINT_PATH = "/api/v1/version/";
const VERSION_TIMEOUT_MS = 4_000;

function resolveVersionUrl(): string {
  const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const base = rawApiUrl?.trim();
  if (!base) return VERSION_ENDPOINT_PATH;

  const normalizedBase = base.replace(/\/+$/g, "");
  if (/\/api\/v1$/i.test(normalizedBase)) {
    return `${normalizedBase}/version/`;
  }

  return `${normalizedBase}${VERSION_ENDPOINT_PATH}`;
}

function toAppVersionPayload(payload: unknown): AppVersionPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid app version payload.");
  }

  const record = payload as Record<string, unknown>;
  const version = record.version;
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("Invalid app version payload.");
  }

  return { ...record, version: version.trim() };
}

export async function getAppVersion(timeoutMs = VERSION_TIMEOUT_MS): Promise<AppVersionPayload> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveVersionUrl(), {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch app version (status ${response.status}).`);
    }

    const payload = await response.json();
    return toAppVersionPayload(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Failed to fetch app version (request timed out).");
    }
    if (error instanceof Error) {
      throw new Error(`Failed to fetch app version (${error.message}).`);
    }
    throw new Error("Failed to fetch app version.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}
