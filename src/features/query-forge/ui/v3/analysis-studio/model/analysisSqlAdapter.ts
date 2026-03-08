import type { SqlFilterNode, SqlFilterOp, SqlQueryJson, SqlSort } from "../../../../model/sqlJson";
import type {
  AnalysisNode,
  AnalysisNodeConfigByType,
  AnalysisState,
  FilterConditionNode,
  FilterGroupNode,
  StudioDomainExplorer,
} from "./analysisTypes";
import { flattenExplorerFields, getFilterRoot, getStepSummary, toTitle } from "./analysisUtils";

const FILTER_OPERATOR_TO_SQL: Record<string, SqlFilterOp> = {
  "=": "equals",
  "!=": "not_equals",
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte",
  contains: "contains",
};

function getNodeByType<TType extends AnalysisNode["type"]>(
  orderedNodes: AnalysisNode[],
  type: TType,
): AnalysisNode<TType> | null {
  for (const node of orderedNodes) {
    if (node.type === type) return node as AnalysisNode<TType>;
  }
  return null;
}

export function getOrderedNodes(state: AnalysisState): AnalysisNode[] {
  return state.orderedNodeIds
    .map((nodeId) => state.nodes[nodeId])
    .filter((node): node is AnalysisNode => Boolean(node));
}

function buildSqlFilters(orderedNodes: AnalysisNode[]): SqlFilterNode | null {
  const filterNode = getNodeByType(orderedNodes, "filter");
  if (!filterNode) return null;

  const config = filterNode.config as AnalysisNodeConfigByType["filter"];
  const root = getFilterRoot(config);

  const toSql = (node: FilterGroupNode | FilterConditionNode): SqlFilterNode | null => {
    if (node.type === "condition") {
      if (!node.field || !node.value) return null;
      return {
        type: "condition",
        id: node.id,
        field: {
          modelColumnId: null,
          columnName: node.field,
          workspaceTableId: null,
        },
        op: FILTER_OPERATOR_TO_SQL[node.operator] ?? "equals",
        value: node.value,
      };
    }

    const children = node.children
      .map((child) => toSql(child))
      .filter((child): child is SqlFilterNode => Boolean(child));
    if (children.length === 0) return null;

    return {
      type: "group",
      id: node.id || "analysis_pipeline_filters",
      match: node.match,
      children,
    };
  };

  return toSql(root);
}

function buildSqlSort(orderedNodes: AnalysisNode[]): SqlSort[] {
  const sortNode = getNodeByType(orderedNodes, "sort");
  if (!sortNode) return [];

  const config = sortNode.config as AnalysisNodeConfigByType["sort"];
  return config.sorts
    .filter((sort) => sort.field)
    .map((sort) => ({
      col: {
        modelColumnId: null,
        columnName: sort.field,
        workspaceTableId: null,
      },
      dir: sort.direction,
    }));
}

function inferDatasetName(explorer: StudioDomainExplorer | null): string | null {
  const firstPath = flattenExplorerFields(explorer)[0]?.path ?? "";
  const fromPath = firstPath.includes(".") ? firstPath.split(".")[0] : "";
  if (fromPath) return fromPath;
  const domainKey = explorer?.domain.key?.trim();
  if (domainKey) return domainKey;
  return null;
}

export function pipelineToSqlJson(state: AnalysisState, domainExplorer: StudioDomainExplorer | null): SqlQueryJson {
  const orderedNodes = getOrderedNodes(state);
  const domainNode = getNodeByType(orderedNodes, "domain");
  const selectNode = getNodeByType(orderedNodes, "select");
  const datasetName = inferDatasetName(domainExplorer);

  const domainConfig = domainNode?.config as AnalysisNodeConfigByType["domain"] | undefined;
  const selectConfig = selectNode?.config as AnalysisNodeConfigByType["select"] | undefined;

  return {
    version: 1,
    domainId: domainConfig?.domainId ?? domainExplorer?.domain.id ?? null,
    columns: (selectConfig?.fields ?? []).map((fieldName) => ({
      modelColumnId: null,
      workspaceTableId: null,
      columnName: fieldName,
      modelTableName: datasetName,
      fullName: fieldName.includes(".") ? fieldName : (datasetName ? `${datasetName}.${fieldName}` : fieldName),
      alias: null,
    })),
    filters: buildSqlFilters(orderedNodes),
    sorting: buildSqlSort(orderedNodes),
    aggs: null,
    dataPrep: null,
    distinct: false,
    meta: {
      tool: "query_studio_branching_analysis_stage1",
      updatedAt: new Date().toISOString(),
    },
  };
}

function selectFieldsForResults(orderedNodes: AnalysisNode[], explorer: StudioDomainExplorer): string[] {
  const selectNode = getNodeByType(orderedNodes, "select");
  const groupNode = getNodeByType(orderedNodes, "group");
  const metricNode = getNodeByType(orderedNodes, "metric");

  const selectConfig = (selectNode?.config as AnalysisNodeConfigByType["select"] | undefined)?.fields ?? [];
  const groupConfig = (groupNode?.config as AnalysisNodeConfigByType["group"] | undefined)?.fields ?? [];
  const metricConfig = (metricNode?.config as AnalysisNodeConfigByType["metric"] | undefined)?.metrics ?? [];

  const dimensions = selectConfig.length ? selectConfig : groupConfig;
  const metrics = metricConfig.map((metric) => metric.alias || `${metric.aggregation}_${metric.field}`);
  const merged = [...dimensions, ...metrics].filter(Boolean);

  if (merged.length > 0) return Array.from(new Set(merged));
  return flattenExplorerFields(explorer).slice(0, 4).map((field) => field.path);
}

export function buildMockResultRows(
  state: AnalysisState,
  explorer: StudioDomainExplorer | null,
): Array<Record<string, string | number>> {
  if (!explorer || state.orderedNodeIds.length === 0) return [];

  const orderedNodes = getOrderedNodes(state);
  const fields = selectFieldsForResults(orderedNodes, explorer);

  return Array.from({ length: 5 }).map((_, rowIndex) => {
    const row: Record<string, string | number> = {};
    fields.forEach((fieldName, colIndex) => {
      const lowered = fieldName.toLowerCase();
      if (lowered.includes("revenue") || lowered.includes("sum")) {
        row[fieldName] = 125000 - rowIndex * 8400 + colIndex * 125;
      } else if (lowered.includes("date") || lowered.includes("year")) {
        row[fieldName] = `2025-0${(rowIndex % 3) + 1}-1${colIndex}`;
      } else if (lowered.includes("rate") || lowered.includes("score")) {
        row[fieldName] = Number((0.62 + rowIndex * 0.07 + colIndex * 0.01).toFixed(2));
      } else {
        row[fieldName] = `${toTitle(fieldName.split(".").pop() ?? fieldName)} ${rowIndex + 1}`;
      }
    });
    return row;
  });
}

export function generateMockSqlFromPipeline(state: AnalysisState, explorer: StudioDomainExplorer | null): string {
  if (!explorer || state.orderedNodeIds.length === 0) {
    return "-- Select a domain to generate SQL";
  }

  const orderedNodes = getOrderedNodes(state);
  const selectNode = getNodeByType(orderedNodes, "select");
  const filterNode = getNodeByType(orderedNodes, "filter");
  const groupNode = getNodeByType(orderedNodes, "group");
  const metricNode = getNodeByType(orderedNodes, "metric");
  const sortNode = getNodeByType(orderedNodes, "sort");
  const limitNode = getNodeByType(orderedNodes, "limit");
  const datasetName = inferDatasetName(explorer) ?? "domain_dataset";

  const filterConfig = filterNode?.config as AnalysisNodeConfigByType["filter"] | undefined;
  const selectConfig = selectNode?.config as AnalysisNodeConfigByType["select"] | undefined;
  const groupConfig = groupNode?.config as AnalysisNodeConfigByType["group"] | undefined;
  const metricConfig = metricNode?.config as AnalysisNodeConfigByType["metric"] | undefined;
  const sortConfig = sortNode?.config as AnalysisNodeConfigByType["sort"] | undefined;
  const limitConfig = limitNode?.config as AnalysisNodeConfigByType["limit"] | undefined;

  const selectClauses: string[] = [];
  if (selectConfig?.fields.length) selectClauses.push(...selectConfig.fields);
  if (metricConfig?.metrics.length) {
    selectClauses.push(
      ...metricConfig.metrics
        .filter((metric) => metric.field)
        .map((metric) => {
          const alias = metric.alias?.trim() ? ` AS ${metric.alias.trim().replace(/\s+/g, "_")}` : "";
          return `${metric.aggregation.toUpperCase()}(${metric.field})${alias}`;
        }),
    );
  }
  if (!selectClauses.length) selectClauses.push("*");

  const toSqlPredicate = (node: FilterGroupNode | FilterConditionNode): string => {
    if (node.type === "condition") {
      if (!node.field || !node.value) return "";
      if (node.operator === "contains") {
        return `${node.field} ILIKE '%${node.value.replace(/'/g, "''")}%'`;
      }
      return `${node.field} ${node.operator} '${node.value.replace(/'/g, "''")}'`;
    }

    const parts = node.children.map((child) => toSqlPredicate(child)).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    const joiner = node.match === "or" ? " OR " : " AND ";
    return `(${parts.join(joiner)})`;
  };

  const whereClause = filterConfig ? toSqlPredicate(getFilterRoot(filterConfig)) : "";

  const groupClause = groupConfig?.fields.length ? groupConfig.fields.join(", ") : "";
  const orderClause =
    sortConfig?.sorts
      .filter((sort) => sort.field)
      .map((sort) => `${sort.field} ${sort.direction.toUpperCase()}`)
      .join(", ") ?? "";

  const sqlParts = [`SELECT\n  ${selectClauses.join(",\n  ")}`, `FROM ${datasetName}`];
  if (whereClause) sqlParts.push(`WHERE\n  ${whereClause}`);
  if (groupClause) sqlParts.push(`GROUP BY ${groupClause}`);
  if (orderClause) sqlParts.push(`ORDER BY ${orderClause}`);
  if (limitConfig?.value) sqlParts.push(`LIMIT ${limitConfig.value}`);

  return `${sqlParts.join("\n")};`;
}

export function buildMockSql(state: AnalysisState, explorer: StudioDomainExplorer | null): string {
  return generateMockSqlFromPipeline(state, explorer);
}

export function generateMockExplainText(state: AnalysisState): string {
  const orderedNodes = getOrderedNodes(state);
  if (!orderedNodes.length) {
    return "Choose a domain to begin. The pipeline will then suggest the next best analysis steps.";
  }

  const summaryLines = orderedNodes.map((node, index) => `${index + 1}. ${getStepSummary(node)}`);

  return [
    "This is a guided, linear analysis path built on a branching-ready node model.",
    "Current pipeline:",
    ...summaryLines,
  ].join("\n");
}

export function buildExplainText(state: AnalysisState): string {
  return generateMockExplainText(state);
}
