import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchWorkspaceTableColumns,
  type WorkspaceColumnRow,
} from "@/shared/services/queryStudioAdminApi";
import {
  DOMAIN_TABLE_DND_MIME,
  type AvailableDomainTable,
} from "./graphTypes";
import { isFlowForgeTableName } from "../../domainTablePresentation";

type Props = {
  tables: AvailableDomainTable[];
  schemaOptions: string[];
  selectedSchema: string;
  onSchemaChange: (schema: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  workspaceId: string | null;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onAddTable: (table: AvailableDomainTable) => void;
};

type TableCardProps = {
  table: AvailableDomainTable;
  workspaceId: string | null;
  onAddTable: (table: AvailableDomainTable) => void;
  onDragStart: (event: DragEvent, table: AvailableDomainTable) => void;
};

function AvailableTableCard({
  table,
  workspaceId,
  onAddTable,
  onDragStart,
}: TableCardProps) {
  const [expanded, setExpanded] = useState(false);
  const canLoadColumns = typeof table.id === "number" && table.id > 0 && !!workspaceId;
  const flowforgeTable = isFlowForgeTableName(table.tableName);

  const columnsQ = useQuery({
    queryKey: ["workspaceTableColumns", { workspaceId, workspaceTableId: table.id }],
    enabled: expanded && canLoadColumns,
    queryFn: () => fetchWorkspaceTableColumns(table.id as number, workspaceId),
    staleTime: 30_000,
  });

  const columns = (columnsQ.data?.rows ?? []) as WorkspaceColumnRow[];

  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, table)}
      onDoubleClick={() => onAddTable(table)}
      style={{
        border: flowforgeTable ? "1px solid #fca5a5" : "1px solid #d8e0ea",
        borderRadius: 7,
        padding: 6,
        background: flowforgeTable ? "#fff7ed" : "#f8fafc",
        cursor: "grab",
        position: "relative",
        boxShadow: flowforgeTable ? "0 3px 8px rgba(185, 28, 28, 0.08)" : undefined,
      }}
      title="Drag to canvas, double-click to add, or use +"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 6,
          paddingRight: 2,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 5,
            minWidth: 0,
          }}
        >
          <span
            style={{
              color: flowforgeTable ? "#991b1b" : "#1e293b",
              fontSize: 10.5,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={table.tableName}
          >
            {table.tableName}
          </span>
          {flowforgeTable ? (
            <span
              style={{
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: 999,
                color: "#991b1b",
                flex: "0 0 auto",
                fontSize: 8,
                fontWeight: 700,
                lineHeight: 1,
                padding: "2px 5px",
              }}
            >
              Workflow
            </span>
          ) : null}
        </div>

        <button
          className="btn btn-sm btn-outline-primary"
          style={{
            width: 18,
            height: 18,
            lineHeight: "12px",
            padding: 0,
            borderRadius: 999,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onAddTable(table);
          }}
          title="Add to graph"
          aria-label={`Add ${table.tableName} to graph`}
        >
          +
        </button>
      </div>

      <div style={{ fontSize: 9, color: "#64748b", marginTop: 2, marginBottom: 4 }}>
        {table.catalogName ? `${table.catalogName}.` : ""}
        {table.schemaName}
      </div>

      <button
        type="button"
        className="btn btn-link btn-sm p-0 text-decoration-none"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        style={{ fontSize: 10 }}
      >
        <span style={{ marginRight: 4 }}>{expanded ? "▾" : "▸"}</span>
        {expanded ? "Hide info" : "More info"}
      </button>

      {expanded ? (
        <div
          style={{
            marginTop: 6,
            borderTop: "1px solid #e2e8f0",
            paddingTop: 6,
            maxHeight: 140,
            overflow: "auto",
          }}
        >
          {!canLoadColumns ? (
            <div className="text-muted small">Column metadata unavailable.</div>
          ) : columnsQ.isLoading ? (
            <div className="text-muted small">Loading columns…</div>
          ) : columnsQ.isError ? (
            <div className="text-danger small">
              {((columnsQ.error as Error | null)?.message) || "Unable to load columns."}
            </div>
          ) : columns.length === 0 ? (
            <div className="text-muted small">No columns found.</div>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {columns.map((column) => (
                <div
                  key={`${column.id}:${column.column_name}`}
                  style={{
                    fontSize: 9.5,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {column.column_name}
                  </span>
                  <span style={{ color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {column.data_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function AvailableTablesSidebar({
  tables,
  schemaOptions,
  selectedSchema,
  onSchemaChange,
  searchValue,
  onSearchChange,
  workspaceId,
  isLoading = false,
  isError = false,
  errorMessage,
  onAddTable,
}: Props) {
  const filtered = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();
    return tables.filter((table) => {
      if (selectedSchema !== "ALL" && table.schemaName !== selectedSchema) return false;
      if (!needle) return true;
      return (
        table.fullName.toLowerCase().includes(needle) ||
        table.tableName.toLowerCase().includes(needle)
      );
    });
  }, [selectedSchema, searchValue, tables]);

  const onDragStart = (event: DragEvent, table: AvailableDomainTable) => {
    event.dataTransfer.setData(DOMAIN_TABLE_DND_MIME, JSON.stringify(table));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside
      style={{
        border: "1px solid #dbe2ea",
        borderRadius: 12,
        background: "#fff",
        padding: 10,
        height: "100%",
        overflow: "auto",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
        Available Tables
      </div>

      <div className="mb-2">
        <input
          className="form-control form-control-sm"
          placeholder="Search tables..."
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          value={selectedSchema}
          onChange={(event) => onSchemaChange(event.target.value)}
          aria-label="Schema filter"
        >
          {schemaOptions.map((schemaOption) => (
            <option key={schemaOption} value={schemaOption}>
              {schemaOption === "ALL" ? "All Schemas" : schemaOption}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {isLoading ? (
          <div className="text-muted small p-2">Loading workspace tables…</div>
        ) : isError ? (
          <div className="text-danger small p-2">
            {errorMessage || "Unable to load workspace tables."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-muted small p-2">
            No tables found for this workspace/schema.
          </div>
        ) : (
          filtered.map((table) => (
            <AvailableTableCard
              key={`${table.id ?? table.fullName}`}
              table={table}
              workspaceId={workspaceId}
              onAddTable={onAddTable}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </aside>
  );
}
