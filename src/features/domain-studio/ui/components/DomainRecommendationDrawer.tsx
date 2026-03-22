import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type {
  ApplyDomainRecommendationsPayload,
  DomainRecommendation,
  DomainRecommendationResponse,
} from "../../../../shared/services/queryStudioAdminApi";

import "../style/domainsTab.css";

type EditableRecommendation = {
  key: string;
  name: string;
  description: string;
  table_names: string[];
  confidence: number;
  rationale: string[];
  needs_review: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onApply: (payload: ApplyDomainRecommendationsPayload) => void;
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;
  data: DomainRecommendationResponse | null;
  existingDomainNames: string[];
};

function toEditable(item: DomainRecommendation): EditableRecommendation {
  return {
    key: item.key,
    name: item.name,
    description: item.description,
    table_names: [...item.table_names],
    confidence: item.confidence,
    rationale: [...item.rationale],
    needs_review: item.needs_review,
  };
}

export const DomainRecommendationDrawer: React.FC<Props> = ({
  open,
  onClose,
  onGenerate,
  onApply,
  isLoading,
  isApplying,
  error,
  data,
  existingDomainNames,
}) => {
  const [drafts, setDrafts] = useState<EditableRecommendation[]>([]);
  const [applyMode, setApplyMode] = useState<"create_only" | "create_or_merge">("create_only");
  const [tableSelections, setTableSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setDrafts((data?.recommendations ?? []).map(toEditable));
    setApplyMode("create_only");
    setTableSelections({});
  }, [open, data]);

  const assignedTableCounts = useMemo(() => {
    const counts = new Map<string, number>();
    drafts.forEach((item) => {
      item.table_names.forEach((tableName) => {
        counts.set(tableName, (counts.get(tableName) ?? 0) + 1);
      });
    });
    return counts;
  }, [drafts]);

  const duplicateTables = useMemo(
    () =>
      Array.from(assignedTableCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([tableName]) => tableName)
        .sort(),
    [assignedTableCounts]
  );

  const allKnownTables = useMemo(() => {
    const fromRecommendations = data?.recommendations.flatMap((item) => item.table_names) ?? [];
    const fromUnassigned = data?.unassigned_tables ?? [];
    return Array.from(new Set([...fromRecommendations, ...fromUnassigned])).sort();
  }, [data]);

  const unassignedTables = useMemo(() => {
    const assigned = new Set(drafts.flatMap((item) => item.table_names));
    return allKnownTables.filter((tableName) => !assigned.has(tableName));
  }, [allKnownTables, drafts]);

  const normalizedExistingNames = useMemo(
    () => new Set(existingDomainNames.map((name) => name.trim().toLowerCase()).filter(Boolean)),
    [existingDomainNames]
  );

  const validationMessages = useMemo(() => {
    const messages: string[] = [];
    const seenNames = new Set<string>();
    drafts.forEach((item, index) => {
      const name = item.name.trim();
      if (!name) {
        messages.push(`Recommendation ${index + 1} is missing a domain name.`);
      }
      const normalizedName = name.toLowerCase();
      if (name && seenNames.has(normalizedName)) {
        messages.push(`Duplicate recommended domain name: ${name}.`);
      }
      if (name) seenNames.add(normalizedName);
      if (item.table_names.length === 0) {
        messages.push(`${name || `Recommendation ${index + 1}`} has no assigned tables.`);
      }
      if (applyMode === "create_only" && name && normalizedExistingNames.has(normalizedName)) {
        messages.push(`${name} already exists. Switch apply mode to merge or rename it.`);
      }
    });
    if (duplicateTables.length > 0) {
      messages.push(`Some tables are assigned to multiple recommendations: ${duplicateTables.join(", ")}.`);
    }
    return messages;
  }, [applyMode, drafts, duplicateTables, normalizedExistingNames]);

  const canApply = !isLoading && !isApplying && drafts.length > 0 && validationMessages.length === 0;

  function updateDraft(key: string, patch: Partial<EditableRecommendation>) {
    setDrafts((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function removeDraft(key: string) {
    setDrafts((current) => current.filter((item) => item.key !== key));
  }

  function removeTable(key: string, tableName: string) {
    setDrafts((current) =>
      current.map((item) =>
        item.key === key
          ? { ...item, table_names: item.table_names.filter((value) => value !== tableName) }
          : item
      )
    );
  }

  function addTable(key: string, tableName: string) {
    if (!tableName) return;
    setDrafts((current) => {
      const withoutTable = current.map((item) => ({
        ...item,
        table_names:
          item.key === key
            ? item.table_names
            : item.table_names.filter((value) => value !== tableName),
      }));

      return withoutTable.map((item) =>
        item.key === key
          ? {
              ...item,
              table_names: item.table_names.includes(tableName)
                ? item.table_names
                : [...item.table_names, tableName],
            }
          : item
      );
    });
    setTableSelections((current) => ({ ...current, [key]: "" }));
  }

  function addDraft() {
    setDrafts((current) => [
      ...current,
      {
        key: `manual_${Date.now()}_${current.length}`,
        name: "",
        description: "",
        table_names: [],
        confidence: 0.5,
        rationale: [],
        needs_review: true,
      },
    ]);
  }

  function updateTableSelection(key: string, value: string) {
    setTableSelections((current) => ({ ...current, [key]: value }));
  }

  function handleApply() {
    onApply({
      mode: applyMode,
      column_name_policy: "DEDUP_PRIMARY_FIRST",
      recommendations: drafts.map((item) => ({
        name: item.name.trim(),
        description: item.description.trim() || null,
        table_names: item.table_names,
      })),
    });
  }

  if (!open) return null;

  return createPortal(
    <>
      <div className="offcanvas-backdrop fade show" onClick={onClose} />
      <div
        className="offcanvas offcanvas-end show domains-offcanvas domains-recommendation-offcanvas"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="offcanvas-header border-bottom">
          <div>
            <h5 className="offcanvas-title mb-0">Suggest Domains</h5>
            <div className="text-muted small">
              AI best-guess domain groupings from workspace table names and descriptions.
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>

        <div className="offcanvas-body domains-recommendation-body">
          <div className="alert alert-info py-2">
            Review and edit the AI suggestions, then apply them to create real domains and table assignments.
          </div>

          {isLoading ? (
            <div className="d-flex align-items-center gap-2 text-muted small mt-3">
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              Generating recommendations...
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div>
          ) : null}

          {!isLoading && !error && data ? (
            <>
              <div className="card mt-3 domains-recommendation-card">
                <div className="card-body d-flex flex-column flex-md-row gap-3 align-items-md-end justify-content-between">
                  <div>
                    <div className="fw-semibold">Apply Mode</div>
                    <div className="text-muted small">
                      Choose whether conflicting names should fail or merge into existing domains.
                    </div>
                  </div>
                  <div className="d-flex gap-2 align-items-center">
                    <select
                      className="form-select form-select-sm"
                      value={applyMode}
                      onChange={(event) => setApplyMode(event.target.value as "create_only" | "create_or_merge")}
                      disabled={isApplying}
                    >
                      <option value="create_only">Create only</option>
                      <option value="create_or_merge">Create or merge</option>
                    </select>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addDraft} disabled={isApplying}>
                      Add Recommendation
                    </button>
                  </div>
                </div>
              </div>

              {validationMessages.length > 0 ? (
                <div className="card mt-3 domains-recommendation-card">
                  <div className="card-body">
                    <div className="fw-semibold mb-2">Before You Apply</div>
                    <ul className="mb-0 ps-3 small text-muted">
                      {validationMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {data.warnings.length > 0 ? (
                <div className="card mt-3 domains-recommendation-card">
                  <div className="card-body">
                    <div className="fw-semibold mb-2">Warnings</div>
                    <ul className="mb-0 ps-3 small text-muted">
                      {data.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <div className="d-flex align-items-center justify-content-between mt-3 mb-2">
                <div className="fw-semibold">Recommendations</div>
                <div className="text-muted small">
                  {drafts.length} suggested domain{drafts.length === 1 ? "" : "s"}
                </div>
              </div>

              {drafts.length === 0 ? (
                <div className="text-muted small">No recommendations were generated for this workspace.</div>
              ) : (
                <div className="domains-recommendation-list">
                  {drafts.map((item) => {
                    const availableTables = allKnownTables.filter(
                      (tableName) => !item.table_names.includes(tableName)
                    );
                    const hasDuplicateTable = item.table_names.some((tableName) => duplicateTables.includes(tableName));
                    return (
                    <div key={item.key} className="card domains-recommendation-card">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div className="flex-grow-1">
                            <label className="form-label fw-semibold mb-1">Domain Name</label>
                            <input
                              className="form-control form-control-sm"
                              value={item.name}
                              onChange={(event) => updateDraft(item.key, { name: event.target.value })}
                              disabled={isApplying}
                            />
                            <label className="form-label fw-semibold mt-3 mb-1">Description</label>
                            <textarea
                              className="form-control form-control-sm"
                              rows={3}
                              value={item.description}
                              onChange={(event) => updateDraft(item.key, { description: event.target.value })}
                              disabled={isApplying}
                            />
                          </div>
                          <div className="d-flex gap-2 flex-wrap justify-content-end align-items-start">
                            <span className={`badge ${item.needs_review ? "text-bg-warning" : "text-bg-success"}`}>
                              {item.needs_review ? "Needs review" : "High confidence"}
                            </span>
                            <span className="badge text-bg-light border">
                              {Math.round(item.confidence * 100)}%
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => removeDraft(item.key)}
                              disabled={isApplying}
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
                            <div className="fw-semibold small">Tables</div>
                            <select
                              className="form-select form-select-sm domains-recommendation-select"
                              value={tableSelections[item.key] ?? ""}
                              onChange={(event) => {
                                updateTableSelection(item.key, event.target.value);
                                addTable(item.key, event.target.value);
                              }}
                              disabled={isApplying || availableTables.length === 0}
                            >
                              <option value="">Add or move table...</option>
                              {availableTables.map((tableName) => (
                                <option key={tableName} value={tableName}>
                                  {tableName}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="d-flex flex-wrap gap-2">
                            {item.table_names.map((tableName) => (
                              <button
                                key={tableName}
                                type="button"
                                className={`badge border domains-recommendation-chip ${duplicateTables.includes(tableName) ? "text-bg-warning" : "text-bg-light"}`}
                                onClick={() => removeTable(item.key, tableName)}
                                disabled={isApplying}
                              >
                                {tableName}
                                <span className="ms-2">x</span>
                              </button>
                            ))}
                          </div>
                          {hasDuplicateTable ? (
                            <div className="text-warning-emphasis small mt-2">
                              One or more tables in this recommendation are also assigned elsewhere.
                            </div>
                          ) : null}
                        </div>

                        {item.rationale.length > 0 ? (
                          <div className="mt-3">
                            <div className="fw-semibold small mb-2">Why this grouping</div>
                            <ul className="mb-0 ps-3 small text-muted">
                              {item.rationale.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )})}
                </div>
              )}

              <div className="card mt-3 domains-recommendation-card">
                <div className="card-body">
                  <div className="fw-semibold mb-2">Unassigned Tables</div>
                  {unassignedTables.length === 0 ? (
                    <div className="text-muted small">Every analyzed table was assigned to a suggested domain.</div>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {unassignedTables.map((tableName) => (
                        <span key={tableName} className="badge text-bg-light border">
                          {tableName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="offcanvas-footer border-top p-3 d-flex justify-content-between">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-primary" onClick={onGenerate} disabled={isLoading || isApplying}>
              {isLoading ? "Generating..." : "Regenerate"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={!canApply}
            >
              {isApplying ? "Applying..." : "Apply Recommendations"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default DomainRecommendationDrawer;
