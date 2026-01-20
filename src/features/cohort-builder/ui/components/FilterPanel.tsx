// src/features/cohort-builder/ui/components/FilterPanel.tsx
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { nanoid } from '@reduxjs/toolkit';
import type { FilterKind, FilterT } from '../../model/filters';
import { FilterEditModal } from './FilterEditModal';

const kindsConfig: Array<{ kind: FilterKind; label: string }> = [
  { kind: 'condition',    label: 'Conditions' },
  { kind: 'procedure',    label: 'Procedures' },
  { kind: 'drug',         label: 'Medications' },
  { kind: 'measurement',  label: 'Measurements / Labs' },
  { kind: 'demographics', label: 'Demographics' },
];

const ALL_KINDS: FilterKind[] = kindsConfig.map(k => k.kind);

const blankFilter = (kind: FilterKind): FilterT => ({
  id: nanoid(),
  kind,
  title: kind.charAt(0).toUpperCase() + kind.slice(1),
});

// ---- Summaries ----
const summarizeDrug = (f: FilterT) => {
  const name = f.name || 'Drug';
  const codeStr =
    typeof f.code === 'string'
      ? f.code
      : f.code != null
      ? String(f.code)
      : '';
  const ndcCount = codeStr
    ? codeStr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean).length
    : 0;
  if (!ndcCount) return name;
  if (ndcCount === 1) return `${name} (1 NDC)`;
  return `${name} (${ndcCount} NDCs)`;
};

const parseNdcCodes = (f: FilterT) => {
  if (typeof f.code !== "string") return [];
  return f.code
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const summarizeMeasurement = (f: FilterT) => {
  const name = f.name || 'Measurement';
  const lb = f.value?.lower_bound;
  const ub = f.value?.upper_bound;

  const unitLabels = f.unit ? Object.keys(f.unit) : [];
  const unit = unitLabels[0] ?? '';

  let range = '';
  if (lb != null && ub != null) range = `${lb} – ${ub}`;
  else if (lb != null) range = `≥ ${lb}`;
  else if (ub != null) range = `≤ ${ub}`;

  return `${name}${unit ? ` (${unit})` : ''}${range ? ` • ${range}` : ''}`;
};

const summarizeDemographics = (f: FilterT) => {
  const parts: string[] = [];

  if (f.age?.lower_bound != null || f.age?.upper_bound != null) {
    const aFrom = f.age.lower_bound ?? '';
    const aTo = f.age.upper_bound ?? '';
    parts.push(`Age ${aFrom || '…'}–${aTo || '…'}`);
  }

  if (f.dx_year?.lower_bound != null || f.dx_year?.upper_bound != null) {
    const yFrom = f.dx_year.lower_bound ?? '';
    const yTo = f.dx_year.upper_bound ?? '';
    parts.push(`Dx year ${yFrom || '…'}–${yTo || '…'}`);
  }

  if (f.gender && f.gender.length) parts.push(`Gender: ${f.gender.join('/')}`);

  if (f.location && f.location.length) {
    const count = f.location.length;
    parts.push(`${count} state${count > 1 ? 's' : ''}`);
  }

  return parts.join(' · ') || '(no demographics set)';
};

const CountCircle: React.FC<{ count: number }> = ({ count }) => (
  <span
    className="badge bg-light text-dark"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: 999,
      fontSize: '0.75rem',
      lineHeight: 1,
    }}
    aria-label={`Count: ${count}`}
    title={`${count}`}
  >
    {count}
  </span>
);

const EmptyState: React.FC = () => (
  <div
    className="rounded p-4"
    style={{
      minHeight: 360,
      background:
        'linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.01))',
      border: '1px dashed rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{ maxWidth: 560, width: '100%' }}>
      <div
        className="rounded mb-3"
        style={{
          height: 140,
          background:
            'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.06), transparent 55%),' +
            'radial-gradient(circle at 80% 70%, rgba(0,0,0,0.05), transparent 55%)',
          filter: 'grayscale(1)',
          opacity: 0.75,
        }}
      />
      <div className="fw-semibold" style={{ fontSize: '1.05rem' }}>
        Generate filters to begin
      </div>
      <div className="text-muted small mt-1">
        Enter a prompt above and click <span className="fw-semibold">Generate</span>.
        We’ll show each filter type here as it’s built.
      </div>
    </div>
  </div>
);

const SkeletonAccordions: React.FC = () => (
  <div className="accordion">
    {kindsConfig.map(({ kind }) => (
      <div className="accordion-item" key={kind}>
        <div
          className="px-3 py-2 bg-white"
          style={{ borderBottom: '1px solid rgba(0,0,0,.075)' }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <span className="placeholder-glow">
                <span
                  className="placeholder"
                  style={{ width: 14, height: 14, borderRadius: 3 }}
                />
              </span>
              <span className="placeholder-glow">
                <span
                  className="placeholder"
                  style={{ width: 150, height: 14, borderRadius: 6 }}
                />
              </span>
              <span className="placeholder-glow">
                <span
                  className="placeholder"
                  style={{ width: 22, height: 22, borderRadius: 999 }}
                />
              </span>
            </div>

            <span className="placeholder-glow">
              <span
                className="placeholder"
                style={{ width: 56, height: 28, borderRadius: 6 }}
              />
            </span>
          </div>

          <div className="mt-2">
            <div className="progress" style={{ height: 4 }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        </div>

        <div className="p-2" style={{ background: '#f7f7f9' }}>
          <div className="placeholder-glow">
            <span className="placeholder col-12" />
          </div>
          <div className="placeholder-glow mt-2">
            <span className="placeholder col-10" />
          </div>
          <div className="placeholder-glow mt-2">
            <span className="placeholder col-8" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const FiltersPanel: React.FC<{
  filters: FilterT[];
  onAdd: (f: FilterT) => void;
  onUpdate: (f: FilterT) => void;
  onRemove: (id: string) => void;
  onRemoveInValue?: (conditionId: string, value: string) => void;

  /** Optional: per-filter-kind loading flags (moved from SummaryStrip usage) */
  loadingByKind?: Partial<Record<FilterKind, boolean>>;

  /** New: used to hide accordions until user starts generation */
  hasGeneratedOnce?: boolean;

  /** New: overall generation flag (e.g. loadingDraft) */
  isGenerating?: boolean;
  maxHeightPx?: number;
}> = ({
  filters,
  onAdd,
  onUpdate,
  onRemove,
  onRemoveInValue,
  loadingByKind,
  hasGeneratedOnce = false,
  isGenerating = false,
  maxHeightPx = 540,
}) => {
  const [openKinds, setOpenKinds] = useState<Set<FilterKind>>(
    () => new Set<FilterKind>(['condition'])
  );

  const [editingFilter, setEditingFilter] = useState<FilterT | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ndcDrawerOpen, setNdcDrawerOpen] = useState(false);
  const [ndcDrawerDrug, setNdcDrawerDrug] = useState<{
    name: string;
    summary: string;
    codes: string[];
  } | null>(null);
  const [ndcDrawerFilter, setNdcDrawerFilter] = useState<FilterT | null>(null);
  const [ndcSearch, setNdcSearch] = useState("");
  const [ndcCodes, setNdcCodes] = useState<string[]>([]);

  const closeNdcDrawer = () => {
    setNdcDrawerOpen(false);
    setNdcSearch("");
    setNdcCodes([]);
    setNdcDrawerFilter(null);
  };

  const grouped = useMemo(() => {
    const base: Record<FilterKind, FilterT[]> = {
      condition: [],
      procedure: [],
      drug: [],
      measurement: [],
      demographics: [],
    };
    for (const f of filters) base[f.kind].push(f);
    return base;
  }, [filters]);

  const toggleKind = (kind: FilterKind) => {
    setOpenKinds(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const expandAll = () => setOpenKinds(new Set(ALL_KINDS));
  const collapseAll = () => setOpenKinds(new Set());

  const handleAdd = (kind: FilterKind) => {
    const f = blankFilter(kind);
    onAdd(f);
    setEditingFilter(f);
    setShowModal(true);
  };

  const handleEdit = (f: FilterT) => {
    setEditingFilter(f);
    setShowModal(true);
  };

  const handleSaveFromModal = (f: FilterT) => onUpdate(f);
  const handleDelete = (id: string) => onRemove(id);

  const allExpanded = openKinds.size === ALL_KINDS.length;

  const showEmpty = !hasGeneratedOnce;
  const showSkeleton = isGenerating && filters.length === 0;

  return (
    <>
      <div className="d-flex justify-content-end mb-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={allExpanded ? collapseAll : expandAll}
          disabled={showEmpty || showSkeleton}
          title={showEmpty ? "Generate filters first" : undefined}
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div style={{ maxHeight: maxHeightPx ?? undefined, overflowY: "auto" }}>
        {showEmpty ? (
          <EmptyState />
        ) : showSkeleton ? (
          <SkeletonAccordions />
        ) : (
          <div className="accordion" id="filters-accordion">
            {kindsConfig.map(({ kind, label }) => {
              const isOpen = openKinds.has(kind);
              const collapseId = `collapse-${kind}`;
              const tableFilters = grouped[kind];
              const count = tableFilters.length;
              const isLoading = loadingByKind?.[kind] ?? false;

              return (
                <div className="accordion-item" key={kind}>
                  <h2 className="accordion-header">
                    <div
                      className={"px-3 py-2 " + (isOpen ? "bg-light" : "bg-white")}
                      style={{
                        borderBottom: "1px solid rgba(0,0,0,.075)",
                        fontSize: "0.95rem",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between">
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2"
                          aria-expanded={isOpen}
                          aria-controls={collapseId}
                          onClick={() => toggleKind(kind)}
                        >
                          <i
                            className={"fa fa-chevron-right " + (isOpen ? "fa-rotate-90" : "")}
                            style={{ width: 14 }}
                            aria-hidden="true"
                          />
                          <span className="fw-semibold text-dark d-flex align-items-center gap-2">
                            <span>{label}</span>
                            <CountCircle count={count} />

                            {isLoading && (
                              <span className="ms-2 small text-muted">
                                <i className="fa fa-spinner fa-spin me-1" />
                                building…
                              </span>
                            )}
                          </span>
                        </button>

                        <span />
                      </div>

                      {isLoading && (
                        <div className="mt-2">
                          <div className="progress" style={{ height: 4 }}>
                            <div
                              className="progress-bar progress-bar-striped progress-bar-animated"
                              style={{ width: "75%" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </h2>

                  <div id={collapseId} className={"accordion-collapse collapse " + (isOpen ? "show" : "")}>
                    <div className="accordion-body p-2" style={{ background: "#f7f7f9" }}>
                      {tableFilters.length === 0 ? (
                        <div className="text-muted small">No {label.toLowerCase()} filters yet.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0">
                            <thead>
                                {kind === "condition" && (
                                  <tr>
                                    <th style={{ width: "25%" }}>Code</th>
                                    <th>Name</th>
                                    <th style={{ width: 44 }} />
                                  </tr>
                                )}
                                {kind === "procedure" && (
                                  <tr>
                                    <th style={{ width: "25%" }}>Code</th>
                                    <th>Name</th>
                                    <th style={{ width: 44 }} />
                                  </tr>
                                )}
                                {kind === "drug" && (
                                  <tr>
                                    <th style={{ width: "25%" }}>Drug</th>
                                    <th>Summary</th>
                                    <th style={{ width: 44 }} />
                                  </tr>
                                )}
                                {kind === "measurement" && (
                                  <tr>
                                    <th style={{ width: "25%" }}>Measurement</th>
                                    <th>Unit / Range</th>
                                    <th style={{ width: 44 }} />
                                  </tr>
                                )}
                                {kind === "demographics" && (
                                  <tr>
                                    <th style={{ width: "25%" }}>Summary</th>
                                    <th>Type</th>
                                    <th style={{ width: 44 }} />
                                  </tr>
                                )}
                            </thead>

                            <tbody>
                              {tableFilters.map(f => {
                                  if (kind === "condition" || kind === "procedure") {
                                    return (
                                      <tr key={f.id} style={{ background: "#fff" }}>
                                        <td>{f.code}</td>
                                        <td>{f.name}</td>
                                        <td className="text-end">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-link p-0 text-danger"
                                            title="Remove"
                                            onClick={() => handleDelete(f.id)}
                                          >
                                            <i className="fa fa-times" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  }

                                  if (kind === "drug") {
                                    const codes = parseNdcCodes(f);
                                  const preview = codes.slice(0, 10).join(", ");
                                  const hasCodes = codes.length > 0;
                                  const hasMore = codes.length > 10;
                                  const summary = `${codes.length} NDC${codes.length === 1 ? "" : "s"}`;
                                  const linkLabel = hasMore ? "View all NDC codes" : "View NDC codes";

                                    return (
                                      <tr key={f.id} style={{ background: "#fff" }}>
                                        <td>{f.name}</td>
                                        <td>
                                          <div>
                                            {summarizeDrug(f)}
                                          {preview ? (
                                            <span className="text-muted">
                                              {" "}
                                              ({preview}
                                              {hasMore ? ", …" : ""})
                                            </span>
                                          ) : null}
                                        </div>
                                        {hasCodes ? (
                                          <button
                                            type="button"
                                            className="btn btn-link p-0 text-decoration-none"
                                            onClick={() => {
                                              setNdcDrawerDrug({
                                                name: f.name || "Drug",
                                                summary,
                                                codes,
                                              });
                                              setNdcDrawerFilter(f);
                                              setNdcCodes(codes);
                                              setNdcSearch("");
                                              setNdcDrawerOpen(true);
                                            }}
                                          >
                                            {linkLabel}
                                          </button>
                                        ) : null}
                                        </td>
                                        <td className="text-end">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-link p-0 text-danger"
                                            title="Remove"
                                            onClick={() => handleDelete(f.id)}
                                          >
                                            <i className="fa fa-times" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  }

                                  if (kind === "measurement") {
                                    return (
                                      <tr key={f.id} style={{ background: "#fff" }}>
                                        <td>{f.name}</td>
                                        <td>{summarizeMeasurement(f)}</td>
                                        <td className="text-end">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-link p-0 text-danger"
                                            title="Remove"
                                            onClick={() => handleDelete(f.id)}
                                          >
                                            <i className="fa fa-times" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  }

                                  return (
                                    <tr key={f.id} style={{ background: "#fff" }}>
                                      <td>{summarizeDemographics(f)}</td>
                                      <td>Demographics</td>
                                      <td className="text-end">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-link p-0 text-danger"
                                          title="Remove"
                                          onClick={() => handleDelete(f.id)}
                                        >
                                          <i className="fa fa-times" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FilterEditModal
        show={showModal}
        filter={editingFilter}
        onClose={() => setShowModal(false)}
        onSave={handleSaveFromModal}
      />

      {ndcDrawerOpen && ndcDrawerDrug
        ? createPortal(
            <>
              <div
                className="offcanvas-backdrop fade show"
                onClick={closeNdcDrawer}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 2000,
                  background: "rgba(0,0,0,0.45)",
                  opacity: 1,
                }}
              />
              <div
                className="offcanvas offcanvas-end show"
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                style={{
                  position: "fixed",
                  top: 0,
                  right: 0,
                  height: "100vh",
                  width: 520,
                  zIndex: 2001,
                  background: "#fff",
                  boxShadow: "0 0.5rem 1rem rgba(0,0,0,0.15)",
                }}
              >
                <div className="offcanvas-header border-bottom">
                  <div>
                    <h5 className="offcanvas-title mb-0">{ndcDrawerDrug.name}</h5>
                    <div className="text-muted small">{ndcDrawerDrug.summary}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={closeNdcDrawer}
                    style={{ position: "absolute", top: 10, right: 12 }}
                  >
                    <i className="fa fa-xmark" />
                  </button>
                </div>

                <div className="offcanvas-body">
                  <div className="mb-3">
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Search NDC codes..."
                      value={ndcSearch}
                      onChange={(e) => setNdcSearch(e.target.value)}
                    />
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>NDC Code</th>
                          <th style={{ width: 44 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {ndcCodes
                          .map((code, idx) => ({ code, idx }))
                          .filter((item) => item.code.toLowerCase().includes(ndcSearch.trim().toLowerCase()))
                          .map(({ code, idx }) => (
                            <tr key={`${code}-${idx}`}>
                              <td>{code}</td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link p-0 text-danger"
                                  title="Remove code"
                                  onClick={() => {
                                    const nextCodes = ndcCodes.filter((_, i) => i !== idx);
                                    setNdcCodes(nextCodes);
                                    if (ndcDrawerFilter) {
                                      if (nextCodes.length === 0) {
                                        onRemove(ndcDrawerFilter.id);
                                        onRemoveInValue?.(ndcDrawerFilter.id, code);
                                        closeNdcDrawer();
                                        return;
                                      }
                                      onUpdate({
                                        ...ndcDrawerFilter,
                                        code: nextCodes.join(","),
                                      });
                                      onRemoveInValue?.(ndcDrawerFilter.id, code);
                                    }
                                    setNdcDrawerDrug((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            codes: nextCodes,
                                            summary: `${nextCodes.length} NDC${nextCodes.length === 1 ? "" : "s"}`,
                                          }
                                        : prev
                                    );
                                  }}
                                >
                                  <i className="fa fa-times" />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
};
