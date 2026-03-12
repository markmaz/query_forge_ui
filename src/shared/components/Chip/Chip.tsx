import React, { useEffect, useRef, useState } from "react";
import "./chip.css";

type Props = {
  label: React.ReactNode;
  title?: string;
  onRemove?: () => void;
  disabled?: boolean;
  removeAriaLabel?: string;
};

export const Chip: React.FC<Props> = ({
  label,
  title,
  onRemove,
  disabled = false,
  removeAriaLabel = "Remove",
}) => {
  const [removing, setRemoving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canRemove = Boolean(onRemove) && !disabled;

  const triggerRemove = () => {
    if (!canRemove) return;
    setRemoving(true);
  };

  useEffect(() => {
    if (!removing) return;
    const t = setTimeout(() => onRemove?.(), 160);
    return () => clearTimeout(t);
  }, [removing, onRemove]);

  return (
    <div
      ref={ref}
      className={`chip ${removing ? "chip--removing" : ""} ${
        disabled ? "chip--disabled" : ""
      }`}
      tabIndex={disabled ? -1 : 0}
      title={title}
      onKeyDown={(e) => {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          triggerRemove();
        }
      }}
    >
      <span className="chip__label">{label}</span>

      {canRemove && (
        <button
          type="button"
          className="chip__remove"
          aria-label={removeAriaLabel}
          onClick={triggerRemove}
        >
          ×
        </button>
      )}
    </div>
  );
};
