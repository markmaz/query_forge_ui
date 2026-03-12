import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchWorkspaceTableColumns,
  type WorkspaceColumnRow,
} from "@/shared/services/queryStudioAdminApi";
import type {
  DomainGraphEdge,
  DomainGraphNode,
  DomainJoinType,
  InspectorSelection,
} from "./graphTypes";

type Props = {
  selection: InspectorSelection;
  selectedNode: DomainGraphNode | null;
  selectedEdge: DomainGraphEdge | null;
  selectedEdgeSourceNode: DomainGraphNode | null;
  selectedEdgeTargetNode: DomainGraphNode | null;
  workspaceId: string | null;
  joinableColumns: readonly string[];
  onUpdateNode: (nodeId: string, patch: Partial<DomainGraphNode["data"]>) => void;
  onUpdateEdge: (edgeId: string, patch: Partial<NonNullable<DomainGraphEdge["data"]>>) => void;
  onDeleteSelected: () => void;
};

export default function DomainInspector({
  selection,
  selectedNode,
  selectedEdge,
  selectedEdgeSourceNode,
  selectedEdgeTargetNode,
  workspaceId,
  joinableColumns,
  onUpdateNode,
  onUpdateEdge,
  onDeleteSelected,
}: Props) {
  const sourceWorkspaceTableId =
    typeof selectedEdgeSourceNode?.data.tableId === "number"
      ? selectedEdgeSourceNode.data.tableId
      : null;
  const targetWorkspaceTableId =
    typeof selectedEdgeTargetNode?.data.tableId === "number"
      ? selectedEdgeTargetNode.data.tableId
      : null;

  const sourceColumnsQ = useQuery({
    queryKey: ["workspaceTableColumns", { workspaceId, workspaceTableId: sourceWorkspaceTableId }],
    enabled: selection?.type === "edge" && !!workspaceId && sourceWorkspaceTableId !== null,
    queryFn: () => fetchWorkspaceTableColumns(sourceWorkspaceTableId as number, workspaceId),
    staleTime: 30_000,
  });

  const targetColumnsQ = useQuery({
    queryKey: ["workspaceTableColumns", { workspaceId, workspaceTableId: targetWorkspaceTableId }],
    enabled: selection?.type === "edge" && !!workspaceId && targetWorkspaceTableId !== null,
    queryFn: () => fetchWorkspaceTableColumns(targetWorkspaceTableId as number, workspaceId),
    staleTime: 30_000,
  });

  const sourceColumnOptions = useMemo(() => {
    const rows = (sourceColumnsQ.data?.rows ?? []) as WorkspaceColumnRow[];
    if (rows.length === 0) return [...joinableColumns];
    return Array.from(new Set(rows.map((row) => row.column_name).filter(Boolean)));
  }, [joinableColumns, sourceColumnsQ.data?.rows]);

  const targetColumnOptions = useMemo(() => {
    const rows = (targetColumnsQ.data?.rows ?? []) as WorkspaceColumnRow[];
    if (rows.length === 0) return [...joinableColumns];
    return Array.from(new Set(rows.map((row) => row.column_name).filter(Boolean)));
  }, [joinableColumns, targetColumnsQ.data?.rows]);

  return (
    <aside
      style={{
        border: "1px solid #dbe2ea",
        borderRadius: 12,
        background: "#fff",
        padding: 14,
        height: "100%",
        overflow: "auto",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
        Inspector
      </div>

      {selection?.type === "node" && selectedNode ? (
        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Table Node</div>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{selectedNode.data.tableName}</div>

          <label className="form-label form-label-sm">Alias</label>
          <input
            className="form-control form-control-sm mb-2"
            value={selectedNode.data.alias}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, { alias: event.target.value })
            }
          />

          <label className="form-label form-label-sm">Filter Mode</label>
          <select
            className="form-select form-select-sm mb-2"
            value={selectedNode.data.filterMode}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, {
                filterMode: event.target.value as DomainGraphNode["data"]["filterMode"],
              })
            }
          >
            <option value="AUTO">AUTO</option>
            <option value="REQUIRED">REQUIRED</option>
            <option value="OPTIONAL">OPTIONAL</option>
          </select>

          <label className="form-label form-label-sm">Cardinality</label>
          <select
            className="form-select form-select-sm mb-2"
            value={selectedNode.data.cardinality}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, {
                cardinality: event.target.value as DomainGraphNode["data"]["cardinality"],
              })
            }
          >
            <option value="ONE">ONE</option>
            <option value="MANY">MANY</option>
          </select>

          <label className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              checked={Boolean(selectedNode.data.isRoot)}
              onChange={(event) =>
                onUpdateNode(selectedNode.id, { isRoot: event.target.checked })
              }
            />
            <span className="form-check-label">Is Root</span>
          </label>

          <button className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected}>
            Delete Node
          </button>
        </div>
      ) : null}

      {selection?.type === "edge" && selectedEdge ? (
        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Join Edge</div>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>
            {(selectedEdgeSourceNode?.data.tableName ?? selectedEdge.source)} →{" "}
            {(selectedEdgeTargetNode?.data.tableName ?? selectedEdge.target)}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>
            Source:{" "}
            <strong>{selectedEdgeSourceNode?.data.tableName ?? selectedEdge.source}</strong>
            <br />
            Target:{" "}
            <strong>{selectedEdgeTargetNode?.data.tableName ?? selectedEdge.target}</strong>
          </div>

          <label className="form-label form-label-sm">Join Type</label>
          <select
            className="form-select form-select-sm mb-2"
            value={selectedEdge.data?.joinType ?? "LEFT"}
            onChange={(event) =>
              onUpdateEdge(selectedEdge.id, {
                joinType: event.target.value as DomainJoinType,
              })
            }
          >
            <option value="LEFT">LEFT</option>
            <option value="INNER">INNER</option>
          </select>

          <label className="form-label form-label-sm">Source Column</label>
          <select
            className="form-select form-select-sm mb-2"
            value={selectedEdge.data?.sourceColumn ?? ""}
            disabled={sourceColumnsQ.isLoading}
            onChange={(event) =>
              onUpdateEdge(selectedEdge.id, {
                sourceColumn: event.target.value,
              })
            }
          >
            <option value="">Select column...</option>
            {sourceColumnOptions.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
          {sourceColumnsQ.isError ? (
            <div className="text-danger small mb-2">
              {((sourceColumnsQ.error as Error | null)?.message) || "Unable to load source columns."}
            </div>
          ) : null}

          <label className="form-label form-label-sm">Target Column</label>
          <select
            className="form-select form-select-sm mb-3"
            value={selectedEdge.data?.targetColumn ?? ""}
            disabled={targetColumnsQ.isLoading}
            onChange={(event) =>
              onUpdateEdge(selectedEdge.id, {
                targetColumn: event.target.value,
              })
            }
          >
            <option value="">Select column...</option>
            {targetColumnOptions.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
          {targetColumnsQ.isError ? (
            <div className="text-danger small mb-2">
              {((targetColumnsQ.error as Error | null)?.message) || "Unable to load target columns."}
            </div>
          ) : null}

          <button className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected}>
            Delete Join
          </button>
        </div>
      ) : null}

      {!selection ? (
        <div
          style={{
            border: "1px dashed #cbd5e1",
            borderRadius: 10,
            padding: 14,
            background: "#f8fafc",
            color: "#475569",
            fontSize: 13,
          }}
        >
          Select a table node or join edge to edit details.
        </div>
      ) : null}
    </aside>
  );
}
