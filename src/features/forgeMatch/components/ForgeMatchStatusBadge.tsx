import type { ForgeMatchReviewStatus } from "@/shared/services/forgeMatch";

type Props = {
  status: ForgeMatchReviewStatus;
};

const STATUS_META: Record<ForgeMatchReviewStatus, { label: string; className: string }> = {
  suggested: { label: "Suggested", className: "fm-status-suggested" },
  accepted: { label: "Accepted", className: "fm-status-accepted" },
  rejected: { label: "Rejected", className: "fm-status-rejected" },
  needs_review: { label: "Needs Review", className: "fm-status-needs-review" },
  manually_mapped: { label: "Manual", className: "fm-status-manual" },
};

export default function ForgeMatchStatusBadge({ status }: Props) {
  const meta = STATUS_META[status] ?? STATUS_META.suggested;
  return <span className={`fm-status-badge ${meta.className}`}>{meta.label}</span>;
}
