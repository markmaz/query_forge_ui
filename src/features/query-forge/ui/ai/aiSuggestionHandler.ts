import type { SqlColumnKey, SqlColumnRef, SqlFilterNode, SqlQueryJson } from "../../model/sqlJson";
import { colKey } from "../../model/sqlJson";
import { upsertSelectedColumn } from "../../model/columnsUtil";
import type { AiSuggestion, BuilderAction } from "./types";

const EMPTY_COLUMN: SqlColumnKey = { modelColumnId: null, columnName: "", workspaceTableId: null };

function appendFilterNode(existing: SqlFilterNode | null, nextNode: SqlFilterNode): SqlFilterNode {
  if (!existing) {
    return {
      type: "group",
      id: `ai-group-${Date.now()}`,
      match: "and",
      children: [nextNode],
    };
  }

  if (existing.type === "group") {
    return {
      ...existing,
      children: [...existing.children, nextNode],
    };
  }

  return {
    type: "group",
    id: `ai-group-${Date.now()}`,
    match: "and",
    children: [existing, nextNode],
  };
}

export function applyBuilderActionsToSqlJson(current: SqlQueryJson, actions: BuilderAction[]): SqlQueryJson {
  if (!actions.length) return current;

  let next = { ...current };
  let changed = false;

  for (const action of actions) {
    switch (action.op) {
      case "setDomain": {
        if (next.domainId === action.domainId) break;
        next = {
          ...next,
          domainId: action.domainId,
          columns: [],
          sorting: [],
          aggs: { enabled: false, metrics: [], groupBy: [] },
          filters: null,
          dataPrep: null,
          distinct: true,
          value_overrideAttachments: [],
          cohortAttachment: null,
        };
        changed = true;
        break;
      }
      case "addSelect": {
        const columnKey = action.col;
        const exists = (next.columns ?? []).some((c) => colKey(c) === colKey(columnKey));
        if (exists) break;
        next = {
          ...next,
          columns: upsertSelectedColumn(next.columns ?? [], {
            modelColumnId: columnKey.modelColumnId ?? null,
            columnName: columnKey.columnName,
            workspaceTableId: columnKey.workspaceTableId ?? null,
            exprId: columnKey.exprId ?? null,
            modelTableId: null,
            modelTableName: null,
            fullName: null,
            dataType: null,
            nullable: null,
            alias: action.alias ?? null,
          } as SqlColumnRef),
        };
        changed = true;
        break;
      }
      case "addFilter": {
        const filterNode: SqlFilterNode = {
          type: "condition",
          id: `ai-cond-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          field: action.col,
          op: action.operator,
          value: action.value,
        };
        next = {
          ...next,
          filters: appendFilterNode(next.filters ?? null, filterNode),
        };
        changed = true;
        break;
      }
      case "setDistinct": {
        if ((next.distinct !== false) === action.value) break;
        next = {
          ...next,
          distinct: action.value,
        };
        changed = true;
        break;
      }
      case "addAggregate": {
        const currentAggs = next.aggs ?? { enabled: false, metrics: [], groupBy: [] };
        let metrics = [...(currentAggs.metrics ?? [])];
        const groupBy = [...(currentAggs.groupBy ?? [])];
        const metricId = `ai-metric-${Date.now()}-${metrics.length}`;
        const metricField = action.col ?? null;
        const exists = metrics.some((m) => {
          const left = m.field ?? EMPTY_COLUMN;
          const right = metricField ?? EMPTY_COLUMN;
          return m.fn === action.func && colKey(left) === colKey(right);
        });
        if (!exists) {
          metrics = [
            ...metrics,
            {
              id: metricId,
              fn: action.func,
              field: metricField,
              label: action.alias ?? null,
            },
          ];
        }
        const metricsChanged = JSON.stringify(metrics) !== JSON.stringify(currentAggs.metrics ?? []);
        if (!metricsChanged) break;

        next = {
          ...next,
          aggs: {
            enabled: metrics.length > 0 || groupBy.length > 0,
            metrics,
            groupBy,
          },
        };
        changed = true;
        break;
      }
      case "addGroupBy": {
        const currentAggs = next.aggs ?? { enabled: false, metrics: [], groupBy: [] };
        const groupBy = [...(currentAggs.groupBy ?? [])];
        if (groupBy.some((g) => colKey(g) === colKey(action.col))) break;
        next = {
          ...next,
          aggs: {
            enabled: true,
            metrics: [...(currentAggs.metrics ?? [])],
            groupBy: [...groupBy, action.col],
          },
        };
        changed = true;
        break;
      }
      case "addSort": {
        const existingIdx = (next.sorting ?? []).findIndex((s) => colKey(s.col) === colKey(action.col));
        const currentSorting = next.sorting ?? [];
        let sorting = currentSorting;

        if (existingIdx >= 0) {
          if (currentSorting[existingIdx].dir === action.dir) break;
          sorting = currentSorting.map((s, idx) =>
            idx === existingIdx ? { ...s, dir: action.dir } : s
          );
        } else {
          sorting = [...currentSorting, { col: action.col, dir: action.dir }];
        }

        next = { ...next, sorting };
        changed = true;
        break;
      }
      default:
        break;
    }
  }

  return changed ? next : current;
}

export function resolveSuggestionSqlJson(
  current: SqlQueryJson,
  suggestion: AiSuggestion,
  normalize: (raw: Partial<SqlQueryJson> | null | undefined) => SqlQueryJson
): { nextSqlJson: SqlQueryJson; source: "sqlJson" | "actions"; changed: boolean } {
  if (suggestion.sqlJson) {
    const nextSqlJson = normalize(suggestion.sqlJson);
    return {
      nextSqlJson,
      source: "sqlJson",
      changed: JSON.stringify(nextSqlJson) !== JSON.stringify(current),
    };
  }

  const nextSqlJson = applyBuilderActionsToSqlJson(current, suggestion.actions);
  return {
    nextSqlJson,
    source: "actions",
    changed: nextSqlJson !== current,
  };
}

