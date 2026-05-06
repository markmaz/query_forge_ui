interface StatusBadgeProps {
  status?: string | null;
}

const toneByStatus: Record<string, string> = {
  completed: "is-success",
  failed: "is-danger",
  needs_attention: "is-danger",
  running: "is-info",
  waiting: "is-warning",
  queued: "is-muted",
  pending: "is-warning",
  sent: "is-success",
  accepted: "is-success",
  declined: "is-muted",
  enabled: "is-success",
  disabled: "is-muted",
  active: "is-success",
  draft: "is-warning",
  archived: "is-muted",
  valid: "is-success",
  invalid: "is-danger",
  warning: "is-warning",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = String(status || "unknown").trim().toLowerCase();
  const tone = toneByStatus[normalized] ?? "is-muted";

  return <span className={`ff-status-badge ${tone}`}>{normalized.replace(/_/g, " ")}</span>;
}
