import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AiCopilotDrawer } from ".././AiCopilotDrawer";
import type { SqlQueryJson } from "../../../model/sqlJson";

const mockRequest = vi.fn();
const mockPlanDomainNextActions = vi.fn();
const mockSubmitPromptFeedback = vi.fn();
const mockEmitPromptFeedbackTelemetry = vi.fn();
const mockEmitNextActionTelemetry = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();

vi.mock(".././aiCopilotApi", () => ({
  requestQueryStudioSuggestions: (...args: unknown[]) => mockRequest(...args),
  planDomainNextActions: (...args: unknown[]) => mockPlanDomainNextActions(...args),
  submitPromptFeedback: (...args: unknown[]) => mockSubmitPromptFeedback(...args),
  toAiSuggestUserMessage: () => "Unable to get suggestions right now.",
  emitAiSuggestTelemetry: vi.fn(),
  emitPromptFeedbackTelemetry: (...args: unknown[]) => mockEmitPromptFeedbackTelemetry(...args),
  emitNextActionTelemetry: (...args: unknown[]) => mockEmitNextActionTelemetry(...args),
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

const baseSqlJson: SqlQueryJson = {
  version: 1,
  domainId: null,
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
};

describe("AiCopilotDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRequest.mockReset();
    mockPlanDomainNextActions.mockReset();
    mockSubmitPromptFeedback.mockReset();
    mockEmitPromptFeedbackTelemetry.mockReset();
    mockEmitNextActionTelemetry.mockReset();
    mockToastError.mockReset();
    mockToastWarning.mockReset();
    mockSubmitPromptFeedback.mockImplementation(async (payload: { vote: "up" | "down" }) => ({
      id: "pfb-1",
      created_at: "2026-02-27T00:00:00Z",
      updated_at: "2026-02-27T00:00:00Z",
      vote: payload.vote,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps copilot UI in ai-first mode without section quick actions", () => {
    render(
      <AiCopilotDrawer
        activeSection="Domain"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /help me start this query/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /help me pick a domain/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /suggest data cleanup rules/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/quick ai actions/i)).not.toBeInTheDocument();
  });

  it("submits a prompt and renders why-this-answer with apply action", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Suggestions ready",
      plannerMeta: {
        route: "plan_domain",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-submit-1",
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
        explanation: {
          summary: "Using enrollment fields based on your request.",
          summary_source: "llm",
          domain: {
            selected_domain_name: "Enrollment",
            reason: "Contains student enrollment records.",
          },
          dimensions: [],
          metrics: [],
          filters: [],
        },
      },
      suggestions: [
        {
          id: "s1",
          title: "Add starter columns",
          why: "Needed for preview",
          confidence: "high",
          actions: [
            {
              op: "addSelect",
              col: { modelColumnId: null, columnName: "patient_id", workspaceTableId: null },
            },
          ],
        },
      ],
    });

    const user = userEvent.setup();

    render(
      <AiCopilotDrawer
        activeSection="Columns"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Suggest columns");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/using enrollment fields based on your request/i)).toBeInTheDocument();
    expect(screen.getByText(/why this answer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply changes/i })).toBeInTheDocument();
  });

  it("keeps previous suggestion cards actionable and allows per-response feedback", async () => {
    mockRequest
      .mockResolvedValueOnce({
        message: "First response",
        plannerMeta: {
          route: "plan_domain",
          planJsonV2: {
            schema_version: 2,
            trace_id: "trace-first",
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
          explanation: {
            summary: "First planner response.",
            summary_source: "llm",
            domain: { selected_domain_name: "Enrollment", reason: "Domain match." },
            dimensions: [],
            metrics: [],
            filters: [],
          },
        },
        suggestions: [
          {
            id: "s1",
            title: "First suggestion",
            why: "First plan",
            confidence: "high",
            actions: [
              {
                op: "addSelect",
                col: { modelColumnId: null, columnName: "patient_id", workspaceTableId: null },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        message: "Second response",
        plannerMeta: {
          route: "plan_domain",
          planJsonV2: {
            schema_version: 2,
            trace_id: "trace-second",
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
          explanation: {
            summary: "Second planner response.",
            summary_source: "deterministic",
            domain: { selected_domain_name: "Enrollment", reason: "Domain match." },
            dimensions: [],
            metrics: [],
            filters: [],
          },
        },
        suggestions: [
          {
            id: "s2",
            title: "Second suggestion",
            why: "Second plan",
            confidence: "medium",
            actions: [
              {
                op: "addFilter",
                col: { modelColumnId: null, columnName: "patient_gender", workspaceTableId: null },
                operator: "equals",
                value: "F",
              },
            ],
          },
        ],
      });

    const user = userEvent.setup();
    const onApplySuggestion = vi.fn();

    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={onApplySuggestion}
        onClose={vi.fn()}
      />
    );

    const goalInput = screen.getByLabelText(/goal/i);
    await user.type(goalInput, "first prompt");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/first planner response/i);

    await user.clear(goalInput);
    await user.type(goalInput, "second prompt");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/second planner response/i);

    const applyButtons = screen.getAllByRole("button", { name: /apply changes/i });
    expect(applyButtons).toHaveLength(2);

    await user.click(applyButtons[0]!);
    expect(onApplySuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ title: "First suggestion" })
    );

    const thumbsUpButtons = screen.getAllByRole("button", {
      name: /rate response helpful/i,
    });
    await user.click(thumbsUpButtons[0]!);
    expect(thumbsUpButtons[0]).toHaveClass("is-active");
    await waitFor(() => {
      expect(mockSubmitPromptFeedback).toHaveBeenCalled();
    });
  });

  it("sends prompt feedback payload for thumbs up and down", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Response ready",
      plannerMeta: {
        route: "plan_domain",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-feedback",
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
        traceId: "trace-feedback",
        timingsMs: { total: 12 },
      },
      rawResponse: {
        trace_id: "trace-feedback",
        plan_json_v2: {
          base_domain_id: 6,
          intent: "list",
          domain_version: 4,
        },
        debug: { model: "qwen25-14b" },
      },
      suggestions: [
        {
          id: "s1",
          title: "Apply AI query plan",
          why: "Use sql json",
          confidence: "high",
          actions: [],
          sqlJson: baseSqlJson,
          debug: { model: "qwen25-14b", attempts: 1 },
        },
      ],
    });

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Find holden black");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/response ready/i);

    const thumbsUp = screen.getByRole("button", { name: /rate response helpful/i });
    const thumbsDown = screen.getByRole("button", { name: /rate response not helpful/i });

    await user.click(thumbsUp);
    await waitFor(() => {
      expect(mockSubmitPromptFeedback).toHaveBeenCalledTimes(1);
    });
    expect(mockSubmitPromptFeedback.mock.calls[0]?.[0]).toMatchObject({
      workspace_id: "ws-1",
      trace_id: "trace-feedback",
      vote: "up",
      prompt_text: "Find holden black",
      meta: {
        model: "qwen25-14b",
        domain_id: 6,
        domain_version: 4,
        intent: "list",
      },
    });
    expect(mockSubmitPromptFeedback.mock.calls[0]?.[1]).toMatchObject({
      workspaceId: "ws-1",
    });

    await user.click(thumbsDown);
    await waitFor(() => {
      expect(mockSubmitPromptFeedback).toHaveBeenCalledTimes(2);
    });
    expect(mockSubmitPromptFeedback.mock.calls[1]?.[0]).toMatchObject({
      vote: "down",
      trace_id: "trace-feedback",
    });
  });

  it("optimistically marks feedback and rolls back on failure", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Response ready",
      plannerMeta: {
        route: "plan_domain",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-feedback-fail",
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
      },
      suggestions: [
        {
          id: "s1",
          title: "Apply AI query plan",
          why: "Use sql json",
          confidence: "high",
          actions: [],
          sqlJson: baseSqlJson,
        },
      ],
    });

    let rejectFeedback: ((reason?: unknown) => void) | null = null;
    mockSubmitPromptFeedback.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFeedback = reject;
        })
    );

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Find holden black");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/response ready/i);

    const thumbsUp = screen.getByRole("button", { name: /rate response helpful/i });
    const thumbsDown = screen.getByRole("button", { name: /rate response not helpful/i });

    await user.click(thumbsUp);
    expect(thumbsUp).toHaveClass("is-active");
    expect(thumbsUp).toBeDisabled();
    expect(thumbsDown).toBeDisabled();

    rejectFeedback?.(new Error("save failed"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Could not save feedback. Please try again.");
    });
    expect(thumbsUp).not.toHaveClass("is-active");
    expect(thumbsUp).toBeEnabled();
    expect(thumbsDown).toBeEnabled();
  });

  it("shows a check icon after copying a user prompt", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Copy-ready response",
      plannerMeta: {
        route: "plan_domain",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-copy",
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
      },
      suggestions: [],
    });

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Copy this prompt");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/copy-ready response/i);

    const copyButton = screen.getByRole("button", { name: /copy prompt/i });
    await user.click(copyButton);

    const copiedButton = screen.getByRole("button", { name: /prompt copied/i });
    expect(copiedButton.querySelector(".fa-check")).not.toBeNull();
  });

  it("shows planner details in collapsed why-this-answer section", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Planner result ready",
      plannerMeta: {
        route: "plan_domain",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-123",
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
          repairs_applied: ["normalized_filter_value"],
        },
        explanation: {
          summary: "Using enrollment data for this request.",
          summary_source: "llm",
          domain: {
            selected_domain_name: "Enrollment",
            reason: "Contains relevant enrollment records.",
          },
          dimensions: [],
          metrics: [],
          filters: [],
        },
        traceId: "trace-123",
        timingsMs: { total: 10 },
      },
      suggestions: [
        {
          id: "s1",
          title: "Apply AI query plan",
          why: "Use sql json",
          confidence: "high",
          actions: [],
          sqlJson: baseSqlJson,
        },
      ],
    });

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Find Holden Black");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/using enrollment data for this request/i)).toBeInTheDocument();
    expect(screen.queryByText(/domain chosen/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /see more/i }));
    expect(screen.getByText(/domain chosen/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Enrollment/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /apply changes/i })).toBeInTheDocument();
  });

  it("shows validation failure details when planner validation is invalid", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Plan validation failed for domain #6. Review validation errors below.",
      plannerMeta: {
        route: "plan_domain",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-invalid",
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
        explanation: {
          summary: "Validation failed while building the plan.",
          summary_source: "deterministic",
          domain: {
            selected_domain_name: "Enrollment",
            reason: "Closest domain match.",
          },
          dimensions: [],
          metrics: [],
          filters: [],
        },
        traceId: "trace-invalid",
        timingsMs: { total: 12 },
      },
      suggestions: [
        {
          id: "s1",
          title: "Apply AI query plan",
          why: "Validation failed",
          confidence: "low",
          actions: [],
        },
      ],
    });

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Find holden black");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    const validationAlert = await screen.findByRole("alert");
    expect(validationAlert).toHaveTextContent(/Plan validation failed/i);
    expect(within(validationAlert).getByText(/invalid_dimension_column/i)).toBeInTheDocument();
    expect(within(validationAlert).getByText(/selects.dimensions\[0\]/i)).toBeInTheDocument();
    expect(within(validationAlert).getByText(/Trace ID:/i)).toBeInTheDocument();
    expect(within(validationAlert).getByText(/Try rephrasing the prompt/i)).toBeInTheDocument();
  });

  it("renders planner next actions when response includes next_actions", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Planner response",
      plannerMeta: {
        route: "plan_domain",
        traceId: "trace-next-actions",
        nextActionsStatus: "ready",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-next-actions",
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
        explanation: {
          summary: "Using enrollment records.",
          summary_source: "llm",
          domain: {
            selected_domain_name: "Enrollment",
            reason: "Best match.",
          },
          dimensions: [],
          metrics: [],
          filters: [],
        },
        nextActions: [
          {
            label: "Break down by school",
            prompt: "Break this down by school",
            reason: "Shows distribution across campuses.",
            intent: "aggregate",
            confidence: 0.86,
            dimensions: ["school_name"],
            metrics: ["total_students"],
            filters: [],
          },
        ],
      },
      suggestions: [],
    });

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Show enrollment");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/next actions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run next action: break down by school/i })).toBeInTheDocument();
    expect(screen.getByText(/shows distribution across campuses/i)).toBeInTheDocument();
    expect(mockPlanDomainNextActions).not.toHaveBeenCalled();
  });

  it("fetches deferred next actions in background and updates next actions area", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Planner response",
      conversationId: "conv-deferred",
      plannerMeta: {
        route: "plan_domain",
        traceId: "trace-deferred",
        conversationId: "conv-deferred",
        nextActionsStatus: "deferred",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-deferred",
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
        nextActions: [],
      },
      suggestions: [],
    });
    mockPlanDomainNextActions.mockImplementationOnce(
      async () =>
        new Promise((resolve) => {
          window.setTimeout(
            () =>
              resolve({
                next_actions_status: "ready",
                next_actions: [
                  {
                    label: "Break down by grade",
                    prompt: "Break this down by grade",
                    reason: "Adds grade-level detail.",
                    intent: "aggregate",
                    confidence: 0.88,
                    dimensions: ["grade_level"],
                    metrics: ["total_students"],
                    filters: [],
                  },
                ],
              }),
            25
          );
        })
    );

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Show enrollment");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/loading next actions/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(mockPlanDomainNextActions).toHaveBeenCalledTimes(1);
    });
    expect(mockPlanDomainNextActions.mock.calls[0]?.[0]).toMatchObject({
      workspace_id: "ws-1",
      prompt: "Show enrollment",
      vertical_norm: "education",
      base_domain_id: 6,
      conversation_id: "conv-deferred",
      trace_id: "trace-deferred",
    });
    expect(await screen.findByRole("button", { name: /run next action: break down by grade/i })).toBeInTheDocument();
  });

  it("clicking a next action runs planner with suggestion prompt", async () => {
    mockRequest
      .mockResolvedValueOnce({
        message: "Planner response",
        conversationId: "conv-1",
        plannerMeta: {
          route: "plan_domain",
          traceId: "trace-next-actions",
          conversationId: "conv-1",
          planJsonV2: {
            schema_version: 2,
            trace_id: "trace-next-actions",
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
          nextActions: [
            {
              label: "Trend over time",
              prompt: "Show this as a trend over time",
              reason: "Tracks change by period.",
              intent: "trend",
              confidence: 0.91,
              dimensions: ["school_year"],
              metrics: ["total_students"],
              filters: [],
            },
          ],
        },
        suggestions: [],
      })
      .mockResolvedValueOnce({
        message: "Follow-up response",
        plannerMeta: {
          route: "plan_domain",
          planJsonV2: {
            schema_version: 2,
            trace_id: "trace-follow-up",
            workspace_id: "ws-1",
            vertical_norm: "education",
            base_domain_id: 6,
            domain_name: "Enrollment",
            intent: "trend",
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
          nextActions: [],
        },
        suggestions: [],
      });

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Show enrollment");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByRole("button", { name: /run next action: trend over time/i });

    await user.click(screen.getByRole("button", { name: /run next action: trend over time/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
    expect(mockRequest.mock.calls[1]?.[0]).toMatchObject({
      userPrompt: "Show this as a trend over time",
      conversationId: "conv-1",
      workspaceId: "ws-1",
    });
  });

  it("fetches next actions when planner response has no next actions", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Planner response",
      plannerMeta: {
        route: "plan_domain",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-no-next-actions",
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
        nextActions: [],
      },
      suggestions: [],
    });
    mockPlanDomainNextActions.mockResolvedValueOnce({
      next_actions_status: "ready",
      next_actions: [
        {
          label: "Filter to active students",
          prompt: "Filter to active students",
          reason: "Narrow to current enrollment.",
          intent: "list",
          confidence: 0.74,
          dimensions: [],
          metrics: [],
          filters: [],
        },
      ],
    });

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Show enrollment");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/planner response/i);
    await waitFor(() => expect(mockPlanDomainNextActions).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("button", { name: /run next action: filter to active students/i })
    ).toBeInTheDocument();
  });

  it("shows non-blocking fallback when deferred next actions request fails", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Planner response still usable",
      conversationId: "conv-deferred-fail",
      plannerMeta: {
        route: "plan_domain",
        traceId: "trace-deferred-fail",
        conversationId: "conv-deferred-fail",
        nextActionsStatus: "deferred",
        planJsonV2: {
          schema_version: 2,
          trace_id: "trace-deferred-fail",
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
        nextActions: [],
      },
      suggestions: [],
    });
    mockPlanDomainNextActions.mockRejectedValueOnce(new Error("network fail"));

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Show enrollment");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/planner response still usable/i)).toBeInTheDocument();
    expect(await screen.findByText(/next actions unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/unable to get suggestions right now/i)).not.toBeInTheDocument();
    expect(mockToastWarning).toHaveBeenCalledWith("Next actions unavailable");
  });

  it("shows inline error state when planner response is malformed", async () => {
    mockRequest.mockRejectedValueOnce(new Error("AI returned invalid structured output"));

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Bad planner payload");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/Unable to get suggestions right now/i)).toBeInTheDocument();
  });

  it("re-enables send after cancelling an in-flight request", async () => {
    mockRequest.mockImplementation(
      () =>
        new Promise(() => {
          // keep pending
        })
    );

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="Columns"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const sendButton = screen.getByRole("button", { name: /^send$/i });
    await user.type(screen.getByLabelText(/goal/i), "long running request");
    await user.click(sendButton);

    expect(screen.getByLabelText(/goal/i)).toHaveValue("");
    expect(screen.getByText("long running request")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();

    expect(await screen.findByRole("button", { name: /stop generating/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /stop generating/i }));
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/goal/i), "retry prompt");
    expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
  });

  it("submits on Enter and keeps newline on Shift+Enter", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Enter submit response",
      suggestions: [],
    });

    const user = userEvent.setup();
    render(
      <AiCopilotDrawer
        activeSection="Columns"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const goalInput = screen.getByLabelText(/goal/i);
    await user.type(goalInput, "line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}line two");
    expect(goalInput).toHaveValue("line one\nline two");

    await user.keyboard("{Enter}");

    expect(await screen.findByText(/line one\s+line two/i)).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("persists chat history across unmount/remount until cleared", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Persisted response",
      suggestions: [],
      rawResponse: { ok: true },
    });

    const user = userEvent.setup();
    const { unmount } = render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Persist this prompt");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(await screen.findByText(/persisted response/i)).toBeInTheDocument();

    unmount();

    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/persist this prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/persisted response/i)).toBeInTheDocument();
  });

  it("clears persisted chat history when user clicks Clear chat", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Clear me",
      suggestions: [],
      rawResponse: { ok: true },
    });

    const user = userEvent.setup();
    const { unmount } = render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/goal/i), "Temporary prompt");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(await screen.findByText(/clear me/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear chat/i }));
    expect(screen.queryByText(/temporary prompt/i)).not.toBeInTheDocument();
    expect(screen.getByText(/start a conversation to build and apply query plans/i)).toBeInTheDocument();

    unmount();

    render(
      <AiCopilotDrawer
        activeSection="AI First"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText(/temporary prompt/i)).not.toBeInTheDocument();
  });
});
