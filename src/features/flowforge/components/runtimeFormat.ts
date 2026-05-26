export function formatFlowForgeDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function summarizeJson(value: unknown) {
  if (value == null) return "None";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? value.map(summarizeJson).join(", ") : "None";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return "None";
    return entries
      .slice(0, 5)
      .map(([key, entryValue]) => `${key}: ${summarizeJson(entryValue)}`)
      .join("; ");
  }
  return String(value);
}
