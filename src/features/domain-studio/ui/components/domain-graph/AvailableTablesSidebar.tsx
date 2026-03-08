import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import {
  DOMAIN_TABLE_DND_MIME,
  MOCK_AVAILABLE_TABLES,
  type AvailableDomainTable,
} from "./graphTypes";

type Props = {
  tables?: AvailableDomainTable[];
  onAddTable: (table: AvailableDomainTable) => void;
};

export default function AvailableTablesSidebar({
  tables = MOCK_AVAILABLE_TABLES,
  onAddTable,
}: Props) {
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState<string>("ALL");

  const schemas = useMemo(() => {
    const unique = new Set<string>();
    tables.forEach((table) => unique.add(table.schemaName));
    return ["ALL", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [tables]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tables.filter((table) => {
      if (schema !== "ALL" && table.schemaName !== schema) return false;
      if (!needle) return true;
      return (
        table.fullName.toLowerCase().includes(needle) ||
        table.tableName.toLowerCase().includes(needle)
      );
    });
  }, [schema, search, tables]);

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
        padding: 12,
        height: "100%",
        overflow: "auto",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
        Available Tables
      </div>

      <div className="mb-2">
        <input
          className="form-control form-control-sm"
          placeholder="Search tables..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          value={schema}
          onChange={(event) => setSchema(event.target.value)}
          aria-label="Schema filter"
        >
          {schemas.map((schemaOption) => (
            <option key={schemaOption} value={schemaOption}>
              {schemaOption === "ALL" ? "All Schemas" : schemaOption}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {filtered.map((table) => (
          <div
            key={table.fullName}
            draggable
            onDragStart={(event) => onDragStart(event, table)}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 10,
              background: "#f8fafc",
              cursor: "grab",
            }}
            title="Drag to canvas or click Add"
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
              {table.tableName}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
              {table.catalogName ? `${table.catalogName}.` : ""}
              {table.schemaName}
            </div>
            <button
              className="btn btn-sm btn-outline-primary"
              style={{ width: "100%" }}
              onClick={() => onAddTable(table)}
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
