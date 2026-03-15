import type { SkillStatus } from "../types";

type Props = {
  status: SkillStatus;
};

const STATUS_CLASS: Record<SkillStatus, string> = {
  draft: "secondary",
  active: "success",
  paused: "warning",
  error: "danger",
};

const STATUS_LABEL: Record<SkillStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  error: "Error",
};

export default function SkillStatusBadge({ status }: Props) {
  return <span className={`badge text-bg-${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}
