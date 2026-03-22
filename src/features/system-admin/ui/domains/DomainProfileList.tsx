import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  useDomainProfileList,
  useCreateDomainProfile,
  useUpdateDomainProfile,
  useDeleteDomainProfile,
} from "@/features/system-admin/hooks";
import {
  generateAllDomainProfiles,
  generateDomainProfile,
  generateDomainProfilesBatch,
  parseDomainProfileApiError,
  reindexDomainVectors,
} from "@/features/system-admin/api";
import type {
  DomainProfile,
  DomainProfileCreateRequest,
  DomainProfileGenerationResultRow,
  DomainProfileUpdateRequest,
} from "@/features/system-admin/types";
import DomainProfileForm from "./DomainProfileForm";
import "../systemAdmin.css";

type SortKey =
  | "domain_name"
  | "domain_id"
  | "summary"
  | "keywords"
  | "entities"
  | "metrics"
  | "updated_at";

type SortDir = "asc" | "desc";

type GenerationSummary = {
  total: number;
  generated: number;
  unchanged: number;
  failed: number;
};

type GenerationResultModalState = {
  title: string;
  summary: GenerationSummary;
  rows: DomainProfileGenerationResultRow[];
};

type GenerationActionState = {
  key: "selected" | "all" | "row";
  text: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function normalizeGenerationRow(raw: unknown): DomainProfileGenerationResultRow | null {
  const record = asRecord(raw);
  if (!record) return null;

  const domainId =
    asNumber(record.domain_id) ??
    asNumber(record.domainId) ??
    asNumber(record.id);
  const status = asString(record.status) ?? asString(record.result_status) ?? "unknown";

  if (domainId === null) return null;

  return {
    domain_id: domainId,
    status,
    trace_id: asString(record.trace_id) ?? asString(record.traceId),
    generation_time_ms:
      asNumber(record.generation_time_ms) ?? asNumber(record.generationTimeMs),
    error: asString(record.error) ?? asString(record.message),
    domain_name: asString(record.domain_name) ?? asString(record.domainName),
  };
}

function extractGenerationRows(payload: unknown): DomainProfileGenerationResultRow[] {
  const root = asRecord(payload);
  if (!root) return [];
  const result = asRecord(root.result);

  const possibleArrays: unknown[] = [
    root.results,
    root.rows,
    root.items,
    result?.results,
    result?.rows,
    result?.items,
  ];

  const rowsFromArrays = possibleArrays
    .filter((value) => Array.isArray(value))
    .flatMap((value) => (value as unknown[]).map(normalizeGenerationRow))
    .filter((row): row is DomainProfileGenerationResultRow => Boolean(row));

  if (rowsFromArrays.length > 0) return rowsFromArrays;

  const singleCandidates = [root.result, root];
  const row = singleCandidates
    .map(normalizeGenerationRow)
    .find((entry): entry is DomainProfileGenerationResultRow => Boolean(entry));
  return row ? [row] : [];
}

function isFailedStatus(status: string | null | undefined): boolean {
  const value = String(status ?? "").toLowerCase();
  return value.includes("fail") || value.includes("error");
}

function isGeneratedStatus(status: string | null | undefined): boolean {
  const value = String(status ?? "").toLowerCase();
  return value === "generated" || value === "created" || value === "updated";
}

function isUnchangedStatus(status: string | null | undefined): boolean {
  return String(status ?? "").toLowerCase() === "unchanged";
}

function summarizeGeneration(payload: unknown, rows: DomainProfileGenerationResultRow[]): GenerationSummary {
  const root = asRecord(payload);
  const result = asRecord(root?.result);

  const total =
    asNumber(root?.total) ??
    asNumber(result?.total) ??
    rows.length;
  const generated =
    asNumber(root?.generated) ??
    asNumber(result?.generated) ??
    rows.filter((row) => isGeneratedStatus(row.status)).length;
  const unchanged =
    asNumber(root?.unchanged) ??
    asNumber(result?.unchanged) ??
    rows.filter((row) => isUnchangedStatus(row.status)).length;
  const failed =
    asNumber(root?.failed) ??
    asNumber(result?.failed) ??
    rows.filter((row) => isFailedStatus(row.status) || Boolean(row.error)).length;

  return {
    total,
    generated,
    unchanged,
    failed,
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  return parseDomainProfileApiError(error, fallback).message;
}

export default function DomainProfileList() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useDomainProfileList();
  const createMut = useCreateDomainProfile();
  const updateMut = useUpdateDomainProfile();
  const deleteMut = useDeleteDomainProfile();

  const [drawerProfile, setDrawerProfile] = useState<DomainProfile | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<DomainProfile | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("domain_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<number>>(new Set());
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [generationAction, setGenerationAction] = useState<GenerationActionState | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResultModalState | null>(null);

  const profiles = data?.profiles ?? [];

  const sorted = useMemo(() => {
    const list = [...profiles];
    list.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "domain_name":
          av = a.domain_name ?? "";
          bv = b.domain_name ?? "";
          break;
        case "domain_id":
          av = a.domain_id;
          bv = b.domain_id;
          break;
        case "summary":
          av = a.summary ?? "";
          bv = b.summary ?? "";
          break;
        case "keywords":
          av = a.keywords?.length ?? 0;
          bv = b.keywords?.length ?? 0;
          break;
        case "entities":
          av = a.entities?.length ?? 0;
          bv = b.entities?.length ?? 0;
          break;
        case "metrics":
          av = a.metrics?.length ?? 0;
          bv = b.metrics?.length ?? 0;
          break;
        case "updated_at":
          av = a.updated_at ?? "";
          bv = b.updated_at ?? "";
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [profiles, sortKey, sortDir]);

  useEffect(() => {
    setSelectedDomainIds((prev) => {
      const validIds = new Set(profiles.map((profile) => profile.domain_id));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [profiles]);

  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending;
  const generating = generationAction !== null;
  const actionBusy = busy || generating;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return "fa-sort";
    return sortDir === "asc" ? "fa-sort-up" : "fa-sort-down";
  }

  function promptRebuild() {
    const rebuild = window.confirm("Rebuild domain vectors now?");
    if (rebuild) {
      reindexDomainVectors({ vertical_norm: "education" }).then(
        () => toast.success("Domain vector reindex started"),
        () => toast.error("Failed to start vector reindex"),
      );
    }
  }

  function handleSave(formData: DomainProfileCreateRequest | DomainProfileUpdateRequest) {
    if (drawerProfile === "new") {
      createMut.mutate(formData as DomainProfileCreateRequest, {
        onSuccess: () => {
          toast.success("Domain profile created");
          setDrawerProfile(null);
          promptRebuild();
        },
        onError: (err) => toast.error(`Create failed: ${err.message}`),
      });
    } else if (drawerProfile) {
      updateMut.mutate(
        { domainId: drawerProfile.domain_id, body: formData as DomainProfileUpdateRequest },
        {
          onSuccess: () => {
            toast.success("Domain profile updated");
            setDrawerProfile(null);
            promptRebuild();
          },
          onError: (err) => toast.error(`Update failed: ${err.message}`),
        },
      );
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.domain_id, {
      onSuccess: () => {
        toast.success("Domain profile deleted");
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(`Delete failed: ${err.message}`),
    });
  }

  function setDomainSelected(domainId: number, checked: boolean) {
    setSelectedDomainIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(domainId);
      else next.delete(domainId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedDomainIds(new Set());
      return;
    }
    setSelectedDomainIds(new Set(sorted.map((profile) => profile.domain_id)));
  }

  async function openGenerationResult(
    payload: unknown,
    title: string,
  ): Promise<GenerationResultModalState> {
    const rows = extractGenerationRows(payload);
    const summary = summarizeGeneration(payload, rows);
    const modalState = { title, summary, rows };
    setGenerationResult(modalState);
    return modalState;
  }

  function clearSuccessfulSelections(rows: DomainProfileGenerationResultRow[]) {
    if (rows.length === 0) return;
    setSelectedDomainIds((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => {
        if (isGeneratedStatus(row.status) || isUnchangedStatus(row.status)) {
          next.delete(row.domain_id);
        }
      });
      return next;
    });
  }

  async function refreshProfiles() {
    await refetch();
  }

  async function handleGenerateRow(profile: DomainProfile) {
    setGenerationAction({ key: "row", text: `Generating profile for ${profile.domain_name ?? `Domain ${profile.domain_id}`}...` });
    try {
      const payload = await generateDomainProfile(profile.domain_id, { force: forceRegenerate });
      const modal = await openGenerationResult(
        payload,
        `Domain ${profile.domain_id} Generation Result`,
      );
      if (modal.summary.failed > 0) {
        toast.warning("Generation completed with issues.");
      } else {
        toast.success("Domain profile generation completed.");
      }
      clearSuccessfulSelections(modal.rows);
      await refreshProfiles();
    } catch (err) {
      toast.error(toErrorMessage(err, "Unable to generate domain profile."));
    } finally {
      setGenerationAction(null);
    }
  }

  async function handleGenerateSelected() {
    const selectedIds = Array.from(selectedDomainIds);
    if (selectedIds.length === 0) {
      toast.warning("Select at least one domain profile first.");
      return;
    }

    setGenerationAction({
      key: "selected",
      text:
        selectedIds.length === 1
          ? "Generating selected domain profile..."
          : `Generating ${selectedIds.length} selected domain profiles...`,
    });

    try {
      let payload: unknown;
      if (selectedIds.length === 1) {
        payload = await generateDomainProfile(selectedIds[0], { force: forceRegenerate });
      } else {
        payload = await generateDomainProfilesBatch({
          domain_ids: selectedIds,
          force: forceRegenerate,
        });
      }

      const modal = await openGenerationResult(
        payload,
        selectedIds.length === 1
          ? "Selected Domain Generation Result"
          : "Selected Domains Generation Results",
      );

      if (modal.summary.failed > 0) {
        toast.warning(
          `Generation completed with partial failures (${modal.summary.failed} failed).`,
        );
      } else {
        toast.success(
          selectedIds.length === 1
            ? "Selected domain generated."
            : `Generated ${modal.summary.generated + modal.summary.unchanged} selected domains.`,
        );
      }

      clearSuccessfulSelections(modal.rows);
      await refreshProfiles();
    } catch (err) {
      toast.error(toErrorMessage(err, "Unable to generate selected domain profiles."));
    } finally {
      setGenerationAction(null);
    }
  }

  async function handleGenerateAll() {
    setGenerationAction({ key: "all", text: "Generating domain profiles for all domains..." });
    try {
      const payload = await generateAllDomainProfiles({
        force: forceRegenerate,
        include_inactive: includeInactive,
      });
      const modal = await openGenerationResult(payload, "Generate All Domains Results");
      if (modal.summary.failed > 0) {
        toast.warning(`Generate all completed with ${modal.summary.failed} failed.`);
      } else {
        toast.success("All domain profile generations completed.");
      }
      clearSuccessfulSelections(modal.rows);
      await refreshProfiles();
    } catch (err) {
      toast.error(toErrorMessage(err, "Unable to generate all domain profiles."));
    } finally {
      setGenerationAction(null);
    }
  }

  async function copyFailedTraceIds() {
    if (!generationResult) return;
    const traceIds = generationResult.rows
      .filter((row) => isFailedStatus(row.status))
      .map((row) => row.trace_id)
      .filter((traceId): traceId is string => Boolean(traceId && traceId.trim().length > 0));

    if (traceIds.length === 0) {
      toast.warning("No failed trace IDs available to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(traceIds.join("\n"));
      toast.success("Failed trace IDs copied.");
    } catch {
      toast.error("Unable to copy trace IDs.");
    }
  }

  if (isLoading) {
    return (
      <div className="sa-loading">
        <span className="sa-spinner lg" />
        Loading domain profiles…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sa-loading">
        <i className="fa fa-exclamation-triangle" style={{ color: "#ef4444", fontSize: "1.4rem" }} />
        Failed to load domain profiles
        {error instanceof Error && `: ${error.message}`}
      </div>
    );
  }

  const MAX_TAGS = 5;

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Domain Profiles</h1>
          <p className="sa-page-subtitle">
            {profiles.length} profile{profiles.length !== 1 && "s"}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setDrawerProfile("new")}>
          <i className="fa fa-plus" /> Create Profile
        </button>
      </div>

      <div className="sa-toolbar sa-toolbar-domain-profiles">
        <div className="sa-toolbar-actions">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => void handleGenerateSelected()}
            disabled={actionBusy}
          >
            <i className="fa fa-bolt me-1" />
            Generate Selected
          </button>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => void handleGenerateAll()}
            disabled={actionBusy}
          >
            <i className="fa fa-bolt me-1" />
            Generate All
          </button>
        </div>
        <div className="sa-toolbar-meta">
          <label className="form-check mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={forceRegenerate}
              onChange={(event) => setForceRegenerate(event.target.checked)}
              disabled={actionBusy}
            />
            <span className="form-check-label">Force regenerate</span>
          </label>
          <label className="form-check mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              disabled={actionBusy}
            />
            <span className="form-check-label">Include inactive</span>
          </label>
          <span className="text-muted small">
            {selectedDomainIds.size} selected
          </span>
          {generating && (
            <span className="text-muted small d-inline-flex align-items-center gap-2">
              <span className="sa-spinner" />
              {generationAction.text}
            </span>
          )}
        </div>
      </div>

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  aria-label="Select all domain profiles"
                  checked={sorted.length > 0 && sorted.every((profile) => selectedDomainIds.has(profile.domain_id))}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  disabled={actionBusy || sorted.length === 0}
                />
              </th>
              <th onClick={() => toggleSort("domain_name")}>
                Domain Name <i className={`fa ${sortIcon("domain_name")}`} />
              </th>
              <th onClick={() => toggleSort("domain_id")}>
                Domain ID <i className={`fa ${sortIcon("domain_id")}`} />
              </th>
              <th onClick={() => toggleSort("summary")}>
                Summary <i className={`fa ${sortIcon("summary")}`} />
              </th>
              <th onClick={() => toggleSort("keywords")}>
                Keywords <i className={`fa ${sortIcon("keywords")}`} />
              </th>
              <th onClick={() => toggleSort("entities")}>
                Entities <i className={`fa ${sortIcon("entities")}`} />
              </th>
              <th onClick={() => toggleSort("metrics")}>
                Metrics <i className={`fa ${sortIcon("metrics")}`} />
              </th>
              <th onClick={() => toggleSort("updated_at")}>
                Last Updated <i className={`fa ${sortIcon("updated_at")}`} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="expandable" onClick={() => setDrawerProfile(p)}>
                <td onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select domain ${p.domain_name ?? p.domain_id}`}
                    checked={selectedDomainIds.has(p.domain_id)}
                    onChange={(event) => setDomainSelected(p.domain_id, event.target.checked)}
                    disabled={actionBusy}
                  />
                </td>
                <td>{p.domain_name ?? "—"}</td>
                <td>{p.domain_id}</td>
                <td>
                  <span className="sa-truncate" title={p.summary ?? ""}>
                    {p.summary ?? "—"}
                  </span>
                </td>
                <td>
                  <div className="sa-tags">
                    {(p.keywords ?? []).slice(0, MAX_TAGS).map((kw) => (
                      <span key={kw} className="sa-tag">{kw}</span>
                    ))}
                    {(p.keywords?.length ?? 0) > MAX_TAGS && (
                      <span className="sa-tag sa-tag-more">
                        +{(p.keywords!.length - MAX_TAGS)} more
                      </span>
                    )}
                  </div>
                </td>
                <td>{p.entities?.length ?? 0}</td>
                <td>{p.metrics?.length ?? 0}</td>
                <td>{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}</td>
                <td>
                  <div className="sa-row-actions">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      title={`Generate ${p.domain_name ?? `Domain ${p.domain_id}`}`}
                      aria-label={`Generate ${p.domain_name ?? `Domain ${p.domain_id}`}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleGenerateRow(p);
                      }}
                      disabled={actionBusy}
                    >
                      <i className="fa fa-bolt" />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      title={`Delete ${p.domain_name ?? `Domain ${p.domain_id}`}`}
                      aria-label={`Delete ${p.domain_name ?? `Domain ${p.domain_id}`}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(p);
                      }}
                      disabled={actionBusy}
                    >
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
                  No domain profiles found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawerProfile !== null && (
        <DomainProfileForm
          profile={drawerProfile === "new" ? null : drawerProfile}
          onSave={handleSave}
          onCancel={() => setDrawerProfile(null)}
          busy={createMut.isPending || updateMut.isPending}
        />
      )}

      {deleteTarget && (
        <div className="sa-dialog-backdrop">
          <div className="sa-dialog">
            <div className="sa-dialog-header">
              <span>Confirm Delete</span>
              <button className="btn btn-sm btn-light" onClick={() => setDeleteTarget(null)}>
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="sa-dialog-body">
              Delete the domain profile for{" "}
              <strong>{deleteTarget.domain_name ?? `Domain ${deleteTarget.domain_id}`}</strong>?
              This action cannot be undone.
            </div>
            <div className="sa-dialog-footer">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMut.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={confirmDelete}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending && <span className="sa-spinner" style={{ marginRight: 6 }} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {generationResult && (
        <div className="sa-dialog-backdrop" onClick={() => setGenerationResult(null)}>
          <div className="sa-dialog wide" role="dialog" aria-label="Domain profile generation results" onClick={(event) => event.stopPropagation()}>
            <div className="sa-dialog-header">
              <span>{generationResult.title}</span>
              <button className="btn btn-sm btn-light" onClick={() => setGenerationResult(null)}>
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="sa-dialog-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span className="badge text-bg-secondary">total: {generationResult.summary.total}</span>
                <span className="badge text-bg-success">generated: {generationResult.summary.generated}</span>
                <span className="badge text-bg-info">unchanged: {generationResult.summary.unchanged}</span>
                <span className="badge text-bg-danger">failed: {generationResult.summary.failed}</span>
              </div>

              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Per-domain results</h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => void copyFailedTraceIds()}
                >
                  Copy trace IDs
                </button>
              </div>

              <div className="sa-table-wrap mb-0">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>domain_id</th>
                      <th>status</th>
                      <th>trace_id</th>
                      <th>generation_time_ms</th>
                      <th>error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generationResult.rows.map((row, index) => (
                      <tr key={`${row.domain_id}-${row.status}-${index}`}>
                        <td>{row.domain_id}</td>
                        <td>
                          {isFailedStatus(row.status) ? (
                            <span className="badge text-bg-danger">{row.status}</span>
                          ) : isUnchangedStatus(row.status) ? (
                            <span className="badge text-bg-secondary">{row.status}</span>
                          ) : (
                            <span className="badge text-bg-success">{row.status}</span>
                          )}
                        </td>
                        <td>{row.trace_id ?? "—"}</td>
                        <td>{row.generation_time_ms ?? "—"}</td>
                        <td>{row.error ?? "—"}</td>
                      </tr>
                    ))}
                    {generationResult.rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-3">
                          No per-domain rows returned by backend.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="sa-dialog-footer">
              <button className="btn btn-sm btn-secondary" onClick={() => setGenerationResult(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
