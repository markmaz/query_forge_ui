import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  buildSemanticCatalog,
  SemanticCatalogBuildApiError,
  type SemanticCatalogBuildResponse,
  type SemanticCatalogBuildResult,
  type SemanticCatalogPreviewRow,
  type SemanticCatalogValidationErrors,
} from "@/features/system-admin/api";
import { fetchDomains, type Domain } from "@/shared/services/queryStudioAdminApi";
import "../systemAdmin.css";

type BuildMode = "preview" | "run";
type PreviewTab = "concepts" | "aliases" | "relationships" | "index";

type BuilderFormState = {
  domainId: string;
  verticalNorm: string;
  domainName: string;
  tableLimit: string;
  dryRun: boolean;
};

const PAGE_SIZE = 10;

const TAB_CONFIG: Array<{
  key: PreviewTab;
  label: string;
  accessor: (result: SemanticCatalogBuildResult) => SemanticCatalogPreviewRow[];
}> = [
  { key: "concepts", label: "Concepts", accessor: (result) => result.concept_preview },
  { key: "aliases", label: "Aliases", accessor: (result) => result.alias_preview },
  { key: "relationships", label: "Relationships", accessor: (result) => result.relationship_preview },
  { key: "index", label: "Index Preview", accessor: (result) => result.index_preview },
];

const DEFAULT_FORM: BuilderFormState = {
  domainId: "",
  verticalNorm: "generic",
  domainName: "",
  tableLimit: "5000",
  dryRun: true,
};

function normalizePreviewRows(rows: SemanticCatalogPreviewRow[]): SemanticCatalogPreviewRow[] {
  return rows.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return row;
    }
    return { value: row };
  });
}

function previewColumns(rows: SemanticCatalogPreviewRow[]): string[] {
  const normalized = normalizePreviewRows(rows);
  const keySet = new Set<string>();
  normalized.slice(0, 25).forEach((row) => {
    Object.keys(row).forEach((key) => keySet.add(key));
  });
  return Array.from(keySet);
}

function displayCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function summarizeValidationErrors(errors: SemanticCatalogValidationErrors): string[] {
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages.map((message: string) => (field === "_error" ? message : `${field}: ${message}`)),
  );
}

function validateForm(form: BuilderFormState): SemanticCatalogValidationErrors {
  const errors: SemanticCatalogValidationErrors = {};

  const domainId = Number(form.domainId);
  if (!Number.isInteger(domainId) || domainId <= 0) {
    errors.domain_id = ["Domain ID is required and must be a positive integer."];
  }

  const tableLimit = Number(form.tableLimit);
  if (!Number.isInteger(tableLimit) || tableLimit < 1 || tableLimit > 50000) {
    errors.table_limit = ["Table limit must be an integer between 1 and 50000."];
  }

  return errors;
}

function buildRequestPayload(form: BuilderFormState, mode: BuildMode) {
  return {
    domain_id: Number(form.domainId),
    vertical_norm: form.verticalNorm.trim() || "generic",
    domain_name: form.domainName.trim() || undefined,
    table_limit: Number(form.tableLimit),
    dry_run: mode === "preview" ? true : false,
  };
}

function ResultSummaryCards({ result }: { result: SemanticCatalogBuildResult }) {
  const cards = [
    { key: "profiles", label: "Profiles", value: result.profile_count },
    { key: "enriched", label: "Enriched", value: result.enriched_count },
    { key: "concepts", label: "Concepts", value: result.concepts_upserted },
    { key: "aliases", label: "Aliases", value: result.aliases_upserted },
    { key: "relationships", label: "Relationships", value: result.relationships_upserted },
    { key: "value-aliases", label: "Value Aliases", value: result.value_aliases_upserted },
    { key: "derived-metrics", label: "Derived Metrics", value: result.derived_metrics_created },
    { key: "index-items", label: "Index Items", value: result.index_items_count },
  ];

  return (
    <div className="sa-card-grid sa-semantic-summary-grid">
      {cards.map((card) => (
        <article key={card.key} className="sa-card">
          <div className="sa-card-header">
            <h3 className="sa-card-title">{card.label}</h3>
          </div>
          <div className="sa-card-body">
            <div className="sa-semantic-summary-value">{card.value}</div>
          </div>
        </article>
      ))}
    </div>
  );
}

function PreviewTable({ rows, tabKey }: { rows: SemanticCatalogPreviewRow[]; tabKey: PreviewTab }) {
  const normalizedRows = normalizePreviewRows(rows);
  const columns = previewColumns(normalizedRows);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(normalizedRows.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = normalizedRows.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tabKey, rows]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (normalizedRows.length === 0) {
    return <div className="alert alert-light mb-0">No preview rows returned for this tab.</div>;
  }

  return (
    <div>
      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={`${tabKey}-${column}`}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => (
              <tr key={`${tabKey}-${rowIndex}`}>
                {columns.map((column) => (
                  <td key={`${tabKey}-${rowIndex}-${column}`}>{displayCellValue(row[column])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex justify-content-between align-items-center mt-2">
        <small className="text-muted">
          Showing {start + 1}-{Math.min(start + PAGE_SIZE, normalizedRows.length)} of {normalizedRows.length}
        </small>
        <div className="btn-group" role="group" aria-label={`${tabKey} pagination`}>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled>
            Page {page}/{totalPages}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SemanticCatalogBuilderPage() {
  const [form, setForm] = useState<BuilderFormState>(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState<SemanticCatalogValidationErrors>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [result, setResult] = useState<SemanticCatalogBuildResult | null>(null);
  const [rawResponse, setRawResponse] = useState<SemanticCatalogBuildResponse | null>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>("concepts");
  const [showRunConfirm, setShowRunConfirm] = useState(false);

  const domainsQuery = useQuery({
    queryKey: ["semantic-catalog", "domains"],
    queryFn: fetchDomains,
    staleTime: 60_000,
  });

  const domainRows = useMemo(() => {
    const rows = domainsQuery.data?.rows ?? [];
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [domainsQuery.data]);

  const selectedDomain = useMemo<Domain | null>(() => {
    const selectedId = Number(form.domainId);
    if (!Number.isFinite(selectedId) || selectedId <= 0) return null;
    return domainRows.find((domain) => Number(domain.id) === selectedId) ?? null;
  }, [domainRows, form.domainId]);

  useEffect(() => {
    if (!selectedDomain) return;
    setForm((prev) => {
      if (prev.domainName.trim() === selectedDomain.name.trim()) return prev;
      return { ...prev, domainName: selectedDomain.name };
    });
  }, [selectedDomain]);

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildRequestPayload>) => buildSemanticCatalog(payload),
    onSuccess: (response) => {
      setResult(response.result);
      setRawResponse(response);
      setFieldErrors({});
      setPageError(null);
      toast.success(`Semantic catalog ${response.result.dry_run ? "preview" : "build"} completed.`);
    },
    onError: (error) => {
      const normalized =
        error instanceof SemanticCatalogBuildApiError
          ? error
          : new SemanticCatalogBuildApiError("Semantic catalog build failed.");
      setFieldErrors(normalized.fieldErrors);
      setPageError(normalized.message);
      toast.error(normalized.message);
    },
  });

  const validationSummary = useMemo(() => summarizeValidationErrors(fieldErrors), [fieldErrors]);

  async function runBuild(mode: BuildMode) {
    const clientErrors = validateForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setPageError("Please correct the highlighted fields.");
      return;
    }

    setFieldErrors({});
    setPageError(null);

    const payload = buildRequestPayload(
      {
        ...form,
        domainName: selectedDomain?.name ?? form.domainName,
      },
      mode,
    );
    try {
      await mutation.mutateAsync(payload);
    } catch {
      // handled by onError
    }
  }

  const activeRows = result
    ? TAB_CONFIG.find((tab) => tab.key === activeTab)?.accessor(result) ?? []
    : [];

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Semantic Catalog Builder</h1>
          <p className="sa-page-subtitle">
            Run dry-run previews or write-mode semantic catalog builds for a specific domain.
          </p>
        </div>
      </div>

      <section className="sa-card mb-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runBuild("preview");
          }}
        >
          {pageError && (
            <div className="alert alert-danger" role="alert">
              {pageError}
            </div>
          )}

          {validationSummary.length > 0 && (
            <div className="alert alert-warning" role="alert">
              <div className="fw-semibold mb-1">Validation details</div>
              <ul className="mb-0">
                {validationSummary.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label" htmlFor="semantic-domain-id">Domain</label>
              <select
                id="semantic-domain-id"
                className={`form-control ${fieldErrors.domain_id ? "is-invalid" : ""}`}
                value={form.domainId}
                onChange={(event) => setForm((prev) => ({ ...prev, domainId: event.target.value }))}
                disabled={domainsQuery.isLoading || domainsQuery.isError}
              >
                <option value="">{domainsQuery.isLoading ? "Loading domains..." : "Select a domain"}</option>
                {domainRows.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name} (ID: {domain.id})
                  </option>
                ))}
              </select>
              {fieldErrors.domain_id && <div className="invalid-feedback">{fieldErrors.domain_id[0]}</div>}
              {domainsQuery.isError && (
                <div className="text-danger small mt-1">Unable to load domains. Refresh and try again.</div>
              )}
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="semantic-vertical-norm">Vertical Norm</label>
              <input
                id="semantic-vertical-norm"
                className="form-control"
                value={form.verticalNorm}
                onChange={(event) => setForm((prev) => ({ ...prev, verticalNorm: event.target.value }))}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="semantic-table-limit">Table Limit</label>
              <input
                id="semantic-table-limit"
                type="number"
                min={1}
                max={50000}
                className={`form-control ${fieldErrors.table_limit ? "is-invalid" : ""}`}
                value={form.tableLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, tableLimit: event.target.value }))}
              />
              {fieldErrors.table_limit && <div className="invalid-feedback">{fieldErrors.table_limit[0]}</div>}
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="semantic-domain-name">Domain Name</label>
              <input
                id="semantic-domain-name"
                className="form-control"
                value={selectedDomain?.name ?? form.domainName}
                readOnly
              />
            </div>

            <div className="col-12 d-flex justify-content-between align-items-center flex-wrap gap-2">
              <label className="form-check form-switch mb-0" htmlFor="semantic-dry-run-toggle">
                <input
                  id="semantic-dry-run-toggle"
                  className="form-check-input"
                  type="checkbox"
                  checked={form.dryRun}
                  onChange={(event) => setForm((prev) => ({ ...prev, dryRun: event.target.checked }))}
                />
                <span className="form-check-label">Dry run enabled by default</span>
              </label>

              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Building...
                    </>
                  ) : (
                    "Preview Build"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={mutation.isPending}
                  onClick={() => setShowRunConfirm(true)}
                >
                  Run Build
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>

      {result && (
        <section className="mb-3" aria-live="polite">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <h2 className="h5 mb-0">Result Summary</h2>
            <span className={`badge ${result.dry_run ? "text-bg-warning" : "text-bg-success"}`}>
              {result.dry_run ? "Dry Run" : "Write Mode"}
            </span>
          </div>

          <ResultSummaryCards result={result} />

          <div className="sa-card mb-3">
            <ul className="nav nav-tabs mb-3" role="tablist" aria-label="Preview tabs">
              {TAB_CONFIG.map((tab) => {
                const tabRows = tab.accessor(result);
                const active = tab.key === activeTab;
                return (
                  <li className="nav-item" role="presentation" key={tab.key}>
                    <button
                      className={`nav-link ${active ? "active" : ""}`}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      aria-selected={active}
                      role="tab"
                    >
                      {tab.label} ({tabRows.length})
                    </button>
                  </li>
                );
              })}
            </ul>

            <PreviewTable rows={activeRows} tabKey={activeTab} />
          </div>

          <details className="sa-card sa-raw-json-details">
            <summary className="fw-semibold">Raw JSON</summary>
            <pre className="sa-raw-json">{JSON.stringify(rawResponse, null, 2)}</pre>
          </details>
        </section>
      )}

      {showRunConfirm && (
        <div className="sa-dialog-backdrop" onClick={() => setShowRunConfirm(false)}>
          <div className="sa-dialog" role="dialog" aria-label="Confirm semantic catalog build" onClick={(event) => event.stopPropagation()}>
            <div className="sa-dialog-header">
              <span>Run semantic catalog build?</span>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => setShowRunConfirm(false)}
                aria-label="Close"
              >
                <i className="fa fa-xmark" />
              </button>
            </div>
            <div className="sa-dialog-body">
              <p className="mb-2">
                This will run the build in write mode and persist semantic catalog updates.
              </p>
              <p className="mb-0 text-muted">You can use Preview Build first to validate the result before writing.</p>
            </div>
            <div className="sa-dialog-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowRunConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={mutation.isPending}
                onClick={async () => {
                  setShowRunConfirm(false);
                  await runBuild("run");
                }}
              >
                {mutation.isPending ? "Running..." : "Run Build"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
