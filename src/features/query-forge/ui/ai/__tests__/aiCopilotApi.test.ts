import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  getApiWorkspaceId: vi.fn(),
}));

vi.mock("../../../../../shared/services/api", () => ({
  default: {
    post: mocks.post,
  },
  getApiWorkspaceId: mocks.getApiWorkspaceId,
}));

import {
  AiSuggestApiError,
  aiSuggest,
  planDomainNextActions,
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
    mocks.getApiWorkspaceId.mockReturnValue(null);
  });

  afterEach(() => {
    setAiSuggestMockEnabledForTests(null);
  });

  it("posts planner prompts to /planner/plan_domain with workspace header", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        conversation_id: "conv-1",
        trace_id: "trace-1",
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-1",
          workspace_id: "ws-1",
          vertical_norm: "education",
          base_domain_id: 7,
          domain_name: "Student Outcomes",
          intent: "list",
          selects: { dimensions: [], metrics: [] },
          filters: [],
          time: null,
          grouping: null,
          debug: null,
        },
        validation: {
          is_valid: true,
          errors: [],
          repairs_applied: [],
        },
        sql_json: {
          ...baseSqlJson,
          domainId: 7,
          columns: [{ modelColumnId: 101, columnName: "patient_id", workspaceTableId: 10 }],
        },
        explanation: {
          summary: "Added patient id based on your prompt.",
          summary_source: "llm",
          domain: {
            selected_domain_name: "Student Outcomes",
            reason: "Best match",
          },
          dimensions: [],
          metrics: [],
          filters: [],
        },
        edits: [
          {
            op: "addSelect",
            col: {
              modelColumnId: 101,
              columnName: "patient_id",
              workspaceTableId: 10,
              exprId: null,
              alias: null,
            },
          },
        ],
        next_actions_status: "deferred",
        next_actions: [],
        timings_ms: { total: 12 },
        debug: {
          model: "qwen25-14b",
          attempts: 1,
        },
      },
      headers: {},
    });

    const result = await requestQueryStudioSuggestions({
      workspaceId: "ws-1",
      activeSection: "Columns",
      sqlJson: baseSqlJson as any,
      userPrompt: "Select patient id",
      conversationId: "conv-1",
      verticalNorm: "education",
      baseDomainId: 7,
      fastMode: true,
      debug: true,
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mocks.post.mock.calls[0];
    expect(url).toMatch(/\/planner\/plan_domain$/);
    expect(body).toMatchObject({
      prompt: "Select patient id",
      vertical_norm: "generic",
      conversation_id: "conv-1",
      base_domain_id: 7,
      fast_mode: true,
      debug: true,
      next_actions_async: true,
    });
    expect(body).not.toHaveProperty("workspace_id");
    expect(body).not.toHaveProperty("workspaceId");
    expect(config?.headers).toMatchObject({ "X-Workspace-Id": "ws-1" });
    expect(result.message).toBe("Added patient id based on your prompt.");
    expect(result.suggestions[0].actions).toHaveLength(1);
    expect(result.suggestions[0].sqlJson?.columns?.[0]?.columnName).toBe("patient_id");
  });

  it("posts follow-up requests to /planner/plan_domain/next_actions with workspace header", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        next_actions_status: "ready",
        next_actions: [
          {
            label: "Break down by grade",
            prompt: "Break this down by grade",
          },
        ],
      },
    });

    const payload = await planDomainNextActions(
      {
        workspace_id: "ws-1",
        prompt: "Show enrollment",
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-1",
          workspace_id: "ws-1",
          vertical_norm: "education",
          base_domain_id: 7,
        } as any,
        conversation_id: "conv-1",
        trace_id: "trace-1",
      },
      { workspaceId: "ws-1" }
    );

    expect(payload.next_actions_status).toBe("ready");
    const [url, body, config] = mocks.post.mock.calls[0];
    expect(url).toMatch(/\/planner\/plan_domain\/next_actions$/);
    expect(body).toMatchObject({
      workspace_id: "ws-1",
      prompt: "Show enrollment",
      conversation_id: "conv-1",
      trace_id: "trace-1",
    });
    expect(config?.headers).toMatchObject({ "X-Workspace-Id": "ws-1" });
  });

  it("normalizes optional candidates payload to strict arrays", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        edits: [],
        explanation: "OK",
        confidence: 0.8,
        sqlJson: baseSqlJson,
        debug: { model: "qwen25-14b", attempts: 1 },
      },
      headers: {},
    });

    await aiSuggest(
      {
        mode: "domains",
        prompt: "pick a domain",
        domainContext: {
          selectedDomainId: 11,
          domainCandidates: [{ domainId: 11, domainName: "Enrollment" } as any],
        } as any,
        candidates: {
          tables: [{ tableName: "dim_student", score: 0.8 } as any],
          columns: [{ columnName: "student_id", label: "Student ID", description: "", score: 0.9 } as any],
        } as any,
      },
      { workspaceId: "ws-1" }
    );

    const [, body] = mocks.post.mock.calls[0];
    expect(body.domainContext).toEqual({
      selectedDomainId: 11,
      domainCandidates: [
        {
          domainId: 11,
          name: "Enrollment",
          description: "",
          domainName: "Enrollment",
        },
      ],
    });
    expect(body.candidates.tables[0].reasons).toEqual([]);
    expect(body.candidates.columns[0].reasons).toEqual([]);
  });

  it("omits optional planner request fields when no context is provided", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        plan_json_v2: {
          schema_version: 2,
          trace_id: "trace-optional",
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
        validation: {
          is_valid: true,
          errors: [],
          repairs_applied: [],
        },
        sql_json: baseSqlJson,
        explanation: { summary: "Fresh plan", summary_source: "llm" },
      },
      headers: {},
    });

    await requestQueryStudioSuggestions({
      workspaceId: "ws-1",
      activeSection: "AI First",
      userPrompt: "Start fresh",
    });

    const [, body] = mocks.post.mock.calls[0];
    expect(body).toMatchObject({
      prompt: "Start fresh",
      vertical_norm: "generic",
      next_actions_async: true,
    });
    expect(body).not.toHaveProperty("conversation_id");
    expect(body).not.toHaveProperty("base_domain_id");
    expect(body).not.toHaveProperty("fast_mode");
    expect(body).not.toHaveProperty("debug");
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

  it("uses api workspace when explicit workspace override is not passed", async () => {
    mocks.getApiWorkspaceId.mockReturnValue("ws-from-api");
    mocks.post.mockResolvedValueOnce({
      data: {
        edits: [],
        explanation: "No explicit workspace header",
        confidence: 0.5,
        sqlJson: baseSqlJson,
        debug: { model: "qwen25-14b", attempts: 1 },
      },
      headers: {},
    });

    const result = await aiSuggest({
      mode: "ai_first",
      prompt: "No workspace",
    });

    expect(result.explanation).toBe("No explicit workspace header");
    const [, , config] = mocks.post.mock.calls[0];
    expect(config?.headers).toEqual({ "X-Workspace-Id": "ws-from-api" });
  });

  it("omits explicit workspace header when no workspace id is available", async () => {
    mocks.getApiWorkspaceId.mockReturnValue(null);
    mocks.post.mockResolvedValueOnce({
      data: {
        edits: [],
        explanation: "No workspace provided",
        confidence: 0.5,
        sqlJson: baseSqlJson,
        debug: { model: "qwen25-14b", attempts: 1 },
      },
      headers: {},
    });

    const result = await aiSuggest({
      mode: "ai_first",
      prompt: "No workspace",
    });

    expect(result.explanation).toBe("No workspace provided");
    const [, , config] = mocks.post.mock.calls[0];
    expect(config?.headers).toBeUndefined();
  });

  it("maps statuses to user-facing errors while preserving backend payload messages", () => {
    expect(
      toAiSuggestUserMessage(
        new AiSuggestApiError("Request failed with status code 400", {
          status: 400,
        })
      )
    ).toBe("Invalid AI suggest request. Check prompt, payload, and workspace header.");
    expect(
      toAiSuggestUserMessage(
        new AiSuggestApiError("Request failed with status code 500", {
          status: 500,
        })
      )
    ).toBe("AI returned invalid structured output");
    expect(
      toAiSuggestUserMessage(
        new AiSuggestApiError("Request failed with status code 502", {
          status: 502,
        })
      )
    ).toBe("AI service unavailable");
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
        data: { error: "Invalid request", details: ["prompt is required"] },
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
      message: "Invalid request",
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
