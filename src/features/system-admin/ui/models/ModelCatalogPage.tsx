import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Card, CardBody, Col, Container, Row } from "reactstrap";

import {
  createModelColumn,
  createModelTable,
  deleteModelColumn,
  deleteModelTable,
  fetchModelColumns,
  fetchModelTables,
  patchModelColumn,
  patchModelTable,
  type ModelColumnRow,
  type ModelTableRow,
} from "@/shared/services/queryStudioAdminApi";
import CommonCardHeader from "@/shared/components/ExtendedCommonCardHeader";
import StyledTable from "@/shared/components/StyledTable";
import "../systemAdmin.css";

type TableFormState = {
  name: string;
  sourceTableName: string;
  description: string;
  origin: string;
};

type ColumnFormState = {
  columnName: string;
  dataType: string;
  description: string;
  semanticType: string;
  semanticEntity: string;
  semanticSubType: string;
  semanticConfidence: string;
  isActive: boolean;
};

const TABLES_QUERY_KEY = ["admin", "model-catalog", "tables"] as const;

function asColumnFormState(row: ModelColumnRow | null): ColumnFormState {
  if (!row) {
    return {
      columnName: "",
      dataType: "",
      description: "",
      semanticType: "",
      semanticEntity: "",
      semanticSubType: "",
      semanticConfidence: "",
      isActive: true,
    };
  }
  return {
    columnName: row.columnName,
    dataType: row.dataType ?? "",
    description: row.description ?? "",
    semanticType: row.semanticType ?? "",
    semanticEntity: row.semanticEntity ?? "",
    semanticSubType: row.semanticSubType ?? "",
    semanticConfidence:
      row.semanticConfidence === null || row.semanticConfidence === undefined
        ? ""
        : String(row.semanticConfidence),
    isActive: Boolean(row.isActive),
  };
}

function asTableFormState(row: ModelTableRow | null): TableFormState {
  if (!row) {
    return {
      name: "",
      sourceTableName: "",
      description: "",
      origin: "MANUAL",
    };
  }
  return {
    name: row.name,
    sourceTableName: row.sourceTableName ?? "",
    description: row.description ?? "",
    origin: row.origin ?? "MANUAL",
  };
}

export default function ModelCatalogPage() {
  const queryClient = useQueryClient();

  const [tableSearch, setTableSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const [tableEditorTarget, setTableEditorTarget] = useState<ModelTableRow | null | "new">(null);
  const [columnEditorTarget, setColumnEditorTarget] = useState<ModelColumnRow | null | "new">(null);
  const [deleteTableTarget, setDeleteTableTarget] = useState<ModelTableRow | null>(null);
  const [deleteColumnTarget, setDeleteColumnTarget] = useState<ModelColumnRow | null>(null);

  const tablesQuery = useQuery({
    queryKey: [...TABLES_QUERY_KEY, tableSearch],
    queryFn: () => fetchModelTables({ q: tableSearch || undefined, limit: 500, offset: 0 }),
    staleTime: 15_000,
  });

  const tableRows = useMemo(() => tablesQuery.data?.rows ?? [], [tablesQuery.data]);

  const selectedTable = useMemo(() => {
    if (!selectedTableId) return null;
    return tableRows.find((row) => row.id === selectedTableId) ?? null;
  }, [tableRows, selectedTableId]);

  const columnsQuery = useQuery({
    queryKey: ["admin", "model-catalog", "columns", selectedTable?.name ?? null, columnSearch],
    queryFn: () =>
      fetchModelColumns({
        table: selectedTable?.name,
        q: columnSearch || undefined,
        limit: 1500,
      }),
    enabled: Boolean(selectedTable?.name),
    staleTime: 10_000,
  });

  const columnRows = useMemo(() => columnsQuery.data?.rows ?? [], [columnsQuery.data]);

  const reloadTables = () => queryClient.invalidateQueries({ queryKey: TABLES_QUERY_KEY });
  const reloadColumns = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "model-catalog", "columns"] });
  };

  function toggleTableColumns(tableId: number) {
    setSelectedTableId((prev) => (prev === tableId ? null : tableId));
    setColumnSearch("");
  }

  const createTableMut = useMutation({
    mutationFn: createModelTable,
    onSuccess: () => {
      toast.success("Model table created");
      reloadTables();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to create model table"),
  });

  const patchTableMut = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => patchModelTable(id, patch),
    onSuccess: () => {
      toast.success("Model table updated");
      reloadTables();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update model table"),
  });

  const deleteTableMut = useMutation({
    mutationFn: (id: number) => deleteModelTable(id),
    onSuccess: () => {
      toast.success("Model table deleted");
      reloadTables();
      setDeleteTableTarget(null);
      setSelectedTableId(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete model table"),
  });

  const createColumnMut = useMutation({
    mutationFn: createModelColumn,
    onSuccess: () => {
      toast.success("Model column created");
      reloadColumns();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to create model column"),
  });

  const patchColumnMut = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => patchModelColumn(id, patch),
    onSuccess: () => {
      toast.success("Model column updated");
      reloadColumns();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update model column"),
  });

  const deleteColumnMut = useMutation({
    mutationFn: (id: number) => deleteModelColumn(id),
    onSuccess: () => {
      toast.success("Model column deleted");
      reloadColumns();
      setDeleteColumnTarget(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete model column"),
  });

  function saveTable(form: TableFormState) {
    const payload = {
      name: form.name.trim(),
      sourceTableName: form.sourceTableName.trim() || null,
      description: form.description.trim() || null,
      origin: form.origin.trim() || null,
    };
    if (!payload.name) {
      toast.error("Table name is required");
      return;
    }

    if (tableEditorTarget === "new") {
      createTableMut.mutate(payload, {
        onSuccess: (row) => {
          setSelectedTableId(row.id);
          setTableEditorTarget(null);
        },
      });
      return;
    }

    if (!tableEditorTarget) return;
    patchTableMut.mutate(
      { id: tableEditorTarget.id, patch: payload },
      { onSuccess: () => setTableEditorTarget(null) },
    );
  }

  function saveColumn(form: ColumnFormState) {
    if (!selectedTable) {
      toast.error("Select a table first");
      return;
    }

    const confidence = form.semanticConfidence.trim();
    const parsedConfidence = confidence === "" ? null : Number(confidence);
    if (confidence !== "" && !Number.isFinite(parsedConfidence)) {
      toast.error("Semantic confidence must be numeric");
      return;
    }

    if (columnEditorTarget === "new") {
      const createPayload = {
        tableName: selectedTable.name,
        columnName: form.columnName.trim(),
        dataType: form.dataType.trim() || null,
        description: form.description.trim() || null,
        isActive: form.isActive,
      };
      if (!createPayload.columnName) {
        toast.error("Column name is required");
        return;
      }
      createColumnMut.mutate(createPayload, {
        onSuccess: () => setColumnEditorTarget(null),
      });
      return;
    }

    if (!columnEditorTarget) return;

    patchColumnMut.mutate(
      {
        id: columnEditorTarget.id,
        patch: {
          dataType: form.dataType.trim() || null,
          description: form.description.trim() || null,
          semanticType: form.semanticType.trim() || null,
          semanticEntity: form.semanticEntity.trim() || null,
          semanticSubType: form.semanticSubType.trim() || null,
          semanticSource: "admin",
          semanticConfidence: parsedConfidence,
          isActive: form.isActive,
        },
      },
      { onSuccess: () => setColumnEditorTarget(null) },
    );
  }

  if (tablesQuery.isLoading) {
    return (
      <div className="sa-loading">
        <span className="sa-spinner lg" />
        Loading model catalog…
      </div>
    );
  }

  if (tablesQuery.isError) {
    return (
      <div className="sa-loading">
        <i className="fa fa-exclamation-triangle" style={{ color: "#ef4444", fontSize: "1.4rem" }} />
        Failed to load model catalog
      </div>
    );
  }

  return (
    <Container fluid className="qf-model-catalog-page">
      <Row>
        <Col sm="12">
          <Card>
            <CommonCardHeader
              title="Model Catalog"
              span={[
                {
                  text: `${tableRows.length} table${tableRows.length !== 1 ? "s" : ""}${
                    selectedTable ? ` • ${columnRows.length} columns in ${selectedTable.name}` : " • Expand a table to view columns"
                  }`,
                },
              ]}
              onInviteClick={() => setTableEditorTarget("new")}
              inviteLabel="New Table"
            />
            <CardBody>
              <div className="qf-model-toolbar">
                <input
                  className="form-control"
                  placeholder="Search tables…"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  style={{ maxWidth: 360 }}
                />
              </div>

              <StyledTable>
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Source</th>
                    <th>Description</th>
                    <th>Origin</th>
                    <th>Missing</th>
                    <th className="th-actions col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => {
                    const selected = selectedTable?.id === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className={selected ? "expanded expandable" : "expandable"}
                          onClick={() => setTableEditorTarget(row)}
                        >
                          <td>
                            <div className="sa-model-table-name-cell">
                              <button
                                type="button"
                                className="sa-table-expand-btn"
                                aria-label={selected ? `Collapse ${row.name} columns` : `Expand ${row.name} columns`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleTableColumns(row.id);
                                }}
                              >
                                <i className={`fa ${selected ? "fa-chevron-down" : "fa-chevron-right"}`} />
                              </button>
                              <span>{row.name}</span>
                            </div>
                          </td>
                          <td>{row.sourceTableName || "—"}</td>
                          <td>
                            <span className="sa-truncate" title={row.description || ""}>
                              {row.description || "—"}
                            </span>
                          </td>
                          <td>{row.origin || "—"}</td>
                          <td>{row.isMissingInSource ? "Yes" : "No"}</td>
                          <td className="td-actions">
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTableTarget(row);
                              }}
                              title="Delete table"
                            >
                              <i className="fa fa-trash" />
                            </button>
                          </td>
                        </tr>
                        {selected && (
                          <tr className="sa-table-inline-details-row">
                            <td colSpan={6}>
                              <div className="sa-model-columns-panel">
                                <div className="sa-model-columns-panel-header">
                                  <div>
                                    <h3>{row.name} Columns</h3>
                                    <p>Click a column row to edit details in the right drawer.</p>
                                  </div>
                                  <div className="sa-model-columns-actions">
                                    <input
                                      className="form-control"
                                      placeholder="Search columns…"
                                      value={columnSearch}
                                      onChange={(event) => setColumnSearch(event.target.value)}
                                      style={{ minWidth: 220 }}
                                    />
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() => setColumnEditorTarget("new")}
                                    >
                                      <i className="fa fa-plus" /> New Column
                                    </button>
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
                                        <th>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {columnsQuery.isLoading && (
                                        <tr>
                                          <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
                                            Loading columns…
                                          </td>
                                        </tr>
                                      )}
                                      {!columnsQuery.isLoading &&
                                        columnRows.map((column) => (
                                          <tr key={column.id} className="expandable" onClick={() => setColumnEditorTarget(column)}>
                                            <td>{column.columnName}</td>
                                            <td>{column.dataType || "—"}</td>
                                            <td>
                                              <span className="sa-truncate" title={column.description || ""}>
                                                {column.description || "—"}
                                              </span>
                                            </td>
                                            <td>{column.semanticType || "—"}</td>
                                            <td>{column.semanticEntity || "—"}</td>
                                            <td>{column.semanticSubType || "—"}</td>
                                            <td>
                                              {column.semanticConfidence === null || column.semanticConfidence === undefined
                                                ? "—"
                                                : column.semanticConfidence}
                                            </td>
                                            <td>{column.isActive ? "Yes" : "No"}</td>
                                            <td>
                                              <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  setDeleteColumnTarget(column);
                                                }}
                                                title="Delete column"
                                              >
                                                <i className="fa fa-trash" />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      {!columnsQuery.isLoading && columnRows.length === 0 && (
                                        <tr>
                                          <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
                                            No columns found for {row.name}
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
                      <td colSpan={6} style={{ textAlign: "center", padding: 28, color: "#6b7280" }}>
                        No model tables found
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
          key={tableEditorTarget === "new" ? "new-table" : `table-${tableEditorTarget.id}`}
          busy={createTableMut.isPending || patchTableMut.isPending}
          initial={asTableFormState(tableEditorTarget === "new" ? null : tableEditorTarget)}
          canDelete={tableEditorTarget !== "new"}
          title={tableEditorTarget === "new" ? "Create Model Table" : "Edit Model Table"}
          onCancel={() => setTableEditorTarget(null)}
          onDelete={() => {
            if (tableEditorTarget !== "new") {
              setTableEditorTarget(null);
              setDeleteTableTarget(tableEditorTarget);
            }
          }}
          onSave={saveTable}
        />
      )}

      {columnEditorTarget !== null && (
        <ColumnEditorDrawer
          key={columnEditorTarget === "new" ? "new-column" : `column-${columnEditorTarget.id}`}
          busy={createColumnMut.isPending || patchColumnMut.isPending}
          initial={asColumnFormState(columnEditorTarget === "new" ? null : columnEditorTarget)}
          canDelete={columnEditorTarget !== "new"}
          title={columnEditorTarget === "new" ? "Create Model Column" : "Edit Model Column"}
          disableColumnName={columnEditorTarget !== "new"}
          onCancel={() => setColumnEditorTarget(null)}
          onDelete={() => {
            if (columnEditorTarget !== "new") {
              setColumnEditorTarget(null);
              setDeleteColumnTarget(columnEditorTarget);
            }
          }}
          onSave={saveColumn}
        />
      )}

      {deleteTableTarget && (
        <ConfirmDialog
          title="Delete Model Table"
          message={`Delete table '${deleteTableTarget.name}' and its model columns?`}
          busy={deleteTableMut.isPending}
          onCancel={() => setDeleteTableTarget(null)}
          onConfirm={() => deleteTableMut.mutate(deleteTableTarget.id)}
        />
      )}

      {deleteColumnTarget && (
        <ConfirmDialog
          title="Delete Model Column"
          message={`Delete column '${deleteColumnTarget.columnName}'?`}
          busy={deleteColumnMut.isPending}
          onCancel={() => setDeleteColumnTarget(null)}
          onConfirm={() => deleteColumnMut.mutate(deleteColumnTarget.id)}
        />
      )}
    </Container>
  );
}

function TableEditorDrawer({
  title,
  initial,
  busy,
  canDelete,
  onSave,
  onDelete,
  onCancel,
}: {
  title: string;
  initial: TableFormState;
  busy: boolean;
  canDelete: boolean;
  onSave: (state: TableFormState) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<TableFormState>(initial);

  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onCancel} />
      <aside className="sa-drawer" role="dialog" aria-label={title}>
        <div className="sa-drawer-header">
          <h2>{title}</h2>
          <button className="btn btn-sm btn-light" onClick={onCancel} aria-label="Close table editor">
            <i className="fa fa-xmark" />
          </button>
        </div>
        <div className="sa-drawer-body">
          <div className="sa-drawer-form-card">
            <h3 className="sa-drawer-form-card-title">Table Details</h3>
            <div className="sa-field">
              <label>Table Name</label>
              <input
                className="form-control"
                value={state.name}
                onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
                autoFocus
              />
            </div>
            <div className="sa-field">
              <label>Source Table Name</label>
              <input
                className="form-control"
                value={state.sourceTableName}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, sourceTableName: event.target.value }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Origin</label>
              <input
                className="form-control"
                value={state.origin}
                onChange={(event) => setState((prev) => ({ ...prev, origin: event.target.value }))}
              />
            </div>
            <div className="sa-field" style={{ marginBottom: 0 }}>
              <label>Description</label>
              <textarea
                className="form-control"
                rows={4}
                value={state.description}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
          </div>
        </div>
        <div className="sa-drawer-footer" style={{ justifyContent: "space-between" }}>
          <div>
            {canDelete && (
              <button className="btn btn-sm btn-outline-danger" onClick={onDelete} disabled={busy}>
                <i className="fa fa-trash" /> Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm btn-secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => onSave(state)} disabled={busy}>
              {busy && <span className="sa-spinner" style={{ marginRight: 6 }} />}
              Save
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function ColumnEditorDrawer({
  title,
  initial,
  disableColumnName,
  busy,
  canDelete,
  onSave,
  onDelete,
  onCancel,
}: {
  title: string;
  initial: ColumnFormState;
  disableColumnName: boolean;
  busy: boolean;
  canDelete: boolean;
  onSave: (state: ColumnFormState) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<ColumnFormState>(initial);

  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onCancel} />
      <aside className="sa-drawer" role="dialog" aria-label={title}>
        <div className="sa-drawer-header">
          <h2>{title}</h2>
          <button className="btn btn-sm btn-light" onClick={onCancel} aria-label="Close column editor">
            <i className="fa fa-xmark" />
          </button>
        </div>
        <div className="sa-drawer-body">
          <div className="sa-drawer-form-card">
            <h3 className="sa-drawer-form-card-title">Column Details</h3>
            <div className="sa-field">
              <label>Column Name</label>
              <input
                className="form-control"
                value={state.columnName}
                disabled={disableColumnName}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, columnName: event.target.value }))
                }
                autoFocus
              />
            </div>
            <div className="sa-field">
              <label>Data Type</label>
              <input
                className="form-control"
                value={state.dataType}
                onChange={(event) => setState((prev) => ({ ...prev, dataType: event.target.value }))}
              />
            </div>
            <div className="sa-field">
              <label>Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={state.description}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Semantic Type</label>
              <input
                className="form-control"
                value={state.semanticType}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, semanticType: event.target.value }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Semantic Entity</label>
              <input
                className="form-control"
                value={state.semanticEntity}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, semanticEntity: event.target.value }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Semantic Sub Type</label>
              <input
                className="form-control"
                value={state.semanticSubType}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, semanticSubType: event.target.value }))
                }
              />
            </div>
            <div className="sa-field">
              <label>Semantic Confidence (0-1)</label>
              <input
                className="form-control"
                value={state.semanticConfidence}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, semanticConfidence: event.target.value }))
                }
              />
            </div>
            <div className="sa-field" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 0 }}>
              <input
                id="model-column-active"
                type="checkbox"
                checked={state.isActive}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, isActive: Boolean(event.target.checked) }))
                }
              />
              <label htmlFor="model-column-active" style={{ margin: 0 }}>
                Active
              </label>
            </div>
          </div>
        </div>
        <div className="sa-drawer-footer" style={{ justifyContent: "space-between" }}>
          <div>
            {canDelete && (
              <button className="btn btn-sm btn-outline-danger" onClick={onDelete} disabled={busy}>
                <i className="fa fa-trash" /> Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm btn-secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => onSave(state)} disabled={busy}>
              {busy && <span className="sa-spinner" style={{ marginRight: 6 }} />}
              Save
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function ConfirmDialog({
  title,
  message,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sa-dialog-backdrop">
      <div className="sa-dialog">
        <div className="sa-dialog-header">{title}</div>
        <div className="sa-dialog-body">{message}</div>
        <div className="sa-dialog-footer">
          <button className="btn btn-sm btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-sm btn-danger" onClick={onConfirm} disabled={busy}>
            {busy && <span className="sa-spinner" style={{ marginRight: 6 }} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
