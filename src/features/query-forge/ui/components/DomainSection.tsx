// src/features/nocode-query/ui/components/DomainSection.tsx
import React, { useEffect, useMemo, useState } from "react";
import { SectionShell } from "./SectionShell";
import "../styles/domainSection.css";

import {
  ValueOverrideVisibilityIndex,
  ValueOverrideVisibilityRow,
  getVisibleValueOverrides,
} from "@/shared/services/queryStudioAdminApi";

import type { DomainColumnRef } from "../../model/domainCatalog";
import type { CohortAttachment, ValueOverrideAttachment, SqlColumnKey } from "../../model/sqlJson";
import { colKey } from "../../model/sqlJson";

type ValueOverrideGroupKey = "regions" | "npiCategories" | "serviceLines";
// If your ValueOverrideType already is this union, you can replace ValueOverrideGroupKey usage with ValueOverrideType.

type DomainOption = {
  id: string | number;
  name: string;
  description?: string | null;
  tables?: string[] | null;
  table_sample?: string[] | null;
  full_path?: string | null;
  fullName?: string | null;
  primary_table_name?: string | null;
  primaryTableName?: string | null;
  model_table_name?: string | null;
  modelTableName?: string | null;
  source_table_name?: string | null;
  sourceTableName?: string | null;
  table_full_name?: string | null;
  tableFullName?: string | null;
  row_count?: number | string | null;
  rowCount?: number | string | null;
  table_row_count?: number | string | null;
  tableRowCount?: number | string | null;
  count?: number | string | null;
  table_count?: number | string | null;
  tableCount?: number | string | null;
  as_of?: string | null;
  asOf?: string | null;
  row_count_as_of?: string | null;
  rowCountAsOf?: string | null;
  last_seen_at?: string | null;
  lastSeenAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
};

type Props = {
  // SectionShell props
  collapsed: boolean;
  onToggleCollapsed: () => void;
  collapsible?: boolean;
  onHide?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;

  // data
  domains: DomainOption[];
  selectedDomainId: string | null;
  onChangeDomain: (id: string | null) => void;
  workspaceId?: string | null;

  domainColumns: DomainColumnRef[];

  // sqlJson state
  valueOverrideAttachments: ValueOverrideAttachment[];
  cohortAttachment?: CohortAttachment | null;
  onChangeValueOverrideAttachments: (next: ValueOverrideAttachment[]) => void;
  onChangeCohortAttachment: (next: CohortAttachment | null) => void;

  onSelectValueOverride?: (listType: ValueOverrideGroupKey, listId: string) => void;

  distinct: boolean;
  onChangeDistinct: (v: boolean) => void;
  disableDistinct?: boolean;
  excludeErrorRows: boolean;
  onChangeExcludeErrorRows: (v: boolean) => void;
  disableExcludeErrorRows?: boolean;

  loading?: boolean;
  error?: string;
  onRetry?: () => void;

  onNext?: () => void;
  onSubmit?: () => void;

  helpAction?: {
    label?: string;
    ariaLabel?: string;
    iconClass?: string;
    onClick: () => void;
    hidden?: boolean;
  };
};

const emptyCrosswalkIndex: ValueOverrideVisibilityIndex = {
  regions: [],
  npiCategories: [],
  serviceLines: [],
};

const newId = () => Math.random().toString(36).slice(2, 10);

function formatAsOf(v: any) {
  if (!v) return "—";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function toSqlColumnKey(c: DomainColumnRef): SqlColumnKey {
  return {
    modelColumnId: c.modelColumnId ?? null,
    columnName: c.columnName,
    workspaceTableId: c.workspaceTableId ?? null,
  };
}

function domainCandidates(domainColumns: DomainColumnRef[]) {
  return (domainColumns ?? []).filter((c) => !String(c.identityKey ?? "").startsWith("expr:"));
}

function candidateColumnsForCrosswalk(cols: DomainColumnRef[], type: ValueOverrideGroupKey) {
  const candidates = domainCandidates(cols);

  if (type === "regions") {
    return candidates.filter((c) => /zip|zipcode/.test(c.columnName.toLowerCase()));
  }

  if (type === "npiCategories") {
    return candidates.filter((c) => c.columnName.toLowerCase().includes("npi"));
  }

  // serviceLines
  return candidates.filter((c) => {
    const n = c.columnName.toLowerCase();
    return n.includes("procedure") || n.includes("cpt") || n.includes("hcpcs") || n.endsWith("_code");
  });
}

// Fixed crosswalk join keys (crosswalk-side)
const crosswalkJoinKeyByType: Record<ValueOverrideGroupKey, string[]> = {
  regions: ["zipcode"],
  npiCategories: ["npi"],
  serviceLines: ["procedure_code"],
};

// Fields available to project from each crosswalk table
const crosswalkProjectFields: Record<ValueOverrideGroupKey, string[]> = {
  regions: ["region", "subregion"],
  npiCategories: ["npi_type_code", "customer_npi_category_1", "customer_npi_category_2"],
  serviceLines: ["customer_service_line", "customer_sub_service_line"],
};

type JoinModalState =
  { kind: "crosswalk"; type: ValueOverrideGroupKey; listId: string; listLabel: string };

const CrosswalkJoinModal: React.FC<{
  modal: Extract<JoinModalState, { kind: "crosswalk" }>;
  workspaceId: string | null | undefined;
  domainColumns: DomainColumnRef[];
  existing: ValueOverrideAttachment | null;
  onSave: (next: ValueOverrideAttachment) => void;
  onRemove: () => void;
  onClose: () => void;
}> = ({ modal, workspaceId, domainColumns, existing, onSave, onRemove, onClose }) => {
  const { type, listId, listLabel } = modal;

  const candidates = useMemo(() => candidateColumnsForCrosswalk(domainColumns, type), [domainColumns, type]);
  const fixedJoinKeys = crosswalkJoinKeyByType[type];
  const projectable = crosswalkProjectFields[type] ?? [];

  const [domainJoinCols, setDomainJoinCols] = useState<SqlColumnKey[]>(existing?.domainJoinColumns ?? []);
  const [projectFields, setProjectFields] = useState<string[]>(
    existing?.projectFields?.length ? existing.projectFields : projectable.slice(0, 1)
  );
  const [aliasByKey, setAliasByKey] = useState<Record<string, string>>(existing?.joinAliasByColumnKey ?? {});

  const selectedKeys = useMemo(() => new Set(domainJoinCols.map((c) => colKey(c))), [domainJoinCols]);
  const joinReady = domainJoinCols.length > 0;

  const save = () => {
    if (!joinReady) return;
    const next: ValueOverrideAttachment = {
      id: existing?.id ?? newId(),
      type,
      workspaceId: workspaceId ?? "",
      listId,
      mode: "join",
      domainJoinColumns: domainJoinCols,
      value_overrideJoinColumns: fixedJoinKeys,
      joinAliasByColumnKey: aliasByKey,
      projectFields,
    };
    onSave(next);
  };

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title mb-0">Join Crosswalk</h5>
                <div className="text-muted small">
                  {type} • <span className="fw-semibold">{listLabel}</span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <div className="text-muted small mb-3">
                Selecting a crosswalk in this section means you want to <span className="fw-semibold">JOIN</span> it.
                IN-list filtering remains in the Filters section.
              </div>

              <div className="mb-3">
                <div className="fw-semibold mb-1">Crosswalk join key</div>
                <div className="text-muted small">{fixedJoinKeys.join(", ")} (fixed)</div>
              </div>

              <div className="mb-3">
                <div className="fw-semibold mb-2">Choose domain join column(s)</div>

                {candidates.length === 0 ? (
                  <div className="alert alert-warning py-2 mb-0">
                    No candidate domain columns found for this crosswalk type.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {candidates.map((c) => {
                      const key = colKey(toSqlColumnKey(c));
                      const checked = selectedKeys.has(key);
                      return (
                        <div key={key} className="d-flex align-items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? domainJoinCols.filter((k) => colKey(k) !== key)
                                : [...domainJoinCols, toSqlColumnKey(c)];
                              setDomainJoinCols(next);
                            }}
                          />
                          <span>{c.columnName}</span>

                          {/* Allow aliasing for multiple NPI joins (attending/referring/etc) */}
                          {type === "npiCategories" && checked ? (
                            <input
                              className="form-control form-control-sm ms-auto"
                              style={{ maxWidth: 240 }}
                              placeholder="Alias (e.g., attending)"
                              value={aliasByKey[key] ?? ""}
                              onChange={(e) => {
                                const next = { ...(aliasByKey ?? {}) };
                                next[key] = e.target.value;
                                setAliasByKey(next);
                              }}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!joinReady ? (
                  <div className="alert alert-warning mt-3 py-2 mb-0">
                    Pick at least one domain column to join on.
                  </div>
                ) : null}
              </div>

              <div className="mb-2">
                <div className="fw-semibold mb-2">Fields to include from crosswalk</div>
                <div className="d-flex flex-wrap gap-2">
                  {projectable.map((f) => {
                    const on = projectFields.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        className={`btn btn-sm ${on ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setProjectFields(on ? projectFields.filter((x) => x !== f) : [...projectFields, f])}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
                <div className="text-muted small mt-2">These get added to Columns (aliased) once joined.</div>
              </div>
            </div>

            <div className="modal-footer d-flex justify-content-between">
              <button type="button" className="btn btn-outline-danger" onClick={onRemove}>
                Remove join
              </button>

              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" disabled={!joinReady} onClick={save}>
                  Save join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
};

export const DomainSection: React.FC<Props> = ({
  collapsed,
  onToggleCollapsed,
  collapsible = true,
  onHide,
  isFullscreen,
  onToggleFullscreen,

  domains,
  selectedDomainId,
  onChangeDomain,
  workspaceId,
  domainColumns,

  valueOverrideAttachments,
  cohortAttachment,
  onChangeValueOverrideAttachments,
  onChangeCohortAttachment,

  onSelectValueOverride,

  distinct,
  onChangeDistinct,
  disableDistinct,
  excludeErrorRows,
  onChangeExcludeErrorRows,
  disableExcludeErrorRows,

  loading,
  error,
  onRetry,
  onNext,
  onSubmit,
  helpAction,
}) => {
  const [pressedId, setPressedId] = useState<string | null>(null);

  const [visibleCrosswalkIndex, setVisibleCrosswalkIndex] =
    useState<ValueOverrideVisibilityIndex>(emptyCrosswalkIndex);

  const [openGroups, setOpenGroups] = useState<Record<ValueOverrideGroupKey, boolean>>({
    regions: false,
    npiCategories: false,
    serviceLines: false,
  });

  const [joinModal, setJoinModal] = useState<JoinModalState | null>(null);

  const domainIsSelected = !!selectedDomainId;
  const canGoNext = Boolean(selectedDomainId);

  const sortedDomains = useMemo(() => {
    return domains.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [domains]);

  const crosswalkCount =
    (visibleCrosswalkIndex.regions?.length ?? 0) +
    (visibleCrosswalkIndex.npiCategories?.length ?? 0) +
    (visibleCrosswalkIndex.serviceLines?.length ?? 0);

  useEffect(() => {
    let alive = true;

    const loadVisibility = async () => {
      try {
        const resp = await getVisibleValueOverrides(true);
        if (alive) setVisibleCrosswalkIndex(resp?.index ?? emptyCrosswalkIndex);
      } catch (e) {
        console.error("Failed to load crosswalk visibility", e);
        if (alive) setVisibleCrosswalkIndex(emptyCrosswalkIndex);
      }
    };

    loadVisibility();
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const toggleGroup = (k: ValueOverrideGroupKey) => setOpenGroups((p) => ({ ...p, [k]: !p[k] }));

  const selectDomain = (id: string) => {
    if (!id) return;
    if (String(selectedDomainId ?? "") === String(id)) return;

    onChangeDomain(id);

    setPressedId(id);
    window.setTimeout(() => setPressedId((cur) => (cur === id ? null : cur)), 140);

    // Open first group by default for discoverability
    setOpenGroups({ regions: true, npiCategories: false, serviceLines: false });
  };

  const clearAll = () => {
    onChangeDomain(null);

    onSelectValueOverride?.("regions", "");

    // Clears joins (domain-specific)
    onChangeValueOverrideAttachments([]);
    onChangeCohortAttachment(null);
  };

  const upsertCrosswalkJoin = (next: ValueOverrideAttachment) => {
    const idx = valueOverrideAttachments.findIndex((cw) => cw.type === next.type && cw.listId === next.listId);
    const updated = idx >= 0 ? valueOverrideAttachments.map((cw, i) => (i === idx ? next : cw)) : [...valueOverrideAttachments, next];
    onChangeValueOverrideAttachments(updated);
  };

  const removeCrosswalkJoin = (type: ValueOverrideGroupKey, listId: string) => {
    onChangeValueOverrideAttachments(valueOverrideAttachments.filter((cw) => !(cw.type === type && cw.listId === listId)));
  };

  const openCrosswalkJoinFlow = (type: ValueOverrideGroupKey, listId: string, listLabel: string) => {
    if (!domainIsSelected) return;
    onSelectValueOverride?.(type, listId);
    setJoinModal({ kind: "crosswalk", type, listId, listLabel });
  };

  const joinedCrosswalksSummary = valueOverrideAttachments?.length ? `${valueOverrideAttachments.length} joined` : "None";
  const cohortJoinSummary = cohortAttachment ? "Joined" : "None";

  const renderCrosswalkGroup = (group: ValueOverrideGroupKey, title: string, rows: ValueOverrideVisibilityRow[]) => {
    if (!rows?.length) return null;

    const open = !!openGroups[group];

    return (
      <div className={`border rounded w-100 ${!domainIsSelected ? "opacity-50" : ""}`}>
        <button
          type="button"
          className="btn w-100 d-flex align-items-center justify-content-between"
          onClick={() => domainIsSelected && toggleGroup(group)}
          style={{ border: "none", background: "transparent", padding: "10px 12px" }}
          aria-expanded={open}
          disabled={!domainIsSelected}
          title={!domainIsSelected ? "Select a domain first" : undefined}
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`fa fa-chevron-${open ? "down" : "right"}`} aria-hidden="true" />
            <span className="fw-semibold">{title}</span>
            <span className="text-muted small">({rows.length})</span>
          </div>
        </button>

        {open ? (
          <div className="border-top w-100">
            <div className="table-responsive w-100">
              <table className="table table-sm mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Crosswalk</th>
                    <th className="text-end" style={{ width: 140 }}>
                      Updated
                    </th>
                    <th className="text-end" style={{ width: 140 }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((cw: any) => {
                    const listId = String(cw.listId ?? cw.id ?? "");
                    const label = String(cw.listName ?? cw.name ?? listId);
                    const updatedRaw = cw.updatedAt ?? cw.updated_at ?? cw.updated ?? null;

                    const isJoined = valueOverrideAttachments.some((a) => a.type === group && a.listId === listId);

                    return (
                      <tr key={listId} className="nc-domain-row">
                        <td style={{ maxWidth: 720 }}>
                          <div className="nc-domain-name">{label}</div>
                          {cw.owner ? (
                            <div className="nc-domain-path" style={{ maxWidth: 720 }}>
                              {String(cw.owner)}
                            </div>
                          ) : null}
                        </td>

                        <td className="text-end">
                          <div className="nc-domain-asof">{formatAsOf(updatedRaw)}</div>
                        </td>

                        <td className="text-end">
                          <button
                            type="button"
                            className={`btn btn-sm ${isJoined ? "btn-outline-secondary" : "btn-primary"}`}
                            disabled={!domainIsSelected}
                            onClick={() => openCrosswalkJoinFlow(group, listId, label)}
                            title={!domainIsSelected ? "Select a domain first" : isJoined ? "Edit join" : "Join"}
                          >
                            {isJoined ? "Edit join" : "Join"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-2 text-muted small">
              Joined crosswalk fields will be added to Columns (aliased). Use Filters for IN-list filtering.
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <SectionShell
      id="domain"
      title="Domain"
      subtitle="Choose a domain table. Optionally join value overrides."
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      collapsible={collapsible}
      iconClass="fa-table"
      count={(selectedDomainId ? 1 : 0) + (valueOverrideAttachments.length ? 1 : 0) + (cohortAttachment ? 1 : 0)}
      onHide={onHide}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
      helpAction={helpAction}
    >
      {loading ? <div className="text-muted small p-2">Loading domains…</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 mb-0 d-flex align-items-center justify-content-between gap-2">
          <span>{error}</span>
          {onRetry ? (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="d-flex flex-column gap-1 w-100">
          {/* Top row actions */}
          <div className="d-flex align-items-center w-100 mb-1">
            <div className="d-flex align-items-center gap-3 flex-grow-1">
              <label className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={distinct}
                  onChange={(e) => onChangeDistinct(e.target.checked)}
                  disabled={!selectedDomainId || disableDistinct}
                />
                <span className="form-check-label small">Distinct rows</span>
              </label>
              <span className="text-muted small">Default on for cleaner results.</span>
              <label className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={excludeErrorRows}
                  onChange={(e) => onChangeExcludeErrorRows(e.target.checked)}
                  disabled={!selectedDomainId || disableExcludeErrorRows}
                />
                <span className="form-check-label small">Exclude Error Rows</span>
              </label>
              <span className="text-muted small">Filters out rows where tdoe_severity_code &gt;= 4</span>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={clearAll}
              disabled={!selectedDomainId && valueOverrideAttachments.length === 0 && !cohortAttachment}
              title="Clear selected domain and joins"
            >
              <i className="fa fa-eraser me-1" />
              Clear
            </button>
          </div>

          {/* Join status summary */}
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <span className="badge text-bg-light border">
              Crosswalk joins: <span className="fw-semibold">{joinedCrosswalksSummary}</span>
            </span>
            <span className="badge text-bg-light border">
              Cohort join: <span className="fw-semibold">{cohortJoinSummary}</span>
            </span>
            {!domainIsSelected ? (
              <span className="text-muted small">Select a domain to enable joins.</span>
            ) : (
              <span className="text-muted small">
                Choosing a crosswalk here means JOIN. Use Filters for IN-list filtering.
              </span>
            )}
          </div>

          {/* Domain picker */}
          <div className="w-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="fw-semibold">Domain</div>
              {!selectedDomainId ? (
                <span className="badge text-bg-light border" style={{ borderColor: "rgba(220,53,69,0.35)" }}>
                  <span style={{ color: "rgb(220,53,69)" }}>Please select a domain</span>
                </span>
              ) : null}
            </div>

            <div className={`table-responsive border rounded w-100 ${!selectedDomainId ? "nc-domain-needs" : ""}`}>
              <table className="table table-sm table-hover mb-0 align-middle w-100">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 46 }} />
                    <th style={{ width: "40%" }}>Domain Name</th>
                    <th style={{ width: "60%" }}>Description</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedDomains.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-muted text-center py-3">
                        No domains available.
                      </td>
                    </tr>
                  ) : (
                    sortedDomains.map((d: any) => {
                      const selected = String(d.id) === String(selectedDomainId ?? "");
                      const pressed = pressedId === String(d.id);

                      const tableNames = (
                        Array.isArray(d.tables)
                          ? d.tables
                          : Array.isArray(d.table_sample)
                          ? d.table_sample
                          : []
                      )
                        .map((tableName: unknown) => String(tableName ?? "").trim())
                        .filter(Boolean);

                      const totalTablesRaw = d.table_count ?? d.tableCount;
                      const parsedTotalTables = Number(totalTablesRaw);
                      const totalTables = Number.isFinite(parsedTotalTables)
                        ? parsedTotalTables
                        : tableNames.length;
                      const hiddenTableCount = Math.max(0, totalTables - tableNames.length);

                      const fullPath =
                        d.full_path ??
                        d.fullName ??
                        d.primary_table_name ??
                        d.primaryTableName ??
                        d.model_table_name ??
                        d.modelTableName ??
                        d.source_table_name ??
                        d.sourceTableName ??
                        d.table_full_name ??
                        d.tableFullName ??
                        d.name;

                      const tableList = tableNames.join(", ");
                      const tableListPreview = tableNames.length
                        ? hiddenTableCount > 0
                          ? `${tableList}, +${hiddenTableCount} more`
                          : tableList
                        : String(fullPath);
                      const tableListTooltip = tableNames.length
                        ? hiddenTableCount > 0
                          ? `${tableList}\n(+${hiddenTableCount} more table${hiddenTableCount === 1 ? "" : "s"})`
                          : tableList
                        : String(fullPath);

                      return (
                        <tr
                          key={d.id}
                          className={`nc-domain-row ${selected ? "is-selected" : ""} ${pressed ? "is-pressed" : ""}`}
                          onClick={() => selectDomain(String(d.id))}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          title="Click row to select"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectDomain(String(d.id));
                            }
                          }}
                        >
                          <td onClick={(e) => e.stopPropagation()} className="text-center" style={{ width: 46 }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ padding: 0, border: "none", background: "transparent" }}
                              onClick={() => selectDomain(String(d.id))}
                              aria-label={selected ? "Selected domain" : "Select domain"}
                              title={selected ? "Selected" : "Select"}
                            >
                              <span className={`nc-domain-radio ${selected ? "is-on" : ""}`} />
                            </button>
                          </td>

                          <td style={{ maxWidth: 640 }}>
                            <div className="nc-domain-name">{d.name}</div>
                            {tableListPreview ? (
                              <div className="nc-domain-path" title={tableListTooltip}>
                                {tableListPreview}
                              </div>
                            ) : null}
                          </td>

                          <td>
                            <div className="nc-domain-desc">
                              {(d.description || "").trim() ? d.description : <span className="text-muted">—</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-muted small mt-2">Tip: click a row (or press Enter) to select a domain.</div>
          </div>

          {/* Crosswalks (JOIN FLOW ONLY) */}
          {crosswalkCount > 0 ? (
            <div className="w-100 mt-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="fw-semibold">
                  Crosswalks <span className="text-muted small">(Join)</span>
                </div>
                {!domainIsSelected ? <span className="text-muted small">Select a domain to enable.</span> : null}
              </div>

              <div className="d-flex flex-column gap-3 w-100">
                {renderCrosswalkGroup("regions", "Regions", visibleCrosswalkIndex.regions)}
                {renderCrosswalkGroup("npiCategories", "NPI Categories", visibleCrosswalkIndex.npiCategories)}
                {renderCrosswalkGroup("serviceLines", "Service Lines", visibleCrosswalkIndex.serviceLines)}
              </div>
            </div>
          ) : null}

        </div>
      ) : null}

      {onNext || onSubmit ? (
        <div className="d-flex flex-column align-items-start mt-3 pt-3 border-top">
          <div className="d-flex align-items-center gap-2">
            {onNext ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={onNext}
                disabled={!canGoNext}
                title={!canGoNext ? "Select a domain to continue" : "Next"}
              >
                Next
              </button>
            ) : null}
            {onSubmit ? (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onSubmit}>
                Save
              </button>
            ) : null}
          </div>
          <div className="text-muted small mt-1">Pick some columns next.</div>
        </div>
      ) : null}

      {/* Modals */}
      {joinModal?.kind === "crosswalk" ? (
        <CrosswalkJoinModal
          modal={joinModal}
          workspaceId={workspaceId}
          domainColumns={domainColumns}
          existing={
            valueOverrideAttachments.find((cw) => cw.type === joinModal.type && cw.listId === joinModal.listId) ?? null
          }
          onSave={(next) => {
            upsertCrosswalkJoin(next);
            setJoinModal(null);
          }}
          onRemove={() => {
            removeCrosswalkJoin(joinModal.type, joinModal.listId);
            setJoinModal(null);
          }}
          onClose={() => setJoinModal(null)}
        />
      ) : null}
    </SectionShell>
  );
};

export default DomainSection;
