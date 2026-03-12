import pkg from "../../../package.json";

const FALLBACK_APP_VERSION = "0.0.0";

function readVersion(manifest: unknown): string {
  const version = (manifest as { version?: unknown }).version;
  return typeof version === "string" && version.trim().length > 0 ? version : FALLBACK_APP_VERSION;
}

export const APP_VERSION = readVersion(pkg);
