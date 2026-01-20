import React, { useMemo, useState } from "react";
import { Chip } from "../Chip/Chip";
import "./chipGroup.css";

type ChipItem = {
  key: string;
  label: React.ReactNode;
  title?: string;
  disabled?: boolean;
};

type Props = {
  items: ChipItem[];
  onRemove: (key: string) => void;

  /** Optional */
  onClearAll?: () => void;
  clearAllLabel?: string;

  /** Show +N more (expand/collapse) */
  maxVisible?: number; // e.g. 12
  moreLabel?: (hiddenCount: number) => string; // default: +N more
  lessLabel?: string; // default: Show less

  /** UI */
  className?: string;
  emptyText?: React.ReactNode;
  disabled?: boolean;
};

export const ChipGroup: React.FC<Props> = ({
  items,
  onRemove,

  onClearAll,
  clearAllLabel = "Clear",
  maxVisible,
  moreLabel,
  lessLabel = "Show less",

  className,
  emptyText = null,
  disabled = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const { visibleItems, hiddenCount } = useMemo(() => {
    if (!maxVisible || expanded) return { visibleItems: items, hiddenCount: 0 };
    const v = items.slice(0, maxVisible);
    return { visibleItems: v, hiddenCount: Math.max(0, items.length - v.length) };
  }, [items, maxVisible, expanded]);

  const moreText = moreLabel ? moreLabel(hiddenCount) : `+${hiddenCount} more`;

  if (!items.length) {
    return emptyText ? <div className={`chipgroup__empty ${className ?? ""}`}>{emptyText}</div> : null;
  }

  return (
    <div className={`chipgroup ${className ?? ""}`}>
      <div className="chipgroup__row">
        <div className="chipgroup__chips">
          {visibleItems.map((it) => (
            <Chip
              key={it.key}
              label={it.label}
              title={it.title}
              disabled={disabled || it.disabled}
              removeAriaLabel={`Remove ${typeof it.label === "string" ? it.label : "item"}`}
              onRemove={() => onRemove(it.key)}
            />
          ))}

          {hiddenCount > 0 && (
            <button
              type="button"
              className="chipgroup__toggle"
              onClick={() => setExpanded(true)}
              disabled={disabled}
              title="Show more"
            >
              {moreText}
            </button>
          )}

          {maxVisible && expanded && items.length > maxVisible && (
            <button
              type="button"
              className="chipgroup__toggle"
              onClick={() => setExpanded(false)}
              disabled={disabled}
              title="Show less"
            >
              {lessLabel}
            </button>
          )}
        </div>

        {onClearAll && items.length > 0 && (
          <button
            type="button"
            className="chipgroup__clear"
            onClick={onClearAll}
            disabled={disabled}
            title={clearAllLabel}
          >
            {clearAllLabel}
          </button>
        )}
      </div>
    </div>
  );
};