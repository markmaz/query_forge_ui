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
        edits: [
          {
            op: "addGroupBy",
            col: { modelColumnId: null, columnName: "patient_gender", workspaceTableId: null },
          },
          {
            op: "addSort",
            col: { modelColumnId: null, columnName: "patient_id", workspaceTableId: null },
            dir: "asc",
          },
        ],
        explanation: "Planner response",
        confidence: 0.9,
        sqlJson: {
          ...baseSqlJson,
          columns: [{ modelColumnId: null, columnName: "patient_id", workspaceTableId: null }],
        },
        debug: {
          model: "gpt-test",
          attempts: 2,
        },
      },
    });

    const result = await requestQueryStudioSuggestions({
      workspaceId: "ws-1",
      activeSection: "Columns",
      sqlJson: baseSqlJson as any,
      userPrompt: "build me a grouped query",
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(result.message).toBe("Planner response");
    expect(result.debugAttempts).toBe(2);
    expect(result.suggestions[0].actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "addGroupBy" }),
        expect.objectContaining({ op: "addSort", dir: "asc" }),
      ])
    );
    expect(result.suggestions[0].sqlJson?.columns?.[0]?.columnName).toBe("patient_id");
  });

  it("omits currentSqlJson when no SQL context is provided", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        edits: [],
        explanation: "No context",
        confidence: 0.5,
        sqlJson: baseSqlJson,
        debug: { model: "gpt-test", attempts: 1 },
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
  });

  it("maps 400/500/502 statuses to user-facing errors", () => {
    expect(toAiSuggestUserMessage(new AiSuggestApiError("bad", { status: 400 }))).toBe(
      "Invalid AI request"
    );
    expect(toAiSuggestUserMessage(new AiSuggestApiError("bad", { status: 500 }))).toBe(
      "AI returned invalid structured output"
    );
    expect(toAiSuggestUserMessage(new AiSuggestApiError("bad", { status: 502 }))).toBe(
      "AI service unavailable"
    );
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
