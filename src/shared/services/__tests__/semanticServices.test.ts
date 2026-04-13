import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createConceptAlias,
  createConceptColumnMap,
  createConcept,
  createValueAlias,
  createSemanticRelationship,
  deleteSemanticRelationship,
  getSemanticRelationship,
  listConceptKeys,
  listConceptColumnMaps,
  listSemanticRelationshipConcepts,
  listSemanticRelationships,
  listConcepts,
  patchSemanticRelationship,
  runSemanticPlanner,
  updateConceptColumnMap,
  listValueAliases,
  suggestSemanticColumns,
  testPlannerExtraction,
  updateConcept,
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

  it("accepts concept update success with minimal 200 payload", async () => {
    mocks.patch.mockResolvedValue({
      status: 200,
      data: { updated: true },
    });

    const updated = await updateConcept(11, {
      concept_key: "district_name",
      name: "District Name",
      description: null,
      semantic_type: "dimension",
      sub_type: null,
      entity: null,
      granularity_rank: null,
      filter_allowed: true,
      group_by_allowed: true,
      aggregation_allowed: false,
      is_identifier: false,
      is_metric: false,
      display_priority: null,
      sensitive: false,
      status: "active",
    });

    expect(mocks.patch).toHaveBeenCalledWith(
      "/semantic/concepts/11",
      expect.objectContaining({
        concept_key: "district_name",
      })
    );
    expect(updated).toMatchObject({
      concept_id: 11,
      concept_key: "district_name",
      name: "District Name",
    });
  });

  it("lists semantic relationships with readable labels", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            id: 41,
            parent_concept_id: 11,
            child_concept_id: 22,
            relationship_type: "depends_on",
            vertical_norm: "education",
            parent_display_label: "District Name",
            child_display_label: "School Name",
            created_at: "2026-03-10T10:00:00Z",
          },
        ],
        page: 1,
        page_size: 25,
        total: 1,
      },
    });

    const response = await listSemanticRelationships({
      relationship_type: "depends_on",
      parent_id: 11,
      child_id: 22,
      page: 1,
      page_size: 25,
    });

    expect(mocks.get).toHaveBeenCalledWith("/semantic/relationships", {
      params: expect.objectContaining({
        relationship_type: "depends_on",
        parent_id: 11,
        child_id: 22,
        page: 1,
        page_size: 25,
      }),
    });
    expect(response.items[0]).toMatchObject({
      id: 41,
      relationship_type: "depends_on",
      parent_display_label: "District Name",
      child_display_label: "School Name",
    });
  });

  it("creates semantic relationship with concept ids", async () => {
    mocks.post.mockResolvedValue({
      data: {
        result: {
          id: 55,
          parent_concept_id: 11,
          child_concept_id: 22,
          relationship_type: "belongs_to_domain",
          vertical_norm: "education",
        },
      },
    });

    const response = await createSemanticRelationship({
      parent_concept_id: 11,
      child_concept_id: 22,
      relationship_type: "belongs_to_domain",
    });

    expect(mocks.post).toHaveBeenCalledWith("/semantic/relationships", {
      parent_concept_id: 11,
      child_concept_id: 22,
      relationship_type: "belongs_to_domain",
    });
    expect(response).toMatchObject({
      id: 55,
      parent_concept_id: 11,
      child_concept_id: 22,
      relationship_type: "belongs_to_domain",
    });
  });

  it("loads one semantic relationship by id", async () => {
    mocks.get.mockResolvedValue({
      data: {
        result: {
          id: 77,
          parent_concept_id: 14,
          child_concept_id: 20,
          relationship_type: "default_time_field_for",
          parent_display_label: "Order Date",
          child_display_label: "Revenue",
        },
      },
    });

    const response = await getSemanticRelationship(77);

    expect(mocks.get).toHaveBeenCalledWith("/semantic/relationships/77");
    expect(response).toMatchObject({
      id: 77,
      parent_concept_id: 14,
      child_concept_id: 20,
      relationship_type: "default_time_field_for",
      parent_display_label: "Order Date",
      child_display_label: "Revenue",
    });
  });

  it("patches semantic relationship fields", async () => {
    mocks.patch.mockResolvedValue({
      data: {
        row: {
          id: 77,
          parent_concept_id: 14,
          child_concept_id: 25,
          relationship_type: "depends_on",
        },
      },
    });

    const response = await patchSemanticRelationship(77, {
      child_concept_id: 25,
      relationship_type: "depends_on",
    });

    expect(mocks.patch).toHaveBeenCalledWith("/semantic/relationships/77", {
      child_concept_id: 25,
      relationship_type: "depends_on",
    });
    expect(response).toMatchObject({
      id: 77,
      child_concept_id: 25,
      relationship_type: "depends_on",
    });
  });

  it("deletes semantic relationship by id", async () => {
    mocks.delete.mockResolvedValue({ status: 200, data: { deleted: true } });

    await deleteSemanticRelationship(77);
    expect(mocks.delete).toHaveBeenCalledWith("/semantic/relationships/77");
  });

  it("lists relationship concepts for lookup selector", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            concept_id: 11,
            concept_key: "DISTRICT_NAME",
            name: "District Name",
            display_label: "District Name",
          },
        ],
        page: 1,
        page_size: 25,
        total: 1,
      },
    });

    const response = await listSemanticRelationshipConcepts({
      q: "district",
      page: 1,
      page_size: 25,
    });

    expect(mocks.get).toHaveBeenCalledWith("/semantic/relationships/concepts", {
      params: {
        q: "district",
        page: 1,
        page_size: 25,
      },
    });
    expect(response.items[0]).toMatchObject({
      concept_id: 11,
      concept_key: "DISTRICT_NAME",
      display_label: "District Name",
    });
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
            workspace_column_id: 1901,
            column_name: "status_code",
            workspace_table_name: "students",
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
      workspace_table_name: "students",
      column_name: "status_code",
      workspace_column_id: 1901,
      relationship_kind: "primary",
      weight: 0.8,
    });
  });

  it("passes concept-column map text filters as query params", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [],
        page: 1,
        page_size: 25,
        total: 0,
      },
    });

    await listConceptColumnMaps({
      vertical: "education",
      semantic_concept_id: 12,
      workspace_column_id: 1901,
      concept_key: "SCHOOL_YEAR",
      column_name: "school_year",
      q: "district",
      relationship_kind: "primary",
      page: 1,
      page_size: 25,
    });

    expect(mocks.get).toHaveBeenCalledWith("/semantic/concept-column-maps", {
      params: {
        semantic_concept_id: 12,
        workspace_column_id: 1901,
        concept_key: "SCHOOL_YEAR",
        column_name: "school_year",
        q: "district",
        relationship_kind: "primary",
        page: 1,
        page_size: 25,
      },
    });
  });

  it("strips deprecated model_column_id from concept-column map list params", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [],
        page: 1,
        page_size: 25,
        total: 0,
      },
    });

    await listConceptColumnMaps({
      workspace_column_id: 1901,
      model_column_id: 901,
      page: 1,
      page_size: 25,
    });

    expect(mocks.get).toHaveBeenCalledWith("/semantic/concept-column-maps", {
      params: {
        workspace_column_id: 1901,
        page: 1,
        page_size: 25,
      },
    });
  });

  it("accepts concept-column map create success with minimal 201 payload", async () => {
    mocks.post.mockResolvedValue({
      status: 201,
      data: { created: true },
    });

    const created = await createConceptColumnMap({
      semantic_concept_id: 12,
      workspace_column_id: 1901,
      model_column_id: 901,
      relationship_kind: "primary",
      weight: 0.9,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/concept-column-maps",
      expect.not.objectContaining({
        model_column_id: expect.anything(),
      })
    );
    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/concept-column-maps",
      expect.objectContaining({
        semantic_concept_id: 12,
        workspace_column_id: 1901,
      })
    );
    expect(created).toMatchObject({
      map_id: 0,
      semantic_concept_id: 12,
      workspace_column_id: 1901,
      relationship_kind: "primary",
      weight: 0.9,
    });
  });

  it("accepts concept-column map update success with minimal 200 payload", async () => {
    mocks.patch.mockResolvedValue({
      status: 200,
      data: { updated: true },
    });

    const updated = await updateConceptColumnMap(44, {
      semantic_concept_id: 12,
      workspace_column_id: 1901,
      relationship_kind: "alternate",
      weight: 0.7,
    });

    expect(mocks.patch).toHaveBeenCalledWith(
      "/semantic/concept-column-maps/44",
      expect.objectContaining({
        semantic_concept_id: 12,
        workspace_column_id: 1901,
      })
    );
    expect(updated).toMatchObject({
      map_id: 44,
      semantic_concept_id: 12,
      workspace_column_id: 1901,
      relationship_kind: "alternate",
      weight: 0.7,
    });
  });

  it("parses value aliases with concept name", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            value_alias_id: 31,
            vertical_norm: "education",
            semantic_concept_id: 12,
            concept_name: "School Year",
            canonical_value: "2024",
            alias_value: "SY24",
            match_kind: "contains",
            weight: 1,
          },
        ],
        page: 1,
        page_size: 25,
        total: 1,
      },
    });

    const response = await listValueAliases({ page: 1, page_size: 25 });

    expect(mocks.get).toHaveBeenCalledWith("/semantic/value-aliases", {
      params: { page: 1, page_size: 25 },
    });
    expect(response.items[0]).toMatchObject({
      value_alias_id: 31,
      semantic_concept_id: 12,
      concept_name: "School Year",
      alias_value: "SY24",
    });
  });

  it("accepts create value alias success with minimal 201 payload", async () => {
    mocks.post.mockResolvedValue({
      status: 201,
      data: { created: true },
    });

    const created = await createValueAlias({
      semantic_concept_id: 12,
      canonical_value: "2024",
      alias_value: "SY24",
      match_kind: "contains",
      weight: 0.9,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/value-aliases",
      expect.objectContaining({
        semantic_concept_id: 12,
      })
    );
    expect(created).toMatchObject({
      value_alias_id: 0,
      semantic_concept_id: 12,
      canonical_value: "2024",
      alias_value: "SY24",
    });
  });

  it("loads concept keys without a semantic vertical filter", async () => {
    mocks.get.mockResolvedValue({
      data: {
        concept_keys: ["ATTENDANCE_RATE", "SCHOOL_YEAR"],
      },
    });

    const response = await listConceptKeys();

    expect(mocks.get).toHaveBeenCalledWith("/semantic/concepts/keys");
    expect(response.concept_keys).toEqual(["ATTENDANCE_RATE", "SCHOOL_YEAR"]);
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

    const response = await runSemanticPlanner({
      engine: "legacy",
      workspaceId: "ws-1",
      prompt: "show active students",
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/plan",
      expect.objectContaining({
        workspace_id: "ws-1",
        prompt: "show active students",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Workspace-Id": "ws-1" }),
      })
    );
    expect(response.raw.edits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "addSort" }),
        expect.objectContaining({ op: "addGroupBy" }),
      ])
    );
  });

  it("routes legacy engine through semantic/plan and normalizes result", async () => {
    mocks.post.mockResolvedValue({
      data: {
        prompt: "show active students",
        deterministic: { matched: [], unmatched_tokens: [] },
        concept_vector: { query_text: "show active students", hits: [] },
        concept_mapping: { concepts: [], mapped_columns: [] },
        column_vector: { filtered_to_candidate_count: 0, hits: [] },
        llm_plan: {
          model: "legacy-model",
          sql_json: { select: ["student_id"] },
          selected_columns: [],
          filters: [],
          join_plan: {},
          confidence: 0.9,
          notes: [],
        },
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
      },
    });

    const response = await runSemanticPlanner({
      engine: "legacy",
      workspaceId: "ws-1",
      prompt: "show active students",
      debug: true,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/plan",
      expect.objectContaining({
        workspace_id: "ws-1",
        prompt: "show active students",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Workspace-Id": "ws-1" }),
      })
    );
    expect(response.engine).toBe("legacy");
    expect(response.sqlJson).toEqual({ select: ["student_id"] });
  });

  it("routes llm_v2 engine through planner/plan_llm and normalizes response", async () => {
    mocks.post.mockResolvedValue({
      data: {
        sql_json: { select: ["student_id"] },
        validation: {
          is_valid: true,
          errors: [],
          repairs_applied: [],
        },
        candidates: {
          domains: [{ id: 1 }],
          concepts: [{ concept_key: "STUDENT_ID" }],
          columns: [{ column_name: "student_id" }],
        },
        trace_id: "trace-123",
        timings_ms: { llm: 42 },
        debug_artifacts: {},
      },
    });

    const response = await runSemanticPlanner({
      engine: "llm_v2",
      workspaceId: "ws-1",
      prompt: "students per teacher by school last year",
      debug: true,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/planner/plan_llm",
      expect.objectContaining({
        workspace_id: "ws-1",
        prompt: "students per teacher by school last year",
        constraints: {
          max_domains: 3,
          max_columns: 40,
          max_concepts: 25,
          allow_pii: false,
        },
        debug: true,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Workspace-Id": "ws-1" }),
      })
    );
    expect(response).toMatchObject({
      engine: "llm_v2",
      traceId: "trace-123",
      validation: { is_valid: true, errors: [], repairs_applied: [] },
    });
    expect(response.sqlJson).toEqual({ select: ["student_id"] });
    expect(response.timingsMs).toMatchObject({ llm: 42 });
  });

  it("uses plan_json when llm_v2 returns empty sql_json", async () => {
    mocks.post.mockResolvedValue({
      data: {
        plan_json: {
          intent: "aggregate",
          aggregation: {
            group_by: ["wt20.county_fips_code"],
          },
        },
        sql_json: {},
        validation: {
          is_valid: false,
          errors: ["aggregate_mismatch_repaired"],
          repairs_applied: ["repaired_bad_aggregate_types"],
        },
        trace_id: "trace-456",
        timings_ms: { total: 2 },
      },
    });

    const response = await runSemanticPlanner({
      engine: "llm_v2",
      workspaceId: "ws-1",
      prompt: "average students per teacher by county",
      debug: true,
    });

    expect(response.engine).toBe("llm_v2");
    expect(response.traceId).toBe("trace-456");
    expect(response.sqlJson).toEqual({
      intent: "aggregate",
      aggregation: {
        group_by: ["wt20.county_fips_code"],
      },
    });
    expect(response.validation).toMatchObject({
      is_valid: false,
      errors: ["aggregate_mismatch_repaired"],
      repairs_applied: ["repaired_bad_aggregate_types"],
    });
  });

  it("surfaces explicit message when llm_v2 planner route is disabled", async () => {
    mocks.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 404,
        data: { message: "planner_llm route disabled" },
      },
    });

    await expect(
      runSemanticPlanner({
        engine: "llm_v2",
        workspaceId: "ws-1",
        prompt: "students per teacher by school last year",
      })
    ).rejects.toThrow("LLM v2 planner is disabled on backend. Switch Planner Engine to Legacy.");
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
      expect.objectContaining({
        workspace_id: "ws-1",
        prompt: "find columns",
      }),
      expect.objectContaining({
        signal: controller.signal,
        headers: expect.objectContaining({ "X-Workspace-Id": "ws-1" }),
      })
    );
  });

  it("parses extraction response from planner extract endpoint", async () => {
    mocks.post.mockResolvedValue({
      status: 200,
      data: {
        spacy: {
          normalized_text: "show active students",
          ents: [{ start: 0, end: 4, label: "ACTION", text: "show" }],
          by_label: { ACTION: ["show"] },
          slots: {
            metric: ["count"],
            dimensions: ["student"],
            subgroups: [],
            time_ranges: [],
            org_schools: [],
            org_districts: [],
          },
          warnings: ["low_confidence_metric"],
        },
      },
    });

    const response = await testPlannerExtraction({ prompt: "show active students" });

    expect(mocks.post).toHaveBeenCalledWith(
      "/planner/extract",
      expect.objectContaining({ prompt: "show active students" }),
      expect.objectContaining({})
    );
    expect(response.normalized_text).toBe("show active students");
    expect(response.warnings).toEqual(["low_confidence_metric"]);
  });

  it("accepts legacy planner success when backend returns wrapped planner payload", async () => {
    mocks.post.mockResolvedValue({
      status: 200,
      data: {
        result: {
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
          edits: [],
          explanation: "Wrapped planner payload.",
          confidence: 0.75,
        },
      },
    });

    const response = await runSemanticPlanner({
      engine: "legacy",
      workspaceId: "ws-1",
      prompt: "show active students",
    });

    expect((response.raw.result as { explanation?: string } | undefined)?.explanation).toBe(
      "Wrapped planner payload."
    );
    expect((response.raw.result as { confidence?: number } | undefined)?.confidence).toBe(0.75);
  });

  it("accepts legacy planner response when concept_vector hits omit concept_id", async () => {
    mocks.post.mockResolvedValue({
      status: 200,
      data: {
        prompt: "Find all the black kids in metro schools",
        deterministic: {
          matched: [],
          unmatched_tokens: ["find", "all", "black", "kids", "metro", "schools"],
        },
        concept_vector: {
          query_text: "Find all the black kids in metro schools",
          hits: [
            {
              concept_key: "RACE",
              concept_id: 52,
              score: 3.0,
              source: "lexical_alias+vector",
              alias_key: "black",
            },
            {
              concept_key: "STUDENT_ID",
              score: 3.0,
              source: "lexical_alias",
              alias_key: "kids",
              match_kind: "exact",
            },
          ],
        },
        concept_mapping: {
          concepts: ["RACE", "STUDENT_ID"],
          mapped_columns: [
            {
              model_column_id: 365,
              table_name: "dim_student",
              column_name: "race_ethnicity",
              concept_key: "RACE",
              weight: 1.0,
            },
          ],
        },
        column_vector: {
          filtered_to_candidate_count: 1,
          hits: [
            {
              model_column_id: 365,
              score: 0.461,
              table_name: "dim_student",
              column_name: "race_ethnicity",
              concept_key: "RACE",
            },
          ],
        },
        llm_plan: {
          model: "qwen25-14b",
          sql_json: { version: 1 },
          selected_columns: [{ concept_key: "STUDENT_ID", model_column_id: 348 }],
          filters: [{ concept_key: "DISTRICT_NAME", op: "=", value: "Davidson County" }],
          join_plan: { primary_table: "dim_student", joins: [] },
          confidence: 0.8,
          notes: ["note"],
        },
        debug: {
          timings_ms: {
            deterministic: 0,
            lexical_alias: 48,
            concept_vector: 115,
            value_alias_resolution: 44,
            concept_mapping: 9,
            domain_selection: 17,
            column_vector: 141,
            llm: 15530,
          },
          warnings: ["identifier_concepts_downranked"],
        },
      },
    });

    const response = await runSemanticPlanner({
      engine: "legacy",
      workspaceId: "ws-1",
      prompt: "Find all the black kids in metro schools",
    });

    expect(response.raw.prompt).toBe("Find all the black kids in metro schools");
    expect((response.raw.concept_vector as { hits?: Array<Record<string, unknown>> }).hits?.[1]).toMatchObject({
      concept_key: "STUDENT_ID",
      score: 3.0,
    });
  });

  it("accepts suggest success when backend returns wrapped planner payload", async () => {
    mocks.post.mockResolvedValue({
      status: 200,
      data: {
        result: {
          prompt: "find student columns",
          deterministic: { matched: [], unmatched_tokens: [] },
          concept_vector: { query_text: "find student columns", hits: [] },
          concept_mapping: { concepts: [], mapped_columns: [] },
          column_vector: { filtered_to_candidate_count: 0, hits: [] },
          llm_plan: {
            model: "gpt-4o-mini",
            sql_json: {},
            selected_columns: [],
            filters: [],
            join_plan: { joins: [] },
            confidence: 0.62,
            notes: [],
          },
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
        },
      },
    });

    const response = await suggestSemanticColumns({
      workspace_id: "ws-1",
      prompt: "find student columns",
    });

    expect(response.edits).toEqual([]);
    expect(response.explanation).toBe("Suggested semantic columns.");
    expect(response.confidence).toBe(0.62);
  });

  it("accepts create alias success with minimal 201 payload", async () => {
    mocks.post.mockResolvedValue({
      status: 201,
      data: { created: true },
    });

    const created = await createConceptAlias({
      alias_key: "district",
      concept_key: "district_name",
      match_kind: "contains",
      weight: 0.9,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/concept-aliases",
      expect.objectContaining({
        alias_key: "district",
      })
    );
    expect(created).toMatchObject({
      alias_id: 0,
      alias_key: "district",
      concept_key: "district_name",
    });
  });

  it("creates aliases without a semantic vertical field", async () => {
    mocks.post.mockResolvedValue({
      status: 201,
      data: { created: true },
    });

    const created = await createConceptAlias({
      alias_key: "district",
      concept_key: "district_name",
      match_kind: "contains",
      weight: 0.9,
    } as any);

    expect(mocks.post).toHaveBeenCalledWith(
      "/semantic/concept-aliases",
      expect.objectContaining({
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
