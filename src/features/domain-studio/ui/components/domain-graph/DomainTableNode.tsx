import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { DomainGraphNode } from "./graphTypes";

function badgeStyle(
  background: string,
  color: string
): CSSProperties {
  return {
    background,
    color,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: "16px",
    padding: "2px 8px",
    letterSpacing: 0.2,
    textTransform: "uppercase",
    border: "1px solid rgba(15, 23, 42, 0.1)",
  };
}

export default function DomainTableNode({
  data,
  selected,
}: NodeProps<DomainGraphNode>) {
  return (
    <div
      style={{
        minWidth: 240,
        maxWidth: 280,
        borderRadius: 12,
        border: selected ? "2px solid #f97316" : "1px solid #dbe2ea",
        background: "#ffffff",
        boxShadow: selected
          ? "0 10px 22px rgba(15,23,42,0.16)"
          : "0 6px 16px rgba(15,23,42,0.10)",
        padding: 12,
        transition: "border-color 120ms ease, box-shadow 120ms ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 10, height: 10, background: "#64748b", border: "1px solid #fff" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 10, height: 10, background: "#334155", border: "1px solid #fff" }}
      />

      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
        {data.tableName}
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>
        Alias: <strong>{data.alias}</strong>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {data.isRoot ? (
          <span style={badgeStyle("#fff7ed", "#c2410c")}>Root</span>
        ) : null}
        <span style={badgeStyle("#eef2ff", "#3730a3")}>{data.cardinality}</span>
        <span style={badgeStyle("#ecfdf5", "#166534")}>{data.filterMode}</span>
      </div>
    </div>
  );
}
