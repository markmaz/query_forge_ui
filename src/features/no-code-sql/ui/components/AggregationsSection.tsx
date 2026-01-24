// src/features/nocode-query/ui/components/AggregationsSection.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { EmptySectionState } from "../../../../shared/ui/EmptySectionState";
import { SectionShell } from "./SectionShell";
import type {
  AggFn,
  SqlAggMetric,
  SqlAggregationsJson,
  SqlColumnKey,
} from "../../model/sqlJson";
import { colKey, labelFor, sameCol } from "../../model/sqlJson";
import { SqlColumnPicker } from "./ColumnSelector";

type Props = {
  // ✅ common column key (source of truth)
  selectedColumns: SqlColumnKey[];
  allColumns?: SqlColumnKey[];

  // optional metadata for numeric validation (best-effort)
  // If you don't have this in nocode-query, you can pass undefined safely.
  columnsMeta?: Array<{
    modelColumnId: number;
    columnName: string;
    dataType?: string | null;
  }>;

  value?: SqlAggregationsJson | null;
  onChange?: (next: SqlAggregationsJson | null) => void;

  // ✅ Optional shell plumbing (PreviewSection pattern)
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  collapsible?: boolean;
  onHide?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

const newId = () => Math.random().toString(36).slice(2, 10);

const FN_LABEL: Record<AggFn, string> = {
  count: "COUNT",
  count_distinct: "COUNT DISTINCT",
  sum: "SUM",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
};

const FN_HELP: Record<AggFn, string> = {
  count: "Counts rows. Uses COUNT(*)",
  count_distinct: "Counts distinct values in a column.",
  sum: "Sums numeric values in a column.",
  avg: "Averages numeric values in a column.",
  min: "Lowest value in a column.",
  max: "Highest value in a column.",
};

function looksNumeric(dt?: string | null) {
  const s = (dt || "").toLowerCase();
  return (
    s.includes("int") ||
    s.includes("bigint") ||
    s.includes("double") ||
    s.includes("float") ||
    s.includes("decimal") ||
    s.includes("numeric") ||
    s.includes("number")
  );
}

function defaultLabel(fn: AggFn, field: SqlColumnKey | null) {
  if (fn === "count" && !field) return "row_count";
  if (!field) return FN_LABEL[fn].toLowerCase();
  return `${FN_LABEL[fn].toLowerCase()}_${field.columnName}`;
}

function metricExpr(m: SqlAggMetric) {
  if (m.fn === "count" && !m.field) return "COUNT(*)";
  if (!m.field) return `${m.fn.toUpperCase()}(?)`;

  const col = labelFor(m.field);
  if (m.fn === "count_distinct") return `COUNT(DISTINCT ${col})`;
  return `${m.fn.toUpperCase()}(${col})`;
}

function reorder<T>(items: T[], fromId: string, toId: string, getId: (x: T) => string) {
  const fromIdx = items.findIndex((x) => getId(x) === fromId);
  const toIdx = items.findIndex((x) => getId(x) === toId);
  if (fromIdx < 0 || toIdx < 0) return items;

  const next = items.slice();
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

function normalizeModel(m: SqlAggregationsJson): SqlAggregationsJson {
  const enabled = (m.metrics?.length ?? 0) > 0 || (m.groupBy?.length ?? 0) > 0;
  return { ...m, enabled };
}

export const AggregationsSection: React.FC<Props> = ({
  selectedColumns,
  allColumns,
  columnsMeta,
  value,
  onChange,

  collapsed,
  onToggleCollapsed,
  collapsible = true,
  onHide,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const metricColumns = allColumns && allColumns.length ? allColumns : selectedColumns;
  const groupByColumns = selectedColumns;
  const hasCols = metricColumns.length > 0;
  const defaultField: SqlColumnKey | null = hasCols ? metricColumns[0] : null;

  const [internal, setInternal] = useState<SqlAggregationsJson>(
    normalizeModel(value ?? { enabled: false, metrics: [], groupBy: [] })
  );

  const model = normalizeModel(value ?? internal);

  const commit = (next: SqlAggregationsJson) => {
    const normalized = normalizeModel(next);
    if (!value) setInternal(normalized);

    // If empty, emit null (optional – keeps sqlJson clean)
    const isEmpty = normalized.metrics.length === 0 && normalized.groupBy.length === 0;
    onChange?.(isEmpty ? null : normalized);
  };

  useEffect(() => {
    if (value) setInternal(normalizeModel(value));
  }, [value]);

  const selectedByKey = useMemo(() => {
    const m = new Map<string, SqlColumnKey>();
    for (const c of metricColumns) m.set(colKey(c), c);
    return m;
  }, [metricColumns]);

  const metaByModelColumnId = useMemo(() => {
    const m = new Map<number, { dataType?: string | null }>();
    (columnsMeta ?? []).forEach((c) => {
      if (typeof c.modelColumnId === "number") m.set(c.modelColumnId, { dataType: c.dataType ?? null });
    });
    return m;
  }, [columnsMeta]);

  const metricAvailableCols = useMemo(() => {
    return metricColumns
      .slice()
      .sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
  }, [metricColumns]);

  const groupByAvailableCols = useMemo(() => {
    return groupByColumns
      .slice()
      .sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
  }, [groupByColumns]);

  // prune removed columns (by sameCol)
  useEffect(() => {
    if (!hasCols) {
      if (model.metrics.length || model.groupBy.length) {
        commit({ ...model, metrics: [], groupBy: [] });
      }
      return;
    }

    const prunedMetrics = model.metrics.map((m) => {
      if (!m.field) return m;
      const match =
        metricColumns.find((c) => sameCol(c, m.field)) ??
        metricColumns.find((c) => c.modelColumnId != null && c.modelColumnId === m?.field?.modelColumnId) ??
        metricColumns.find((c) => c.columnName === m?.field?.columnName);
      return match ? { ...m, field: match } : { ...m, field: defaultField };
    });

    const prunedGroup = model.groupBy
      .map((g) => {
        const match =
          groupByColumns.find((c) => sameCol(c, g)) ??
          groupByColumns.find((c) => c.modelColumnId != null && c.modelColumnId === g.modelColumnId) ??
          groupByColumns.find((c) => c.columnName === g.columnName);
        return match ?? null;
      })
      .filter(Boolean) as SqlColumnKey[];

    // ensure groupBy has no dups by colKey
    const seen = new Set<string>();
    const uniqGroup: SqlColumnKey[] = [];
    for (const g of prunedGroup) {
      const k = colKey(g);
      if (seen.has(k)) continue;
      seen.add(k);
      uniqGroup.push(g);
    }

    const beforeSig = JSON.stringify(model);
    const afterSig = JSON.stringify({ ...model, metrics: prunedMetrics, groupBy: uniqGroup });

    if (beforeSig !== afterSig) {
      commit({ ...model, metrics: prunedMetrics, groupBy: uniqGroup });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasCols ? metricColumns.map(colKey).slice().sort().join("|") : "none",
    groupByColumns.map(colKey).slice().sort().join("|"),
    defaultField ? colKey(defaultField) : "none",
  ]);

  const addMetric = () => {
    const first = defaultField;
    const fn: AggFn = first ? "count_distinct" : "count";
    const field: SqlColumnKey | null = first ? first : null;

    const m: SqlAggMetric = {
      id: newId(),
      fn,
      field: fn === "count" ? null : field,
      label: defaultLabel(fn, fn === "count" ? null : field),
    };

    commit({ ...model, metrics: [...model.metrics, m] });
  };

  const clearAll = () => commit({ ...model, metrics: [], groupBy: [] });

  const removeMetric = (id: string) => {
    commit({ ...model, metrics: model.metrics.filter((m) => m.id !== id) });
  };

  const updateMetric = (id: string, patch: Partial<SqlAggMetric>) => {
    commit({
      ...model,
      metrics: model.metrics.map((m) => {
        if (m.id !== id) return m;
        const next: SqlAggMetric = { ...m, ...patch };

        // COUNT => always COUNT(*)
        if (patch.fn === "count") next.field = null;

        // Non-count needs a field
        if (next.fn !== "count" && !next.field) next.field = defaultField;

        // If label was cleared, restore a default
        if (!next.label?.trim()) next.label = defaultLabel(next.fn, next.field ?? null);

        return next;
      }),
    });
  };

  const toggleGroupBy = (col: SqlColumnKey) => {
    const exists = model.groupBy.some((g) => sameCol(g, col));
    commit({
      ...model,
      groupBy: exists ? model.groupBy.filter((g) => !sameCol(g, col)) : [...model.groupBy, col],
    });
  };

  // validation
  const metricErrors = useMemo(() => {
    const errors = new Map<string, string>();
    const counts = new Map<string, number>();

    model.metrics.forEach((m) => {
      const k = (m.label || "").trim().toLowerCase();
      if (!k) return;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });

    model.metrics.forEach((m) => {
      if (!m.label?.trim()) errors.set(m.id, "Label is required.");
      else if ((counts.get(m.label.trim().toLowerCase()) ?? 0) > 1)
        errors.set(m.id, "Metric label must be unique.");

      if (m.fn !== "count" && !m.field) errors.set(m.id, "This function requires a column.");

      if ((m.fn === "sum" || m.fn === "avg") && m.field && metaByModelColumnId.size) {
        const id = m.field.modelColumnId;
        if (typeof id === "number" && id !== null) {
          const dt = metaByModelColumnId.get(id)?.dataType ?? null;
          if (dt && !looksNumeric(dt)) errors.set(m.id, "SUM/AVG require a numeric column.");
        }
      }
    });

    return errors;
  }, [model.metrics, metaByModelColumnId]);

  // drag & drop
  const dragIdRef = useRef<string | null>(null);
  const onDragStart = (id: string) => (dragIdRef.current = id);
  const onDropOn = (targetId: string) => {
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    if (!fromId || fromId === targetId) return;
    commit({
      ...model,
      metrics: reorder(model.metrics, fromId, targetId, (x) => x.id),
    });
  };

  const metricsSummary = useMemo(() => {
    if (model.metrics.length === 0) return [];
    return model.metrics.map((m) => `${m.label} = ${metricExpr(m)}`);
  }, [model.metrics]);

  const groupBySummary = useMemo(() => {
    if (model.groupBy.length === 0) return "none";
    return model.groupBy.map((c) => labelFor(c)).join(", ");
  }, [model.groupBy]);

  const body = (
    <div>
      <style>{`
        .nc-agg-list-item {
          border-radius: 10px;
          margin-bottom: 10px;
          background: linear-gradient(135deg, rgba(0,0,0,0.02), rgba(0,0,0,0.01));
          border: 1px solid rgba(0,0,0,0.08);
        }

        .nc-agg-drag {
          cursor: grab;
          width: 18px;
          text-align: center;
          opacity: 0.7;
        }

        /* equal-width controls */
        .nc-agg-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          align-items: end;
        }

        .nc-agg-cap {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .02em;
          color: rgba(0,0,0,0.55);
          margin: 0 0 4px 2px;
          text-transform: uppercase;
        }

        /* column-pill look */
        .nc-agg-pill {
          border-radius: 10px !important;
          padding: 6px 10px !important;
          border: 1px solid rgba(0,0,0,0.14) !important;
          background: rgba(255,255,255,0.9) !important;
        }
        .nc-agg-pill:hover {
          background: rgba(0,0,0,0.03) !important;
        }
        .nc-agg-pill.is-on {
          background: rgba(var(--bs-primary-rgb, 13,110,253), 0.10) !important;
          border-color: rgba(var(--bs-primary-rgb, 13,110,253), 0.32) !important;
          color: var(--bs-primary) !important;
        }

        .nc-agg-help {
          color: rgba(0,0,0,0.62);
        }

        .nc-agg-summary {
          background: rgba(0,0,0,0.02);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 10px;
          padding: 10px 12px;
        }

        .nc-agg-summary code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
        }
      `}</style>

      {!hasCols ? (
        <EmptySectionState
          iconClass="fa-chart-simple"
          title="No columns selected yet"
          subtitle="Select some columns to enable aggregations."
        />
      ) : (
        <>
          {/* Top row controls */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="text-muted small">
              Drag metrics to reorder. Top → bottom is evaluation order.
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={clearAll}
                disabled={model.metrics.length === 0 && model.groupBy.length === 0}
                title="Clear aggregations"
              >
                <i className="fa fa-eraser me-1" aria-hidden="true" />
                Clear
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={addMetric}
                title="Add a metric"
              >
                <i className="fa fa-plus me-1" aria-hidden="true" />
                Add metric
              </button>
            </div>
          </div>

          {/* Metrics list */}
          {model.metrics.length === 0 ? (
            <EmptySectionState
              iconClass="fa-chart-simple"
              title="No metrics yet"
              subtitle="Click “Add metric” to create COUNT/SUM/AVG style metrics."
            />
          ) : (
            <div className="list-group mb-3">
              {model.metrics.map((m, idx) => {
                const err = metricErrors.get(m.id);
                const expr = metricExpr(m);

                const fieldK = m.field ? colKey(m.field) : "";

                return (
                  <div
                    key={m.id}
                    className="list-group-item d-flex align-items-start justify-content-between nc-agg-list-item"
                    draggable
                    onDragStart={() => onDragStart(m.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDropOn(m.id)}
                    title="Drag to reorder"
                  >
                    <div className="d-flex align-items-start gap-2" style={{ minWidth: 0, flex: 1 }}>
                      <span className="text-muted nc-agg-drag mt-1" aria-hidden="true" title="Drag">
                        <i className="fa fa-grip-vertical" />
                      </span>

                      <span
                        className="badge bg-light text-dark mt-1"
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          borderRadius: 999,
                          width: 28,
                          height: 22,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                        }}
                        title="Metric order"
                      >
                        {idx + 1}
                      </span>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="nc-agg-grid" style={{ minWidth: 0 }}>
                          <div>
                            <div className="nc-agg-cap">Fn</div>
                            <select
                              className="form-select form-select-sm"
                              value={m.fn}
                              title={FN_HELP[m.fn]}
                              onChange={(e) => updateMetric(m.id, { fn: e.target.value as AggFn })}
                            >
                              {(["count", "count_distinct", "sum", "avg", "min", "max"] as AggFn[]).map((fn) => (
                                <option key={fn} value={fn}>
                                  {FN_LABEL[fn]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <div className="nc-agg-cap">Column</div>
                            {m.fn === "count" ? (
                              <div className="form-control form-control-sm bg-light" title="COUNT(*)">
                                <span className="text-muted">(*)</span>
                              </div>
                            ) : (
                              <SqlColumnPicker
                                columns={metricAvailableCols}
                                selectedColumns={selectedColumns}
                                showSelectedBadge
                                value={m.field ?? defaultField}
                                onChange={(next) => updateMetric(m.id, { field: next })}
                                placeholder="Choose column…"
                              />
                            )}
                          </div>

                          <div>
                            <div className="nc-agg-cap">Label</div>
                            <input
                              className={`form-control form-control-sm ${err ? "is-invalid" : ""}`}
                              value={m.label ?? ""}
                              onChange={(e) => updateMetric(m.id, { label: e.target.value })}
                              placeholder="e.g., total_paid"
                              title="Alias / label"
                            />
                          </div>
                        </div>

                        <div className="small nc-agg-help mt-2 text-truncate" title={`${m.label} = ${expr}`}>
                          <code>{m.label}</code> <span className="text-muted">=</span> <code>{expr}</code>
                        </div>

                        {err ? <div className="invalid-feedback d-block">{err}</div> : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => removeMetric(m.id)}
                      title="Remove metric"
                      style={{
                        border: "none",
                        background: "transparent",
                        opacity: 0.65,
                        padding: "4px 8px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
                    >
                      <i className="fa fa-xmark" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Group By */}
          <div className="mb-2 fw-semibold">Group by columns</div>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {groupByAvailableCols.map((c) => {
              const on = model.groupBy.some((g) => sameCol(g, c));
              return (
                <button
                  key={colKey(c)}
                  type="button"
                  className={`btn btn-sm nc-agg-pill ${on ? "is-on" : ""}`}
                  onClick={() => toggleGroupBy(c)}
                  title={on ? "Remove from GROUP BY" : "Add to GROUP BY"}
                >
                  {labelFor(c)}
                </button>
              );
            })}
          </div>

          {/* Bottom summary */}
          <div className="nc-agg-summary">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold">Summary</div>
              <div className="text-muted small">
                {model.metrics.length} metric{model.metrics.length === 1 ? "" : "s"} •{" "}
                {model.groupBy.length} group by
              </div>
            </div>

            <div className="mb-2">
              <div className="text-muted small fw-semibold mb-1">Metrics</div>
              {metricsSummary.length === 0 ? (
                <div className="text-muted small">None</div>
              ) : (
                <div className="vstack gap-1">
                  {metricsSummary.map((line, i) => (
                    <div key={i} className="small">
                      <code>{line}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-muted small fw-semibold mb-1">Group by</div>
              <div className="small">
                {groupBySummary === "none" ? <span className="text-muted">none</span> : <code>{groupBySummary}</code>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ✅ shell is optional (same migration strategy as SortingSection)
  const useShell = typeof collapsed === "boolean" && typeof onToggleCollapsed === "function";
  if (!useShell) return body;

  const right = (
    <div className="d-flex align-items-center gap-2">
      {onToggleFullscreen ? (
        <button
          type="button"
          className="btn btn-sm"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          style={{
            border: "none",
            background: "transparent",
            padding: "2px 6px",
            lineHeight: 1,
            opacity: 0.65,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
        >
          <i className={`fa ${isFullscreen ? "fa-compress" : "fa-expand"}`} />
        </button>
      ) : null}

      {onHide ? (
        <button
          type="button"
          className="btn btn-sm"
          onClick={onHide}
          aria-label="Hide Aggregations"
          title="Hide section"
          style={{
            border: "none",
            background: "transparent",
            padding: "2px 6px",
            lineHeight: 1,
            opacity: 0.65,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
        >
          <i className="fa fa-xmark" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return (
    <SectionShell
      id="aggs"
      title="Aggregations"
      subtitle="Define metrics and groupings."
      collapsed={collapsed!}
      onToggleCollapsed={onToggleCollapsed!}
      collapsible={collapsible}
      iconClass="fa-chart-simple"
      count={model.metrics.length > 0 ? model.metrics.length : model.groupBy.length > 0 ? 1 : undefined}
      right={right}
    >
      {body}
    </SectionShell>
  );
};

export default AggregationsSection;
