import React, { useEffect, useMemo, useRef, useState } from "react";
import { EmptySectionState } from "../../../../shared/components/EmptySectionState";
import type {
  AggFn,
  AggSpec,
  DerivedMetric,
  SqlAggMetric,
  SqlAggregationsJson,
  SqlColumnKey,
  SqlMetricRef,
} from "../../model/sqlJson";
import { colKey, labelFor, sameCol } from "../../model/sqlJson";
import { SqlColumnPicker } from "./ColumnSelector";
import RatioMetricBuilder from "./RatioMetricBuilder";
import { SectionShell } from "./SectionShell";

type Props = {
  selectedColumns: SqlColumnKey[];
  allColumns?: SqlColumnKey[];
  columnsMeta?: Array<{
    modelColumnId: number;
    columnName: string;
    dataType?: string | null;
  }>;
  value?: SqlAggregationsJson | null;
  onChange?: (next: SqlAggregationsJson | null) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  collapsible?: boolean;
  onHide?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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

type LegacyMetricShape = {
  id?: unknown;
  fn?: unknown;
  field?: unknown;
  label?: unknown;
  metricRef?: unknown;
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

const AGG_OPTIONS: AggFn[] = ["count", "count_distinct", "sum", "avg", "min", "max"];

function looksNumeric(dt?: string | null): boolean {
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

function isAggFn(value: unknown): value is AggFn {
  return typeof value === "string" && AGG_OPTIONS.includes(value as AggFn);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asColumnKey(value: unknown): SqlColumnKey | null {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const workspaceMatch = trimmed.match(/^wt(\d+)\.(.+)$/i);
    if (workspaceMatch) {
      return {
        modelColumnId: null,
        workspaceTableId: Number(workspaceMatch[1]),
        columnName: workspaceMatch[2],
        exprId: null,
        alias: null,
      };
    }
    return {
      modelColumnId: null,
      workspaceTableId: null,
      columnName: trimmed,
      exprId: null,
      alias: null,
    };
  }
  if (!isRecord(value)) return null;
  const columnName = typeof value.columnName === "string" ? value.columnName : null;
  if (!columnName) return null;
  return {
    modelColumnId:
      typeof value.modelColumnId === "number"
        ? value.modelColumnId
        : value.modelColumnId == null
          ? null
          : null,
    columnName,
    workspaceTableId:
      typeof value.workspaceTableId === "number"
        ? value.workspaceTableId
        : value.workspaceTableId == null
          ? null
          : null,
    exprId: typeof value.exprId === "string" ? value.exprId : null,
    alias: typeof value.alias === "string" ? value.alias : null,
  };
}

function normalizeMetricRef(raw: unknown): SqlMetricRef | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  if (type === "derived") {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) return null;
    return {
      type: "derived",
      name,
      label: typeof raw.label === "string" ? raw.label : null,
    };
  }

  if (type === "column") {
    return {
      type: "column",
      columnKey: asColumnKey(raw.columnKey) ?? null,
      agg: isAggFn(raw.agg) ? raw.agg : "count_distinct",
      label: typeof raw.label === "string" ? raw.label : null,
    };
  }

  return null;
}

function normalizeMetric(metric: LegacyMetricShape, fallbackField: SqlColumnKey | null): SqlAggMetric {
  const metricRef = normalizeMetricRef(metric.metricRef);
  if (metricRef) {
    return {
      id: typeof metric.id === "string" && metric.id.trim() ? metric.id : newId(),
      metricRef,
    };
  }

  const legacyFn = isAggFn(metric.fn) ? metric.fn : "count_distinct";
  const legacyField = asColumnKey(metric.field) ?? fallbackField;
  const legacyLabel = typeof metric.label === "string" ? metric.label : null;

  return {
    id: typeof metric.id === "string" && metric.id.trim() ? metric.id : newId(),
    metricRef: {
      type: "column",
      columnKey: legacyField,
      agg: legacyFn,
      label: legacyLabel,
    },
  };
}

function normalizeAggSpec(raw: unknown): AggSpec {
  if (!isRecord(raw)) return { columnKey: null, agg: "count_distinct", filters: [] };
  return {
    columnKey: asColumnKey(raw.columnKey) ?? null,
    agg: isAggFn(raw.agg) ? raw.agg : "count_distinct",
    filters: Array.isArray(raw.filters) ? (raw.filters as any[]) : [],
  };
}

function normalizeDerivedMetric(raw: unknown): DerivedMetric | null {
  if (!isRecord(raw)) return null;
  if (raw.kind !== "ratio") return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;
  return {
    kind: "ratio",
    name,
    label: typeof raw.label === "string" ? raw.label : null,
    numerator: normalizeAggSpec(raw.numerator),
    denominator: normalizeAggSpec(raw.denominator),
    safeDivide: raw.safeDivide !== false,
    multiplyBy:
      typeof raw.multiplyBy === "number" && Number.isFinite(raw.multiplyBy) ? raw.multiplyBy : null,
  };
}

function normalizeModel(value: SqlAggregationsJson | null | undefined, fallbackField: SqlColumnKey | null): SqlAggregationsJson {
  const metricsRaw = Array.isArray(value?.metrics) ? value?.metrics : [];
  const derivedRaw = Array.isArray(value?.derivedMetrics) ? value?.derivedMetrics : [];
  const normalized: SqlAggregationsJson = {
    enabled: false,
    metrics: metricsRaw.map((metric) => normalizeMetric(metric as LegacyMetricShape, fallbackField)),
    groupBy: Array.isArray(value?.groupBy) ? value?.groupBy : [],
    derivedMetrics: derivedRaw.map(normalizeDerivedMetric).filter((metric): metric is DerivedMetric => Boolean(metric)),
  };
  normalized.enabled = normalized.metrics.length > 0 || normalized.groupBy.length > 0;
  return normalized;
}

function resolveColumn(columns: SqlColumnKey[], key: SqlColumnKey | null): SqlColumnKey | null {
  if (!key) return null;
  return (
    columns.find((entry) => sameCol(entry, key)) ??
    columns.find((entry) => entry.modelColumnId != null && entry.modelColumnId === key.modelColumnId) ??
    columns.find((entry) => entry.columnName === key.columnName) ??
    null
  );
}

function defaultColumnMetric(field: SqlColumnKey | null): SqlAggMetric {
  return {
    id: newId(),
    metricRef: {
      type: "column",
      agg: field ? "count_distinct" : "count",
      columnKey: field,
      label: field ? `count_distinct_${field.columnName}` : "row_count",
    },
  };
}

function metricDisplayLabel(metric: SqlAggMetric, derivedByName: Map<string, DerivedMetric>) {
  if (metric.metricRef.type === "derived") {
    const found = derivedByName.get(metric.metricRef.name);
    return metric.metricRef.label?.trim() || found?.label?.trim() || metric.metricRef.name;
  }
  const label = metric.metricRef.label?.trim();
  if (label) return label;
  const field = metric.metricRef.columnKey;
  if (!field) return metric.metricRef.agg.toLowerCase();
  return `${metric.metricRef.agg.toLowerCase()}_${field.columnName}`;
}

function metricExpr(metric: SqlAggMetric, derivedByName: Map<string, DerivedMetric>) {
  if (metric.metricRef.type === "derived") {
    const found = derivedByName.get(metric.metricRef.name);
    if (!found) return `DERIVED(${metric.metricRef.name})`;
    const numerator = `${found.numerator.agg.toUpperCase()}(${found.numerator.columnKey ? labelFor(found.numerator.columnKey) : "?"})`;
    const denominator = `${found.denominator.agg.toUpperCase()}(${found.denominator.columnKey ? labelFor(found.denominator.columnKey) : "?"})`;
    const multiply = found.multiplyBy == null ? "" : ` * ${found.multiplyBy}`;
    return `${numerator} / ${denominator}${multiply}`;
  }
  const field = metric.metricRef.columnKey;
  if (!field) return `${metric.metricRef.agg.toUpperCase()}(?)`;
  if (metric.metricRef.agg === "count_distinct") return `COUNT(DISTINCT ${labelFor(field)})`;
  return `${metric.metricRef.agg.toUpperCase()}(${labelFor(field)})`;
}

function reorder<T>(items: T[], fromId: string, toId: string, getId: (item: T) => string) {
  const fromIdx = items.findIndex((item) => getId(item) === fromId);
  const toIdx = items.findIndex((item) => getId(item) === toId);
  if (fromIdx < 0 || toIdx < 0) return items;
  const next = items.slice();
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
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
  onNext,
  onSubmit,
  helpAction,
}) => {
  const metricColumns = allColumns && allColumns.length ? allColumns : selectedColumns;
  const groupByColumns = selectedColumns;
  const hasCols = metricColumns.length > 0;
  const defaultField: SqlColumnKey | null =
    selectedColumns.length > 0 ? selectedColumns[0] : metricColumns[0] ?? null;

  const [ratioBuilderOpen, setRatioBuilderOpen] = useState(false);
  const [editingDerivedMetric, setEditingDerivedMetric] = useState<DerivedMetric | null>(null);
  const [internal, setInternal] = useState<SqlAggregationsJson>(() =>
    normalizeModel(value ?? { enabled: false, metrics: [], groupBy: [], derivedMetrics: [] }, defaultField)
  );
  const model = normalizeModel(value ?? internal, defaultField);

  const commit = (next: SqlAggregationsJson) => {
    const normalized = normalizeModel(next, defaultField);
    if (!value) setInternal(normalized);
    const isEmpty =
      normalized.metrics.length === 0 &&
      normalized.groupBy.length === 0 &&
      (normalized.derivedMetrics?.length ?? 0) === 0;
    onChange?.(isEmpty ? null : normalized);
  };

  useEffect(() => {
    if (value) setInternal(normalizeModel(value, defaultField));
  }, [defaultField, value]);

  const labelForSort = (column: SqlColumnKey) => labelFor(column) || column.columnName || "";

  const metricAvailableCols = useMemo(
    () => metricColumns.slice().sort((a, b) => labelForSort(a).localeCompare(labelForSort(b))),
    [metricColumns]
  );

  const groupByAvailableCols = useMemo(
    () => groupByColumns.slice().sort((a, b) => labelForSort(a).localeCompare(labelForSort(b))),
    [groupByColumns]
  );

  const derivedByName = useMemo(() => {
    const map = new Map<string, DerivedMetric>();
    (model.derivedMetrics ?? []).forEach((metric) => {
      map.set(metric.name, metric);
    });
    return map;
  }, [model.derivedMetrics]);

  const dataTypeByModelColumnId = useMemo(() => {
    const map = new Map<number, string | null>();
    (columnsMeta ?? []).forEach((meta) => {
      if (typeof meta.modelColumnId === "number") map.set(meta.modelColumnId, meta.dataType ?? null);
    });
    return map;
  }, [columnsMeta]);

  const findDataType = (column: SqlColumnKey | null): string | null => {
    if (!column) return null;
    if (typeof column.modelColumnId === "number") {
      return dataTypeByModelColumnId.get(column.modelColumnId) ?? null;
    }
    const found = metricColumns.find((entry) => sameCol(entry, column));
    const raw = (found as { dataType?: unknown } | undefined)?.dataType;
    return typeof raw === "string" ? raw : null;
  };

  useEffect(() => {
    if (!hasCols) {
      if (model.metrics.length || model.groupBy.length || (model.derivedMetrics?.length ?? 0) > 0) {
        commit({ ...model, metrics: [], groupBy: [], derivedMetrics: [] });
      }
      return;
    }

    const nextMetrics = model.metrics.map((metric) => {
      if (metric.metricRef.type === "derived") return metric;
      return {
        ...metric,
        metricRef: {
          ...metric.metricRef,
          columnKey: resolveColumn(metricColumns, metric.metricRef.columnKey),
        },
      };
    });

    const nextGroupBy = model.groupBy
      .map((groupBy) => resolveColumn(groupByColumns, groupBy))
      .filter((entry): entry is SqlColumnKey => Boolean(entry));
    const seen = new Set<string>();
    const dedupGroupBy: SqlColumnKey[] = [];
    nextGroupBy.forEach((entry) => {
      const key = colKey(entry);
      if (seen.has(key)) return;
      seen.add(key);
      dedupGroupBy.push(entry);
    });

    const nextDerived = (model.derivedMetrics ?? []).map((metric) => ({
      ...metric,
      numerator: {
        ...metric.numerator,
        columnKey: resolveColumn(metricColumns, metric.numerator.columnKey),
      },
      denominator: {
        ...metric.denominator,
        columnKey: resolveColumn(metricColumns, metric.denominator.columnKey),
      },
    }));

    const before = JSON.stringify(model);
    const after = JSON.stringify({ ...model, metrics: nextMetrics, groupBy: dedupGroupBy, derivedMetrics: nextDerived });
    if (before !== after) {
      commit({ ...model, metrics: nextMetrics, groupBy: dedupGroupBy, derivedMetrics: nextDerived });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasCols ? metricColumns.map(colKey).slice().sort().join("|") : "none",
    groupByColumns.map(colKey).slice().sort().join("|"),
  ]);

  const addMetric = () => commit({ ...model, metrics: [...model.metrics, defaultColumnMetric(defaultField)] });

  const addDerivedMetricMetricRef = (name?: string) => {
    const target = name ?? model.derivedMetrics?.[0]?.name;
    if (!target) return;
    commit({
      ...model,
      metrics: [
        ...model.metrics,
        {
          id: newId(),
          metricRef: { type: "derived", name: target, label: derivedByName.get(target)?.label ?? target },
        },
      ],
    });
  };

  const clearAll = () => commit({ ...model, metrics: [], groupBy: [] });

  const removeMetric = (id: string) => commit({ ...model, metrics: model.metrics.filter((metric) => metric.id !== id) });

  const updateMetric = (id: string, updater: (metric: SqlAggMetric) => SqlAggMetric) =>
    commit({
      ...model,
      metrics: model.metrics.map((metric) => (metric.id === id ? updater(metric) : metric)),
    });

  const switchMetricType = (id: string, type: "column" | "derived") => {
    updateMetric(id, (metric) => {
      if (type === "column") {
        return {
          ...metric,
          metricRef: {
            type: "column",
            agg: "count_distinct",
            columnKey: defaultField,
            label: metric.metricRef.label ?? null,
          },
        };
      }
      const firstDerived = model.derivedMetrics?.[0];
      return {
        ...metric,
        metricRef: {
          type: "derived",
          name: firstDerived?.name ?? "",
          label: metric.metricRef.label ?? firstDerived?.label ?? null,
        },
      };
    });
  };

  const updateDerivedMetric = (metric: DerivedMetric, previousName?: string) => {
    const prevName = previousName ?? editingDerivedMetric?.name;
    const exists = (model.derivedMetrics ?? []).some((entry) => entry.name === prevName);
    const nextDerived = exists
      ? (model.derivedMetrics ?? []).map((entry) => (entry.name === prevName ? metric : entry))
      : [...(model.derivedMetrics ?? []), metric];

    const nextMetrics = model.metrics.map((entry) => {
      if (entry.metricRef.type !== "derived") return entry;
      if (!prevName || entry.metricRef.name !== prevName) return entry;
      return {
        ...entry,
        metricRef: {
          type: "derived" as const,
          name: metric.name,
          label: entry.metricRef.label ?? metric.label ?? metric.name,
        },
      };
    });

    commit({ ...model, metrics: nextMetrics, derivedMetrics: nextDerived });
    setEditingDerivedMetric(null);
    setRatioBuilderOpen(false);
  };

  const deleteDerivedMetric = (name: string) => {
    const nextDerived = (model.derivedMetrics ?? []).filter((metric) => metric.name !== name);
    const nextMetrics = model.metrics.filter(
      (metric) => metric.metricRef.type !== "derived" || metric.metricRef.name !== name
    );
    commit({ ...model, metrics: nextMetrics, derivedMetrics: nextDerived });
  };

  const toggleGroupBy = (column: SqlColumnKey) => {
    const exists = model.groupBy.some((entry) => sameCol(entry, column));
    commit({
      ...model,
      groupBy: exists ? model.groupBy.filter((entry) => !sameCol(entry, column)) : [...model.groupBy, column],
    });
  };

  const derivedNameCounts = useMemo(() => {
    const map = new Map<string, number>();
    (model.derivedMetrics ?? []).forEach((metric) => {
      const key = metric.name.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [model.derivedMetrics]);

  const metricErrors = useMemo(() => {
    const errors = new Map<string, string>();

    model.metrics.forEach((metric) => {
      if (metric.metricRef.type === "derived") {
        if (!metric.metricRef.name.trim()) {
          errors.set(metric.id, "Choose a derived metric.");
          return;
        }
        if (!derivedByName.has(metric.metricRef.name)) {
          errors.set(metric.id, "Selected derived metric no longer exists.");
        }
        return;
      }

      const columnKey = metric.metricRef.columnKey;
      if (!columnKey) {
        errors.set(metric.id, "Choose a metric column.");
        return;
      }

      if (metric.metricRef.agg === "sum" || metric.metricRef.agg === "avg") {
        const dataType = findDataType(columnKey);
        const idLike = /(^id$|_id$|^id_)/i.test(columnKey.columnName ?? "");
        if (dataType && !looksNumeric(dataType)) {
          errors.set(metric.id, "Invalid aggregate: SUM/AVG require numeric columns.");
        } else if (!dataType && idLike) {
          errors.set(metric.id, "Invalid aggregate: SUM/AVG cannot be used on id columns.");
        }
      }
    });

    return errors;
  }, [derivedByName, model.metrics]);

  const derivedMetricErrors = useMemo(() => {
    const errors = new Map<string, string>();
    (model.derivedMetrics ?? []).forEach((metric) => {
      const key = metric.name.trim().toLowerCase();
      if (!metric.name.trim()) {
        errors.set(metric.name, "Name is required.");
        return;
      }
      if ((derivedNameCounts.get(key) ?? 0) > 1) {
        errors.set(metric.name, "Derived metric name must be unique.");
        return;
      }
      if (!metric.numerator.columnKey || !metric.denominator.columnKey) {
        errors.set(metric.name, "Numerator and denominator columns are required.");
      }
    });
    return errors;
  }, [derivedNameCounts, model.derivedMetrics]);

  const metricsSummary = useMemo(() => {
    if (model.metrics.length === 0) return [];
    return model.metrics.map((metric) => {
      const metricLabel = metricDisplayLabel(metric, derivedByName);
      return `${metricLabel} = ${metricExpr(metric, derivedByName)}`;
    });
  }, [derivedByName, model.metrics]);

  const groupBySummary = useMemo(() => {
    if (model.groupBy.length === 0) return "none";
    return model.groupBy.map((column) => labelFor(column)).join(", ");
  }, [model.groupBy]);

  const dragIdRef = useRef<string | null>(null);
  const onDragStart = (id: string) => (dragIdRef.current = id);
  const onDropOn = (targetId: string) => {
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    if (!fromId || fromId === targetId) return;
    commit({
      ...model,
      metrics: reorder(model.metrics, fromId, targetId, (item) => item.id),
    });
  };

  const addStudentsPerTeacherPreset = () => {
    const findByWorkspaceAndName = (workspaceTableId: number, columnName: string): SqlColumnKey | null =>
      metricColumns.find(
        (column) => column.workspaceTableId === workspaceTableId && column.columnName === columnName
      ) ?? {
        modelColumnId: null,
        workspaceTableId,
        columnName,
        exprId: null,
        alias: null,
      };

    const preset: DerivedMetric = {
      kind: "ratio",
      name: "students_per_teacher",
      label: "Students per Teacher",
      numerator: {
        columnKey: findByWorkspaceAndName(61, "k_student"),
        agg: "count_distinct",
        filters: [],
      },
      denominator: {
        columnKey: findByWorkspaceAndName(30, "k_staff_school_association"),
        agg: "count_distinct",
        filters: [],
      },
      safeDivide: true,
      multiplyBy: null,
    };
    updateDerivedMetric(preset, "students_per_teacher");
  };

  const body = (
    <div>
      {!hasCols ? (
        <EmptySectionState
          iconClass="fa-chart-simple"
          title="No columns selected yet"
          subtitle="Select some columns to enable aggregations."
        />
      ) : (
        <>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="text-muted small">Drag metrics to reorder. Top to bottom is evaluation order.</div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={clearAll}
                disabled={model.metrics.length === 0 && model.groupBy.length === 0}
              >
                <i className="fa fa-eraser me-1" aria-hidden="true" />
                Clear
              </button>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={addMetric}>
                <i className="fa fa-plus me-1" aria-hidden="true" />
                Add metric
              </button>
            </div>
          </div>

          <div className="border rounded p-3 mb-3 bg-light-subtle">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold">Derived metrics</div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={addStudentsPerTeacherPreset}
                  title="Add Students per Teacher preset"
                >
                  Students per Teacher
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setEditingDerivedMetric(null);
                    setRatioBuilderOpen(true);
                  }}
                >
                  Add Ratio Metric
                </button>
              </div>
            </div>
            {(model.derivedMetrics ?? []).length === 0 ? (
              <div className="small text-muted">No derived metrics yet.</div>
            ) : (
              <div className="vstack gap-2">
                {(model.derivedMetrics ?? []).map((derived) => (
                  <div key={derived.name} className="border rounded bg-white p-2">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <div className="fw-semibold">
                          {derived.label?.trim() || derived.name}
                          <span className="text-muted ms-2 small">({derived.name})</span>
                        </div>
                        <div className="small text-muted">
                          {derived.numerator.agg.toUpperCase()}(
                          {derived.numerator.columnKey ? labelFor(derived.numerator.columnKey) : "?"}) /{" "}
                          {derived.denominator.agg.toUpperCase()}(
                          {derived.denominator.columnKey ? labelFor(derived.denominator.columnKey) : "?"})
                          {derived.multiplyBy == null ? "" : ` * ${derived.multiplyBy}`}
                        </div>
                        {derivedMetricErrors.get(derived.name) ? (
                          <div className="text-danger small mt-1">{derivedMetricErrors.get(derived.name)}</div>
                        ) : null}
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addDerivedMetricMetricRef(derived.name)}
                        >
                          Use metric
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            setEditingDerivedMetric(derived);
                            setRatioBuilderOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteDerivedMetric(derived.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {model.metrics.length === 0 ? (
            <EmptySectionState
              iconClass="fa-chart-simple"
              title="No metrics yet"
              subtitle="Add a metric and choose Column or Derived metric type."
            />
          ) : (
            <div className="list-group mb-3">
              {model.metrics.map((metric, idx) => {
                const error = metricErrors.get(metric.id);
                return (
                  <div
                    key={metric.id}
                    className="list-group-item"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => onDropOn(metric.id)}
                  >
                    <div className="d-flex gap-2 align-items-start">
                      <button
                        type="button"
                        className="btn btn-sm btn-light"
                        draggable
                        title="Drag to reorder"
                        onDragStart={(event) => {
                          onDragStart(metric.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        <i className="fa fa-grip-vertical" aria-hidden="true" />
                      </button>
                      <span className="badge bg-light text-dark mt-1">{idx + 1}</span>
                      <div className="flex-grow-1">
                        <div className="row g-2">
                          <div className="col-md-3">
                            <label className="form-label small text-muted mb-1">Metric Type</label>
                            <select
                              className="form-select form-select-sm"
                              value={metric.metricRef.type}
                              onChange={(event) =>
                                switchMetricType(metric.id, event.target.value === "derived" ? "derived" : "column")
                              }
                            >
                              <option value="column">Column metric</option>
                              <option value="derived">Derived metric</option>
                            </select>
                          </div>

                          {metric.metricRef.type === "column" ? (
                            <>
                              <div className="col-md-3">
                                <label className="form-label small text-muted mb-1">Aggregate</label>
                                <select
                                  className="form-select form-select-sm"
                                  value={metric.metricRef.agg}
                                  onChange={(event) =>
                                    updateMetric(metric.id, (entry) =>
                                      entry.metricRef.type !== "column"
                                        ? entry
                                        : {
                                            ...entry,
                                            metricRef: {
                                              ...entry.metricRef,
                                              agg: event.target.value as AggFn,
                                            },
                                          }
                                    )
                                  }
                                >
                                  {AGG_OPTIONS.map((agg) => (
                                    <option key={agg} value={agg}>
                                      {FN_LABEL[agg]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small text-muted mb-1">Column</label>
                                <SqlColumnPicker
                                  columns={metricAvailableCols}
                                  selectedColumns={selectedColumns}
                                  showSelectedBadge
                                  value={metric.metricRef.columnKey}
                                  onChange={(columnKey) =>
                                    updateMetric(metric.id, (entry) =>
                                      entry.metricRef.type !== "column"
                                        ? entry
                                        : {
                                            ...entry,
                                            metricRef: { ...entry.metricRef, columnKey },
                                          }
                                    )
                                  }
                                  placeholder="Choose column…"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="col-md-7">
                              <label className="form-label small text-muted mb-1">Derived metric</label>
                              <select
                                className="form-select form-select-sm"
                                value={metric.metricRef.name}
                                onChange={(event) =>
                                  updateMetric(metric.id, (entry) =>
                                    entry.metricRef.type !== "derived"
                                      ? entry
                                      : {
                                          ...entry,
                                          metricRef: {
                                            ...entry.metricRef,
                                            name: event.target.value,
                                          },
                                        }
                                  )
                                }
                              >
                                <option value="">Choose derived metric…</option>
                                {(model.derivedMetrics ?? []).map((derived) => (
                                  <option key={derived.name} value={derived.name}>
                                    {derived.label?.trim() || derived.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="col-md-2">
                            <label className="form-label small text-muted mb-1">Label</label>
                            <input
                              className="form-control form-control-sm"
                              value={metric.metricRef.label ?? ""}
                              onChange={(event) =>
                                updateMetric(metric.id, (entry) => ({
                                  ...entry,
                                  metricRef: { ...entry.metricRef, label: event.target.value },
                                }))
                              }
                              placeholder="Label"
                            />
                          </div>
                        </div>
                        <div className="small text-muted mt-2">
                          <code>{metricDisplayLabel(metric, derivedByName)}</code> ={" "}
                          <code>{metricExpr(metric, derivedByName)}</code>
                        </div>
                        {error ? <div className="text-danger small mt-1">{error}</div> : null}
                      </div>

                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeMetric(metric.id)}>
                        <i className="fa fa-xmark" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-2 fw-semibold">Group by columns</div>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {groupByAvailableCols.map((column) => {
              const selected = model.groupBy.some((entry) => sameCol(entry, column));
              return (
                <button
                  key={colKey(column)}
                  type="button"
                  className={`btn btn-sm ${selected ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => toggleGroupBy(column)}
                >
                  {labelFor(column)}
                </button>
              );
            })}
          </div>

          <div className="border rounded p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold">Summary</div>
              <div className="small text-muted">
                {model.metrics.length} metric{model.metrics.length === 1 ? "" : "s"} • {model.groupBy.length} group by
              </div>
            </div>
            <div className="mb-2">
              <div className="text-muted small fw-semibold mb-1">Metrics</div>
              {metricsSummary.length === 0 ? (
                <div className="small text-muted">None</div>
              ) : (
                <div className="vstack gap-1">
                  {metricsSummary.map((line, index) => (
                    <div key={index} className="small">
                      <code>{line}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-muted small fw-semibold mb-1">Group by</div>
              <div className="small">{groupBySummary === "none" ? <span className="text-muted">none</span> : <code>{groupBySummary}</code>}</div>
            </div>
          </div>
        </>
      )}

      {onNext || onSubmit ? (
        <div className="d-flex flex-column align-items-start mt-3 pt-3 border-top">
          <div className="d-flex align-items-center gap-2">
            {onNext ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={onNext}>
                Next
              </button>
            ) : null}
            {onSubmit ? (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onSubmit}>
                Save
              </button>
            ) : null}
          </div>
          <div className="text-muted small mt-1">Choose sorting next.</div>
        </div>
      ) : null}

      <RatioMetricBuilder
        open={ratioBuilderOpen}
        initialMetric={editingDerivedMetric}
        metricColumns={metricAvailableCols}
        selectedColumns={selectedColumns}
        columnsMeta={columnsMeta}
        existingNames={(model.derivedMetrics ?? []).map((metric) => metric.name)}
        onClose={() => {
          setRatioBuilderOpen(false);
          setEditingDerivedMetric(null);
        }}
        onSave={(metric) => updateDerivedMetric(metric)}
      />
    </div>
  );

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
          onMouseEnter={(event) => (event.currentTarget.style.opacity = "1")}
          onMouseLeave={(event) => (event.currentTarget.style.opacity = "0.65")}
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
          onMouseEnter={(event) => (event.currentTarget.style.opacity = "1")}
          onMouseLeave={(event) => (event.currentTarget.style.opacity = "0.65")}
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
      subtitle="Define column metrics and ratio derived metrics."
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      collapsible={collapsible}
      iconClass="fa-chart-simple"
      count={model.metrics.length > 0 ? model.metrics.length : model.groupBy.length > 0 ? 1 : undefined}
      right={right}
      helpAction={helpAction}
    >
      {body}
    </SectionShell>
  );
};

export default AggregationsSection;
