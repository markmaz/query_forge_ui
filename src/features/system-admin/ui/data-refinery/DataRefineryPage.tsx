import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Card, CardBody, Col, Container, Row } from "reactstrap";

import {
  fetchDictionaryColumns,
  fetchDictionaryTables,
  patchDictionaryColumn,
  patchDictionaryTable,
  type DictionaryTableRow,
  type WorkspaceDictionaryColumn,
} from "@/shared/services/queryStudioAdminApi";
import CommonCardHeader from "@/shared/components/ExtendedCommonCardHeader";
import StyledTable from "@/shared/components/StyledTable";
import "../systemAdmin.css";
import "../../../query-forge/ui/styles/queryForgeHero.css";

type TableFormState = {
  description: string;
};

type ColumnFormState = {
  dataType: string;
  description: string;
  semanticType: string;
  semanticEntity: string;
  semanticSubType: string;
  semanticConfidence: string;
  isActive: boolean;
};

const TABLES_QUERY_KEY = ["admin", "data-refinery", "tables"] as const;

function asColumnFormState(row: WorkspaceDictionaryColumn): ColumnFormState {
  return {
    dataType: row.data_type ?? "",
    description: row.description ?? "",
    semanticType: row.semantic_type ?? "",
    semanticEntity: row.semantic_entity ?? "",
    semanticSubType: row.semantic_sub_type ?? "",
    semanticConfidence:
      row.semantic_confidence === null || row.semantic_confidence === undefined
        ? ""
        : String(row.semantic_confidence),
    isActive: Boolean(row.is_active),
  };
}

function asTableFormState(row: DictionaryTableRow): TableFormState {
  return { description: row.description ?? "" };
}

export default function DataRefineryPage() {
  const queryClient = useQueryClient();

  const [tableSearch, setTableSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tableEditorTarget, setTableEditorTarget] =
    useState<DictionaryTableRow | null>(null);
  const [columnEditorTarget, setColumnEditorTarget] =
    useState<WorkspaceDictionaryColumn | null>(null);

  const tablesQuery = useQuery({
    queryKey: [...TABLES_QUERY_KEY, tableSearch],
    queryFn: () =>
      fetchDictionaryTables({
        q: tableSearch || undefined,
        limit: 500,
        offset: 0,
      }),
    staleTime: 15_000,
  });

  const tableRows = useMemo(
    () => tablesQuery.data?.rows ?? [],
    [tablesQuery.data],
  );

  const selectedTable = useMemo(
    () =>
      selectedTableId
        ? (tableRows.find((r) => r.id === selectedTableId) ?? null)
        : null,
    [tableRows, selectedTableId],
  );

  const columnsQuery = useQuery({
    queryKey: [
      "admin",
      "data-refinery",
      "columns",
      selectedTableId,
      columnSearch,
    ],
    queryFn: () =>
      fetchDictionaryColumns({
        workspace_table_id: selectedTableId!,
        q: columnSearch || undefined,
        active_only: false,
      }),
    enabled: selectedTableId !== null,
    staleTime: 10_000,
  });

  const columnRows = useMemo(
    () => columnsQuery.data?.rows ?? [],
    [columnsQuery.data],
  );

  const reloadTables = () =>
    queryClient.invalidateQueries({ queryKey: TABLES_QUERY_KEY });
  const reloadColumns = () =>
    queryClient.invalidateQueries({
      queryKey: ["admin", "data-refinery", "columns"],
    });

  function toggleTableColumns(tableId: number) {
    setSelectedTableId((prev) => (prev === tableId ? null : tableId));
    setColumnSearch("");
  }

  const patchTableMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: { description: string | null };
    }) => patchDictionaryTable(id, patch),
    onSuccess: () => {
      toast.success("Table updated");
      reloadTables();
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Failed to update table"),
  });

  const patchColumnMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: Parameters<typeof patchDictionaryColumn>[1];
    }) => patchDictionaryColumn(id, patch),
    onSuccess: () => {
      toast.success("Column updated");
      reloadColumns();
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Failed to update column"),
  });

  function saveTable(form: TableFormState) {
    if (!tableEditorTarget) return;
    patchTableMut.mutate(
      {
        id: tableEditorTarget.id,
        patch: { description: form.description.trim() || null },
      },
      { onSuccess: () => setTableEditorTarget(null) },
    );
  }

  function saveColumn(form: ColumnFormState) {
    if (!columnEditorTarget) return;
    const confidence = form.semanticConfidence.trim();
    const parsedConfidence = confidence === "" ? null : Number(confidence);
    if (confidence !== "" && !Number.isFinite(parsedConfidence)) {
      toast.error("Semantic confidence must be numeric");
      return;
    }
    patchColumnMut.mutate(
      {
        id: columnEditorTarget.id,
        patch: {
          data_type: form.dataType.trim() || null,
          description: form.description.trim() || null,
          semantic_type: form.semanticType.trim() || null,
          semantic_entity: form.semanticEntity.trim() || null,
          semantic_sub_type: form.semanticSubType.trim() || null,
          semantic_confidence: parsedConfidence,
          is_active: form.isActive,
        },
      },
      { onSuccess: () => setColumnEditorTarget(null) },
    );
  }

  if (tablesQuery.isLoading) {
    return (
      <div className="sa-loading">
        <span className="sa-spinner lg" />
        Loading Data Refinery…
      </div>
    );
  }

  if (tablesQuery.isError) {
    return (
      <div className="sa-loading">
        <i
          className="fa fa-exclamation-triangle"
          style={{ color: "#ef4444", fontSize: "1.4rem" }}
        />
        Failed to load Data Refinery
      </div>
    );
  }

  return (
    <Container fluid className="qf-model-catalog-page">
      <header className="qf-hero mb-3">
        <div className="qf-hero-main">
          <h1 className="qf-hero-title">Data Refinery</h1>
          <p className="qf-hero-subtitle mb-0">
            Enrich workspace tables and columns with semantic metadata for
            QueryForge planning and retrieval.
          </p>
        </div>
      </header>

      <Row>
        <Col sm="12">
          <Card>
            <CommonCardHeader
              title="Data Refinery"
              span={[
                {
                  text: `${tableRows.length} table${tableRows.length !== 1 ? "s" : ""}${
                    selectedTable
                      ? ` • ${columnRows.length} columns in ${selectedTable.table_name}`
                      : " • Expand a table to view columns"
                  }`,
                },
              ]}
            />
            <CardBody>
              <div className="qf-model-toolbar">
                <input
                  className="form-control"
                  placeholder="Search tables…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{ maxWidth: 360 }}
                />
              </div>

              <StyledTable>
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Full Name</th>
                    <th>Schema</th>
                    <th>Description</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => {
                    const selected = selectedTable?.id === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr className={selected ? "expanded" : undefined}>
                          <td>
                            <div className="sa-model-table-name-cell">
                              <button
                                type="button"
                                className="sa-table-expand-btn"
                                aria-label={
                                  selected
                                    ? `Collapse ${row.table_name} columns`
                                    : `Expand ${row.table_name} columns`
                                }
                                onClick={() => toggleTableColumns(row.id)}
                              >
                                <i
                                  className={`fa ${selected ? "fa-chevron-down" : "fa-chevron-right"}`}
                                />
                              </button>
                              <span>{row.table_name}</span>
                            </div>
                          </td>
                          <td>{row.full_name || "—"}</td>
                          <td>{row.schema_name || "—"}</td>
                          <td>
                            <span
                              className="sa-truncate"
                              title={row.description || ""}
                            >
                              {row.description || "—"}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-light"
                              aria-label={`Edit ${row.table_name}`}
                              onClick={() => setTableEditorTarget(row)}
                            >
                              <i className="fa fa-pencil" />
                            </button>
                          </td>
                        </tr>
                        {selected && (
                          <tr className="sa-table-inline-details-row">
                            <td colSpan={5}>
                              <div className="sa-model-columns-panel">
                                <div className="sa-model-columns-panel-header">
                                  <div>
                                    <h3>{row.table_name} Columns</h3>
                                    <p>
                                      Click a column to edit semantic metadata.
                                    </p>
                                  </div>
                                  <div className="sa-model-columns-actions">
                                    <input
                                      className="form-control"
                                      placeholder="Search columns…"
                                      value={columnSearch}
                                      onChange={(e) =>
                                        setColumnSearch(e.target.value)
                                      }
                                      style={{ minWidth: 220 }}
                                    />
                                  </div>
                                </div>
                                <div className="sa-model-columns-table-wrap">
                                  <table className="sa-table sa-table-nested">
                                    <thead>
                                      <tr>
                                        <th>Column</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th>Semantic Type</th>
                                        <th>Entity</th>
                                        <th>Sub Type</th>
                                        <th>Confidence</th>
                                        <th>Active</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {columnsQuery.isLoading && (
                                        <tr>
                                          <td
                                            colSpan={8}
                                            style={{
                                              textAlign: "center",
                                              padding: 24,
                                              color: "#6b7280",
                                            }}
                                          >
                                            Loading columns…
                                          </td>
                                        </tr>
                                      )}
                                      {!columnsQuery.isLoading &&
                                        columnRows.map((col) => (
                                          <tr
                                            key={col.id}
                                            className="expandable"
                                            onClick={() =>
                                              setColumnEditorTarget(col)
                                            }
                                          >
                                            <td>{col.column_name}</td>
                                            <td>{col.data_type || "—"}</td>
                                            <td>
                                              <span
                                                className="sa-truncate"
                                                title={col.description || ""}
                                              >
                                                {col.description || "—"}
                                              </span>
                                            </td>
                                            <td>{col.semantic_type || "—"}</td>
                                            <td>
                                              {col.semantic_entity || "—"}
                                            </td>
                                            <td>
                                              {col.semantic_sub_type || "—"}
                                            </td>
                                            <td>
                                              {col.semantic_confidence ===
                                                null ||
                                              col.semantic_confidence ===
                                                undefined
                                                ? "—"
                                                : col.semantic_confidence}
                                            </td>
                                            <td>
                                              {col.is_active ? "Yes" : "No"}
                                            </td>
                                          </tr>
                                        ))}
                                      {!columnsQuery.isLoading &&
                                        columnRows.length === 0 && (
                                          <tr>
                                            <td
                                              colSpan={8}
                                              style={{
                                                textAlign: "center",
                                                padding: 24,
                                                color: "#6b7280",
                                              }}
                                            >
                                              No columns found for{" "}
                                              {row.table_name}
                                            </td>
                                          </tr>
                                        )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                          padding: 28,
                          color: "#6b7280",
                        }}
                      >
                        No workspace tables found
                      </td>
                    </tr>
                  )}
                </tbody>
              </StyledTable>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {tableEditorTarget !== null && (
        <TableEditorDrawer
          key={`table-${tableEditorTarget.id}`}
          busy={patchTableMut.isPending}
          initial={asTableFormState(tableEditorTarget)}
          onCancel={() => setTableEditorTarget(null)}
          onSave={saveTable}
        />
      )}

      {columnEditorTarget !== null && (
        <ColumnEditorDrawer
          key={`column-${columnEditorTarget.id}`}
          busy={patchColumnMut.isPending}
          columnName={columnEditorTarget.column_name}
          initial={asColumnFormState(columnEditorTarget)}
          onCancel={() => setColumnEditorTarget(null)}
          onSave={saveColumn}
        />
      )}
    </Container>
  );
}

// ---------------------------------------------------------------------------
// TableEditorDrawer — edit-only (description field only)
// ---------------------------------------------------------------------------

function TableEditorDrawer({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: TableFormState;
  busy: boolean;
  onSave: (state: TableFormState) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<TableFormState>(initial);

  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onCancel} />
      <aside className="sa-drawer" role="dialog" aria-label="Edit Table">
        <div className="sa-drawer-header">
          <h2>Edit Table</h2>
          <button
            className="btn btn-sm btn-light"
            onClick={onCancel}
            aria-label="Close table editor"
          >
            <i className="fa fa-xmark" />
          </button>
        </div>
        <div className="sa-drawer-body">
          <div className="sa-drawer-form-card">
            <h3 className="sa-drawer-form-card-title">Table Details</h3>
            <div className="sa-field" style={{ marginBottom: 0 }}>
              <label>Description</label>
              <textarea
                className="form-control"
                rows={4}
                value={state.description}
                autoFocus
                onChange={(e) =>
                  setState((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
        <div
          className="sa-drawer-footer"
          style={{ justifyContent: "flex-end" }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onSave(state)}
              disabled={busy}
            >
              {busy && (
                <span className="sa-spinner" style={{ marginRight: 6 }} />
              )}
              Save
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// ColumnEditorDrawer — edit-only (all semantic fields)
// ---------------------------------------------------------------------------

function ColumnEditorDrawer({
  columnName,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  columnName: string;
  initial: ColumnFormState;
  busy: boolean;
  onSave: (state: ColumnFormState) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<ColumnFormState>(initial);

  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onCancel} />
      <aside className="sa-drawer" role="dialog" aria-label="Edit Column">
        <div className="sa-drawer-header">
          <h2>Edit Column</h2>
          <button
            className="btn btn-sm btn-light"
            onClick={onCancel}
            aria-label="Close column editor"
          >
            <i className="fa fa-xmark" />
          </button>
        </div>
        <div className="sa-drawer-body">
          <div className="sa-drawer-form-card">
            <h3 className="sa-drawer-form-card-title">Column Details</h3>
            <div className="sa-field">
              <label>Column Name</label>
              <input className="form-control" value={columnName} disabled />
            </div>
            <div className="sa-field">
              <label>Data Type</label>
              <input
                className="form-control"
                value={state.dataType}
                autoFocus
                onChange={(e) =>
                  setState((prev) => ({ ...prev, dataType: e.target.value }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={state.description}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Semantic Type</label>
              <input
                className="form-control"
                value={state.semanticType}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    semanticType: e.target.value,
                  }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Semantic Entity</label>
              <input
                className="form-control"
                value={state.semanticEntity}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    semanticEntity: e.target.value,
                  }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Semantic Sub Type</label>
              <input
                className="form-control"
                value={state.semanticSubType}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    semanticSubType: e.target.value,
                  }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Semantic Confidence (0–1)</label>
              <input
                className="form-control"
                value={state.semanticConfidence}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    semanticConfidence: e.target.value,
                  }))
                }
              />
            </div>
            <div
              className="sa-field"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 0,
              }}
            >
              <input
                id="data-refinery-column-active"
                type="checkbox"
                checked={state.isActive}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    isActive: Boolean(e.target.checked),
                  }))
                }
              />
              <label
                htmlFor="data-refinery-column-active"
                style={{ margin: 0 }}
              >
                Active
              </label>
            </div>
          </div>
        </div>
        <div
          className="sa-drawer-footer"
          style={{ justifyContent: "flex-end" }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onSave(state)}
              disabled={busy}
            >
              {busy && (
                <span className="sa-spinner" style={{ marginRight: 6 }} />
              )}
              Save
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
