// src/features/domain-studio/ui/components/DictionaryColumnGrid.tsx
import React, { useState } from "react";
import { flexRender, type ColumnDef, type Table } from "@tanstack/react-table";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import type { WorkspaceDictionaryColumn } from "../../../../shared/services/queryStudioAdminApi";
import { EmptySectionState } from "../../../../shared/components/EmptySectionState";
import { toColumnLookupKey } from "./dictionaryTabUtils";

const DATA_TYPE_OPTIONS = [
  "string",
  "int",
  "bigint",
  "double",
  "decimal",
  "boolean",
  "date",
  "timestamp",
] as const;

function InlineTextArea(props: {
  value: string;
  placeholder?: string;
  onSave: (next: string) => void;
  disabled?: boolean;
  resetKey: string;
  onDone?: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  return (
    <div className="d-flex gap-2 align-items-start">
      <textarea
        key={props.resetKey}
        className="form-control form-control-sm dict-textarea"
        defaultValue={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          const next = e.target.value ?? "";
          if (dirty && next !== props.value) props.onSave(next);
          setDirty(false);
          props.onDone?.();
        }}
      />
      {dirty ? <span className="text-muted small mt-1">●</span> : null}
    </div>
  );
}

function DataTypeSelect(props: {
  value: string | null;
  options: readonly string[];
  disabled?: boolean;
  onSave: (next: string | null) => void;
  resetKey: string;
  onDone?: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const initial = props.value ?? "";
  return (
    <div className="d-flex gap-2 align-items-center">
      <select
        key={props.resetKey}
        className="form-select form-select-sm dict-dtype-select"
        defaultValue={initial}
        disabled={props.disabled}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          if (!dirty) {
            props.onDone?.();
            return;
          }
          const next = e.target.value;
          props.onSave(next ? next : null);
          setDirty(false);
          props.onDone?.();
        }}
      >
        <option value="">—</option>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {dirty ? <span className="text-muted small">●</span> : null}
    </div>
  );
}

export interface BuildDictionaryColumnsInput {
  editing: { id: number; field: "data_type" | "description" } | null;
  patchM: { mutate: (args: any) => void; isPending: boolean };
  onSetEditing: (
    v: { id: number; field: "data_type" | "description" } | null,
  ) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  onOpenPreview: (row: WorkspaceDictionaryColumn) => void;
}

export function buildDictionaryColumns({
  editing,
  patchM,
  onSetEditing,
  activeOnly,
  onActiveOnlyChange,
  onOpenPreview,
}: BuildDictionaryColumnsInput): ColumnDef<WorkspaceDictionaryColumn>[] {
  return [
    {
      header: "Column",
      accessorKey: "column_name",
      meta: { className: "col-colname" },
      cell: ({ row }) => (
        <div className="text-truncate" title={row.original.column_name}>
          {row.original.column_name}
        </div>
      ),
    },
    {
      header: "Data Type",
      accessorKey: "data_type",
      meta: { className: "col-dtype" },
      cell: ({ row }) => {
        const isEditing =
          editing?.id === row.original.id && editing.field === "data_type";
        if (!isEditing) {
          const label = row.original.data_type ?? "—";
          return (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none"
              onClick={() =>
                onSetEditing({ id: row.original.id, field: "data_type" })
              }
              disabled={patchM.isPending}
              title="Click to edit"
            >
              {label}
            </button>
          );
        }
        return (
          <DataTypeSelect
            value={row.original.data_type ?? null}
            options={DATA_TYPE_OPTIONS}
            disabled={patchM.isPending}
            resetKey={`${row.original.id}:${row.original.data_type ?? ""}`}
            onDone={() => onSetEditing(null)}
            onSave={(next) =>
              patchM.mutate({ id: row.original.id, patch: { data_type: next } })
            }
          />
        );
      },
    },
    {
      header: "Preview",
      id: "previewData",
      meta: { className: "col-preview" },
      cell: ({ row }) => (
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-decoration-none dict-preview-link"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenPreview(row.original);
          }}
        >
          Preview data
        </button>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      meta: { className: "col-desc" },
      cell: ({ row }) => {
        const isEditing =
          editing?.id === row.original.id && editing.field === "description";
        if (!isEditing) {
          const text = (row.original.description ?? "").trim();
          const previewText = text
            ? text.length > 80
              ? `${text.slice(0, 80)}…`
              : text
            : "—";
          return (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none text-start w-100 dict-desc-button"
              onClick={() =>
                onSetEditing({ id: row.original.id, field: "description" })
              }
              disabled={patchM.isPending}
              title="Click to edit"
            >
              <span className="text-truncate d-block">{previewText}</span>
            </button>
          );
        }
        return (
          <InlineTextArea
            value={row.original.description ?? ""}
            placeholder="Describe what this column means…"
            disabled={patchM.isPending}
            resetKey={`${row.original.id}:${row.original.description ?? ""}`}
            onDone={() => onSetEditing(null)}
            onSave={(next) =>
              patchM.mutate({
                id: row.original.id,
                patch: { description: next.trim() ? next : null },
              })
            }
          />
        );
      },
    },
    {
      header: "Active",
      accessorKey: "is_active",
      meta: { className: "col-active" },
      cell: ({ row }) => (
        <div className="form-check m-0">
          <input
            className="form-check-input"
            type="checkbox"
            checked={!!row.original.is_active}
            disabled={patchM.isPending}
            onChange={(e) => {
              const nextIsActive = e.target.checked;
              if (!nextIsActive && activeOnly) onActiveOnlyChange(false);
              patchM.mutate({
                id: row.original.id,
                patch: { is_active: nextIsActive },
              });
            }}
          />
        </div>
      ),
    },
  ];
}

export interface DictionaryColumnGridProps {
  selectedTable: { id: number; name: string } | null;
  rows: WorkspaceDictionaryColumn[];
  tableInst: Table<WorkspaceDictionaryColumn>;
  columns: ColumnDef<WorkspaceDictionaryColumn>[];
  modelQ: UseQueryResult;
  patchM: UseMutationResult<any, any, any, any>;
  editing: { id: number; field: "data_type" | "description" } | null;
  onSetEditing: (
    v: { id: number; field: "data_type" | "description" } | null,
  ) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  onOpenPreview: (row: WorkspaceDictionaryColumn) => void;
  rowRefMap: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
  pulsedColumnKey: string | null;
  qDraft: string;
  onQDraftChange: (v: string) => void;
  statusText: string;
}

export const DictionaryColumnGrid: React.FC<DictionaryColumnGridProps> = ({
  selectedTable,
  rows,
  tableInst,
  columns,
  modelQ,
  patchM: _patchM,
  editing: _editing,
  onSetEditing: _onSetEditing,
  activeOnly: _activeOnly,
  onActiveOnlyChange: _onActiveOnlyChange,
  onOpenPreview: _onOpenPreview,
  rowRefMap,
  pulsedColumnKey,
  qDraft,
  onQDraftChange,
  statusText,
}) => {
  return (
    <div className="card">
      <div className="card-header py-2">
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div className="dict-selected-table-title">
            {selectedTable?.name || "Select a table"}
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <div className="input-group input-group-sm" style={{ width: 360 }}>
              <span className="input-group-text bg-white">
                <i className="fa fa-search text-muted" aria-hidden="true" />
              </span>
              <input
                className="form-control"
                value={qDraft}
                onChange={(e) => onQDraftChange(e.target.value)}
                placeholder="Search columns (name / description)…"
                disabled={!selectedTable}
              />
            </div>
            <div
              className="text-muted small text-end"
              style={{ minWidth: 110 }}
            >
              <span style={{ visibility: statusText ? "visible" : "hidden" }}>
                {statusText || "…"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body p-0">
        {!selectedTable ? (
          <div className="p-3">
            <EmptySectionState
              iconClass="fa-table"
              title="Select a table"
              subtitle="Click a table on the left to load and edit its columns."
              ctaLabel="Select"
              onClick={() => {}}
            />
          </div>
        ) : (
          <>
            {modelQ.isError ? (
              <div className="alert alert-danger m-3 py-2">
                {(modelQ.error as Error).message}
              </div>
            ) : null}

            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 dict-table">
                <thead className="dict-thead">
                  {tableInst.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => {
                        const cls =
                          (h.column.columnDef.meta as any)?.className ?? "";
                        return (
                          <th key={h.id} className={`px-3 py-2 ${cls}`}>
                            {flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {modelQ.isLoading ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-3">
                        Loading…
                      </td>
                    </tr>
                  ) : tableInst.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-3">
                        No results.
                      </td>
                    </tr>
                  ) : (
                    tableInst.getRowModel().rows.map((r) => {
                      const key = toColumnLookupKey(
                        selectedTable?.name ?? "",
                        r.original.column_name,
                      );
                      const pulsing = pulsedColumnKey === key;
                      return (
                        <tr
                          key={r.id}
                          className={pulsing ? "dict-column-pulse" : ""}
                          ref={(node) => {
                            if (node) rowRefMap.current.set(key, node);
                            else rowRefMap.current.delete(key);
                          }}
                        >
                          {r.getVisibleCells().map((c) => {
                            const cls =
                              (c.column.columnDef.meta as any)?.className ?? "";
                            return (
                              <td key={c.id} className={`px-3 py-2 ${cls}`}>
                                {flexRender(
                                  c.column.columnDef.cell,
                                  c.getContext(),
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center p-2 border-top">
              <div className="text-muted small">
                Rows: {rows.length.toLocaleString()}
              </div>
              <div className="d-flex gap-2 align-items-center">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => tableInst.previousPage()}
                  disabled={!tableInst.getCanPreviousPage()}
                >
                  Prev
                </button>
                <div className="text-muted small">
                  Page {tableInst.getState().pagination.pageIndex + 1} of{" "}
                  {tableInst.getPageCount() || 1}
                </div>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => tableInst.nextPage()}
                  disabled={!tableInst.getCanNextPage()}
                >
                  Next
                </button>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 120 }}
                  value={tableInst.getState().pagination.pageSize}
                  onChange={(e) =>
                    tableInst.setPageSize(Number(e.target.value))
                  }
                >
                  {[25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n}/page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
