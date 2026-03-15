import type { SkillType } from "../types";

type Props = {
  skillType: SkillType;
  className?: string;
};

const ICON_BY_TYPE: Record<SkillType, string> = {
  threshold_alert: "fa fa-chart-line",
  ai_summary_digest: "fa fa-wand-magic-sparkles",
  webhook_delivery: "fa fa-link",
  data_freshness_check: "fa fa-clock",
  email_report: "fa fa-envelope",
  slack_delivery: "fa-brands fa-slack",
  custom: "fa fa-bolt",
};

export default function SkillTypeIcon({ skillType, className = "" }: Props) {
  return <i className={`${ICON_BY_TYPE[skillType]} ${className}`.trim()} aria-hidden="true" />;
}
