import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AiCopilotDrawer } from ".././AiCopilotDrawer";
import type { SqlQueryJson } from "../../../model/sqlJson";

const mockRequest = vi.fn();

vi.mock(".././aiCopilotApi", () => ({
  requestQueryStudioSuggestions: (...args: unknown[]) => mockRequest(...args),
  toAiSuggestUserMessage: () => "Unable to get suggestions right now.",
  emitAiSuggestTelemetry: vi.fn(),
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders context-specific quick actions", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <AiCopilotDrawer
        activeSection="Domain"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={onApply}
        onClose={onClose}
      />
    );

    expect(screen.getByRole("button", { name: /help me pick a domain/i })).toBeInTheDocument();

    rerender(
      <AiCopilotDrawer
        activeSection="Data Prep"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={onApply}
        onClose={onClose}
      />
    );

    expect(screen.getByRole("button", { name: /suggest data cleanup rules/i })).toBeInTheDocument();

    rerender(
      <AiCopilotDrawer
        activeSection="Filters"
        workspaceId="ws-1"
        sqlJson={baseSqlJson}
        onApplySuggestion={onApply}
        onClose={onClose}
      />
    );

    expect(screen.getByRole("button", { name: /suggest filters/i })).toBeInTheDocument();
  });

  it("shows only starter quick action in AI First and populates random prompt", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
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

    const starterButton = screen.getByRole("button", { name: /help me start this query/i });
    expect(starterButton).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /suggest a plan from my goal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /build a starter query/i })).not.toBeInTheDocument();

    await user.click(starterButton);
    expect(screen.getByLabelText(/goal/i)).toHaveValue(
      "Show student enrollment by grade level for the current school year."
    );
  });

  it("submits a prompt and renders suggestion cards", async () => {
    mockRequest.mockResolvedValueOnce({
      message: "Suggestions ready",
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

    expect(await screen.findByText(/suggestions ready/i)).toBeInTheDocument();
    expect(screen.getByText(/add starter columns/i)).toBeInTheDocument();
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

    expect(await screen.findByRole("button", { name: /stop generating/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /stop generating/i }));
    expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
  });
});
