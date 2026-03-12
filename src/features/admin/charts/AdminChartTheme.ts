export const CHART_COLORS = {
  ok: "var(--qf-orange, var(--qf-orange-500, #ff5a1f))",
  warn: "var(--qf-orange-600, #f24a12)",
  err: "var(--qf-red-600, #dc2626)",
  // Requested high-contrast palette: orange, red, black, green, blue, brown.
  stage1: "#ff4d00", // orange
  stage2: "#ff1f3d", // red
  stage3: "#000000", // black
  stage4: "#00b33c", // green
  stage5: "#005dff", // blue
  stage6: "#9c4f00", // brown
  stage7: "#ff7a00", // bright orange variant
  stage8: "#00d084", // bright green variant
} as const;

export const GRID_COLOR = "var(--qf-border, rgba(15, 23, 42, 0.14))";
export const TEXT_PRIMARY = "var(--qf-text, #111827)";
export const TEXT_MUTED = "var(--qf-text-muted, #6b7280)";

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "0 ms";
  return `${Math.round(ms).toLocaleString()} ms`;
}

export function formatSeconds(ms: number): string {
  if (!Number.isFinite(ms)) return "0.00s";
  return `${(ms / 1000).toFixed(2)}s`;
}

export function latencyColor(ms: number): string {
  if (!Number.isFinite(ms)) return CHART_COLORS.warn;
  if (ms < 100) return CHART_COLORS.ok;
  if (ms <= 500) return CHART_COLORS.warn;
  return CHART_COLORS.err;
}
