import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import type { DomainGraphEdge } from "./graphTypes";

export default function DomainJoinEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<DomainGraphEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 14,
  });

  const label = data?.label || "Select join columns";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "#f97316" : "#64748b",
          strokeWidth: selected ? 2.5 : 1.8,
          opacity: 0.95,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            fontSize: 8,
            fontWeight: 600,
            color: selected ? "#c2410c" : "#334155",
            background: selected ? "#fff7ed" : "#f8fafc",
            border: selected ? "1px solid #fb923c" : "1px solid #cbd5e1",
            borderRadius: 5,
            padding: "0 4px",
            lineHeight: "12px",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
          }}
          className="nodrag nopan"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
