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
  const entries = Object.entries(block.config || {});
  if (!entries.length) return "No settings configured.";
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" • ");
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
