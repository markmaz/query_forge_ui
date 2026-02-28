import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import type {
  AggFn,
  AggSpec,
  DerivedMetric,
  SqlColumnKey,
  SqlFilterNode,
  SqlFilterOp,
} from "../../model/sqlJson";
import { colKey, labelFor } from "../../model/sqlJson";
import {
  CANONICAL_FILTER_OPERATORS,
  normalizeFilterOperator,
  normalizeFilterValueForOperator,
} from "../../model/filterOperators";
import { SqlColumnPicker } from "./ColumnSelector";

type ColumnMeta = {
  modelColumnId: number;
  columnName: string;
  dataType?: string | null;
};

type FilterRow = {
  id: string;
  field: SqlColumnKey | null;
  op: SqlFilterOp;
  value: string;
};

type RatioMetricBuilderProps = {
  open: boolean;
  metricColumns: SqlColumnKey[];
  selectedColumns: SqlColumnKey[];
  columnsMeta?: ColumnMeta[];
  existingNames: string[];
  initialMetric?: DerivedMetric | null;
  onClose: () => void;
  onSave: (metric: DerivedMetric) => void;
};

const AGG_OPTIONS: AggFn[] = ["count", "count_distinct", "sum", "avg", "min", "max"];
const FILTER_OPS: SqlFilterOp[] = CANONICAL_FILTER_OPERATORS;

const newId = () => Math.random().toString(36).slice(2, 10);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

function isIdLikeColumn(column: SqlColumnKey | null): boolean {
  if (!column) return false;
  const name = (column.columnName ?? "").toLowerCase();
  return name === "id" || name.endsWith("_id") || name.startsWith("id_");
}

function parseFilterValue(op: SqlFilterOp, raw: string): unknown {
  return normalizeFilterValueForOperator(op, raw);
}

function toFilterNodes(rows: FilterRow[]): SqlFilterNode[] {
  return rows
    .filter((row) => row.field)
    .map((row) => ({
      type: "condition" as const,
      id: `ratio-cond-${row.id}`,
      field: row.field as SqlColumnKey,
      op: row.op,
      value: parseFilterValue(row.op, row.value),
    }));
}

function fromFilterNodes(nodes: SqlFilterNode[] | undefined): FilterRow[] {
  if (!nodes?.length) return [];
  const rows: FilterRow[] = [];
  nodes.forEach((node) => {
    if (node.type !== "condition") return;
    rows.push({
      id: newId(),
      field: node.field,
      op: normalizeFilterOperator(node.op),
      value:
        Array.isArray(node.value) ? node.value.join(", ") : node.value == null ? "" : String(node.value),
    });
  });
  return rows;
}

type SpecEditorProps = {
  title: string;
  spec: AggSpec;
  filters: FilterRow[];
  metricColumns: SqlColumnKey[];
  selectedColumns: SqlColumnKey[];
  onSpecChange: (next: AggSpec) => void;
  onFiltersChange: (next: FilterRow[]) => void;
};

const AggSpecEditor: React.FC<SpecEditorProps> = ({
  title,
  spec,
  filters,
  metricColumns,
  selectedColumns,
  onSpecChange,
  onFiltersChange,
}) => {
  const addFilter = () =>
    onFiltersChange([
      ...filters,
      {
        id: newId(),
        field: metricColumns[0] ?? null,
        op: "equals",
        value: "",
      },
    ]);

  const updateFilter = (id: string, patch: Partial<FilterRow>) =>
    onFiltersChange(filters.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const removeFilter = (id: string) => onFiltersChange(filters.filter((row) => row.id !== id));

  return (
    <div className="border rounded p-3 bg-light-subtle">
      <div className="fw-semibold mb-2">{title}</div>
      <div className="row g-2 mb-2">
        <div className="col-md-7">
          <label className="form-label small text-muted mb-1">Column</label>
          <SqlColumnPicker
            columns={metricColumns}
            selectedColumns={selectedColumns}
            value={spec.columnKey}
            onChange={(columnKey) => onSpecChange({ ...spec, columnKey })}
            placeholder="Choose column…"
          />
        </div>
        <div className="col-md-5">
          <label className="form-label small text-muted mb-1">Aggregate</label>
          <select
            className="form-select form-select-sm"
            value={spec.agg}
            onChange={(event) => onSpecChange({ ...spec, agg: event.target.value as AggFn })}
          >
            {AGG_OPTIONS.map((agg) => (
              <option key={agg} value={agg}>
                {agg.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div className="d-flex align-items-center justify-content-between">
          <span className="small text-muted">Optional filters</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addFilter}>
            + Filter
          </button>
        </div>
        {filters.length === 0 ? (
          <div className="small text-muted mt-2">No filters</div>
        ) : (
          <div className="vstack gap-2 mt-2">
            {filters.map((row) => (
              <div key={row.id} className="border rounded p-2 bg-white">
                <div className="row g-2">
                  <div className="col-md-5">
                    <SqlColumnPicker
                      columns={metricColumns}
                      selectedColumns={selectedColumns}
                      value={row.field}
                      onChange={(field) => updateFilter(row.id, { field })}
                      placeholder="Column"
                    />
                  </div>
                  <div className="col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={row.op}
                      onChange={(event) => updateFilter(row.id, { op: event.target.value as SqlFilterOp })}
                    >
                      {FILTER_OPS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4 d-flex gap-2">
                    <input
                      className="form-control form-control-sm"
                      value={row.value}
                      onChange={(event) => updateFilter(row.id, { value: event.target.value })}
                      placeholder={row.op === "in" || row.op === "between" ? "comma separated" : "value"}
                    />
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeFilter(row.id)}>
                      <i className="fa fa-xmark" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const RatioMetricBuilder: React.FC<RatioMetricBuilderProps> = ({
  open,
  metricColumns,
  selectedColumns,
  columnsMeta,
  existingNames,
  initialMetric,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState("students_per_teacher");
  const [label, setLabel] = useState("Students per Teacher");
  const [safeDivide, setSafeDivide] = useState(true);
  const [multiplyByText, setMultiplyByText] = useState("");
  const [numerator, setNumerator] = useState<AggSpec>({ columnKey: null, agg: "count_distinct", filters: [] });
  const [denominator, setDenominator] = useState<AggSpec>({ columnKey: null, agg: "count_distinct", filters: [] });
  const [numeratorFilters, setNumeratorFilters] = useState<FilterRow[]>([]);
  const [denominatorFilters, setDenominatorFilters] = useState<FilterRow[]>([]);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const metric = initialMetric ?? null;
    if (metric?.kind === "ratio") {
      setName(metric.name);
      setLabel(metric.label?.trim() || metric.name);
      setSafeDivide(metric.safeDivide !== false);
      setMultiplyByText(metric.multiplyBy == null ? "" : String(metric.multiplyBy));
      setNumerator({
        columnKey: metric.numerator.columnKey ?? null,
        agg: metric.numerator.agg ?? "count_distinct",
        filters: metric.numerator.filters ?? [],
      });
      setDenominator({
        columnKey: metric.denominator.columnKey ?? null,
        agg: metric.denominator.agg ?? "count_distinct",
        filters: metric.denominator.filters ?? [],
      });
      setNumeratorFilters(fromFilterNodes(metric.numerator.filters));
      setDenominatorFilters(fromFilterNodes(metric.denominator.filters));
      setNameTouched(true);
      return;
    }

    setName("students_per_teacher");
    setLabel("Students per Teacher");
    setSafeDivide(true);
    setMultiplyByText("");
    setNumerator({ columnKey: null, agg: "count_distinct", filters: [] });
    setDenominator({ columnKey: null, agg: "count_distinct", filters: [] });
    setNumeratorFilters([]);
    setDenominatorFilters([]);
    setNameTouched(false);
  }, [initialMetric, open]);

  const dataTypeByModelColumnId = useMemo(() => {
    const map = new Map<number, string | null>();
    (columnsMeta ?? []).forEach((meta) => {
      if (typeof meta.modelColumnId === "number") {
        map.set(meta.modelColumnId, meta.dataType ?? null);
      }
    });
    return map;
  }, [columnsMeta]);

  const findDataType = (column: SqlColumnKey | null): string | null => {
    if (!column) return null;
    if (typeof column.modelColumnId === "number") {
      return dataTypeByModelColumnId.get(column.modelColumnId) ?? null;
    }
    const found = metricColumns.find((c) => colKey(c) === colKey(column));
    const raw = (found as { dataType?: unknown } | undefined)?.dataType;
    return typeof raw === "string" ? raw : null;
  };

  const validateAggregate = (spec: AggSpec): string | null => {
    if (spec.agg !== "sum" && spec.agg !== "avg") return null;
    if (!spec.columnKey) return null;
    const dataType = findDataType(spec.columnKey);
    const idLike = isIdLikeColumn(spec.columnKey);
    if (dataType && !looksNumeric(dataType)) {
      return "Invalid aggregate: SUM/AVG require numeric columns.";
    }
    if (!dataType && idLike) {
      return "Invalid aggregate: SUM/AVG cannot be used on id columns.";
    }
    return null;
  };

  const uniqueNameError = useMemo(() => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return "Name is required.";
    const initialName = initialMetric?.kind === "ratio" ? initialMetric.name.trim().toLowerCase() : "";
    if (normalized === initialName) return null;
    return existingNames.map((entry) => entry.trim().toLowerCase()).includes(normalized)
      ? "Derived metric name must be unique."
      : null;
  }, [existingNames, initialMetric, name]);

  const numeratorAggError = validateAggregate(numerator);
  const denominatorAggError = validateAggregate(denominator);

  const errors = {
    name: uniqueNameError,
    numerator: numerator.columnKey ? null : "Choose a numerator column.",
    denominator: denominator.columnKey ? null : "Choose a denominator column.",
    numeratorAgg: numeratorAggError,
    denominatorAgg: denominatorAggError,
  };

  const hasErrors = Boolean(
    errors.name || errors.numerator || errors.denominator || errors.numeratorAgg || errors.denominatorAgg
  );

  const save = () => {
    if (hasErrors) return;
    const multiplyBy = multiplyByText.trim() ? Number(multiplyByText) : null;
    const ratio: DerivedMetric = {
      kind: "ratio",
      name: name.trim(),
      label: label.trim() || name.trim(),
      numerator: { ...numerator, filters: toFilterNodes(numeratorFilters) },
      denominator: { ...denominator, filters: toFilterNodes(denominatorFilters) },
      safeDivide,
      multiplyBy: Number.isFinite(multiplyBy) ? multiplyBy : null,
    };
    onSave(ratio);
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ zIndex: 2000, background: "rgba(0, 0, 0, 0.45)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Ratio metric builder"
    >
      <div className="bg-white rounded shadow-lg p-3 w-100" style={{ maxWidth: 940, maxHeight: "88vh", overflow: "auto" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h5 className="mb-1">{initialMetric ? "Edit Ratio Metric" : "New Ratio Metric"}</h5>
            <div className="small text-muted">Define numerator / denominator and save as a derived metric.</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label">Name</label>
            <input
              className={`form-control ${errors.name ? "is-invalid" : ""}`}
              value={name}
              onChange={(event) => {
                setNameTouched(true);
                setName(slugify(event.target.value));
              }}
              placeholder="students_per_teacher"
            />
            {errors.name ? <div className="invalid-feedback d-block">{errors.name}</div> : null}
          </div>
          <div className="col-md-4">
            <label className="form-label">Label</label>
            <input
              className="form-control"
              value={label}
              onChange={(event) => {
                const nextLabel = event.target.value;
                setLabel(nextLabel);
                if (!nameTouched) setName(slugify(nextLabel));
              }}
              placeholder="Students per Teacher"
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Multiply by (optional)</label>
            <input
              className="form-control"
              type="number"
              value={multiplyByText}
              onChange={(event) => setMultiplyByText(event.target.value)}
              placeholder="e.g. 100"
            />
          </div>
        </div>

        <div className="d-flex gap-3 mb-3">
          <div className="form-check">
            <input
              id="ratio-safe-divide"
              type="checkbox"
              className="form-check-input"
              checked={safeDivide}
              onChange={(event) => setSafeDivide(event.target.checked)}
            />
            <label htmlFor="ratio-safe-divide" className="form-check-label">
              Safe divide
            </label>
          </div>
        </div>

        <div className="vstack gap-3 mb-3">
          <AggSpecEditor
            title="Numerator"
            spec={numerator}
            filters={numeratorFilters}
            metricColumns={metricColumns}
            selectedColumns={selectedColumns}
            onSpecChange={setNumerator}
            onFiltersChange={setNumeratorFilters}
          />
          {errors.numerator ? <div className="text-danger small">{errors.numerator}</div> : null}
          {errors.numeratorAgg ? <div className="text-danger small">{errors.numeratorAgg}</div> : null}

          <AggSpecEditor
            title="Denominator"
            spec={denominator}
            filters={denominatorFilters}
            metricColumns={metricColumns}
            selectedColumns={selectedColumns}
            onSpecChange={setDenominator}
            onFiltersChange={setDenominatorFilters}
          />
          {errors.denominator ? <div className="text-danger small">{errors.denominator}</div> : null}
          {errors.denominatorAgg ? <div className="text-danger small">{errors.denominatorAgg}</div> : null}
        </div>

        <div className="small text-muted mb-3">
          Preview:{" "}
          <code>
            {label.trim() || name.trim()} = {numerator.agg.toUpperCase()}(
            {numerator.columnKey ? labelFor(numerator.columnKey) : "?"}) / {denominator.agg.toUpperCase()}(
            {denominator.columnKey ? labelFor(denominator.columnKey) : "?"})
          </code>
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={hasErrors} onClick={save}>
            Save Ratio Metric
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RatioMetricBuilder;
