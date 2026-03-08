import { useMemo, useState } from "react";
import type { AnalysisNodeType } from "../model/analysisTypes";
import { NODE_TYPE_LABELS } from "../model/analysisUtils";

type AddStepMenuProps = {
  onAddStep: (nodeType: AnalysisNodeType) => void;
  compact?: boolean;
  allowedTypes?: AnalysisNodeType[];
};

const DEFAULT_TYPES: AnalysisNodeType[] = ["domain", "filter", "select", "group", "metric", "sort", "limit"];

export function AddStepMenu(props: AddStepMenuProps) {
  const { onAddStep, compact = false, allowedTypes } = props;
  const [open, setOpen] = useState(false);
  const types = useMemo(() => allowedTypes ?? DEFAULT_TYPES, [allowedTypes]);

  return (
    <div className={`addStepMenu ${compact ? "addStepMenu--compact" : ""}`}>
      <button
        type="button"
        className="analysisBtn analysisBtn--add"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        + Add Step
      </button>
      {open ? (
        <div className="addStepMenu__list" role="menu">
          {types.map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => {
                onAddStep(type);
                setOpen(false);
              }}
            >
              {NODE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
