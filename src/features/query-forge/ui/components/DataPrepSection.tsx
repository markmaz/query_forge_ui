// src/features/nocode-query/ui/components/DataPrepSection.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { EmptySectionState } from "../../../../shared/components/EmptySectionState";
import { SectionShell } from "./SectionShell";
import type {
  SqlColumnKey,
  SqlDataPrepJson,
  SqlDataPrepRule,
  SqlDataPrepOp,
  SqlFillEmptyRule,
  SqlCastRule,
  SqlNormalizeTextRule,
  SqlParseDateRule,
  SqlDatePartRule,
  SqlRoundRule,
  SqlConcatRule,
  SqlValueRef,
} from "../../model/sqlJson";
import { colKey, labelFor, sameCol } from "../../model/sqlJson";
import {
  isRuleConcat,
  isFillEmpty,
  mkColumnRef,
  mkLiteralRef,
  getValueRefCol,
  getValueRefLiteral,
} from "./dataPrepHelpers";
import { DomainColumnRef } from "../../model/domainCatalog";
import { SqlColumnPicker } from "./ColumnSelector";
import "../styles/ncPill.css";

type Props = {
  selectedColumns: SqlColumnKey[];
  columnsMeta?: DomainColumnRef[];
  value?: SqlDataPrepJson | null;
  onChange?: (next: SqlDataPrepJson | null) => void;

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

const newId = () => Math.random().toString(36).slice(2, 10);

const EMPTY_PREP: SqlDataPrepJson = {
  enabled: false,
  rules: [] as SqlDataPrepRule[],
};

function normalizeModel(m: SqlDataPrepJson): SqlDataPrepJson {
  const rules = (m.rules ?? []) as SqlDataPrepRule[];
  const enabled = rules.length > 0;
  return { ...m, enabled, rules };
}

function reorder<T>(
  items: T[],
  fromId: string,
  toId: string,
  getId: (x: T) => string,
) {
  const fromIdx = items.findIndex((x) => getId(x) === fromId);
  const toIdx = items.findIndex((x) => getId(x) === toId);
  if (fromIdx < 0 || toIdx < 0) return items;

  const next = items.slice();
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

const OP_LABEL: Record<SqlDataPrepOp, string> = {
  fill_empty: "Fill blanks",
  cast: "Cast",
  normalize_text: "Normalize text",
  parse_date: "Parse date",
  date_part: "Extract date part",
  round: "Round",
  concat: "Combine Text",
};

const OP_HELP: Record<SqlDataPrepOp, string> = {
  fill_empty:
    "Replace null/empty values with a fallback across the whole query.",
  cast: "Cast values to a new type across the whole query.",
  normalize_text: "Normalize casing/whitespace across the whole query.",
  parse_date: "Parse text into a date using an optional format string.",
  date_part: "Create a reusable computed field from a date/timestamp column.",
  round: "Round numeric values to N decimals across the whole query.",
  concat: "Build a combined value from columns and typed text.",
};

function parseScalar(raw: string): string | number | boolean | null {
  const v = raw.trim();
  if (!v) return "";
  if (v.toLowerCase() === "null") return null;
  if (v.toLowerCase() === "true") return true;
  if (v.toLowerCase() === "false") return false;
  const n = Number(v);
  if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(v)) return n;
  return v;
}

type ColumnItem = {
  key: SqlColumnKey;
  name: string;
  table?: string | null;
  data_type?: string | null;
};

function makeOutput(ruleId: string, name: string): SqlColumnKey {
  return {
    modelColumnId: null,
    columnName: name,
    workspaceTableId: null,
    exprId: ruleId,
  };
}

function makeDatePartExprId(
  target: SqlColumnKey,
  part: SqlDatePartRule["part"],
) {
  const base =
    target.modelColumnId != null
      ? `id:${target.modelColumnId}`
      : target.exprId
        ? `expr:${target.exprId}`
        : `name:${target.columnName}`;
  return `dp:date_part:${part}:${base}`;
}

function makeDatePartAlias(
  target: SqlColumnKey | null | undefined,
  part: SqlDatePartRule["part"],
) {
  const base = (target?.columnName ?? "").trim();
  if (!base) return part;
  return `${base}_${part}`;
}

function makeDatePartOutput(
  target: SqlColumnKey,
  part: SqlDatePartRule["part"],
  alias?: string | null,
): SqlColumnKey {
  const defaultAlias = makeDatePartAlias(target, part);
  const name = (alias ?? defaultAlias).trim() || defaultAlias;
  return {
    modelColumnId: null,
    columnName: name,
    alias: name,
    exprId: makeDatePartExprId(target, part),
  };
}

const DATE_PART_OPTIONS: SqlDatePartRule["part"][] = ["year", "month", "day"];

function isDateType(raw?: string | null) {
  if (!raw) return false;
  const v = raw.toLowerCase();
  return (
    v.includes("date") || v.includes("timestamp") || v.includes("datetime")
  );
}

// -----------------------------
// Concat helpers
// -----------------------------
function ensureMinTwoInputs(
  inputs: SqlValueRef[] | undefined | null,
  seedCol?: SqlColumnKey | null,
): SqlValueRef[] {
  const xs = (inputs ?? []).slice().filter(Boolean);
  if (xs.length >= 2) return xs;

  const out = xs.slice();
  while (out.length < 2) {
    if (seedCol && out.length === 0) out.push(mkColumnRef(seedCol));
    else out.push(mkLiteralRef(""));
  }
  return out;
}

function pillText(v: SqlValueRef): string {
  if (v.type === "column") {
    const c = getValueRefCol(v);
    return c?.columnName ? labelFor(c) : "Choose column…";
  }
  const s = String(getValueRefLiteral(v) ?? "");
  return s.length ? s : "Text…";
}

// ------------------------------------------------------------
// ColumnPicker (PORTAL VERSION)
// ------------------------------------------------------------
function ColumnPicker(props: {
  value: SqlColumnKey | null;
  onChange: (next: SqlColumnKey | null) => void;
  selectedColumns: SqlColumnKey[];
  allColumns: ColumnItem[];
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  showSelectedBadge?: boolean;
  defaultShowAll?: boolean;
}) {
  const {
    value,
    onChange,
    selectedColumns,
    allColumns,
    disabled,
    placeholder,
    title,
    showSelectedBadge,
    defaultShowAll,
  } = props;

  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(!!defaultShowAll);
  const [q, setQ] = useState("");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const selectedSet = useMemo(
    () => new Set(selectedColumns.map(colKey)),
    [selectedColumns],
  );

  const selectedItems = useMemo(() => {
    return selectedColumns
      .slice()
      .sort((a, b) => labelFor(a).localeCompare(labelFor(b)))
      .map(
        (k) =>
          allColumns.find((c) => sameCol(c.key, k)) ?? {
            key: k,
            name: labelFor(k),
          },
      );
  }, [selectedColumns, allColumns]);

  const otherItems = useMemo(() => {
    const filtered = allColumns.filter((c) => !selectedSet.has(colKey(c.key)));
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return filtered;
  }, [allColumns, selectedSet]);

  const filterByQ = (xs: ColumnItem[]) => {
    const term = q.trim().toLowerCase();
    if (!term) return xs;
    return xs.filter((c) => {
      const n = (c.name || "").toLowerCase();
      const t = (c.table || "").toLowerCase();
      const dt = (c.data_type || "").toLowerCase();
      return n.includes(term) || t.includes(term) || dt.includes(term);
    });
  };

  const selectedFiltered = useMemo(
    () => filterByQ(selectedItems),
    [selectedItems, q],
  );
  const otherFiltered = useMemo(() => filterByQ(otherItems), [otherItems, q]);

  const isSelected = (k: SqlColumnKey) => selectedSet.has(colKey(k));

  const computePos = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
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
      const btn = btnRef.current;
      const menu = menuRef.current;
      const target = e.target as any;
      if (btn && btn.contains(target)) return;
      if (menu && menu.contains(target)) return;
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

  const pick = (k: SqlColumnKey) => {
    onChange(k);
    setOpen(false);
    setQ("");
    setShowAll(!!defaultShowAll);
  };

  const label = value ? labelFor(value) : (placeholder ?? "Choose column…");

  const Row = (c: ColumnItem) => (
    <div className="d-flex justify-content-between align-items-center">
      <span
        className="text-truncate"
        style={{ maxWidth: showSelectedBadge ? "62%" : "72%" }}
      >
        {c.name}
      </span>
      <div className="d-flex align-items-center gap-2">
        {showSelectedBadge && isSelected(c.key) ? (
          <span
            className="badge bg-primary"
            style={{ fontSize: 10, borderRadius: 999, padding: "3px 8px" }}
          >
            Selected
          </span>
        ) : null}
        {c.data_type ? (
          <span className="text-muted" style={{ fontSize: 12 }}>
            {c.data_type}
          </span>
        ) : null}
        {!c.data_type && c.table ? (
          <span className="text-muted" style={{ fontSize: 12 }}>
            {c.table}
          </span>
        ) : null}
      </div>
    </div>
  );

  const menu =
    open && pos
      ? ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="bg-white border shadow-sm"
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div className="p-2 border-bottom">
              <input
                autoFocus
                className="form-control form-control-sm"
                placeholder="Search columns…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              <div
                className="px-2 pt-2 pb-1 text-muted"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".02em",
                }}
              >
                SELECTED COLUMNS
              </div>

              {selectedFiltered.length === 0 ? (
                <div className="px-3 pb-2 text-muted small">No matches.</div>
              ) : (
                selectedFiltered.map((c) => (
                  <button
                    key={colKey(c.key)}
                    type="button"
                    className="btn btn-sm w-100 text-start"
                    style={{ borderRadius: 0, padding: "8px 10px" }}
                    onClick={() => pick(c.key)}
                  >
                    {Row(c)}
                  </button>
                ))
              )}

              <div className="border-top" />

              <div className="px-2 pt-2 pb-1 d-flex align-items-center justify-content-between">
                <div
                  className="text-muted"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".02em",
                  }}
                >
                  OTHER DOMAIN COLUMNS
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-link"
                  style={{ textDecoration: "none", padding: 0 }}
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "Hide" : "Show"}
                </button>
              </div>

              {showAll ? (
                otherFiltered.length === 0 ? (
                  <div className="px-3 pb-2 text-muted small">No matches.</div>
                ) : (
                  otherFiltered.map((c) => (
                    <button
                      key={colKey(c.key)}
                      type="button"
                      className="btn btn-sm w-100 text-start"
                      style={{ borderRadius: 0, padding: "8px 10px" }}
                      onClick={() => pick(c.key)}
                    >
                      {Row(c)}
                    </button>
                  ))
                )
              ) : (
                <div className="px-3 pb-2 text-muted small">
                  Hidden by default. Click <b>Show</b> to pick from the full
                  domain.
                </div>
              )}
            </div>

            <div className="p-2 border-top d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQ("");
                  setShowAll(!!defaultShowAll);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="position-relative">
      <button
        ref={btnRef}
        type="button"
        className="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center justify-content-between"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={title}
        style={{ borderRadius: 8 }}
      >
        <span className="text-truncate" style={{ maxWidth: "92%" }}>
          {label}
        </span>
        <i
          className={`fa fa-chevron-${open ? "up" : "down"}`}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
}

export const DataPrepSection: React.FC<Props> = ({
  selectedColumns,
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
  const [internal, setInternal] = useState<SqlDataPrepJson>(() =>
    normalizeModel(value ?? EMPTY_PREP),
  );
  const model = normalizeModel(value ?? internal);

  const rulesSig = useMemo(
    () => JSON.stringify(model.rules ?? []),
    [model.rules],
  );
  const selectedSig = useMemo(
    () => selectedColumns.map(colKey).slice().sort().join("|"),
    [selectedColumns],
  );

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) =>
    setExpandedIds((p) => ({ ...p, [id]: !p[id] }));

  const [concatDrafts, setConcatDrafts] = useState<
    Record<string, SqlConcatRule>
  >({});
  const [editingTextChip, setEditingTextChip] = useState<
    Record<string, number | null>
  >({});
  const [editingColChip, setEditingColChip] = useState<
    Record<string, number | null>
  >({});

  const [dragChip, setDragChip] = useState<{
    ruleId: string;
    fromIdx: number;
  } | null>(null);

  const commitIfChanged = (next: SqlDataPrepJson) => {
    const normalized = normalizeModel(next);
    const nextRulesSig = JSON.stringify(normalized.rules ?? []);
    if (nextRulesSig === rulesSig) return;

    if (!value) setInternal(normalized);
    onChange?.(normalized.rules.length ? normalized : null);
  };

  useEffect(() => {
    if (value) setInternal(normalizeModel(value));
  }, [value]);

  const allColumns: ColumnItem[] = useMemo(() => {
    const domainCols = (columnsMeta ?? []) as any[];

    const fromDomain: ColumnItem[] = domainCols
      .map((c) => {
        const columnName =
          (c.columnName as string | undefined) ??
          (c.name as string | undefined) ??
          "";
        if (!columnName) return null;
        const displayName =
          (c.alias as string | undefined) ??
          (c.label as string | undefined) ??
          columnName;

        const id =
          typeof c.modelColumnId === "number"
            ? c.modelColumnId
            : typeof c.model_column_id === "number"
              ? c.model_column_id
              : null;

        const table =
          (c.modelTableName as string | undefined) ??
          (c.model_table_name as string | undefined) ??
          (c.table as string | undefined) ??
          null;

        const data_type =
          (c.dataType as string | undefined) ??
          (c.data_type as string | undefined) ??
          null;

        const wtId =
          typeof (c as any).workspaceTableId === "number"
            ? (c as any).workspaceTableId
            : typeof (c as any).workspace_table_id === "number"
              ? (c as any).workspace_table_id
              : null;

        const key: SqlColumnKey = {
          modelColumnId: id ?? null,
          columnName,
          workspaceTableId: wtId,
        };
        return { key, name: displayName, table, data_type } as ColumnItem;
      })
      .filter(Boolean) as ColumnItem[];

    if (fromDomain.length) return fromDomain;

    return selectedColumns.map((k) => ({
      key: k,
      name: labelFor(k),
      table: (k as any).modelTableName ?? null,
      data_type: (k as any).dataType ?? (k as any).data_type ?? null,
    }));
  }, [columnsMeta, selectedColumns]);

  const allColumnKeys = useMemo(
    () => allColumns.map((c) => c.key),
    [allColumns],
  );

  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    allColumns.forEach((c) => {
      const key = colKey(c.key);
      const label = (c.name ?? "").trim() || labelFor(c.key);
      m.set(key, label);
    });
    return m;
  }, [allColumns]);

  const dateColumns = useMemo(
    () => allColumns.filter((c) => isDateType(c.data_type)),
    [allColumns],
  );
  const dateColumnKeys = useMemo(
    () => dateColumns.map((c) => c.key),
    [dateColumns],
  );
  const dateKeySet = useMemo(
    () => new Set(dateColumnKeys.map(colKey)),
    [dateColumnKeys],
  );

  const seedCol = selectedColumns[0] ?? allColumns[0]?.key ?? null;

  const addRule = () => {
    const first = seedCol;
    if (!first) return;

    const id = newId();
    const op: SqlDataPrepOp = "fill_empty";
    const outName = first.columnName;

    const r: SqlFillEmptyRule = {
      id,
      enabled: true,
      op,
      target: first,
      output: { modelColumnId: null, columnName: outName, exprId: id },
      applyScope: "query_wide",
      treatBlankAsEmpty: true,
      value: "",
      fallbackCol: null,
    };

    commitIfChanged({ ...model, rules: [...model.rules, r as any] });
  };

  const removeRule = (id: string) => {
    commitIfChanged({
      ...model,
      rules: model.rules.filter((r) => r.id !== id),
    });

    setExpandedIds((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setConcatDrafts((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setEditingTextChip((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setEditingColChip((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };

  const clearAll = () => {
    commitIfChanged({ ...model, rules: [] });
    setExpandedIds({});
    setConcatDrafts({});
    setEditingTextChip({});
    setEditingColChip({});
  };

  const updateRule = (id: string, patch: Partial<SqlDataPrepRule> | any) => {
    const nextRules = model.rules.map((r) => {
      if (r.id !== id) return r;

      if (patch.op && patch.op !== r.op) {
        const baseTarget = patch.target ?? r.target ?? seedCol;
        const target =
          patch.op === "date_part" &&
          baseTarget &&
          !dateKeySet.has(colKey(baseTarget))
            ? (dateColumnKeys[0] ?? baseTarget)
            : baseTarget;
        const defaultOutName =
          target?.columnName ?? r.output?.columnName ?? "derived";

        const base = {
          id: r.id,
          enabled: true,
          target,
          output: makeOutput(r.id, defaultOutName),
          applyScope: "query_wide" as const,
        };

        switch (patch.op as SqlDataPrepOp) {
          case "fill_empty":
            return {
              ...base,
              op: "fill_empty",
              treatBlankAsEmpty: true,
              value: "",
              fallbackCol: null,
            } as any;
          case "cast":
            return {
              ...base,
              op: "cast",
              toType: "STRING",
              safe: false,
            } as SqlCastRule;
          case "normalize_text":
            return {
              ...base,
              op: "normalize_text",
              mode: "trim_lower",
            } as SqlNormalizeTextRule;
          case "parse_date":
            return {
              ...base,
              op: "parse_date",
              format: null,
            } as SqlParseDateRule;
          case "date_part": {
            if (!target || !dateKeySet.has(colKey(target))) return r;
            const outName = makeDatePartAlias(target, "year");
            return {
              ...base,
              op: "date_part",
              part: "year",
              target,
              output: makeDatePartOutput(target, "year", outName),
            } as SqlDatePartRule;
          }
          case "round":
            return { ...base, op: "round", decimals: 0 } as SqlRoundRule;
          case "concat": {
            const t = (target ?? seedCol) as SqlColumnKey | null;
            const inputs = ensureMinTwoInputs(
              t ? [{ type: "column", col: t } as any] : [],
              t ?? seedCol,
            );
            const outName = (t?.columnName ?? "combined").replace(/\s+/g, "_");

            return {
              ...base,
              op: "concat",
              target: (t ?? base.target) as any,
              output: makeOutput(r.id, outName),
              inputs,
              separator: "",
              nulls: "skip",
            } as SqlConcatRule;
          }
          default:
            return r;
        }
      }

      const prevOutName =
        r.output?.columnName ?? r.target?.columnName ?? "derived";
      const prevTargetName = r.target?.columnName ?? prevOutName;
      const isDatePart = r.op === "date_part";
      const prevDatePart = isDatePart ? (r as SqlDatePartRule).part : null;

      const next = { ...r, ...patch, enabled: true } as any;

      if (patch.target) {
        const newTargetName = patch.target.columnName;
        const outputWasDefault = isDatePart
          ? prevOutName === makeDatePartAlias(r.target, prevDatePart ?? "year")
          : prevOutName === prevTargetName;

        next.target = patch.target;
        if (isDatePart) {
          const part = (next.part ??
            prevDatePart ??
            "year") as SqlDatePartRule["part"];
          const outName = outputWasDefault
            ? makeDatePartAlias(patch.target, part)
            : (next.output?.columnName ?? prevOutName);
          next.output = makeDatePartOutput(patch.target, part, outName);
        } else {
          next.output = {
            ...(next.output ?? makeOutput(r.id, newTargetName)),
            exprId: r.id,
            modelColumnId: null,
            columnName: outputWasDefault
              ? newTargetName
              : (next.output?.columnName ?? prevOutName),
          };
        }
      } else {
        if (isDatePart && next.target) {
          const part = (next.part ??
            prevDatePart ??
            "year") as SqlDatePartRule["part"];
          const outName =
            next.output?.columnName ?? makeDatePartAlias(next.target, part);
          next.output = makeDatePartOutput(next.target, part, outName);
        } else {
          next.output = {
            ...(next.output ?? makeOutput(r.id, prevOutName)),
            exprId: r.id,
            modelColumnId: null,
            columnName: next.output?.columnName ?? prevOutName,
          };
        }
      }

      if (patch.outputName != null) {
        const nextName = String(patch.outputName);
        if (isDatePart && next.target) {
          const part = (next.part ??
            prevDatePart ??
            "year") as SqlDatePartRule["part"];
          next.output = makeDatePartOutput(next.target, part, nextName);
        } else {
          next.output = {
            ...(next.output ?? makeOutput(r.id, prevOutName)),
            exprId: r.id,
            modelColumnId: null,
            columnName: nextName,
          };
        }
        delete next.outputName;
      }

      return next as SqlDataPrepRule;
    });

    commitIfChanged({ ...model, rules: nextRules });
  };

  useEffect(() => {
    if (!selectedColumns.length || !model.rules.length) return;

    const upgradeKey = (k: SqlColumnKey) => {
      const hit = selectedColumns.find((c) => sameCol(c, k));
      if (hit) return hit;
      const byName = selectedColumns.find((c) => c.columnName === k.columnName);
      return byName ? byName : k;
    };

    const nextRules = model.rules.map((r) => {
      const nextTarget = r.target ? upgradeKey(r.target) : r.target;
      const isDatePart = r.op === "date_part";
      const next: any = {
        ...r,
        enabled: true,
        target: nextTarget,
        output:
          isDatePart && nextTarget
            ? makeDatePartOutput(
                nextTarget,
                (r as SqlDatePartRule).part ?? "year",
                r.output?.alias ??
                  r.output?.columnName ??
                  makeDatePartAlias(
                    nextTarget,
                    (r as SqlDatePartRule).part ?? "year",
                  ),
              )
            : {
                ...(r.output ??
                  makeOutput(r.id, nextTarget?.columnName ?? "derived")),
                exprId: r.id,
                modelColumnId: null,
              },
      };

      if (r.op === "fill_empty") {
        const rr = r as SqlFillEmptyRule;
        if (rr.fallbackCol) next.fallbackCol = upgradeKey(rr.fallbackCol);
      }

      if (r.op === "concat") {
        const cr = r as any as SqlConcatRule;
        next.inputs = ensureMinTwoInputs(cr.inputs, seedCol).map(
          (v: SqlValueRef) => {
            if (v.type === "column")
              return { ...v, col: upgradeKey((v as any).col) };
            return v;
          },
        );
      }

      return next;
    });

    if (JSON.stringify(nextRules) === JSON.stringify(model.rules)) return;
    commitIfChanged({ ...model, rules: nextRules });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSig]);

  const dragIdRef = useRef<string | null>(null);
  const onDragStartRule = (id: string) => (dragIdRef.current = id);
  const onDropOnRule = (targetId: string) => {
    const fromId = dragIdRef.current;
    dragIdRef.current = null;
    if (!fromId || fromId === targetId) return;
    commitIfChanged({
      ...model,
      rules: reorder(model.rules, fromId, targetId, (x) => x.id),
    });
  };

  const openConcatDraft = (rule: SqlConcatRule) => {
    const inputs = ensureMinTwoInputs(rule.inputs ?? [], seedCol);
    const draft: SqlConcatRule = {
      ...rule,
      inputs,
      separator: "",
      nulls: "skip",
    };

    setConcatDrafts((p) => ({ ...p, [rule.id]: draft }));
    setEditingTextChip((p) => ({ ...p, [rule.id]: null }));
    setEditingColChip((p) => ({ ...p, [rule.id]: null }));
  };

  const applyConcatDraft = (ruleId: string) => {
    const draft = concatDrafts[ruleId];
    if (!draft) return;

    updateRule(ruleId, {
      inputs: ensureMinTwoInputs(draft.inputs ?? [], seedCol),
      separator: "",
      nulls: "skip",
    } as any);

    setExpandedIds((p) => ({ ...p, [ruleId]: false }));
    setEditingTextChip((p) => ({ ...p, [ruleId]: null }));
    setEditingColChip((p) => ({ ...p, [ruleId]: null }));
  };

  const cancelConcatDraft = (ruleId: string) => {
    setConcatDrafts((p) => {
      const n = { ...p };
      delete n[ruleId];
      return n;
    });
    setExpandedIds((p) => ({ ...p, [ruleId]: false }));
    setEditingTextChip((p) => ({ ...p, [ruleId]: null }));
    setEditingColChip((p) => ({ ...p, [ruleId]: null }));
  };

  const moveChip = (ruleId: string, fromIdx: number, toIdx: number) => {
    const draft = concatDrafts[ruleId];
    if (!draft) return;

    const inputs = ensureMinTwoInputs(draft.inputs ?? [], seedCol);
    if (fromIdx === toIdx) return;

    const next = inputs.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    setConcatDrafts((p) => ({ ...p, [ruleId]: { ...draft, inputs: next } }));

    setEditingTextChip((p) => {
      const cur = p[ruleId];
      if (cur == null) return p;
      let newIdx = cur;
      if (cur === fromIdx) newIdx = toIdx;
      else if (fromIdx < cur && toIdx >= cur) newIdx = cur - 1;
      else if (fromIdx > cur && toIdx <= cur) newIdx = cur + 1;
      return { ...p, [ruleId]: newIdx };
    });
    setEditingColChip((p) => {
      const cur = p[ruleId];
      if (cur == null) return p;
      let newIdx = cur;
      if (cur === fromIdx) newIdx = toIdx;
      else if (fromIdx < cur && toIdx >= cur) newIdx = cur - 1;
      else if (fromIdx > cur && toIdx <= cur) newIdx = cur + 1;
      return { ...p, [ruleId]: newIdx };
    });
  };

  const SPACER = <div style={{ height: 18 }} />;
  const opOptions: SqlDataPrepOp[] = [
    "fill_empty",
    "cast",
    "normalize_text",
    "parse_date",
    "date_part",
    "round",
    "concat",
  ];

  const body = (
    <div>
      {allColumns.length === 0 ? (
        <EmptySectionState
          iconClass="fa-wand-magic-sparkles"
          title="No domain columns available yet"
          subtitle="Pick a Domain first so Data Prep can offer columns."
        />
      ) : (
        <>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="text-muted small">
              Create derived fields usable in columns/filters/aggs/sorting.
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={clearAll}
                disabled={model.rules.length === 0}
              >
                <i className="fa fa-eraser me-1" /> Clear
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={addRule}
              >
                <i className="fa fa-plus me-1" /> Add derived field
              </button>
            </div>
          </div>

          {model.rules.length === 0 ? (
            <EmptySectionState
              iconClass="fa-wand-magic-sparkles"
              title="No data prep steps yet"
              subtitle="Click “Add derived field” to create a new reusable column."
            />
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 260 }}>Action</th>
                    <th>Options</th>
                    <th style={{ width: 320 }}>Affected</th>
                    <th style={{ width: 240 }}>Alias</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>

                <tbody>
                  {model.rules.map((r) => {
                    const isFill = r.op === "fill_empty";
                    const rr = r as SqlFillEmptyRule;
                    const usingFallbackCol = isFill && !!rr.fallbackCol;

                    const fillResult = isFill
                      ? usingFallbackCol
                        ? `COALESCE(${labelFor(r.target)}, ${labelFor(rr.fallbackCol!)})`
                        : `COALESCE(${labelFor(r.target)}, ${JSON.stringify(rr.value ?? "")})`
                      : null;

                    const isConcat = isRuleConcat(r);
                    const expanded = !!expandedIds[r.id];
                    const aliasName = (
                      r.output?.columnName ??
                      r.target?.columnName ??
                      ""
                    ).trim();

                    const draft = concatDrafts[r.id];
                    const concatRow = (draft ??
                      (r as any as SqlConcatRule)) as SqlConcatRule;
                    const previewText = ensureMinTwoInputs(
                      concatRow.inputs ?? [],
                      seedCol,
                    )
                      .map((v) =>
                        v.type === "column"
                          ? labelFor((v as any).col)
                          : String((v as any).value ?? ""),
                      )
                      .join("");

                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDropOnRule(r.id)}
                        >
                          {/* 1) Action (removed extra preview text here) */}
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <span
                                className="text-muted"
                                style={{
                                  cursor: "grab",
                                  width: 16,
                                  textAlign: "center",
                                  opacity: 0.7,
                                }}
                                title="Drag to reorder"
                                draggable
                                onDragStart={(e) => {
                                  onDragStartRule(r.id);
                                  e.dataTransfer.effectAllowed = "move";
                                  const row = (
                                    e.currentTarget as HTMLElement
                                  ).closest("tr");
                                  if (row)
                                    e.dataTransfer.setDragImage(row, 24, 12);
                                }}
                              >
                                <i className="fa fa-grip-vertical" />
                              </span>

                              {isConcat ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light"
                                  style={{
                                    borderRadius: 8,
                                    padding: "3px 8px",
                                  }}
                                  title={expanded ? "Collapse" : "Expand"}
                                  onClick={() => {
                                    if (!expanded) {
                                      // open draft on first expand
                                      const inputs = ensureMinTwoInputs(
                                        (r as any as SqlConcatRule).inputs ??
                                          [],
                                        seedCol,
                                      );
                                      setConcatDrafts((p) => ({
                                        ...p,
                                        [r.id]: {
                                          ...(r as SqlConcatRule),
                                          inputs,
                                          separator: "",
                                          nulls: "skip",
                                        },
                                      }));
                                      setEditingTextChip((p) => ({
                                        ...p,
                                        [r.id]: null,
                                      }));
                                      setEditingColChip((p) => ({
                                        ...p,
                                        [r.id]: null,
                                      }));
                                    }
                                    toggleExpanded(r.id);
                                  }}
                                >
                                  <i
                                    className={`fa fa-chevron-${expanded ? "down" : "right"}`}
                                  />
                                </button>
                              ) : (
                                <span style={{ width: 30 }} />
                              )}

                              <select
                                className="form-select form-select-sm"
                                value={r.op}
                                title={OP_HELP[r.op]}
                                onChange={(e) =>
                                  updateRule(r.id, {
                                    op: e.target.value as SqlDataPrepOp,
                                  } as any)
                                }
                              >
                                {opOptions.map((op) => (
                                  <option key={op} value={op}>
                                    {OP_LABEL[op]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {SPACER}
                          </td>

                          {/* 2) Options */}
                          <td>
                            {r.op === "fill_empty" ? (
                              <>
                                <div className="mb-2">
                                  <SqlColumnPicker
                                    value={r.target}
                                    onChange={(v) =>
                                      v &&
                                      updateRule(r.id, { target: v } as any)
                                    }
                                    columns={allColumnKeys}
                                    selectedColumns={selectedColumns}
                                    labelByKey={labelByKey}
                                    placeholder="Source column…"
                                    showSelectedBadge
                                    allowClear={false}
                                  />
                                </div>
                                <div className="text-muted small mt-2">
                                  {OP_HELP[r.op]}
                                </div>
                              </>
                            ) : r.op === "cast" ? (
                              <>
                                <div className="d-flex flex-column gap-2">
                                  <input
                                    className="form-control form-control-sm"
                                    value={(r as SqlCastRule).toType ?? ""}
                                    onChange={(e) =>
                                      updateRule(r.id, {
                                        toType: e.target.value,
                                      } as any)
                                    }
                                    placeholder="e.g., INT, DECIMAL(10,2), DATE"
                                  />
                                </div>
                                <div className="text-muted small mt-2">
                                  {OP_HELP[r.op]}
                                </div>
                              </>
                            ) : r.op === "normalize_text" ? (
                              <>
                                <select
                                  className="form-select form-select-sm"
                                  value={(r as SqlNormalizeTextRule).mode}
                                  onChange={(e) =>
                                    updateRule(r.id, {
                                      mode: e.target.value as any,
                                    } as any)
                                  }
                                >
                                  <option value="trim_lower">
                                    trim + lower
                                  </option>
                                  <option value="trim">trim</option>
                                  <option value="lower">lower</option>
                                  <option value="upper">upper</option>
                                </select>
                                <div className="text-muted small mt-2">
                                  {OP_HELP[r.op]}
                                </div>
                              </>
                            ) : r.op === "parse_date" ? (
                              <>
                                <input
                                  className="form-control form-control-sm"
                                  value={(r as SqlParseDateRule).format ?? ""}
                                  onChange={(e) =>
                                    updateRule(r.id, {
                                      format: e.target.value || null,
                                    } as any)
                                  }
                                  placeholder="Format (optional, e.g. yyyy-MM-dd)"
                                />
                                <div className="text-muted small mt-2">
                                  {OP_HELP[r.op]}
                                </div>
                              </>
                            ) : r.op === "date_part" ? (
                              <>
                                <select
                                  className="form-select form-select-sm"
                                  value={(r as SqlDatePartRule).part}
                                  onChange={(e) =>
                                    updateRule(r.id, {
                                      part: e.target
                                        .value as SqlDatePartRule["part"],
                                    } as any)
                                  }
                                >
                                  {DATE_PART_OPTIONS.map((part) => (
                                    <option key={part} value={part}>
                                      {part}
                                    </option>
                                  ))}
                                </select>
                                <div className="small text-muted mt-2">
                                  Extracts the selected date part from the date
                                  column.
                                </div>
                                <div className="text-muted small mt-2">
                                  {OP_HELP[r.op]}
                                </div>
                              </>
                            ) : r.op === "round" ? (
                              <>
                                <input
                                  type="number"
                                  min={0}
                                  className="form-control form-control-sm"
                                  value={String(
                                    (r as SqlRoundRule).decimals ?? 0,
                                  )}
                                  onChange={(e) =>
                                    updateRule(r.id, {
                                      decimals: Number(e.target.value),
                                    } as any)
                                  }
                                />
                                <div className="text-muted small mt-2">
                                  {OP_HELP[r.op]}
                                </div>
                              </>
                            ) : r.op === "concat" ? (
                              <>
                                <div className="small text-muted">
                                  {expanded
                                    ? "Editing below…"
                                    : "Expand to edit"}
                                </div>
                                <div className="text-muted small mt-2">
                                  {OP_HELP[r.op]}
                                </div>
                              </>
                            ) : (
                              <>{SPACER}</>
                            )}
                          </td>

                          {/* 3) Affected */}
                          <td>
                            {r.op === "fill_empty" ? (
                              <>
                                <div className="d-flex align-items-center gap-3 flex-wrap mb-2">
                                  <div className="form-check">
                                    <input
                                      className="form-check-input"
                                      type="radio"
                                      name={`fillmode-${r.id}`}
                                      id={`fillmode-value-${r.id}`}
                                      checked={!usingFallbackCol}
                                      onChange={() =>
                                        updateRule(r.id, {
                                          fallbackCol: null,
                                        } as any)
                                      }
                                    />
                                    <label
                                      className="form-check-label small"
                                      htmlFor={`fillmode-value-${r.id}`}
                                    >
                                      Literal
                                    </label>
                                  </div>

                                  <div className="form-check">
                                    <input
                                      className="form-check-input"
                                      type="radio"
                                      name={`fillmode-${r.id}`}
                                      id={`fillmode-col-${r.id}`}
                                      checked={usingFallbackCol}
                                      onChange={() => {
                                        const seed =
                                          rr.fallbackCol ??
                                          allColumns[0]?.key ??
                                          null;
                                        updateRule(r.id, {
                                          fallbackCol: seed,
                                        } as any);
                                      }}
                                    />
                                    <label
                                      className="form-check-label small"
                                      htmlFor={`fillmode-col-${r.id}`}
                                    >
                                      Column
                                    </label>
                                  </div>
                                </div>

                                {!usingFallbackCol ? (
                                  <input
                                    className="form-control form-control-sm"
                                    value={
                                      rr.value === null
                                        ? "null"
                                        : String(rr.value ?? "")
                                    }
                                    onChange={(e) =>
                                      updateRule(r.id, {
                                        value: parseScalar(e.target.value),
                                      } as any)
                                    }
                                    placeholder='e.g., 0  (or "Unknown", or null)'
                                  />
                                ) : (
                                  <SqlColumnPicker
                                    value={rr.fallbackCol ?? null}
                                    onChange={(v) =>
                                      updateRule(r.id, {
                                        fallbackCol: v,
                                      } as any)
                                    }
                                    columns={allColumnKeys}
                                    selectedColumns={selectedColumns}
                                    labelByKey={labelByKey}
                                    placeholder="Fallback column…"
                                    showSelectedBadge
                                  />
                                )}

                                <div className="small text-muted mt-2">
                                  Result: <code>{fillResult}</code>
                                </div>
                              </>
                            ) : r.op === "concat" ? (
                              <>
                                <div className="small text-muted">
                                  Result: <code>{previewText || "—"}</code>
                                </div>
                                {SPACER}
                              </>
                            ) : r.op === "date_part" ? (
                              <>
                                {dateColumnKeys.length > 0 ? (
                                  <SqlColumnPicker
                                    value={r.target}
                                    onChange={(v) =>
                                      v &&
                                      updateRule(r.id, { target: v } as any)
                                    }
                                    columns={dateColumnKeys}
                                    selectedColumns={selectedColumns}
                                    labelByKey={labelByKey}
                                    placeholder="Date column…"
                                    showSelectedBadge
                                    allowClear={false}
                                  />
                                ) : (
                                  <div className="text-muted small">
                                    No date/timestamp columns available.
                                  </div>
                                )}
                                {SPACER}
                              </>
                            ) : (
                              <>
                                <SqlColumnPicker
                                  value={r.target}
                                  onChange={(v) =>
                                    v && updateRule(r.id, { target: v } as any)
                                  }
                                  columns={allColumnKeys}
                                  selectedColumns={selectedColumns}
                                  labelByKey={labelByKey}
                                  placeholder="Affected column…"
                                  showSelectedBadge
                                  allowClear={false}
                                />
                                {SPACER}
                              </>
                            )}
                          </td>

                          {/* 4) Alias */}
                          <td>
                            <input
                              className="form-control form-control-sm"
                              value={aliasName}
                              onChange={(e) =>
                                updateRule(r.id, {
                                  outputName: e.target.value,
                                } as any)
                              }
                              placeholder="Alias"
                            />
                            {SPACER}
                          </td>

                          {/* remove */}
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => removeRule(r.id)}
                              title="Remove"
                              style={{
                                border: "none",
                                background: "transparent",
                                opacity: 0.65,
                                padding: "4px 8px",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.opacity = "1")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.opacity = "0.65")
                              }
                            >
                              <i className="fa fa-xmark" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Concat Builder */}
                        {isConcat && expanded && draft ? (
                          <tr>
                            <td colSpan={5} className="bg-light">
                              <div className="p-3">
                                <div className="d-flex align-items-center justify-content-between">
                                  <div style={{ fontWeight: 800 }}>
                                    Build combined value
                                  </div>
                                  <div className="d-flex align-items-center gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() => cancelConcatDraft(r.id)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-primary"
                                      onClick={() => applyConcatDraft(r.id)}
                                    >
                                      Done
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 border rounded bg-white p-3">
                                  <div className="small text-muted mb-2">
                                    Preview
                                  </div>
                                  <div className="mb-3">
                                    <code>{previewText || "—"}</code>
                                  </div>

                                  <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {ensureMinTwoInputs(
                                      draft.inputs ?? [],
                                      seedCol,
                                    ).map((v, idx) => {
                                      const isText = v.type === "literal";
                                      const isCol = v.type === "column";

                                      const textEditing =
                                        (editingTextChip[r.id] ?? null) === idx;
                                      const colEditing =
                                        (editingColChip[r.id] ?? null) === idx;
                                      const isEditing =
                                        textEditing || colEditing;

                                      const inputs = ensureMinTwoInputs(
                                        draft.inputs ?? [],
                                        seedCol,
                                      );
                                      const canRemove = inputs.length > 2;

                                      const removeAt = () => {
                                        if (!canRemove) return;
                                        const next = inputs.slice();
                                        next.splice(idx, 1);
                                        setConcatDrafts((p) => ({
                                          ...p,
                                          [r.id]: { ...draft, inputs: next },
                                        }));
                                        setEditingTextChip((p) => ({
                                          ...p,
                                          [r.id]: null,
                                        }));
                                        setEditingColChip((p) => ({
                                          ...p,
                                          [r.id]: null,
                                        }));
                                      };

                                      return (
                                        <span
                                          key={idx}
                                          className={`nc-pill ${idx === 0 ? "is-primary" : ""} ${
                                            isEditing ? "is-editing" : ""
                                          }`}
                                          draggable={!isEditing}
                                          onDragStart={() =>
                                            !isEditing &&
                                            setDragChip({
                                              ruleId: r.id,
                                              fromIdx: idx,
                                            })
                                          }
                                          onDragOver={(e) => {
                                            if (isEditing) return;
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = "move";
                                          }}
                                          onDrop={(e) => {
                                            if (isEditing) return;
                                            e.preventDefault();
                                            const d = dragChip;
                                            setDragChip(null);
                                            if (!d || d.ruleId !== r.id) return;
                                            moveChip(r.id, d.fromIdx, idx);
                                          }}
                                          title={
                                            !isEditing
                                              ? "Drag to reorder"
                                              : undefined
                                          }
                                        >
                                          <span
                                            className="nc-pill-grip"
                                            aria-hidden="true"
                                            title="Drag"
                                          >
                                            <i className="fa fa-grip-vertical" />
                                          </span>

                                          <span
                                            className="nc-pill-index"
                                            title={`Part ${idx + 1}`}
                                          >
                                            {idx + 1}
                                          </span>

                                          <span
                                            className="nc-pill-text"
                                            style={{ cursor: "default" }}
                                          >
                                            <div className="nc-pill-labelline">
                                              {isCol && colEditing ? (
                                                <div style={{ minWidth: 260 }}>
                                                  <SqlColumnPicker
                                                    value={
                                                      (v as any).col ?? null
                                                    }
                                                    onChange={(picked) => {
                                                      const cur =
                                                        ensureMinTwoInputs(
                                                          draft.inputs ?? [],
                                                          seedCol,
                                                        );
                                                      const next = cur.slice();
                                                      next[idx] = {
                                                        type: "column",
                                                        col:
                                                          picked ??
                                                          (v as any).col ??
                                                          ({
                                                            modelColumnId: null,
                                                            columnName: "",
                                                          } as SqlColumnKey),
                                                      } as any;
                                                      setConcatDrafts((p) => ({
                                                        ...p,
                                                        [r.id]: {
                                                          ...draft,
                                                          inputs: next,
                                                        },
                                                      }));
                                                      setEditingColChip(
                                                        (p) => ({
                                                          ...p,
                                                          [r.id]: null,
                                                        }),
                                                      );
                                                    }}
                                                    columns={allColumnKeys}
                                                    selectedColumns={
                                                      selectedColumns
                                                    }
                                                    labelByKey={labelByKey}
                                                    placeholder="Choose column…"
                                                    showSelectedBadge
                                                  />
                                                </div>
                                              ) : isText && textEditing ? (
                                                <input
                                                  className="nc-pill-input"
                                                  autoFocus
                                                  value={String(
                                                    (v as any).value ?? "",
                                                  )}
                                                  onChange={(e) => {
                                                    const cur =
                                                      ensureMinTwoInputs(
                                                        draft.inputs ?? [],
                                                        seedCol,
                                                      );
                                                    const next = cur.slice();
                                                    next[idx] = {
                                                      type: "literal",
                                                      value: e.target.value,
                                                    } as any;
                                                    setConcatDrafts((p) => ({
                                                      ...p,
                                                      [r.id]: {
                                                        ...draft,
                                                        inputs: next,
                                                      },
                                                    }));
                                                  }}
                                                  onBlur={() =>
                                                    setEditingTextChip((p) => ({
                                                      ...p,
                                                      [r.id]: null,
                                                    }))
                                                  }
                                                  onKeyDown={(e) => {
                                                    if (
                                                      e.key === "Enter" ||
                                                      e.key === "Escape"
                                                    )
                                                      (
                                                        e.currentTarget as any
                                                      ).blur();
                                                  }}
                                                  placeholder="Type text…"
                                                />
                                              ) : (
                                                <button
                                                  type="button"
                                                  className="btn btn-sm"
                                                  style={{
                                                    border: "none",
                                                    background: "transparent",
                                                    padding: 0,
                                                    textAlign: "left",
                                                    color: "inherit",
                                                  }}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (isCol) {
                                                      setEditingColChip(
                                                        (p) => ({
                                                          ...p,
                                                          [r.id]: idx,
                                                        }),
                                                      );
                                                      setEditingTextChip(
                                                        (p) => ({
                                                          ...p,
                                                          [r.id]: null,
                                                        }),
                                                      );
                                                    } else {
                                                      setEditingTextChip(
                                                        (p) => ({
                                                          ...p,
                                                          [r.id]: idx,
                                                        }),
                                                      );
                                                      setEditingColChip(
                                                        (p) => ({
                                                          ...p,
                                                          [r.id]: null,
                                                        }),
                                                      );
                                                    }
                                                  }}
                                                  title={
                                                    isCol
                                                      ? "Click to choose column"
                                                      : "Click to edit text"
                                                  }
                                                >
                                                  <span className="nc-pill-label">
                                                    {pillText(v)}
                                                  </span>
                                                </button>
                                              )}
                                            </div>

                                            <div className="nc-pill-orig">
                                              {isCol ? "Column" : "Text"}
                                            </div>
                                          </span>

                                          <button
                                            type="button"
                                            className="nc-pill-remove"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              removeAt();
                                            }}
                                            title={
                                              canRemove
                                                ? "Remove part"
                                                : "Need at least 2 parts"
                                            }
                                            aria-label="Remove part"
                                            style={
                                              !canRemove
                                                ? {
                                                    opacity: 0.25,
                                                    cursor: "not-allowed",
                                                  }
                                                : undefined
                                            }
                                          >
                                            <i className="fa fa-xmark" />
                                          </button>
                                        </span>
                                      );
                                    })}
                                  </div>

                                  <div className="mt-3 d-flex align-items-center gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => {
                                        const next = ensureMinTwoInputs(
                                          draft.inputs ?? [],
                                          seedCol,
                                        ).slice();
                                        next.push({
                                          type: "column",
                                          col: {
                                            modelColumnId: null,
                                            columnName: "",
                                          },
                                        } as any);
                                        setConcatDrafts((p) => ({
                                          ...p,
                                          [r.id]: { ...draft, inputs: next },
                                        }));
                                        setEditingColChip((p) => ({
                                          ...p,
                                          [r.id]: next.length - 1,
                                        }));
                                        setEditingTextChip((p) => ({
                                          ...p,
                                          [r.id]: null,
                                        }));
                                      }}
                                    >
                                      <i className="fa fa-plus me-1" /> Add
                                      column
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => {
                                        const next = ensureMinTwoInputs(
                                          draft.inputs ?? [],
                                          seedCol,
                                        ).slice();
                                        next.push({
                                          type: "literal",
                                          value: "",
                                        } as any);
                                        setConcatDrafts((p) => ({
                                          ...p,
                                          [r.id]: { ...draft, inputs: next },
                                        }));
                                        setEditingTextChip((p) => ({
                                          ...p,
                                          [r.id]: next.length - 1,
                                        }));
                                        setEditingColChip((p) => ({
                                          ...p,
                                          [r.id]: null,
                                        }));
                                      }}
                                    >
                                      <i className="fa fa-plus me-1" /> Add text
                                    </button>
                                  </div>

                                  <div className="mt-2 small text-muted">
                                    Tip: Drag pills to reorder. Click a pill to
                                    edit. No automatic spaces are inserted.
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {onNext || onSubmit ? (
        <div className="d-flex flex-column align-items-start mt-3 pt-3 border-top">
          <div className="d-flex align-items-center gap-2">
            {onNext ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={onNext}
              >
                Next
              </button>
            ) : null}
            {onSubmit ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onSubmit}
              >
                Save
              </button>
            ) : null}
          </div>
          <div className="text-muted small mt-1">Add filters next.</div>
        </div>
      ) : null}
    </div>
  );

  const useShell =
    typeof collapsed === "boolean" && typeof onToggleCollapsed === "function";
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
          aria-label="Hide Data Prep"
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
      id="data-prep"
      title="Data Prep"
      subtitle="Create derived fields used throughout the query."
      collapsed={collapsed!}
      onToggleCollapsed={onToggleCollapsed!}
      collapsible={collapsible}
      iconClass="fa-soap"
      count={model.rules.length > 0 ? model.rules.length : undefined}
      right={right}
      helpAction={helpAction}
    >
      {body}
    </SectionShell>
  );
};

export default DataPrepSection;
