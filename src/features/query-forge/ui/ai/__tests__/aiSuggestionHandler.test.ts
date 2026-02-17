import { describe, expect, it } from "vitest";

import { applyBuilderActionsToSqlJson, resolveSuggestionSqlJson } from "../aiSuggestionHandler";

const baseSqlJson = {
  version: 1,
  domainId: 1,
  columns: [],
  prompt: "",
  dataPrep: null,
  filters: null,
  aggs: { enabled: false, metrics: [], groupBy: [] },
  sorting: [],
  distinct: true,
  value_overrides: { a: null, b: null, c: null },
  value_overrideAttachments: [],
  cohortAttachment: null,
  meta: { tool: "query_builder" },
} as const;

describe("aiSuggestionHandler", () => {
  it("applies addSort/addGroupBy actions without type failures", () => {
    const next = applyBuilderActionsToSqlJson(baseSqlJson as any, [
      {
        op: "addGroupBy",
        col: { modelColumnId: null, columnName: "patient_gender", workspaceTableId: null },
      },
      {
        op: "addSort",
        col: { modelColumnId: null, columnName: "patient_id", workspaceTableId: null },
        dir: "desc",
      },
    ]);

    expect(next.aggs?.groupBy?.[0]?.columnName).toBe("patient_gender");
    expect(next.sorting?.[0]?.col?.columnName).toBe("patient_id");
    expect(next.sorting?.[0]?.dir).toBe("desc");
  });

  it("prefers backend sqlJson as source of truth", () => {
    const suggestionSqlJson = {
      ...baseSqlJson,
      domainId: 7,
      columns: [{ modelColumnId: null, columnName: "member_id", workspaceTableId: null }],
      meta: { tool: "query_builder", prompt: "from ai" },
    };

    const result = resolveSuggestionSqlJson(
      baseSqlJson as any,
      {
        title: "AI plan",
        why: "Use backend plan",
        confidence: "high",
        actions: [
          {
            op: "setDomain",
            domainId: 999,
          },
        ],
        sqlJson: suggestionSqlJson as any,
      },
      (raw) => raw as any
    );

    expect(result.source).toBe("sqlJson");
    expect(result.nextSqlJson.domainId).toBe(7);
    expect(result.nextSqlJson.columns?.[0]?.columnName).toBe("member_id");
  });
});

