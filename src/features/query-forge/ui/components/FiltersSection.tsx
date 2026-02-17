// src/features/nocode-query/ui/components/FiltersSection.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { EmptySectionState } from "../../../../shared/ui/EmptySectionState";
import { SectionShell } from "./SectionShell";
import type {
  SqlFilterNode,
  SqlFilterLogic,
  SqlFilterOp,
  SqlColumnKey,
  SqlColumnRef,
  SqlQueryJson,
  InListValue,
} from "../../model/sqlJson";
import { colKey, labelFor, sameCol } from "../../model/sqlJson";
import { SqlColumnPicker } from "./ColumnSelector";
import {
  getVisibleCohorts,
  getVisibleValueOverrides,
  type ValueOverrideVisibilityIndex,
  type CohortVisibilityRow,
} from "@/shared/services/noCodeAdminApi";

type LogicOp = "and" | "or";
type ConditionOp = "equals" | "contains" | "starts_with" | "in" | "gt" | "lt" | "between";

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

function opLabel(op: ConditionOp) {
  switch (op) {
    case "equals":
      return "=";
    case "contains":
      return "CONTAINS";
    case "starts_with":
      return "STARTS WITH";
    case "in":
      return "IN";
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "between":
      return "BETWEEN";
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

type InListMode = "manual" | "cohort" | "value_override";

type CrosswalkOption = {
  listType: "regions" | "npiCategories" | "serviceLines";
  listId: string;
  label: string;
  name?: string;
};

const emptyCrosswalkIndex: ValueOverrideVisibilityIndex = {
  regions: [],
  npiCategories: [],
  serviceLines: [],
};

const MAX_MANUAL_IN = 150;

function normalizeManualValues(v: any): string[] {
  if (Array.isArray(v)) return v.map((item) => String(item)).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item)).map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        // fall through to comma split
      }
    }
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (v == null) return [];
  return [String(v)];
}

function normalizeInListValue(v: any): InListValue {
  if (v && typeof v === "object" && typeof (v as any).mode === "string") {
    const mode = String((v as any).mode);
    if (mode === "manual") return { mode: "manual", values: normalizeManualValues((v as any).values ?? []) };
    if (mode === "cohort") return { mode: "cohort", cohortId: String((v as any).cohortId ?? "") };
    if (mode === "value_override" || mode === "crosswalk") {
      return {
        mode: "value_override",
        listType: ((v as any).listType ?? "regions") as any,
        listId: String((v as any).listId ?? ""),
      };
    }
  }
  // Back-compat: if persisted value was just a string/array -> treat as manual list
  return { mode: "manual", values: normalizeManualValues(v) };
}

function toCrosswalkOptions(index: ValueOverrideVisibilityIndex): CrosswalkOption[] {
  const options: CrosswalkOption[] = [];
  (["regions", "npiCategories", "serviceLines"] as const).forEach((listType) => {
    index[listType].forEach((cw: any) => {
      const listId = String(cw.listId ?? cw.id ?? "");
      const name = String(cw.listName ?? cw.name ?? listId);
      const label = `${listType}: ${name}`;
      options.push({ listType, listId, label, name });
    });
  });
  return options;
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
    const op = (((n as any).op ?? "equals") as ConditionOp) ?? "equals";
    const rawValue = (n as any).value;
    const value = op === "in" ? normalizeInListValue(rawValue) : rawValue == null ? "" : String(rawValue);

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
      value: n.value,
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
    if (node.op === "in") {
      const v = normalizeInListValue(node.value);
      if (v.mode === "manual") {
        const label = v.values.length ? v.values.join(", ") : "…";
        return `${labelFor(node.field)} ${opLabel(node.op)} (${label})`;
      }
      if (v.mode === "cohort") {
        return `${labelFor(node.field)} ${opLabel(node.op)} (cohort ${v.cohortId || "…"})`;
      }
      return `${labelFor(node.field)} ${opLabel(node.op)} (${v.listType}:${v.listId || "…"})`;
    }
    const v = String(node.value ?? "").trim() ? `"${String(node.value ?? "").trim()}"` : "…";
    return `${labelFor(node.field)} ${opLabel(node.op)} ${v}`;
  }
  const joiner = ` ${joinerLabel(node.match)} `;
  const parts = node.children.map(buildPreview).filter(Boolean);
  return `(${parts.join(joiner) || "…"})`;
}

/** -----------------------------
 *  ONE-CONTROL in-list value picker
 *  (looks/behaves like ColumnSelector)
 * ------------------------------ */
function formatInListButtonLabel(
  v: InListValue,
  cohorts: CohortVisibilityRow[],
  crosswalkOptions: CrosswalkOption[]
) {
  if (v.mode === "manual") {
    if (!v.values?.length) return "Enter values…";
    const first = v.values.slice(0, 3);
    const extra = v.values.length - first.length;
    return extra > 0 ? `${first.join(", ")} +${extra}` : first.join(", ");
  }

  if (v.mode === "cohort") {
    if (!v.cohortId) return "Select cohort…";
    const hit = cohorts.find((c) => String(c.queryId) === String(v.cohortId));
    return hit ? `Cohort: ${hit.title}` : `Cohort: ${v.cohortId}`;
  }

  // crosswalk
  if (!v.listId) return "Select crosswalk…";
  const hit = crosswalkOptions.find((x) => x.listType === (v as any).listType && String(x.listId) === String(v.listId));
  return hit ? `Crosswalk: ${hit.label}` : `Crosswalk: ${(v as any).listType}:${v.listId}`;
}

function badgeClass(active: boolean) {
  return active ? "text-bg-primary" : "text-bg-light border";
}

function InListValuePicker(props: {
  value: InListValue;
  onChange: (next: InListValue) => void;
  cohorts: CohortVisibilityRow[];
  crosswalkOptions: CrosswalkOption[];
  disabled?: boolean;
}) {
  const { value, onChange, cohorts, crosswalkOptions, disabled } = props;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // manual input draft + search
  const [manualDraft, setManualDraft] = useState("");
  const [manualLimitWarning, setManualLimitWarning] = useState(false);
  const [q, setQ] = useState("");

  const cohortItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cohorts
      .map((c) => ({
        id: String(c.queryId),
        title: String(c.title ?? ""),
        prompt: String(c.prompt ?? ""),
      }))
      .filter((c) => {
        if (!term) return true;
        return c.title.toLowerCase().includes(term) || c.prompt.toLowerCase().includes(term);
      });
  }, [cohorts, q]);

  const crosswalkItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    return crosswalkOptions
      .map((x) => ({
        id: `${x.listType}:${x.listId}`,
        label: x.label,
      }))
      .filter((x) => (!term ? true : x.label.toLowerCase().includes(term)));
  }, [crosswalkOptions, q]);

  const hasCohorts = cohorts.length > 0;
  const hasCrosswalks = crosswalkOptions.length > 0;

  const computePos = () => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    setPos({
      top: r.bottom + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
    });
  };

  useEffect(() => {
    if (!open) return;

    computePos();

    const onDocDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;

      if (boxRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;

      setOpen(false);
    };

    const onScrollOrResize = () => computePos();
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (value.mode === "manual" && value.values.length > MAX_MANUAL_IN) {
      setManualLimitWarning(true);
    }
  }, [value]);

  const setMode = (mode: InListMode) => {
    // UX: if user clicks cohort/crosswalk but none exist, do nothing.
    if (mode === "cohort" && !hasCohorts) return;
    if (mode === "value_override" && !hasCrosswalks) return;

    if (mode === "manual") onChange({ mode: "manual", values: value.mode === "manual" ? value.values : [] });
    if (mode === "cohort") onChange({ mode: "cohort", cohortId: value.mode === "cohort" ? value.cohortId : "" });
    if (mode === "value_override")
      onChange({
        mode: "value_override",
        listType: (value.mode === "value_override" ? (value as any).listType : "regions") as any,
        listId: value.mode === "value_override" ? String((value as any).listId ?? "") : "",
      });

    setQ("");
  };

  const addManualValues = (raw: string) => {
    const nextValues = normalizeManualValues(raw);
    if (!nextValues.length) return;

    const cur = value.mode === "manual" ? value.values : [];
    const merged = Array.from(new Set([...cur, ...nextValues]));
    if (merged.length > MAX_MANUAL_IN) {
      onChange({ mode: "manual", values: merged.slice(0, MAX_MANUAL_IN) });
      setManualLimitWarning(true);
      setManualDraft("");
      return;
    }
    onChange({ mode: "manual", values: merged });
    setManualLimitWarning(false);
    setManualDraft("");
  };

  const removeManualValue = (v: string) => {
    if (value.mode !== "manual") return;
    onChange({ ...value, values: value.values.filter((x) => x !== v) });
    setManualLimitWarning(false);
  };

  const clearSelection = () => {
    // Return to manual empty (feels like a normal "clear")
    onChange({ mode: "manual", values: [] });
    setQ("");
    setManualDraft("");
    setManualLimitWarning(false);
  };

  const buttonLabel = useMemo(
    () => formatInListButtonLabel(value, cohorts, crosswalkOptions),
    [value, cohorts, crosswalkOptions]
  );

  return (
    <div className="position-relative w-100" ref={boxRef}>
      <button
        type="button"
        className="form-control form-control-sm d-flex align-items-center justify-content-between"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <span className="text-truncate" style={{ maxWidth: "92%" }}>
          {buttonLabel ? buttonLabel : <span className="text-muted">Enter values…</span>}
        </span>
        <i className={`fa fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>

      {open && !disabled && pos
        ? ReactDOM.createPortal(
            <div
              ref={menuRef}
              className="border rounded shadow-sm bg-white position-absolute mt-1"
              style={{
                zIndex: 2000,
                width: pos.width,
                maxHeight: 360,
                overflow: "auto",
                top: pos.top,
                left: pos.left,
              }}
            >
              {/* Header: mode badges + clear */}
              <div className="p-2 border-bottom">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex gap-2 flex-wrap">
                    <span
                      role="button"
                      className={`badge ${badgeClass(value.mode === "manual")}`}
                      onClick={() => setMode("manual")}
                      title="Type your own values"
                    >
                      Manual
                    </span>

                    <span
                      role="button"
                      className={`badge ${badgeClass(value.mode === "cohort")}`}
                      onClick={() => setMode("cohort")}
                      title={hasCohorts ? "Pick a cohort" : "No cohorts available"}
                      style={!hasCohorts ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                    >
                      Cohort
                    </span>

                    <span
                      role="button"
                      className={`badge ${badgeClass(value.mode === "value_override")}`}
                      onClick={() => setMode("value_override")}
                      title={hasCrosswalks ? "Pick a crosswalk" : "No lists available"}
                      style={!hasCrosswalks ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                    >
                      Crosswalk
                    </span>
                  </div>

                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearSelection}>
                    Clear
                  </button>
                </div>

                {/* Search only relevant for cohort/crosswalk */}
                {value.mode !== "manual" ? (
                  <div className="mt-2">
                    <input
                      className="form-control form-control-sm"
                      placeholder="Search…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      autoFocus
                    />
                  </div>
                ) : null}
              </div>

              {/* Body */}
              {value.mode === "manual" ? (
                <div className="p-2">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Enter values (comma or Enter to add)"
                    value={manualDraft}
                    onChange={(e) => setManualDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addManualValues(manualDraft);
                      }
                    }}
                    onBlur={() => addManualValues(manualDraft)}
                  />

                  {value.values?.length ? (
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {value.values.map((v) => (
                        <span key={v} className="badge text-bg-light border">
                          {v}
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-danger ms-2 p-0"
                            onClick={() => removeManualValue(v)}
                            aria-label={`Remove ${v}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted small mt-2">No values yet.</div>
                  )}
                  {manualLimitWarning ? (
                    <div className="text-warning small mt-2">
                      Manual code lists are limited to {MAX_MANUAL_IN}. Please upload/use a Crosswalk list for larger sets.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {value.mode === "cohort" ? (
                <div className="list-group list-group-flush">
                  {cohortItems.length === 0 ? (
                    <div className="p-3 text-muted small">No matches.</div>
                  ) : (
                    cohortItems.map((c) => {
                      const active = String(value.cohortId ?? "") === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`list-group-item list-group-item-action py-2 ${active ? "bg-light" : ""}`}
                          onClick={() => {
                            onChange({ mode: "cohort", cohortId: c.id });
                            setOpen(false);
                            setQ("");
                          }}
                          title={c.prompt}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="fw-medium">{c.title}</div>
                            {active ? <span className="badge text-bg-primary">Selected</span> : null}
                          </div>
                          {c.prompt ? <div className="text-muted small text-truncate">{c.prompt}</div> : null}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}

              {value.mode === "value_override" ? (
                <div className="list-group list-group-flush">
                  {crosswalkItems.length === 0 ? (
                    <div className="p-3 text-muted small">No matches.</div>
                  ) : (
                    crosswalkItems.map((x) => {
                      const active = value.mode === "value_override" && `${(value as any).listType}:${value.listId}` === x.id;
                      return (
                        <button
                          key={x.id}
                          type="button"
                          className={`list-group-item list-group-item-action py-2 ${active ? "bg-light" : ""}`}
                          onClick={() => {
                            const [listType, listId] = x.id.split(":");
                            onChange({ mode: "value_override", listType: listType as any, listId });
                            setOpen(false);
                            setQ("");
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="fw-medium">{x.label}</div>
                            {active ? <span className="badge text-bg-primary">Selected</span> : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}

              <div className="p-2 border-top d-flex justify-content-end">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
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

  const [visibleCrosswalkIndex, setVisibleCrosswalkIndex] =
    useState<ValueOverrideVisibilityIndex>(emptyCrosswalkIndex);
  const [visibleCohorts, setVisibleCohorts] = useState<CohortVisibilityRow[]>([]);

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

  const crosswalkOptions = useMemo(() => toCrosswalkOptions(visibleCrosswalkIndex), [visibleCrosswalkIndex]);

  // ---- local UI model
  const [model, setModel] = useState<RootModel>(() => ({ match: "and", groups: [] }));

  // Track last applied incoming value so we don’t rehydrate repeatedly
  const lastValueSigRef = useRef<string>("");

  // Emit control: only emit after *user-triggered* updates
  const shouldEmitRef = useRef(false);
  const lastEmittedSigRef = useRef<string>("");

  const valueSig = useMemo(() => JSON.stringify(value ?? null), [value]);

  useEffect(() => {
    let alive = true;

    const loadVisibility = async () => {
      try {
        const crosswalkResp = await getVisibleValueOverrides(true);
        if (alive) setVisibleCrosswalkIndex(crosswalkResp?.index ?? emptyCrosswalkIndex);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to load crosswalk visibility", err);
        if (alive) setVisibleCrosswalkIndex(emptyCrosswalkIndex);
      }

      try {
        const cohortResp = await getVisibleCohorts();
        if (alive) setVisibleCohorts(Array.isArray(cohortResp?.cohorts) ? cohortResp.cohorts : []);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to load cohort visibility", err);
        if (alive) setVisibleCohorts([]);
      }
    };

    loadVisibility();
    return () => {
      alive = false;
    };
  }, []);

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

              return (
                <div key={child.id} className="row g-2 align-items-center w-100">
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
                        const nextOp = e.target.value as ConditionOp;
                        updateAnyNode(child.id, (n) => {
                          if (n.type !== "condition") return n;
                          const nextValue = nextOp === "in" ? normalizeInListValue(n.value) : "";
                          return { ...n, op: nextOp, value: nextValue };
                        });
                      }}
                    >
                      <option value="equals">equals</option>
                      <option value="contains">contains</option>
                      <option value="starts_with">starts with</option>
                      <option value="in">in list</option>
                      <option value="gt">&gt;</option>
                      <option value="lt">&lt;</option>
                      <option value="between">between</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    {child.op === "in" ? (
                      <InListValuePicker
                        value={normalizeInListValue(child.value)}
                        onChange={(next) =>
                          updateAnyNode(child.id, (n) => (n.type === "condition" ? { ...n, value: next } : n))
                        }
                        cohorts={visibleCohorts}
                        crosswalkOptions={crosswalkOptions}
                      />
                    ) : (
                      <div>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Value"
                          value={String(child.value ?? "")}
                          onChange={(e) =>
                            updateAnyNode(child.id, (n) => (n.type === "condition" ? { ...n, value: e.target.value } : n))
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
            <div className="text-muted small mt-1">Add aggregations next.</div>
          </div>
        ) : null}
      </>
    </SectionShell>
  );
};

export default FiltersSection;
