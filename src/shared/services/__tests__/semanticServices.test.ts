import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createConceptAlias,
  createConcept,
  generateSemanticPlan,
  listConceptColumnMaps,
  listConcepts,
  suggestSemanticColumns,
} from "../semantic";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}));

describe("semantic services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses concepts list from rows payload", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            id: 11,
            vertical_norm: "education",
            concept_key: "district",
            name: "District",
            semantic_type: "dimension",
            filter_allowed: 1,
            group_by_allowed: 1,
            aggregation_allowed: 0,
            is_identifier: true,
            is_metric: false,
            sensitive: false,
            status: "active",
          },
          {
            id: 12,
            vertical_norm: "generic",
            concept_key: "status",
            name: null,
            semantic_type: "attribute",
            filter_allowed: true,
            group_by_allowed: true,
            aggregation_allowed: false,
            is_identifier: false,
            is_metric: false,
            sensitive: false,
            status: "active",
          },
        ],
        page: 1,
        page_size: 25,
        total: 2,
      },
    });

    const response = await listConcepts({ page: 1, page_size: 25 });

    expect(mocks.get).toHaveBeenCalledWith("/semantic/concepts", { params: { page: 1, page_size: 25 } });
    expect(response.items[0]).toMatchObject({
      concept_id: 11,
      concept_key: "district",
      filter_allowed: true,
      group_by_allowed: true,
      aggregation_allowed: false,
    });
    expect(response.items[1]).toMatchObject({
      concept_id: 12,
      concept_key: "status",
      name: null,
    });
  });

  it("validates concept create payload before submit", async () => {
    await expect(
      createConcept({
        vertical_norm: "",
        concept_key: "",
        name: "",
        description: null,
        semantic_type: "",
        sub_type: null,
        entity: null,
        granularity_rank: null,
        filter_allowed: false,
        group_by_allowed: false,
        aggregation_allowed: false,
        is_identifier: false,
        is_metric: false,
        display_priority: null,
        sensitive: false,
        status: "",
      })
    ).rejects.toThrow("Unable to create semantic concept.");
  });

  it("parses concept-column maps with human-readable fields", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            id: 44,
            vertical_norm: "education",
            semantic_concept_id: 12,
            concept_key: "STUDENT_STATUS",
            concept_name: "Student Status",
            model_column_id: 901,
            column_name: "status_code",
            model_table_name: "students",
            relationship_kind: "primary",
            weight: 0.8,
            created_at: "2026-02-15T11:25:51",
          },
        ],
        page: 1,
        page_size: 25,
        total: 1,
      },
    });

    const response = await listConceptColumnMaps({ page: 1, page_size: 25 });

    expect(mocks.get).toHaveBeenCalledWith("/semantic/concept-column-maps", {
      params: { page: 1, page_size: 25 },
    });
    expect(response.items[0]).toMatchObject({
      map_id: 44,
      concept_key: "STUDENT_STATUS",
      concept_name: "Student Status",
      model_table_name: "students",
      column_name: "status_code",
      relationship_kind: "primary",
      weight: 0.8,
    });
  });

  it("parses planner response", async () => {
    mocks.post.mockResolvedValue({
      data: {
        prompt: "show active students",
        deterministic: { matched: [], unmatched_tokens: [] },
        concept_vector: { query_text: "show active students", hits: [] },
        concept_mapping: { concepts: [], mapped_columns: [] },
        column_vector: { filtered_to_candidate_count: 0, hits: [] },
        debug: {
          timings_ms: {
            deterministic: 1,
            concept_vector: 2,
            concept_mapping: 3,
            column_vector: 4,
            llm: 5,
          },
          warnings: [],
        },
        edits: [
          {
            op: "addSort",
            col: { columnName: "student_id" },
            dir: "asc",
          },
          {
            op: "addGroupBy",
            col: { columnName: "district_name" },
          },
        ],
        explanation: "Matched student activity concepts.",
        confidence: 0.9,
      },
    });

    const response = await generateSemanticPlan({
      workspace_id: "ws-1",
      prompt: "show active students",
    });

    expect(response.edits?.[0]).toMatchObject({ op: "addSort" });
    expect(response.edits?.[1]).toMatchObject({ op: "addGroupBy" });
  });

  it("passes abort signal to suggest endpoint", async () => {
    const controller = new AbortController();
    mocks.post.mockResolvedValue({
      data: {
        prompt: "find columns",
        deterministic: { matched: [], unmatched_tokens: [] },
        concept_vector: { query_text: "find columns", hits: [] },
        concept_mapping: { concepts: [], mapped_columns: [] },
        column_vector: { filtered_to_candidate_count: 0, hits: [] },
        debug: {
          timings_ms: {
            deterministic: 1,
            concept_vector: 2,
            concept_mapping: 3,
            column_vector: 4,
            llm: 5,
          },
          warnings: [],
        },
        edits: [],
        explanation: "Suggested columns.",
        confidence: 0.7,
      },
    });

    await suggestSemanticColumns(
      {
        workspace_id: "ws-1",
        prompt: "find columns",
      },
      { signal: controller.signal }
    );

    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/suggest-columns",
      expect.objectContaining({ workspace_id: "ws-1", prompt: "find columns" }),
      { signal: controller.signal }
    );
  });

  it("accepts create alias success with minimal 201 payload", async () => {
    mocks.post.mockResolvedValue({
      status: 201,
      data: { created: true },
    });

    const created = await createConceptAlias({
      vertical_norm: "education",
      alias_key: "district",
      concept_key: "district_name",
      match_kind: "contains",
      weight: 0.9,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/concept-aliases",
      expect.objectContaining({
        vertical_norm: "education",
        alias_key: "district",
      })
    );
    expect(created).toMatchObject({
      alias_id: 0,
      alias_key: "district",
      concept_key: "district_name",
    });
  });
});
