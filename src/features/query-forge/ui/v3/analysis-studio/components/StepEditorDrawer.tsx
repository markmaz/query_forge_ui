import { useEffect, useMemo, useState } from "react";

import type {
  AnalysisNode,
  AnalysisNodeConfig,
  AnalysisNodeConfigByType,
  FilterGroupNode,
  MetricAggregation,
  MetricConfig,
  SortConfig,
  StudioDomainSummary,
  StudioField,
} from "../model/analysisTypes";
import {
  createFilterGroupNode,
  createMetric,
  createSort,
  getFilterRoot,
  NODE_TYPE_LABELS,
  toFilterConfig,
} from "../model/analysisUtils";
import type { DomainColumnRef } from "../../../../model/domainCatalog";
import type { SqlColumnKey, SqlFilterNode, SqlFilterOp, SqlSort } from "../../../../model/sqlJson";
import { FiltersSection } from "../../../components/FiltersSection";
import { ColumnsSection } from "../../../components/ColumnsSection";
import { SortingSection } from "../../../components/SortingSection";

type StepEditorDrawerProps = {
  isOpen: boolean;
  node: AnalysisNode | null;
  domains: StudioDomainSummary[];
  activeDomainId: number | null;
  availableFields: StudioField[];
  onClose: () => void;
  onSave: (nodeId: string, config: AnalysisNodeConfig) => void;
};

type FieldOption = {
  value: string;
  label: string;
  path: string;
  allowedAggregations: MetricAggregation[];
};

const DEFAULT_AGGREGATIONS: MetricAggregation[] = ["sum", "avg", "count", "min", "max"];
const STEP_EDITOR_DESCRIPTIONS: Record<AnalysisNode["type"], string> = {
  domain: "Choose the domain context that anchors this pipeline.",
  filter: "Define row constraints with explicit field conditions.",
  select: "Pick projected fields for result shape and readability.",
  group: "Set grouping dimensions to establish analytical grain.",
  metric: "Configure KPI calculations and business-ready aliases.",
  sort: "Rank output rows by signal strength or priority.",
  limit: "Control the result size for exploration and export.",
};

function newEditorId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function cloneConfig(config: AnalysisNodeConfig): AnalysisNodeConfig {
  return JSON.parse(JSON.stringify(config)) as AnalysisNodeConfig;
}

function toggleField(fields: string[], field: string): string[] {
  return fields.includes(field) ? fields.filter((value) => value !== field) : [...fields, field];
}

function toMetricAggregation(value: string): MetricAggregation | null {
  const normalized = value.toLowerCase();
  if (normalized === "count_distinct") return "count";
  if (normalized === "sum" || normalized === "avg" || normalized === "count" || normalized === "min" || normalized === "max") {
    return normalized;
  }
  return null;
}

function toFieldOptions(fields: StudioField[]): FieldOption[] {
  return fields.map((field) => {
    const allowed = (field.allowedAggregations ?? [])
      .map((aggregation) => toMetricAggregation(String(aggregation)))
      .filter((aggregation): aggregation is MetricAggregation => Boolean(aggregation));

    return {
      value: field.path,
      label: field.label,
      path: field.path,
      allowedAggregations: allowed.length > 0 ? Array.from(new Set(allowed)) : DEFAULT_AGGREGATIONS,
    };
  });
}

function findOption(options: FieldOption[], value: string): FieldOption | null {
  return options.find((option) => option.value === value) ?? null;
}

function normalizeMetricAggregation(aggregation: MetricAggregation, selectedOption: FieldOption | null): MetricAggregation {
  if (!selectedOption) return aggregation;
  return selectedOption.allowedAggregations.includes(aggregation)
    ? aggregation
    : selectedOption.allowedAggregations[0] ?? "count";
}

const V3_TO_SQL_OP: Record<string, SqlFilterOp> = {
  "=": "equals",
  "!=": "not_equals",
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte",
  contains: "contains",
};

const SQL_TO_V3_OP: Record<string, "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains"> = {
  equals: "=",
  not_equals: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  contains: "contains",
  starts_with: "contains",
  in: "contains",
  not_in: "contains",
  between: "contains",
  is_null: "=",
  is_not_null: "!=",
};

function toSqlFilterNode(node: FilterGroupNode): SqlFilterNode | null {
  const walk = (value: FilterGroupNode | { type: "condition"; id: string; field: string; operator: string; value: string }): SqlFilterNode | null => {
    if (value.type === "condition") {
      const trimmedField = value.field?.trim();
      const trimmedValue = value.value?.trim();
      if (!trimmedField || !trimmedValue) return null;
      return {
        type: "condition",
        id: value.id,
        field: { modelColumnId: null, workspaceTableId: null, columnName: trimmedField },
        op: V3_TO_SQL_OP[value.operator] ?? "equals",
        value: trimmedValue,
      };
    }

    const children = value.children
      .map((child) => walk(child as any))
      .filter((child): child is SqlFilterNode => Boolean(child));
    if (!children.length) return null;

    return {
      type: "group",
      id: value.id || "root",
      match: value.match,
      children,
    };
  };

  return walk(node);
}

function fromSqlFilterNode(node: SqlFilterNode | null | undefined, fallbackField: string): FilterGroupNode {
  if (!node) {
    return createFilterGroupNode(undefined, [
      { type: "condition", id: newEditorId("cond"), field: fallbackField, operator: "=", value: "" },
    ]);
  }

  const walk = (value: SqlFilterNode): FilterGroupNode | { type: "condition"; id: string; field: string; operator: "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains"; value: string } => {
    if (value.type === "condition") {
      return {
        type: "condition",
        id: value.id || newEditorId("cond"),
        field: value.field?.columnName ?? fallbackField,
        operator: SQL_TO_V3_OP[value.op] ?? "=",
        value: typeof value.value === "string" ? value.value : String(value.value ?? ""),
      };
    }

    const children = value.children
      .map((child) => walk(child))
      .filter(Boolean) as Array<FilterGroupNode | { type: "condition"; id: string; field: string; operator: "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains"; value: string }>;

    return {
      type: "group",
      id: value.id || newEditorId("grp"),
      match: value.match === "or" ? "or" : "and",
      children:
        children.length > 0
          ? children
          : [{ type: "condition", id: newEditorId("cond"), field: fallbackField, operator: "=", value: "" }],
    };
  };

  const converted = walk(node);
  if (converted.type === "group") return converted;
  return createFilterGroupNode(undefined, [converted]);
}

export function StepEditorDrawer(props: StepEditorDrawerProps) {
  const { isOpen, node, domains, activeDomainId, availableFields, onClose, onSave } = props;
  const [draftConfig, setDraftConfig] = useState<AnalysisNodeConfig | null>(null);
  const [columnsSearch, setColumnsSearch] = useState("");
  const [columnsPage, setColumnsPage] = useState(1);

  const fieldOptions = useMemo(() => toFieldOptions(availableFields), [availableFields]);

  const selectedDomainId = useMemo(() => {
    if (!node || node.type !== "domain" || !draftConfig) return null;
    const config = draftConfig as AnalysisNodeConfigByType["domain"];
    return config.domainId;
  }, [draftConfig, node]);

  useEffect(() => {
    if (!node) {
      setDraftConfig(null);
      return;
    }
    setDraftConfig(cloneConfig(node.config));
  }, [node]);

  const isReady = Boolean(isOpen && node && draftConfig);

  const activeDomainForRows = useMemo(() => {
    if (node && node.type === "domain" && draftConfig) {
      const cfg = draftConfig as AnalysisNodeConfigByType["domain"];
      return domains.find((domain) => domain.id === cfg.domainId) ?? null;
    }
    return domains.find((domain) => domain.id === activeDomainId) ?? null;
  }, [domains, draftConfig, node, activeDomainId]);

  const domainColumnRows = useMemo<DomainColumnRef[]>(() => {
    const domainId = activeDomainForRows?.id ?? -1;
    const domainName = activeDomainForRows?.label ?? "Domain";

    return availableFields.map((field, index) => {
      const parts = field.path.split(".");
      const tableAlias = parts.length > 1 ? parts[0] : "domain";
      const columnName = parts.length > 1 ? parts.slice(1).join(".") : field.path;
      const workspaceTableId = index + 1;

      return {
        modelColumnId: typeof field.id === "number" ? field.id : null,
        identityKey: `field:${field.path}`,
        columnName,
        modelTableName: tableAlias,
        fullName: field.path,
        tableAlias,
        columnLabel: field.label,
        dataType: field.dataType ?? "string",
        nullable: true,
        description: undefined,
        workspaceTableId,
        modelTableId: workspaceTableId,
        baseTableName: tableAlias,
        schemaName: "studio",
        catalogName: "query_forge",
        domainId,
        domainName,
      };
    });
  }, [activeDomainForRows, availableFields]);

  const rowsByIdentity = useMemo(
    () => new Map(domainColumnRows.map((row) => [row.identityKey, row])),
    [domainColumnRows],
  );
  const rowsByPath = useMemo(
    () => new Map(domainColumnRows.map((row) => [row.fullName, row])),
    [domainColumnRows],
  );

  const filterSortColumns = useMemo<SqlColumnKey[]>(
    () =>
      domainColumnRows.map((row) => ({
        modelColumnId: row.modelColumnId,
        workspaceTableId: row.workspaceTableId,
        columnName: row.fullName,
      })),
    [domainColumnRows],
  );

  useEffect(() => {
    setColumnsSearch("");
    setColumnsPage(1);
  }, [node?.id, node?.type]);

  if (!isReady || !node || !draftConfig) return null;
  const usesLegacyV2Drawer = node.type === "filter" || node.type === "select" || node.type === "sort";

  const defaultFilterField = fieldOptions[0]?.path ?? "";
  const filterValue = node.type === "filter"
    ? toSqlFilterNode(getFilterRoot(draftConfig as AnalysisNodeConfigByType["filter"]))
    : null;

  const selectConfig =
    node.type === "select" ? (draftConfig as AnalysisNodeConfigByType["select"]) : null;
  const selectedSelectKeys = selectConfig
    ? selectConfig.fields.map((path) => rowsByPath.get(path)?.identityKey ?? `field:${path}`)
    : [];
  const columnsJsonValue = selectConfig
    ? selectConfig.fields.map((path) => {
        const row = rowsByPath.get(path);
        return {
          modelColumnId: row?.modelColumnId ?? null,
          workspaceTableId: row?.workspaceTableId ?? null,
          columnName: row?.columnName ?? path,
          modelTableName: row?.modelTableName ?? null,
          fullName: path,
          tableAlias: row?.tableAlias ?? null,
          dataType: row?.dataType ?? null,
          alias: null,
        };
      })
    : [];

  const sortValue: SqlSort[] =
    node.type === "sort"
      ? (draftConfig as AnalysisNodeConfigByType["sort"]).sorts.map((sort) => ({
          col: { modelColumnId: null, workspaceTableId: null, columnName: sort.field },
          dir: sort.direction,
        }))
      : [];

  const onSaveClick = () => {
    onSave(node.id, draftConfig);
    onClose();
  };

  const legacyV2Body = usesLegacyV2Drawer ? (
    <>
      {node.type === "filter" ? (
        <div className="stepDrawerLegacyMount stepDrawerLegacyMount--filters">
          <FiltersSection
            collapsed={false}
            onToggleCollapsed={() => {}}
            collapsible={false}
            selectedColumns={filterSortColumns}
            allColumns={filterSortColumns}
            value={filterValue}
            onChange={(nextFilter) => {
              const nextRoot = fromSqlFilterNode(nextFilter, defaultFilterField);
              setDraftConfig(toFilterConfig(nextRoot));
            }}
          />
        </div>
      ) : null}

      {node.type === "select" ? (
        <div className="stepDrawerLegacyMount stepDrawerLegacyMount--columns">
          <ColumnsSection
            collapsed={false}
            onToggleCollapsed={() => {}}
            collapsible={false}
            rows={domainColumnRows}
            searchTerm={columnsSearch}
            onChangeSearch={setColumnsSearch}
            selectedColumnKeys={selectedSelectKeys}
            onToggleColumn={(identityKey) => {
              const row = rowsByIdentity.get(identityKey);
              if (!row || !selectConfig) return;
              const nextFields = toggleField(selectConfig.fields, row.fullName);
              setDraftConfig({ fields: nextFields });
            }}
            onRemoveSelected={(identityKey) => {
              const row = rowsByIdentity.get(identityKey);
              if (!row || !selectConfig) return;
              setDraftConfig({ fields: selectConfig.fields.filter((field) => field !== row.fullName) });
            }}
            pageSize={25}
            currentPage={columnsPage}
            onChangePage={setColumnsPage}
            loading={false}
            error={undefined}
            total={domainColumnRows.length}
            domainId={activeDomainForRows?.id ?? null}
            columnsJson={columnsJsonValue}
            onColumnsJsonChange={(nextCols) => {
              if (!selectConfig) return;
              const nextPaths = nextCols
                .map((col) => {
                  if (col.fullName && rowsByPath.has(col.fullName)) return col.fullName;
                  const byWorkspace = domainColumnRows.find(
                    (row) =>
                      row.workspaceTableId === col.workspaceTableId &&
                      (row.columnName === col.columnName || row.fullName === col.columnName),
                  );
                  if (byWorkspace) return byWorkspace.fullName;
                  if (rowsByPath.has(col.columnName)) return col.columnName;
                  return "";
                })
                .filter((value): value is string => Boolean(value));

              setDraftConfig({ fields: Array.from(new Set(nextPaths)) });
            }}
          />
        </div>
      ) : null}

      {node.type === "sort" ? (
        <div className="stepDrawerLegacyMount stepDrawerLegacyMount--sort">
          <SortingSection
            collapsed={false}
            onToggleCollapsed={() => {}}
            collapsible={false}
            selectedColumns={filterSortColumns}
            allColumns={filterSortColumns}
            value={sortValue}
            onChange={(nextSorts) => {
              const current = (draftConfig as AnalysisNodeConfigByType["sort"]).sorts;
              setDraftConfig({
                sorts: nextSorts.map((item, index) => ({
                  id: current[index]?.id ?? createSort().id,
                  field: item.col.columnName,
                  direction: item.dir,
                })),
              });
            }}
          />
        </div>
      ) : null}
    </>
  ) : null;

  if (usesLegacyV2Drawer) {
    return (
      <div className="ncqv2-drawer-layer is-open stepDrawerV2Layer" aria-hidden={false}>
        <div className="ncqv2-drawer-backdrop" onClick={onClose} />
        <aside className="ncqv2-drawer stepDrawerV2Legacy" role="dialog" aria-label="Step editor">
          <div className="ncqv2-drawer-content stepDrawerV2Legacy__content">
            <header className="stepDrawerV2Legacy__header">
              <div className="stepDrawer__titleBlock">
                <span className={`stepDrawer__typePill is-${node.type}`}>{NODE_TYPE_LABELS[node.type]}</span>
                <div>
                  <h3>Step Editor</h3>
                  <p>{STEP_EDITOR_DESCRIPTIONS[node.type]}</p>
                </div>
              </div>
              <button type="button" className="stepDrawer__closeBtn" onClick={onClose} aria-label="Close step editor">
                <i className="fa fa-xmark" aria-hidden="true" />
              </button>
            </header>
            <div className="stepDrawerV2Legacy__body">{legacyV2Body}</div>
            <footer className="stepDrawerV2Legacy__footer">
              <button type="button" className="analysisBtn analysisBtn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="analysisBtn analysisBtn--primary" onClick={onSaveClick}>
                Save Step
              </button>
            </footer>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="stepDrawer" role="dialog" aria-modal="true" aria-label="Step editor">
      <div className="stepDrawer__backdrop" onClick={onClose} />
      <div className="stepDrawer__panel">
        <header className="stepDrawer__header">
          <div className="stepDrawer__titleBlock">
            <span className={`stepDrawer__typePill is-${node.type}`}>{NODE_TYPE_LABELS[node.type]}</span>
            <div>
              <h3>Step Editor</h3>
              <p>{STEP_EDITOR_DESCRIPTIONS[node.type]}</p>
            </div>
          </div>
          <button type="button" className="stepDrawer__closeBtn" onClick={onClose} aria-label="Close step editor">
            <i className="fa fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="stepDrawer__body">
          {node.type === "domain" ? (
            <section className="stepDrawerCard stepDrawerCard--domain">
              <div className="stepDrawerCard__header">
                <div className="stepDrawerCard__title">
                  <span className="stepDrawerCard__icon" aria-hidden="true">
                    <i className="fa fa-layer-group" />
                  </span>
                  <div>
                    <h4>Domain</h4>
                    <p>Select the business domain for this analysis pipeline.</p>
                  </div>
                </div>
              </div>
              <label className="analysisField">
                <span>Select domain</span>
                <select
                  value={selectedDomainId ?? ""}
                  onChange={(event) => {
                    const selectedId = Number(event.target.value);
                    const selected = domains.find((domain) => domain.id === selectedId) ?? null;
                    setDraftConfig({
                      domainId: selected?.id ?? null,
                      domainName: selected?.label ?? "",
                      domainKey: selected?.key ?? undefined,
                      description: selected?.description ?? undefined,
                    });
                  }}
                >
                  <option value="">Select a domain</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          ) : null}

          {node.type === "group" ? (
            <section className="stepDrawerCard stepDrawerCard--fields">
              <div className="stepDrawerCard__header">
                <div className="stepDrawerCard__title">
                  <span className="stepDrawerCard__icon" aria-hidden="true">
                    <i className="fa fa-diagram-project" />
                  </span>
                  <div>
                    <h4>Group Fields</h4>
                    <p>Choose the fields that define grouping grain.</p>
                  </div>
                </div>
              </div>
              <div className="stepEditorGroup">
                <div className="stepEditorChecks">
                  {fieldOptions.map((field) => {
                    const config = draftConfig as AnalysisNodeConfigByType["group"];
                    const checked = config.fields.includes(field.value);

                    return (
                      <label key={field.path}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setDraftConfig({ fields: toggleField(config.fields, field.value) });
                          }}
                        />
                        <span>{field.label}</span>
                        <small className="analysisFieldOptionPath">{field.path}</small>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {node.type === "metric" ? (
            <section className="stepDrawerCard stepDrawerCard--metric">
              <div className="stepDrawerCard__header">
                <div className="stepDrawerCard__title">
                  <span className="stepDrawerCard__icon" aria-hidden="true">
                    <i className="fa fa-chart-line" />
                  </span>
                  <div>
                    <h4>Metrics</h4>
                    <p>Add one or more aggregations for KPI output.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="analysisBtn analysisBtn--ghost stepDrawerCard__headerAction"
                  onClick={() => {
                    const config = draftConfig as AnalysisNodeConfigByType["metric"];
                    setDraftConfig({ metrics: [...config.metrics, createMetric()] });
                  }}
                >
                  + Metric
                </button>
              </div>
              <div className="stepEditorGroup">
                {(draftConfig as AnalysisNodeConfigByType["metric"]).metrics.map((metric, index) => {
                  const selectedOption = findOption(fieldOptions, metric.field);
                  const allowedAggregations = selectedOption?.allowedAggregations ?? DEFAULT_AGGREGATIONS;
                  const selectedAggregation = normalizeMetricAggregation(metric.aggregation, selectedOption);

                  return (
                    <div className="stepEditorRow stepEditorRow--metric" key={metric.id}>
                      <label className="stepEditorControl">
                        <span>Aggregation</span>
                        <select
                          value={selectedAggregation}
                          onChange={(event) => {
                            const config = draftConfig as AnalysisNodeConfigByType["metric"];
                            const nextMetrics: MetricConfig[] = config.metrics.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, aggregation: event.target.value as MetricAggregation }
                                : item,
                            );
                            setDraftConfig({ metrics: nextMetrics });
                          }}
                        >
                          {allowedAggregations.map((aggregation) => (
                            <option key={aggregation} value={aggregation}>
                              {aggregation.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="stepEditorControl">
                        <span>Field</span>
                        <select
                          value={metric.field}
                          onChange={(event) => {
                            const selectedField = findOption(fieldOptions, event.target.value);
                            const config = draftConfig as AnalysisNodeConfigByType["metric"];
                            const nextMetrics: MetricConfig[] = config.metrics.map((item, itemIndex) => {
                              if (itemIndex !== index) return item;
                              const nextAggregation = normalizeMetricAggregation(item.aggregation, selectedField);
                              return { ...item, field: event.target.value, aggregation: nextAggregation };
                            });
                            setDraftConfig({ metrics: nextMetrics });
                          }}
                        >
                          <option value="">Field</option>
                          {fieldOptions.map((field) => (
                            <option key={field.path} value={field.value}>
                              {field.label} ({field.path})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="stepEditorControl">
                        <span>Alias</span>
                        <input
                          value={metric.alias}
                          placeholder="Alias"
                          onChange={(event) => {
                            const config = draftConfig as AnalysisNodeConfigByType["metric"];
                            const nextMetrics: MetricConfig[] = config.metrics.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, alias: event.target.value } : item,
                            );
                            setDraftConfig({ metrics: nextMetrics });
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="analysisIconBtn is-danger"
                        onClick={() => {
                          const config = draftConfig as AnalysisNodeConfigByType["metric"];
                          setDraftConfig({
                            metrics: config.metrics.filter((item) => item.id !== metric.id),
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {node.type === "limit" ? (
            <section className="stepDrawerCard stepDrawerCard--limit">
              <div className="stepDrawerCard__header">
                <div className="stepDrawerCard__title">
                  <span className="stepDrawerCard__icon" aria-hidden="true">
                    <i className="fa fa-sliders" />
                  </span>
                  <div>
                    <h4>Limit</h4>
                    <p>Control the maximum rows returned by this step.</p>
                  </div>
                </div>
              </div>
              <label className="analysisField">
                <span>Row limit</span>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={(draftConfig as AnalysisNodeConfigByType["limit"]).value}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    setDraftConfig({
                      value: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1,
                    });
                  }}
                />
              </label>
            </section>
          ) : null}
        </div>

        <footer className="stepDrawer__footer">
          <button type="button" className="analysisBtn analysisBtn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="analysisBtn analysisBtn--primary" onClick={onSaveClick}>
            Save Step
          </button>
        </footer>
      </div>
    </div>
  );
}
