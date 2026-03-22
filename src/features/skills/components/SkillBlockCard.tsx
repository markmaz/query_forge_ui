import type { SkillActionBlock, SkillConditionBlock, SkillTriggerBlock } from "../types";

type SkillBlock = SkillTriggerBlock | SkillConditionBlock | SkillActionBlock;

type Props = {
  block: SkillBlock;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

const KIND_CLASS: Record<SkillBlock["kind"], string> = {
  trigger: "trigger",
  condition: "condition",
  action: "action",
};

function configPreview(block: SkillBlock): string {
  const config = block.config || {};

  if (block.kind === "trigger") {
    if (block.type === "schedule") {
      const frequency = String(config.frequency || "daily");
      const time = String(config.time || "08:00");
      const timezone = String(config.timezone || "America/Chicago");
      return `${frequency} at ${time} (${timezone})`;
    }
    return "Trigger configured.";
  }

  if (block.kind === "condition") {
    if ("operator" in config || "value" in config) {
      const metric = String(config.metric || "row count");
      const operator = String(config.operator || ">");
      const value = String(config.value ?? config.threshold ?? "0");
      return `${metric} ${operator} ${value}`;
    }
    return "Condition configured.";
  }

  const hasDestination = Boolean(config.destination_id);
  const hasRecipients = typeof config.recipients === "string"
    ? config.recipients.trim().length > 0
    : Array.isArray(config.recipients) && config.recipients.length > 0;
  const hasWebhook = [config.webhook_url, config.endpoint_url, config.url].some(
    (value) => typeof value === "string" && value.trim().length > 0
  );

  if (block.type === "email_report" || block.type === "ai_summary_digest") {
    if (hasDestination) return "Saved destination attached.";
    if (hasRecipients) return "Recipients configured.";
    return "Destination not attached.";
  }

  if (block.type === "slack_delivery" || block.type === "webhook_delivery") {
    if (hasDestination) return "Saved destination attached.";
    if (hasWebhook) return "Direct webhook configured.";
    return "Destination not attached.";
  }

  const entries = Object.entries(config);
  if (!entries.length) return "No settings configured.";
  return entries.slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(" • ");
}

export default function SkillBlockCard({
  block,
  selected,
  expanded,
  onSelect,
  onToggleExpanded,
  onRemove,
  onMoveUp,
  onMoveDown,
}: Props) {
  return (
    <div className={`skills-block-card ${KIND_CLASS[block.kind]} ${selected ? "is-selected" : ""}`}>
      <div className="skills-block-head">
        <button type="button" className="skills-block-title" onClick={onSelect}>
          <span className="skills-block-kind text-uppercase">{block.kind}</span>
          <span className="skills-block-label">{block.label}</span>
        </button>
        <div className="skills-block-actions">
          {onMoveUp ? (
            <button type="button" className="btn btn-sm btn-light" onClick={onMoveUp} aria-label="Move up">
              <i className="fa fa-arrow-up" />
            </button>
          ) : null}
          {onMoveDown ? (
            <button type="button" className="btn btn-sm btn-light" onClick={onMoveDown} aria-label="Move down">
              <i className="fa fa-arrow-down" />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-sm btn-light"
            onClick={onToggleExpanded}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <i className={`fa ${expanded ? "fa-chevron-up" : "fa-chevron-down"}`} />
          </button>
          {onRemove ? (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRemove} aria-label="Remove">
              <i className="fa fa-trash" />
            </button>
          ) : null}
        </div>
      </div>
      {expanded ? <div className="skills-block-preview small text-muted">{configPreview(block)}</div> : null}
    </div>
  );
}
