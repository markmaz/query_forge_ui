// src/features/nocode-query/ui/components/FiltersSection.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { EmptySectionState } from "../../../../shared/ui/EmptySectionState";
import { SectionShell } from "./SectionShell";
import type {
  SqlFilterNode,
  SqlFilterLogic,
  SqlFilterOp,
  SqlColumnKey,
  SqlColumnRef,
  SqlQueryJson,
} from "../../model/sqlJson";
import { colKey, labelFor, sameCol } from "../../model/sqlJson";
import {
  getFilterOperatorInputKind,
  getFilterValueError,
  normalizeFilterOperator,
  normalizeFilterValueForOperator,
} from "../../model/filterOperators";
import { SqlColumnPicker } from "./ColumnSelector";

type LogicOp = "and" | "or";
type ConditionOp = SqlFilterOp;

type ConditionNode = {
  type: "condition";
  id: string;
  field: SqlColumnKey;
  op: ConditionOp;
  value: any;
};

type GroupNode = {
  type: "group";
  id: string;
  match: LogicOp;
  children: Array<GroupNode | ConditionNode>;
};

type Node = GroupNode | ConditionNode;

type RootModel = {
  match: LogicOp;
  groups: GroupNode[];
};

type FiltersBodyProps = {
  // ✅ common SqlColumnKey list (source of truth)
  selectedColumns: SqlColumnKey[];
  allColumns?: SqlColumnKey[];

  /** ✅ sql json integration */
  value?: SqlFilterNode | null;
  onChange?: (next: SqlFilterNode | null) => void;
  sqlJson?: SqlQueryJson;
};

type Props = FiltersBodyProps & {
  // shell props
  collapsed: boolean;
  onToggleCollapsed: () => void;
  collapsible?: boolean;
  onHide?: () => void;

  /** optional (if you’re wiring fullscreen per-section later) */
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

const newId = () => Math.random().toString(36).slice(2, 10);
const FILTER_OPERATOR_OPTIONS: Array<{ value: SqlFilterOp; label: string }> = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "in", label: "in list" },
  { value: "not_in", label: "not in list" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "between", label: "between" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

function opLabel(op: ConditionOp) {
  switch (op) {
    case "equals":
      return "=";
    case "not_equals":
      return "!=";
    case "contains":
      return "CONTAINS";
    case "starts_with":
      return "STARTS WITH";
    case "in":
      return "IN";
    case "not_in":
      return "NOT IN";
    case "gt":
      return ">";
    case "gte":
      return ">=";
    case "lt":
      return "<";
    case "lte":
      return "<=";
    case "between":
      return "BETWEEN";
    case "is_null":
      return "IS NULL";
    case "is_not_null":
      return "IS NOT NULL";
  }
}

function joinerLabel(op: LogicOp) {
  return op === "and" ? "AND" : "OR";
}

function makeCondition(defaultField: SqlColumnKey): ConditionNode {
  return { type: "condition", id: newId(), field: defaultField, op: "equals", value: "" };
}

function computedColumnsFromDataPrep(sqlJson?: SqlQueryJson | null): SqlColumnRef[] {
  const rules = sqlJson?.dataPrep?.rules ?? [];
  const out: SqlColumnRef[] = [];
  for (const r of rules) {
    if (!r || r.enabled === false) continue;
    const output = r.output as SqlColumnRef | undefined;
    if (!output?.columnName) continue;
    const alias = (output.alias ?? output.columnName ?? "").trim() || output.columnName;
    const exprId = output.exprId ?? (r as any).id ?? null;
    out.push({
      ...output,
      modelColumnId: null,
      exprId,
      alias,
      dataType: r.op === "date_part" ? "int" : (output as any).dataType ?? (output as any).data_type ?? null,
      fullName: alias,
      modelTableName: "Computed",
    });
  }
  return out;
}

function isDateTypeValue(raw?: string | null) {
  if (!raw) return false;
  const v = raw.toLowerCase();
  return v.includes("date") || v.includes("timestamp") || v.includes("datetime");
}

function normalizeListValues(value: unknown): string[] {
  const normalized = normalizeFilterValueForOperator("in", value);
  return Array.isArray(normalized)
    ? normalized.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
}

function makeGroup(defaultField: SqlColumnKey): GroupNode {
  return { type: "group", id: newId(), match: "and", children: [makeCondition(defaultField)] };
}

/** --- SQL <-> UI mapping --- */
function sqlNodeToRootModel(v: SqlFilterNode | null | undefined, fallback: SqlColumnKey): RootModel {
  if (!v) return { match: "and", groups: [] };

  const asNode = (n: SqlFilterNode): GroupNode | ConditionNode => {
    if (n.type === "group") {
      return {
        type: "group",
        id: (n as any).id ?? newId(),
        match: (((n as any).match ?? "and") as LogicOp) ?? "and",
        children: (((n as any).children ?? []) as SqlFilterNode[]).map(asNode) as any,
      };
    }

    const field = (n as any).field as SqlColumnKey | null | undefined;
    const op = normalizeFilterOperator((n as any).op) as ConditionOp;
    const value = normalizeFilterValueForOperator(op, (n as any).value);

    return {
      type: "condition",
      id: (n as any).id ?? newId(),
      field: field ?? fallback,
      op,
      value,
    };
  };

  if (v.type === "group") {
    const children = (((v as any).children ?? []) as SqlFilterNode[]).map(asNode);
    const groups = children.filter((c): c is GroupNode => c.type === "group");

    // If someone persisted a root group that contains conditions directly, wrap it as a single top-level group.
    if (!groups.length) {
      return {
        match: (((v as any).match ?? "and") as LogicOp) ?? "and",
        groups: [asNode(v) as GroupNode],
      };
    }

    return {
      match: (((v as any).match ?? "and") as LogicOp) ?? "and",
      groups,
    };
  }

  // condition only => wrap into a single group
  return {
    match: "and",
    groups: [
      {
        type: "group",
        id: newId(),
        match: "and",
        children: [asNode(v) as ConditionNode],
      },
    ],
  };
}

function rootModelToSqlNode(m: RootModel): SqlFilterNode | null {
  if (!m.groups.length) return null;

  const toSql = (n: Node): SqlFilterNode => {
    if (n.type === "group") {
      return {
        type: "group",
        id: n.id,
        match: n.match as SqlFilterLogic,
        children: n.children.map(toSql),
      };
    }
    return {
      type: "condition",
      id: n.id,
      field: n.field,
      op: n.op as SqlFilterOp,
      value: normalizeFilterValueForOperator(n.op, n.value),
    };
  };

  return {
    type: "group",
    id: "root",
    match: m.match as SqlFilterLogic,
    children: m.groups.map(toSql),
  };
}

/** Recursively update ANY node by id (nested-safe) */
function updateNode(root: GroupNode, targetId: string, fn: (n: Node) => Node): [GroupNode, boolean] {
  const walk = (n: Node): [Node, boolean] => {
    if (n.id === targetId) return [fn(n), true];

    if (n.type === "group") {
      let anyChanged = false;
      const nextChildren = n.children.map((c) => {
        const [nextC, changed] = walk(c);
        if (changed) anyChanged = true;
        return nextC as any;
      });

      if (!anyChanged) return [n, false];
      return [{ ...n, children: nextChildren }, true];
    }
    return [n, false];
  };

  const [next, changed] = walk(root);
  return [next as GroupNode, changed];
}

function removeNode(root: GroupNode, targetId: string): [GroupNode, boolean] {
  const walk = (n: Node): [Node, boolean] => {
    if (n.type !== "group") return [n, false];

    let anyChanged = false;
    const nextChildren: Array<GroupNode | ConditionNode> = [];

    for (const c of n.children) {
      if (c.id === targetId) {
        anyChanged = true;
        continue;
      }
      const [nextC, changed] = walk(c);
      if (changed) anyChanged = true;
      nextChildren.push(nextC as any);
    }

    if (!anyChanged) return [n, false];
    return [{ ...n, children: nextChildren }, true];
  };

  const [next, changed] = walk(root);
  return [next as GroupNode, changed];
}

function ensureNotEmpty(g: GroupNode, defaultField: SqlColumnKey): GroupNode {
  const nextChildren = g.children.map((c) => (c.type === "group" ? ensureNotEmpty(c, defaultField) : c));
  return { ...g, children: nextChildren.length ? nextChildren : [makeCondition(defaultField)] };
}

function coerceFields(g: GroupNode, selectedColumns: SqlColumnKey[], fallback: SqlColumnKey): GroupNode {
  const walk = (n: Node): [Node, boolean] => {
    if (n.type === "condition") {
      const match =
        selectedColumns.find((c) => sameCol(c, n.field)) ??
        selectedColumns.find((c) => c.modelColumnId != null && c.modelColumnId === n.field.modelColumnId) ??
        selectedColumns.find((c) => c.columnName === n.field.columnName);
      const field = match ?? fallback;
      if (colKey(field) === colKey(n.field)) return [n, false];
      return [{ ...n, field }, true];
    }

    let did = false;
    const nextChildren: Array<GroupNode | ConditionNode> = [];
    for (const c of n.children) {
      const [nc, changed] = walk(c);
      if (changed) did = true;
      nextChildren.push(nc as any);
    }

    if (!did) return [n, false];
    return [{ ...n, children: nextChildren }, true];
  };

  const [next] = walk(g);
  return next as GroupNode;
}

function buildPreview(node: Node): string {
  if (node.type === "condition") {
    if (node.op === "is_null" || node.op === "is_not_null") {
      return `${labelFor(node.field)} ${opLabel(node.op)}`;
    }
    if (node.op === "in" || node.op === "not_in") {
      const values = normalizeListValues(node.value);
      const label = values.length ? values.join(", ") : "…";
      return `${labelFor(node.field)} ${opLabel(node.op)} (${label})`;
    }
    if (node.op === "between") {
      const [left, right] = normalizeFilterValueForOperator("between", node.value) as [string, string];
      const leftLabel = left ? `"${left}"` : "…";
      const rightLabel = right ? `"${right}"` : "…";
      return `${labelFor(node.field)} ${opLabel(node.op)} ${leftLabel} and ${rightLabel}`;
    }
    const value = normalizeFilterValueForOperator(node.op, node.value);
    const v = String(value ?? "").trim() ? `"${String(value ?? "").trim()}"` : "…";
    return `${labelFor(node.field)} ${opLabel(node.op)} ${v}`;
  }
  const joiner = ` ${joinerLabel(node.match)} `;
  const parts = node.children.map(buildPreview).filter(Boolean);
  return `(${parts.join(joiner) || "…"})`;
}

function MultiValueInput(props: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const { values, onChange } = props;
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const additions = draft
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!additions.length) {
      setDraft("");
      return;
    }
    const merged = Array.from(new Set([...values, ...additions]));
    onChange(merged);
    setDraft("");
  };

  return (
    <div>
      <input
        className="form-control form-control-sm"
        placeholder="Enter value and press Enter"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
      />
      <div className="d-flex flex-wrap gap-2 mt-2">
        {values.map((item) => (
          <span key={item} className="badge text-bg-light border">
            {item}
            <button
              type="button"
              className="btn btn-sm btn-link text-danger ms-2 p-0"
              onClick={() => onChange(values.filter((entry) => entry !== item))}
              aria-label={`Remove ${item}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export const FiltersSectionBody: React.FC<FiltersBodyProps> = ({
  selectedColumns,
  allColumns,
  value,
  onChange,
  sqlJson,
}) => {
  const domainColumns = useMemo(
    () => (allColumns && allColumns.length ? allColumns : selectedColumns),
    [allColumns, selectedColumns]
  );
  const computedCols = useMemo(() => computedColumnsFromDataPrep(sqlJson), [sqlJson]);
  const columnOptions = useMemo(() => {
    const all = [...computedCols, ...domainColumns];
    const seen = new Set<string>();
    const uniq: SqlColumnKey[] = [];
    for (const c of all) {
      const key = colKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(c);
    }
    return uniq;
  }, [computedCols, domainColumns]);
  const hasCols = columnOptions.length > 0;
  const defaultField: SqlColumnKey | null = hasCols ? columnOptions[0] : null;
  const defaultFieldKey = defaultField ? colKey(defaultField) : "";
  const [previewOpen, setPreviewOpen] = useState(true);

  // stable signature for "set of columns" (order-insensitive)
  const selectedSig = useMemo(() => {
    return columnOptions
      .map(colKey)
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .join("|");
  }, [columnOptions]);

  const selectedByKey = useMemo(() => {
    const m = new Map<string, SqlColumnKey>();
    for (const c of columnOptions) m.set(colKey(c), c);
    return m;
  }, [columnOptions]);

  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    columnOptions.forEach((c) => {
      const key = colKey(c);
      const label = (c as any).alias?.toString().trim() || labelFor(c);
      m.set(key, label);
    });
    return m;
  }, [columnOptions]);

  const groupLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    computedCols.forEach((c) => m.set(colKey(c), "Computed"));
    return m;
  }, [computedCols]);

  const dataTypeByKey = useMemo(() => {
    const m = new Map<string, string>();
    columnOptions.forEach((c) => {
      const raw = (c as any).dataType ?? (c as any).data_type ?? null;
      if (raw) m.set(colKey(c), String(raw));
    });
    return m;
  }, [columnOptions]);

  // ---- local UI model
  const [model, setModel] = useState<RootModel>(() => ({ match: "and", groups: [] }));

  // Track last applied incoming value so we don’t rehydrate repeatedly
  const lastValueSigRef = useRef<string>("");

  // Emit control: only emit after *user-triggered* updates
  const shouldEmitRef = useRef(false);
  const lastEmittedSigRef = useRef<string>("");

  const valueSig = useMemo(() => JSON.stringify(value ?? null), [value]);

  // ✅ Rehydrate when parent `value` changes (NO EMIT HERE)
  useEffect(() => {
    if (valueSig === lastValueSigRef.current) return;
    lastValueSigRef.current = valueSig;

    if (!defaultField) {
      setModel({ match: "and", groups: [] });
      return;
    }

    const next = sqlNodeToRootModel(value ?? null, defaultField);
    setModel(next);
  }, [valueSig, defaultFieldKey]); // stable deps

  // ✅ When selectedColumns change, coerce fields / ensure non-empty (NO EMIT HERE)
  useEffect(() => {
    if (!defaultField) return;

    setModel((prev) => {
      if (!prev.groups.length) return prev; // do not auto-create

      const nextGroups = prev.groups.map((g) =>
        ensureNotEmpty(coerceFields(g, columnOptions, defaultField), defaultField)
      );

      // cheap structural check
      const prevSig = JSON.stringify(prev.groups);
      const nextSig = JSON.stringify(nextGroups);
      if (prevSig === nextSig) return prev;

      return { ...prev, groups: nextGroups };
    });
  }, [selectedSig, defaultFieldKey]); // (order-insensitive)

  // ✅ Emit AFTER render, only for user-triggered updates, and dedupe
  useEffect(() => {
    if (!onChange) return;
    if (!shouldEmitRef.current) return;

    shouldEmitRef.current = false;

    const sql = rootModelToSqlNode(model);
    const sig = JSON.stringify(sql ?? null);

    if (sig === lastEmittedSigRef.current) return;
    lastEmittedSigRef.current = sig;

    // Keep "incoming value" signature aligned so we don't immediately rehydrate on parent echo
    lastValueSigRef.current = sig;

    onChange(sql);
  }, [model, onChange]);

  // ✅ Safe user update helper: state update only; effect emits
  const setModelAndEmit = (updater: (cur: RootModel) => RootModel) => {
    shouldEmitRef.current = true;
    setModel((cur) => updater(cur));
  };

  const preview = useMemo(() => {
    if (!hasCols) return "";
    const joiner = ` ${joinerLabel(model.match)} `;
    const parts = model.groups.map((g) => buildPreview(g));
    return parts.length <= 1 ? (parts[0] ?? "(…)") : `(${parts.join(joiner)})`;
  }, [model, hasCols]);

  const addTopLevelGroup = () => {
    if (!defaultField) return;
    setModelAndEmit((p) => ({ ...p, groups: [...p.groups, makeGroup(defaultField)] }));
  };

  const addFirstFilter = () => {
    if (!defaultField) return;
    setModelAndEmit((p) => ({ ...p, groups: [makeGroup(defaultField)] }));
  };

  const clearAllFilters = () => {
    // explicit clear: emit null and reset
    lastEmittedSigRef.current = JSON.stringify(null);
    lastValueSigRef.current = JSON.stringify(null);
    onChange?.(null);
    setModel({ match: "and", groups: [] });
  };

  const removeTopLevelGroup = (id: string) =>
    setModelAndEmit((p) => ({ ...p, groups: p.groups.filter((g) => g.id !== id) }));

  const updateAnyNode = (nodeId: string, fn: (n: Node) => Node) =>
    setModelAndEmit((p) => {
      let did = false;
      const nextGroups = p.groups.map((g) => {
        const [ng, changed] = updateNode(g, nodeId, fn);
        if (changed) did = true;
        return changed ? ng : g;
      });
      return did ? { ...p, groups: nextGroups } : p;
    });

  const removeAnyNode = (nodeId: string) =>
    setModelAndEmit((p) => {
      if (!defaultField) return p;

      let did = false;
      const nextGroups = p.groups.map((g) => {
        const [ng, removed] = removeNode(g, nodeId);
        if (removed) did = true;
        return removed ? ensureNotEmpty(ng, defaultField) : g;
      });
      return did ? { ...p, groups: nextGroups } : p;
    });

  const addConditionToGroup = (groupId: string) => {
    if (!defaultField) return;
    updateAnyNode(groupId, (n) =>
      n.type === "group" ? { ...n, children: [...n.children, makeCondition(defaultField)] } : n
    );
  };

  const addNestedGroupToGroup = (groupId: string) => {
    if (!defaultField) return;
    updateAnyNode(groupId, (n) =>
      n.type === "group" ? { ...n, children: [...n.children, makeGroup(defaultField)] } : n
    );
  };

  const renderGroup = (group: GroupNode, depth: number, topLevel?: boolean) => {
    return (
      <div className="w-100" key={group.id}>
        <div
          className="rounded p-3 w-100"
          style={{
            background: depth === 0 ? "rgba(0,0,0,0.01)" : "rgba(0,0,0,0.015)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div className="d-flex align-items-center gap-2 mb-2 w-100">
            <div className="fw-semibold" style={{ fontSize: 13 }}>
              {topLevel ? "Top-level Group" : "Group"}
            </div>

            <div className="d-flex align-items-center gap-2 ms-2">
              <small className="text-muted">Match</small>
              <select
                className="form-select form-select-sm"
                style={{ width: 110 }}
                value={group.match === "and" ? "ALL" : "ANY"}
                onChange={(e) =>
                  updateAnyNode(group.id, (n) =>
                    n.type === "group" ? { ...n, match: e.target.value === "ALL" ? "and" : "or" } : n
                  )
                }
              >
                <option value="ALL">ALL</option>
                <option value="ANY">ANY</option>
              </select>
              <small className="text-muted">of these</small>
            </div>

            <div className="ms-auto d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => addConditionToGroup(group.id)}
                disabled={!hasCols}
              >
                + Condition
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => addNestedGroupToGroup(group.id)}
                disabled={!hasCols}
              >
                + Group
              </button>

              {topLevel && model.groups.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-sm btn-link text-danger"
                  onClick={() => removeTopLevelGroup(group.id)}
                  title="Remove top-level group"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>

          <div className="d-flex flex-column gap-2 w-100">
            {group.children.map((child) => {
              if (child.type === "group") {
                return (
                  <div key={child.id} className="w-100" style={{ paddingLeft: 14 }}>
                    {renderGroup(child, depth + 1, false)}
                    <div className="mt-1 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger"
                        onClick={() => removeAnyNode(child.id)}
                        title="Remove group"
                      >
                        Remove group
                      </button>
                    </div>
                  </div>
                );
              }

              const currentKey = colKey(child.field);
              const dataType = dataTypeByKey.get(currentKey);
              const nameHint = (child.field?.columnName ?? "").toLowerCase();
              const isDateField =
                !child.field?.exprId &&
                (isDateTypeValue(dataType) || (!dataType && (nameHint.includes("date") || nameHint.includes("timestamp"))));
              const isYearValue = child.op === "equals" && /^\d{4}$/.test(String(child.value ?? ""));
              const showYearWarning = isDateField && isYearValue;
              const valueKind = getFilterOperatorInputKind(child.op);
              const valueError = getFilterValueError(child.op, child.value);
              const betweenValue = normalizeFilterValueForOperator("between", child.value) as [string, string];
              const listValue = normalizeListValues(child.value);

              return (
                <div key={child.id} className="row g-2 align-items-start w-100">
                  <div className="col-md-4">
                    <SqlColumnPicker
                      columns={columnOptions}
                      selectedColumns={selectedColumns}
                      showSelectedBadge
                      labelByKey={labelByKey}
                      groupLabelByKey={groupLabelByKey}
                      value={selectedByKey.has(currentKey) ? selectedByKey.get(currentKey) ?? null : defaultField ?? null}
                      onChange={(next) => {
                        if (!next) return;
                        updateAnyNode(child.id, (n) => (n.type === "condition" ? { ...n, field: next } : n));
                      }}
                      disabled={!hasCols}
                      placeholder="Choose column…"
                    />
                  </div>

                  <div className="col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={child.op}
                      onChange={(e) => {
                        const nextOp = normalizeFilterOperator(e.target.value) as ConditionOp;
                        updateAnyNode(child.id, (n) => {
                          if (n.type !== "condition") return n;
                          const nextValue = normalizeFilterValueForOperator(nextOp, n.value);
                          return { ...n, op: nextOp, value: nextValue };
                        });
                      }}
                    >
                      {FILTER_OPERATOR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    {valueKind === "none" ? (
                      <div className="form-control form-control-sm text-muted bg-light">
                        No value required
                      </div>
                    ) : valueKind === "multi" ? (
                      <MultiValueInput
                        values={listValue}
                        onChange={(next) =>
                          updateAnyNode(child.id, (n) =>
                            n.type === "condition"
                              ? { ...n, value: normalizeFilterValueForOperator(child.op, next) }
                              : n
                          )
                        }
                      />
                    ) : valueKind === "range" ? (
                      <div className="d-flex align-items-center gap-2">
                        <input
                          className="form-control form-control-sm"
                          placeholder="Min value"
                          value={betweenValue[0] ?? ""}
                          onChange={(event) =>
                            updateAnyNode(child.id, (n) =>
                              n.type === "condition"
                                ? {
                                    ...n,
                                    value: normalizeFilterValueForOperator(child.op, [
                                      event.target.value,
                                      betweenValue[1] ?? "",
                                    ]),
                                  }
                                : n
                            )
                          }
                        />
                        <span className="text-muted small">and</span>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Max value"
                          value={betweenValue[1] ?? ""}
                          onChange={(event) =>
                            updateAnyNode(child.id, (n) =>
                              n.type === "condition"
                                ? {
                                    ...n,
                                    value: normalizeFilterValueForOperator(child.op, [
                                      betweenValue[0] ?? "",
                                      event.target.value,
                                    ]),
                                  }
                                : n
                            )
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Value"
                          value={String(normalizeFilterValueForOperator(child.op, child.value) ?? "")}
                          onChange={(e) =>
                            updateAnyNode(child.id, (n) =>
                              n.type === "condition"
                                ? {
                                    ...n,
                                    value: normalizeFilterValueForOperator(child.op, e.target.value),
                                  }
                                : n
                            )
                          }
                        />
                        {showYearWarning ? (
                          <div className="text-warning small mt-1">
                            This is a DATE/TIMESTAMP column. To filter by year, create a computed Year field in Data Prep
                            and filter on that field.
                          </div>
                        ) : null}
                      </div>
                    )}
                    {valueError ? <div className="text-danger small mt-1">{valueError}</div> : null}
                  </div>

                  <div className="col-md-1 text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-danger"
                      onClick={() => removeAnyNode(child.id)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <small className="text-muted d-block mt-2">
            Tip: Nest groups to build parentheses, e.g. (A AND B) OR (C AND (D OR E)).
          </small>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-2 w-100">
        <div className="text-muted small">Build conditions using available columns.</div>

        {model.groups.length === 0 ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={addFirstFilter}
            disabled={!hasCols}
            title="Add your first filter group"
          >
            <i className="fa fa-plus me-1" />
            Add filter
          </button>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearAllFilters} title="Clear all filters">
              <i className="fa fa-eraser me-1" />
              Clear
            </button>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={addTopLevelGroup}
              title="Add a filter group"
              disabled={!hasCols}
            >
              <i className="fa fa-plus me-1" />
              Add group
            </button>
          </div>
        )}
      </div>

      {model.groups.length === 0 ? (
        <EmptySectionState
          iconClass="fa-filter"
          title={hasCols ? "No filters yet" : "No columns selected yet"}
          subtitle={hasCols ? "Click “Add filter” to start building conditions." : "Select some columns first, then you can create filters."}
          ctaLabel="Add filter"
          onClick={addFirstFilter}
        />
      ) : (
        <div className="w-100">
          <div className="d-flex align-items-center mb-2">
            <button
              type="button"
              className="btn btn-sm btn-link text-decoration-none p-0"
              onClick={() => setPreviewOpen((v) => !v)}
              title={previewOpen ? "Hide preview" : "Show preview"}
            >
              <span className="text-muted small">Preview ({previewOpen ? "Hide" : "Show"})</span>
            </button>
          </div>

          {previewOpen ? (
            <div
              className="rounded px-3 py-2 mb-3 w-100"
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.01))",
                border: "1px dashed rgba(0,0,0,0.14)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {preview || "(…)"}
            </div>
          ) : null}

          <div className="d-flex flex-column gap-2 w-100">{model.groups.map((g) => renderGroup(g, 0, true))}</div>
        </div>
      )}
    </>
  );
};

export const FiltersSection: React.FC<Props> = ({
  collapsed,
  onToggleCollapsed,
  collapsible = true,
  onHide,
  isFullscreen,
  onToggleFullscreen,
  selectedColumns,
  allColumns,
  value,
  onChange,
  sqlJson,
  onNext,
  onSubmit,
  helpAction,
}) => {
  const count = useMemo(() => {
    const domainCols = allColumns && allColumns.length ? allColumns : selectedColumns;
    const computedCols = computedColumnsFromDataPrep(sqlJson);
    const all = [...computedCols, ...domainCols];
    const seen = new Set<string>();
    const columnOptions: SqlColumnKey[] = [];
    for (const c of all) {
      const key = colKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      columnOptions.push(c);
    }
    if (!columnOptions.length) return 0;
    const fallback: SqlColumnKey = columnOptions[0] ?? { modelColumnId: null, columnName: "" } as any;
    const root = sqlNodeToRootModel(value ?? null, fallback);
    const walk = (n: Node): number => {
      if (n.type === "condition") return 1;
      return n.children.reduce((acc, c) => acc + walk(c), 0);
    };
    return root.groups.reduce((acc, g) => acc + walk(g), 0);
  }, [value, selectedColumns, allColumns, sqlJson]);

  const hasInvalidConditions = useMemo(() => {
    const walk = (node: SqlFilterNode | null | undefined): boolean => {
      if (!node) return false;
      if (node.type === "condition") {
        const op = normalizeFilterOperator(node.op);
        return Boolean(getFilterValueError(op, normalizeFilterValueForOperator(op, node.value)));
      }
      return node.children.some((child) => walk(child));
    };
    return walk(value ?? null);
  }, [value]);

  return (
    <SectionShell
      id="filters"
      title="Filters"
      subtitle="Build conditions using available columns."
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      collapsible={collapsible}
      iconClass="fa-filter"
      count={(allColumns && allColumns.length) || selectedColumns.length ? count : 0}
      onHide={onHide}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
      helpAction={helpAction}
    >
      <>
        <FiltersSectionBody
          selectedColumns={selectedColumns}
          allColumns={allColumns}
          value={value}
          onChange={onChange}
          sqlJson={sqlJson}
        />
        {onNext || onSubmit ? (
          <div className="d-flex flex-column align-items-start mt-3 pt-3 border-top">
            <div className="d-flex align-items-center gap-2">
              {onNext ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={onNext}
                  disabled={hasInvalidConditions}
                  title={hasInvalidConditions ? "Resolve filter validation errors before continuing." : undefined}
                >
                  Next
                </button>
              ) : null}
            {onSubmit ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onSubmit}
                disabled={hasInvalidConditions}
                title={hasInvalidConditions ? "Resolve filter validation errors before saving." : undefined}
              >
                Save
              </button>
            ) : null}
            </div>
            {hasInvalidConditions ? (
              <div className="text-danger small mt-1">
                Resolve invalid filter values before continuing.
              </div>
            ) : null}
            <div className="text-muted small mt-1">Add aggregations next.</div>
          </div>
        ) : null}
      </>
    </SectionShell>
  );
};

export default FiltersSection;
