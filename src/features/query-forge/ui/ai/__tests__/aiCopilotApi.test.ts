import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("../../../../../shared/services/api", () => ({
  default: {
    post: mocks.post,
  },
}));

import {
  AiSuggestApiError,
  aiSuggest,
  requestQueryStudioSuggestions,
  setAiSuggestMockEnabledForTests,
  submitPromptFeedback,
  toAiSuggestUserMessage,
} from "../aiCopilotApi";

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

describe("aiCopilotApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAiSuggestMockEnabledForTests(false);
  });

  afterEach(() => {
    setAiSuggestMockEnabledForTests(null);
  });

  it("maps backend sqlJson response into copilot suggestions", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-abc",
          workspace_id: "ws-1",
          vertical_norm: "education",
          base_domain_id: 6,
          domain_name: "Enrollment",
          intent: "list",
          selects: { dimensions: [], metrics: [] },
          filters: [],
          time: null,
          grouping: null,
          debug: null,
        },
        sql_json: {
          ...baseSqlJson,
          domainId: 6,
          columns: [{ modelColumnId: null, columnName: "patient_id", workspaceTableId: null }],
        },
        validation: {
          is_valid: true,
          errors: [],
          repairs_applied: ["normalized_filter_value"],
        },
        trace_id: "trace-abc",
        timings_ms: { total: 12 },
        debug: { model: "qwen-test", attempts: 2 },
      },
    });

    const result = await requestQueryStudioSuggestions({
      workspaceId: "ws-1",
      activeSection: "Columns",
      sqlJson: baseSqlJson as any,
      userPrompt: "build me a grouped query",
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(result.message).toMatch(/Domain-first planner generated SQL JSON/i);
    expect(result.debugAttempts).toBe(2);
    expect(result.suggestions[0].actions).toEqual([]);
    const [url, body, config] = mocks.post.mock.calls[0];
    expect(url).toMatch(/planner\/plan_domain$/);
    expect(body).toMatchObject({
      prompt: "build me a grouped query",
      vertical_norm: "education",
      base_domain_id: 1,
      debug: false,
    });
    expect(body).not.toHaveProperty("workspace_id");
    expect(body).not.toHaveProperty("workspaceId");
    expect(config?.headers).toMatchObject({ "X-Workspace-Id": "ws-1" });
    expect(result.suggestions[0].sqlJson?.columns?.[0]?.columnName).toBe("patient_id");
    expect(result.plannerMeta?.planJsonV2.domain_name).toBe("Enrollment");
    expect(result.plannerMeta?.validation.repairs_applied).toEqual(["normalized_filter_value"]);
    expect(result.plannerMeta?.traceId).toBe("trace-abc");
    expect(result.rawResponse).toMatchObject({
      trace_id: "trace-abc",
    });
  });

  it("forwards conversationId to planner and returns updated conversationId", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        conversation_id: "conv-2",
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-conv",
          workspace_id: "ws-1",
          vertical_norm: "education",
          base_domain_id: 6,
          domain_name: "Enrollment",
          intent: "list",
          selects: { dimensions: [], metrics: [] },
          filters: [],
          time: null,
          grouping: null,
          debug: null,
        },
        sql_json: {
          ...baseSqlJson,
          domainId: 6,
        },
        validation: {
          is_valid: true,
          errors: [],
          repairs_applied: [],
        },
      },
    });

    const result = await requestQueryStudioSuggestions({
      workspaceId: "ws-1",
      activeSection: "AI First",
      userPrompt: "follow up",
      conversationId: "conv-1",
    });

    const [, body] = mocks.post.mock.calls[0];
    expect(body).toMatchObject({
      prompt: "follow up",
      conversation_id: "conv-1",
    });
    expect(result.conversationId).toBe("conv-2");
    expect(result.plannerMeta?.conversationId).toBe("conv-2");
  });

  it("posts prompt feedback with workspace header and returns saved vote", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        id: "pfb-1",
        created_at: "2026-02-27T00:00:00Z",
        updated_at: "2026-02-27T00:00:01Z",
        vote: "up",
      },
    });

    const result = await submitPromptFeedback(
      {
        workspace_id: "ws-1",
        trace_id: "trace-1",
        vote: "up",
        prompt_text: "Show me enrollment",
        response_json: { trace_id: "trace-1" },
        meta: { model: "qwen25-14b" },
      },
      { workspaceId: "ws-1" }
    );

    expect(result.vote).toBe("up");
    const [url, body, config] = mocks.post.mock.calls[0];
    expect(url).toMatch(/prompt-feedback$/);
    expect(body).toMatchObject({
      workspace_id: "ws-1",
      trace_id: "trace-1",
      vote: "up",
    });
    expect(config?.headers).toMatchObject({ "X-Workspace-Id": "ws-1" });
  });

  it("prefers planner explanation summary when provided", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-summary",
          workspace_id: "ws-1",
          vertical_norm: "education",
          base_domain_id: 6,
          domain_name: "Enrollment",
        },
        sql_json: {
          ...baseSqlJson,
          domainId: 6,
        },
        validation: {
          is_valid: true,
          errors: [],
          repairs_applied: [],
        },
        explanation: {
          summary: "Using enrollment records to answer your question.",
          summary_source: "llm",
        },
      },
    });

    const result = await requestQueryStudioSuggestions({
      workspaceId: "ws-1",
      activeSection: "AI First",
      sqlJson: baseSqlJson as any,
      userPrompt: "show enrollment",
    });

    expect(result.message).toBe("Using enrollment records to answer your question.");
    expect(result.plannerMeta?.explanation?.summary_source).toBe("llm");
  });

  it("omits currentSqlJson when no SQL context is provided", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-1",
          workspace_id: "ws-1",
          vertical_norm: "education",
          base_domain_id: 9,
          domain_name: null,
          intent: "list",
          selects: { dimensions: [], metrics: [] },
          filters: [],
          time: null,
          grouping: null,
          debug: null,
        },
        sql_json: baseSqlJson,
        validation: { is_valid: true, errors: [], repairs_applied: [] },
        trace_id: "trace-1",
      },
    });

    await requestQueryStudioSuggestions({
      workspaceId: "ws-1",
      activeSection: "AI First",
      userPrompt: "Start fresh",
    });

    const [, body] = mocks.post.mock.calls[0];
    expect(body).not.toHaveProperty("currentSqlJson");
    expect(body).not.toHaveProperty("domainContext");
    expect(body).not.toHaveProperty("candidates");
    expect(body).not.toHaveProperty("workspace_id");
    expect(body).not.toHaveProperty("workspaceId");
    expect(body.base_domain_id).toBeNull();
  });

  it("returns validation-state response when envelope is valid but validation fails", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-bad",
          workspace_id: "ws-1",
          vertical_norm: "education",
          base_domain_id: 6,
          selects: { dimensions: [], metrics: [] },
          filters: [],
          time: null,
          grouping: null,
        },
        validation: {
          is_valid: false,
          errors: [
            {
              code: "invalid_dimension_column",
              path: "selects.dimensions[0]",
              message: "Dimension is not valid for selected domain.",
            },
          ],
          repairs_applied: [],
        },
        trace_id: "trace-bad",
      },
    });

    const result = await requestQueryStudioSuggestions({
      workspaceId: "ws-1",
      activeSection: "AI First",
      userPrompt: "bad backend payload",
    });

    expect(result.message).toMatch(/Plan validation failed/i);
    expect(result.plannerMeta?.validation.is_valid).toBe(false);
    expect(result.plannerMeta?.validation.errors).toEqual([
      {
        code: "invalid_dimension_column",
        path: "selects.dimensions[0]",
        message: "Dimension is not valid for selected domain.",
      },
    ]);
    expect(result.plannerMeta?.traceId).toBe("trace-bad");
    expect(result.suggestions[0].sqlJson).toBeUndefined();
  });

  it("fails safely when planner response envelope is malformed", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-bad",
          workspace_id: "ws-1",
          vertical_norm: "education",
          base_domain_id: 6,
        },
      },
    });

    await expect(
      requestQueryStudioSuggestions({
        workspaceId: "ws-1",
        activeSection: "AI First",
        userPrompt: "malformed payload",
      })
    ).rejects.toMatchObject({
      name: "AiSuggestApiError",
      message: "AI returned invalid structured output",
      status: 500,
    });
  });

  it("maps statuses to user-facing errors while preserving backend payload messages", () => {
    expect(
      toAiSuggestUserMessage(
        new AiSuggestApiError("Request failed with status code 400", {
          status: 400,
        })
      )
    ).toBe(
      "Invalid planner request. Check prompt and workspace header."
    );
    expect(
      toAiSuggestUserMessage(
        new AiSuggestApiError("Request failed with status code 500", {
          status: 500,
        })
      )
    ).toBe(
      "AI returned invalid structured output"
    );
    expect(
      toAiSuggestUserMessage(
        new AiSuggestApiError("Request failed with status code 502", {
          status: 502,
        })
      )
    ).toBe(
      "AI service unavailable"
    );
    expect(
      toAiSuggestUserMessage(
        new AiSuggestApiError("Backend said no", {
          status: 500,
          details: { message: "Domain planner disabled for this workspace." },
        })
      )
    ).toBe("Domain planner disabled for this workspace.");
  });

  it("surfaces typed status details from backend failures", async () => {
    mocks.post.mockRejectedValueOnce({
      isAxiosError: true,
      message: "bad request",
      response: {
        status: 400,
        data: { error: "Invalid prompt" },
      },
    });

    await expect(
      aiSuggest(
        {
          mode: "columns",
          prompt: "bad prompt",
          currentSqlJson: baseSqlJson as any,
        },
        { workspaceId: "ws-1" }
      )
    ).rejects.toMatchObject({
      name: "AiSuggestApiError",
      status: 400,
      message: "Invalid prompt",
    });
  });

  it("throws abort error when request is cancelled", async () => {
    setAiSuggestMockEnabledForTests(true);
    const controller = new AbortController();
    controller.abort();

    await expect(
      aiSuggest(
        {
          mode: "columns",
          prompt: "find columns",
          currentSqlJson: baseSqlJson as any,
        },
        { signal: controller.signal, workspaceId: "ws-1" }
      )
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
