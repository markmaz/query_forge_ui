import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchWorkspaceNamespaces } from "@/shared/services/queryStudioAdminApi";

import type { ForgeMatchDraftResponse, ForgeMatchExecuteDraftSqlResponse } from "../types";

type Props = {
  open: boolean;
  draft: ForgeMatchDraftResponse | null;
  workspaceId: string | null | undefined;
  isExecuting?: boolean;
  executionResult: ForgeMatchExecuteDraftSqlResponse | null;
  onClose: () => void;
  onExecute: (input: { sql: string; catalog_name?: string; schema_name?: string }) => Promise<void>;
};

export default function ForgeMatchSqlWorkareaModal({
  open,
  draft,
  workspaceId,
  isExecuting = false,
  executionResult,
  onClose,
  onExecute,
}: Props) {
  const [sql, setSql] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [schemaName, setSchemaName] = useState("");

  useEffect(() => {
    if (!open || !draft) return;
    setSql(draft.editable_sql ?? draft.create_view_sql ?? draft.select_sql ?? "");
    setCatalogName("");
    setSchemaName("");
  }, [draft, open]);

  const catalogsQ = useQuery({
    queryKey: ["forge-match", "draft-workarea", workspaceId, "catalogs"],
    enabled: open && Boolean(workspaceId),
    queryFn: () => fetchWorkspaceNamespaces(String(workspaceId)),
    staleTime: 60_000,
  });

  const schemasQ = useQuery({
    queryKey: ["forge-match", "draft-workarea", workspaceId, "schemas", catalogName],
    enabled: open && Boolean(workspaceId),
    queryFn: () => fetchWorkspaceNamespaces(String(workspaceId), catalogName || undefined),
    staleTime: 60_000,
  });

  const catalogOptions = catalogsQ.data?.catalogs ?? [];
  const schemaOptions = schemasQ.data?.schemas ?? [];

  const tableLabels = useMemo(
    () =>
      (draft?.involved_tables ?? [])
        .map((table) => String(table.full_name ?? table.table_name ?? "").trim())
        .filter(Boolean),
    [draft?.involved_tables],
  );

  if (!open || !draft) return null;

  return (
    <div className="fm-drawer-overlay" role="presentation" onClick={onClose}>
      <div
        className="fm-modal fm-sql-workarea-modal"
        role="dialog"
        aria-label="View SQL Workarea"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fm-modal-header">
          <div>
            <h3 className="mb-0">View SQL Workarea</h3>
            <p className="small text-muted mb-0">
              Review the generated SQL, adjust catalog/schema if needed, edit it, and run it in the workspace datasource.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose} disabled={isExecuting}>
            Close
          </button>
        </div>

        <div className="fm-sql-workarea-body">
          <div className="fm-sql-workarea-meta">
            <div className="fm-sql-workarea-meta-card">
              <div className="small text-muted">Draft Artifact</div>
              <div className="fw-semibold">{draft.artifact_id}</div>
            </div>
            <div className="fm-sql-workarea-meta-card">
              <div className="small text-muted">Accepted Columns</div>
              <div className="fw-semibold">{draft.accepted_column_count}</div>
            </div>
            <div className="fm-sql-workarea-meta-card">
              <div className="small text-muted">Generated View Name</div>
              <div className="fw-semibold">{draft.view_name ?? "-"}</div>
            </div>
            <div className="fm-sql-workarea-meta-card">
              <div className="small text-muted">Executable</div>
              <div className="fw-semibold">{draft.is_executable ? "Yes" : "Needs review"}</div>
            </div>
          </div>

          {draft.blocking_reason ? (
            <div className="alert alert-warning" role="status">
              <div className="fw-semibold mb-1">Join resolution needs review</div>
              <div>{draft.blocking_reason}</div>
            </div>
          ) : null}

          {tableLabels.length > 0 ? (
            <div className="fm-sql-workarea-tables mb-3">
              <div className="fw-semibold mb-1">Tables involved</div>
              <div className="d-flex flex-wrap gap-2">
                {tableLabels.map((label) => (
                  <span key={label} className="fm-sql-workarea-table-chip">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="forge-match-draft-catalog">Catalog (optional)</label>
              <select
                id="forge-match-draft-catalog"
                className="form-select"
                value={catalogName}
                onChange={(event) => {
                  setCatalogName(event.target.value);
                  setSchemaName("");
                }}
                disabled={catalogsQ.isLoading}
              >
                <option value="">Use SQL as written</option>
                {catalogOptions.map((catalog) => (
                  <option key={catalog} value={catalog}>
                    {catalog}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="forge-match-draft-schema">Schema (optional)</label>
              <select
                id="forge-match-draft-schema"
                className="form-select"
                value={schemaName}
                onChange={(event) => setSchemaName(event.target.value)}
                disabled={schemasQ.isLoading}
              >
                <option value="">Use SQL as written</option>
                {schemaOptions.map((schema) => (
                  <option key={schema} value={schema}>
                    {schema}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="fm-sql-workarea-editor">
            <label className="form-label" htmlFor="forge-match-draft-sql">SQL</label>
            <textarea
              id="forge-match-draft-sql"
              className="form-control fm-sql-workarea-textarea"
              value={sql}
              onChange={(event) => setSql(event.target.value)}
              spellCheck={false}
            />
          </div>

          {executionResult ? (
            <div className="alert alert-info mt-3 mb-0" role="status">
              <div className="fw-semibold mb-1">{executionResult.message ?? executionResult.status}</div>
              <div className="small mb-2">
                Statement type: <strong>{executionResult.statement_type}</strong> · Status:{" "}
                <strong>{executionResult.status}</strong> · Rows returned: <strong>{executionResult.row_count}</strong>
              </div>
              <pre className="fm-draft-sql-preview mb-0">
                <code>{executionResult.effective_sql}</code>
              </pre>
              {executionResult.rows.length > 0 ? (
                <pre className="fm-draft-sql-preview mt-3 mb-0">
                  <code>{JSON.stringify(executionResult.rows, null, 2)}</code>
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isExecuting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isExecuting || !sql.trim()}
            onClick={() =>
              void onExecute({
                sql: sql.trim(),
                catalog_name: catalogName || undefined,
                schema_name: schemaName || undefined,
              })
            }
          >
            {isExecuting ? "Running..." : "Run SQL"}
          </button>
        </div>
      </div>
    </div>
  );
}
