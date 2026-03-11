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
    fontSize: 8,
    fontWeight: 600,
    lineHeight: "11px",
    padding: "0 4px",
    letterSpacing: 0.1,
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
        minWidth: 124,
        maxWidth: 150,
        borderRadius: 8,
        border: selected ? "2px solid #f97316" : "1px solid #dbe2ea",
        background: "#ffffff",
        boxShadow: selected
          ? "0 6px 12px rgba(15,23,42,0.16)"
          : "0 3px 9px rgba(15,23,42,0.10)",
        padding: 6,
        transition: "border-color 120ms ease, box-shadow 120ms ease",
      }}
    >
      <Handle
        type="target"
        id="target-left"
        position={Position.Left}
        style={{ width: 7, height: 7, background: "#64748b", border: "1px solid #fff" }}
      />
      <Handle
        type="source"
        id="source-right"
        position={Position.Right}
        style={{ width: 7, height: 7, background: "#334155", border: "1px solid #fff" }}
      />
      <Handle
        type="target"
        id="target-top"
        position={Position.Top}
        style={{ width: 7, height: 7, background: "#64748b", border: "1px solid #fff" }}
      />
      <Handle
        type="source"
        id="source-bottom"
        position={Position.Bottom}
        style={{ width: 7, height: 7, background: "#334155", border: "1px solid #fff" }}
      />

      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: "#0f172a",
          lineHeight: "10px",
          marginBottom: 2,
          whiteSpace: "normal",
          wordBreak: "break-word",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={data.tableName}
      >
        {data.tableName}
      </div>
      <div
        style={{
          fontSize: 8,
          color: "#475569",
          marginBottom: 5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={`Alias: ${data.alias}`}
      >
        Alias: <strong>{data.alias}</strong>
      </div>

      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {data.isRoot ? (
          <span style={badgeStyle("#fff7ed", "#c2410c")}>Root</span>
        ) : null}
        <span style={badgeStyle("#eef2ff", "#3730a3")}>{data.cardinality}</span>
        <span style={badgeStyle("#ecfdf5", "#166534")}>{data.filterMode}</span>
      </div>
    </div>
  );
}
