import React, { useMemo } from "react";
import type {
  SqlAggregationsJson,
  SqlColumnRef,
  SqlDataPrepRule,
  SqlFilterNode,
  SqlFilterOp,
  SqlQueryJson,
  SqlSort,
  InListValue,
} from "../../model/sqlJson";
import { labelFor } from "../../model/sqlJson";
import type { ToolKeyV2 } from "./BuilderToolRailV2";

type DomainOption = { id: string; name: string };

type ReadinessLevel = "success" | "warning" | "info";
type ReadinessStatus = {
  level: ReadinessLevel;
  title: string;
  detail?: string;
  fixTool?: ToolKeyV2;
  fixLabel?: string;
};

const FILTER_OP_LABEL: Record<SqlFilterOp, string> = {
  equals: "=",
  not_equals: "!=",
  contains: "contains",
  starts_with: "starts with",
  in: "in",
  not_in: "not in",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  between: "between",
  is_null: "is null",
  is_not_null: "is not null",
};

const formatValue = (value: unknown): string => {
  if (value == null) return "null";
  if (typeof value === "string") return value.length > 26 ? `${value.slice(0, 26)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(", ");
  return String(value);
};

const formatFilterValue = (op: SqlFilterOp, value: unknown): string => {
  if (op === "between" && Array.isArray(value) && value.length >= 2) {
    return `${formatValue(value[0])} and ${formatValue(value[1])}`;
  }

  if (op === "is_null" || op === "is_not_null") {
    return "";
  }

  if (op === "in" || op === "not_in") {
    const list = value as InListValue | null;
    if (list && typeof list === "object" && "mode" in list) {
      if (list.mode === "manual") return `${list.values.length} values`;
      if (list.mode === "cohort") return "cohort list";
      if (list.mode === "value_override") return "value override list";
    }
    if (Array.isArray(value)) return `${value.length} values`;
  }

  return formatValue(value);
};

const summarizeCondition = (node: Extract<SqlFilterNode, { type: "condition" }>): string => {
  const fieldLabel = labelFor(node.field);
  const opLabel = FILTER_OP_LABEL[node.op] ?? node.op;
  if (node.op === "is_null" || node.op === "is_not_null") {
    return `${fieldLabel} ${opLabel}`;
  }
  const valueLabel = formatFilterValue(node.op, node.value);
  return `${fieldLabel} ${opLabel} ${valueLabel}`;
};

const countFilterConditions = (node: SqlFilterNode | null | undefined): number => {
  if (!node) return 0;
  if (node.type === "condition") return 1;
  return node.children.reduce((acc, child) => acc + countFilterConditions(child), 0);
};

const collectConditionSnippets = (
  node: SqlFilterNode | null | undefined,
  limit: number
): string[] => {
  if (!node || limit <= 0) return [];
  if (node.type === "condition") return [summarizeCondition(node)].slice(0, limit);

  const out: string[] = [];
  for (const child of node.children) {
    if (out.length >= limit) break;
    out.push(...collectConditionSnippets(child, limit - out.length));
  }
  return out;
};

const summarizeDataPrepRule = (rule: SqlDataPrepRule): string => {
  const target = rule.target?.columnName ?? "field";
  const output = rule.output?.columnName ?? target;
  const ruleAny = rule as any;

  switch (rule.op) {
    case "fill_empty": {
      const fallback =
        ruleAny.fallbackCol?.columnName ??
        (ruleAny.value != null ? formatValue(ruleAny.value) : null);
      return fallback
        ? `Fill empty ${target} -> ${output} (${fallback})`
        : `Fill empty ${target} -> ${output}`;
    }
    case "cast":
      return `Cast ${target} -> ${ruleAny.toType ?? "type"}`;
    case "normalize_text":
      return `Normalize ${target} (${ruleAny.mode ?? "text"})`;
    case "parse_date":
      return `Parse date ${target}`;
    case "date_part":
      return `Date part ${ruleAny.part ?? "part"} from ${target}`;
    case "round":
      return `Round ${target} (${ruleAny.decimals ?? 0})`;
    case "concat": {
      const inputs = Array.isArray(ruleAny.inputs)
        ? ruleAny.inputs
            .map((input: any) =>
              input?.type === "column" ? input.col?.columnName ?? "col" : formatValue(input?.value)
            )
            .join(", ")
        : "fields";
      return `Concat ${inputs} -> ${output}`;
    }
    default:
      return `Transform ${target}`;
  }
};

const summarizeAggs = (aggs: SqlAggregationsJson | null | undefined): string => {
  const metrics = aggs?.metrics ?? [];
  const groupBy = aggs?.groupBy ?? [];
  const derived = aggs?.derivedMetrics ?? [];
  return `Metrics: ${metrics.length}, Derived: ${derived.length}, Group by: ${groupBy.length}`;
};

const summarizeSorting = (sorting: SqlSort[]): string[] => {
  return sorting.map((s) => `${labelFor(s.col)} ${s.dir.toUpperCase()}`);
};

const formatColLabel = (col: SqlColumnRef): string => {
  const alias = (col.alias ?? "").trim();
  return alias || labelFor(col);
};

export function BuilderSummaryCardV2(props: {
  sqlJson: SqlQueryJson;
  domainOptions: DomainOption[];
  onOpenTool: (k: ToolKeyV2) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { sqlJson, domainOptions, onOpenTool, collapsed, onToggleCollapsed } = props;

  const domainName = useMemo(() => {
    return domainOptions.find((d) => Number(d.id) === sqlJson.domainId)?.name ?? null;
  }, [domainOptions, sqlJson.domainId]);

  const selectedCols = sqlJson.columns ?? [];

  const columnLabels = useMemo(() => {
    return selectedCols.map(formatColLabel);
  }, [selectedCols]);

  const dataPrepRules = useMemo(() => {
    return (sqlJson.dataPrep?.rules ?? []).filter((r) => r && r.enabled !== false);
  }, [sqlJson.dataPrep]);

  const dataPrepSummaries = useMemo(() => {
    return dataPrepRules.map(summarizeDataPrepRule);
  }, [dataPrepRules]);

  const filterCount = useMemo(() => countFilterConditions(sqlJson.filters ?? null), [sqlJson.filters]);
  const filterSnippets = useMemo(
    () => collectConditionSnippets(sqlJson.filters ?? null, 2),
    [sqlJson.filters]
  );

  const aggsSummary = useMemo(() => summarizeAggs(sqlJson.aggs ?? null), [sqlJson.aggs]);
  const sortingSummary = useMemo(() => summarizeSorting(sqlJson.sorting ?? []), [sqlJson.sorting]);
  const aggsComplete =
    (sqlJson.aggs?.metrics?.length ?? 0) > 0 || (sqlJson.aggs?.groupBy?.length ?? 0) > 0;

  const readiness = useMemo<ReadinessStatus>(() => {
    if (!sqlJson.domainId) {
      return {
        level: "warning",
        title: "Missing Domain",
        detail: "Select a domain to begin.",
        fixTool: "domain",
        fixLabel: "Select domain",
      };
    }

    if (!selectedCols.length && !aggsComplete) {
      return {
        level: "warning",
        title: "No columns selected",
        detail: "Choose at least one column.",
        fixTool: "columns",
        fixLabel: "Choose columns",
      };
    }

    if (sqlJson.filters && filterCount === 0) {
      return {
        level: "info",
        title: "Filters incomplete",
        detail: "Filters are present but missing conditions.",
        fixTool: "filters",
        fixLabel: "Review filters",
      };
    }

    return {
      level: "success",
      title: "Ready",
      detail:
        selectedCols.length === 0 && aggsComplete
          ? "Aggregate metric selected. No detail columns are required."
          : filterCount === 0
          ? "Domain + columns selected. Filters are optional but highly encouraged to limit results."
          : "Domain + columns selected. Filters and aggs are optional.",
    };
  }, [sqlJson.domainId, sqlJson.filters, filterCount, selectedCols.length, aggsComplete]);

  const badgeClass =
    readiness.level === "success"
      ? "bg-success"
      : readiness.level === "warning"
        ? "bg-warning text-dark"
        : "bg-secondary";

  const renderRow = (opts: {
    title: string;
    content: React.ReactNode;
    onEdit?: () => void;
    editLabel?: string;
    complete?: boolean;
  }) => {
    const clickable = Boolean(opts.onEdit);
    const contentNode =
      typeof opts.content === "string" ? (
        <div className="small text-muted">{opts.content}</div>
      ) : (
        <div>{opts.content}</div>
      );

    return (
      <div
        className={`d-flex align-items-start justify-content-between ncqv2-summary-row ncqv2-row ${
          clickable ? "is-clickable" : ""
        }`}
        onClick={opts.onEdit}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (!clickable) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            opts.onEdit?.();
          }
        }}
      >
        <div className="pe-2">
          <div className={`fw-semibold small ${clickable ? "ncqv2-clickable" : ""}`}>
            {opts.complete ? (
              <i className="fa fa-circle-check text-success me-2" aria-hidden="true" />
            ) : null}
            {opts.title}
          </div>
          {contentNode}
        </div>
        {clickable ? (
          <button
            type="button"
            className="btn btn-link p-0 small text-decoration-none"
            aria-label={`${opts.title} edit`}
            onClick={(e) => {
              e.stopPropagation();
              opts.onEdit?.();
            }}
          >
            {opts.editLabel ?? "Edit"}
          </button>
        ) : null}
      </div>
    );
  };

  const distinctOn = sqlJson.distinct !== false;
  const distinctLabel = distinctOn ? "On" : "Off";

  const columnChips = columnLabels.slice(0, 6);
  const columnExtra = columnLabels.length - columnChips.length;

  const dataPrepChips = dataPrepSummaries.slice(0, 4);
  const dataPrepExtra = dataPrepSummaries.length - dataPrepChips.length;

  const sortingChips = sortingSummary.slice(0, 2);
  const sortingExtra = sortingSummary.length - sortingChips.length;

  const domainComplete = Boolean(sqlJson.domainId);
  const columnsComplete = selectedCols.length > 0;
  const dataPrepComplete = dataPrepRules.length > 0;
  const filtersComplete = filterCount > 0;
  const sortingComplete = sortingSummary.length > 0;

  return (
    <div className="card shadow-sm ncqv2-summary-card">
      <div className="card-body py-3">
        <div className="d-flex align-items-center justify-content-between">
          <button
            type="button"
            className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand summary" : "Collapse summary"}
            style={{ minWidth: 0 }}
          >
            <div className="d-flex align-items-center gap-2" style={{ minWidth: 42 }}>
              <i
                className={`fa ${collapsed ? "fa-chevron-right" : "fa-chevron-down"}`}
                style={{ width: 14, color: "var(--bs-secondary-color)" }}
                aria-hidden="true"
              />
              <i
                className="fa fa-clipboard-list"
                style={{ color: "var(--bs-secondary-color)", fontSize: "0.95rem" }}
                aria-hidden="true"
              />
            </div>
            <span className="fw-semibold text-dark" style={{ fontSize: "0.95rem" }}>
              Summary
            </span>
          </button>
          {!collapsed ? <div className="text-muted small">Click a section to edit</div> : null}
        </div>

        {!collapsed ? (
          <>
            <div className="d-flex align-items-center justify-content-between ncqv2-summary-row">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className={`badge ${badgeClass}`} title={readiness.title}>
                  {readiness.title}
                </span>
                {readiness.detail ? <span className="small text-muted">{readiness.detail}</span> : null}
              </div>
              {readiness.fixTool ? (
                <button
                  type="button"
                  className="btn btn-link p-0 small text-decoration-none"
                  onClick={() => onOpenTool(readiness.fixTool!)}
                >
                  {readiness.fixLabel ?? "Fix"}
                </button>
              ) : null}
            </div>

            {renderRow({
              title: "Domain",
              content: domainName ? domainName : "Not selected",
              onEdit: () => onOpenTool("domain"),
              complete: domainComplete,
            })}

            {renderRow({
              title: "Distinct",
              content: distinctLabel,
              onEdit: () => onOpenTool("domain"),
              editLabel: "Toggle",
            })}

            {renderRow({
              title: "Columns",
              content:
                columnChips.length > 0 ? (
                  <div className="d-flex flex-wrap gap-1">
                    {columnChips.map((label, idx) => (
                      <span
                        key={`${label}-${idx}`}
                        className="badge rounded-pill text-bg-light border"
                        title={label}
                      >
                        {label}
                      </span>
                    ))}
                    {columnExtra > 0 ? (
                      <span className="badge rounded-pill text-bg-light border" title={`${columnExtra} more columns`}>
                        +{columnExtra} more
                      </span>
                    ) : null}
                  </div>
                ) : (
                  aggsComplete ? "Aggregate output only" : "None selected"
                ),
              onEdit: () => onOpenTool("columns"),
              complete: columnsComplete,
            })}

            {renderRow({
              title: "Data Prep",
              content:
                dataPrepChips.length > 0 ? (
                  <div className="d-flex flex-wrap gap-1">
                    {dataPrepChips.map((label, idx) => (
                      <span
                        key={`${label}-${idx}`}
                        className="badge rounded-pill text-bg-light border"
                        title={label}
                      >
                        {label}
                      </span>
                    ))}
                    {dataPrepExtra > 0 ? (
                      <span className="badge rounded-pill text-bg-light border" title={`${dataPrepExtra} more rules`}>
                        +{dataPrepExtra} more
                      </span>
                    ) : null}
                  </div>
                ) : (
                  "None"
                ),
              onEdit: () => onOpenTool("dataprep"),
              complete: dataPrepComplete,
            })}

            {renderRow({
              title: "Filters",
              content:
                filterCount > 0 ? (
                  <div className="d-flex flex-column gap-1">
                    <div className="small text-muted">{`${filterCount} condition${filterCount === 1 ? "" : "s"}`}</div>
                    {filterSnippets.map((snippet, idx) => (
                      <div key={`${snippet}-${idx}`} className="small text-muted" title={snippet}>
                        {snippet}
                      </div>
                    ))}
                  </div>
                ) : (
                  "None"
                ),
              onEdit: () => onOpenTool("filters"),
              complete: filtersComplete,
            })}

            {renderRow({
              title: "Aggs",
              content: aggsSummary,
              onEdit: () => onOpenTool("aggs"),
              complete: aggsComplete,
            })}

            {renderRow({
              title: "Sorting",
              content:
                sortingChips.length > 0 ? (
                  <div className="d-flex flex-wrap gap-1">
                    {sortingChips.map((label, idx) => (
                      <span
                        key={`${label}-${idx}`}
                        className="badge rounded-pill text-bg-light border"
                        title={label}
                      >
                        {label}
                      </span>
                    ))}
                    {sortingExtra > 0 ? (
                      <span className="badge rounded-pill text-bg-light border" title={`${sortingExtra} more sort specs`}>
                        +{sortingExtra} more
                      </span>
                    ) : null}
                  </div>
                ) : (
                  "None"
                ),
              onEdit: () => onOpenTool("sorting"),
              complete: sortingComplete,
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}
