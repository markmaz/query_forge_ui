import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";

import { createAppStore, type RootState } from "../../../../app/providers/store";
import { server } from "../../../../test/msw/server";
import ForgeInsightsPage from "../ForgeInsightsPage";

function renderPage(preloadedState?: Partial<RootState>) {
  const store = createAppStore(preloadedState);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/forge-insights"]}>
          <ForgeInsightsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

const preloadedState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "user-1" },
    rolesByProduct: {},
    capabilities: [],
    loading: false,
    initialized: true,
    error: null,
  },
  userWorkspaces: {
    selectedWorkspaceId: "ws-123",
  },
} as Partial<RootState>;

describe("ForgeInsightsPage", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  beforeEach(() => {
    server.use(
      http.get("*/chat/forge-insights/conversations", () =>
        HttpResponse.json({
          conversations: [],
        })
      ),
      http.get("*/chat/forge-insights/conversations/:conversationId", ({ params }) =>
        HttpResponse.json({
          conversation_id: String(params.conversationId ?? ""),
          messages: [],
        })
      )
    );
  });

  afterEach(() => {
    server.resetHandlers();
    window.localStorage.clear();
  });

  afterAll(() => {
    server.close();
  });

  it("renders Conversations navigation with buckets", async () => {
    server.use(
      http.get("*/forge-insights/projects", () => HttpResponse.json({ projects: [] })),
      http.get("*/forge-insights/threads", () => HttpResponse.json({ threads: [] }))
    );

    renderPage(preloadedState);

    expect(await screen.findByRole("heading", { name: "Conversations" })).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start a new conversation/i })).toBeInTheDocument();
  });

  it("creates a thread, sends chat, and patches thread preview metadata", async () => {
    let seenWorkspaceHeader: string | null = null;
    let seenPatchBody: Record<string, unknown> | null = null;

    server.use(
      http.get("*/forge-insights/projects", () => HttpResponse.json({ projects: [] })),
      http.get("*/forge-insights/threads", () => HttpResponse.json({ threads: [] })),
      http.post("*/forge-insights/threads", ({ request }) => {
        seenWorkspaceHeader = request.headers.get("x-workspace-id");
        return HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        });
      }),
      http.get("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
          messages: [],
        })
      ),
      http.post("*/chat/forge-insights", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toMatchObject({
          conversation_id: "conv-1",
          messages: [{ role: "user", content: "Hello Forge" }],
          temperature: 0.2,
          max_tokens: 512,
          debug: false,
        });
        return HttpResponse.json({
          conversation_id: "conv-1",
          message: {
            role: "assistant",
            content: "Assistant answer",
          },
        });
      }),
      http.patch("*/forge-insights/threads/thread-1", async ({ request }) => {
        seenPatchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: "Hello Forge",
          preview_text: "Assistant answer",
          is_pinned: false,
          is_archived: false,
          last_message_at: "2026-03-02T02:00:00Z",
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T02:00:00Z",
        });
      })
    );

    renderPage(preloadedState);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^message$/i), "Hello Forge");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    const assistantAnswerMatches = await screen.findAllByText("Assistant answer");
    expect(assistantAnswerMatches.length).toBeGreaterThan(0);
    expect(seenWorkspaceHeader).toBe("ws-123");
    expect(seenPatchBody).toEqual(
      expect.objectContaining({
        preview_text: expect.any(String),
        last_message_at: expect.any(String),
        title: "Hello Forge",
      })
    );
  });

  it("keeps draft text when chat request fails", async () => {
    server.use(
      http.get("*/forge-insights/projects", () => HttpResponse.json({ projects: [] })),
      http.get("*/forge-insights/threads", () => HttpResponse.json({ threads: [] })),
      http.post("*/forge-insights/threads", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        })
      ),
      http.get("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
          messages: [],
        })
      ),
      http.post("*/chat/forge-insights", () =>
        HttpResponse.json({ detail: "backend exploded" }, { status: 500 })
      )
    );

    renderPage(preloadedState);
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^message$/i);

    await user.type(input, "Please fail");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(input).toHaveValue("Please fail");
  });

  it("switches send to cancel and stops processing in-flight chat request", async () => {
    server.use(
      http.get("*/forge-insights/projects", () => HttpResponse.json({ projects: [] })),
      http.get("*/forge-insights/threads", () => HttpResponse.json({ threads: [] })),
      http.post("*/forge-insights/threads", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        })
      ),
      http.get("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
          messages: [],
        })
      ),
      http.post("*/chat/forge-insights", async ({ request }) => {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 300);
        });
        return HttpResponse.json({
          conversation_id: "conv-1",
          message: { role: "assistant", content: "Slow assistant answer" },
        });
      })
    );

    renderPage(preloadedState);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^message$/i), "Cancel this");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
    });
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    expect(screen.queryByText("Slow assistant answer")).not.toBeInTheDocument();
  });

  it("renders education pipeline mode with query card and inline results", async () => {
    server.use(
      http.get("*/forge-insights/projects", () => HttpResponse.json({ projects: [] })),
      http.get("*/forge-insights/threads", () => HttpResponse.json({ threads: [] })),
      http.post("*/forge-insights/threads", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        })
      ),
      http.get("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
          messages: [],
        })
      ),
      http.post("*/chat/forge-insights", () =>
        HttpResponse.json({
          mode: "education_pipeline",
          route: "plan_domain",
          conversation_id: "conv-1",
          trace_id: "trace-1",
          message: { role: "assistant", content: "I started your query." },
          plan_result: {
            sql_json: { version: 1 },
            validation: { is_valid: true, errors: [], repairs_applied: [] },
          },
          execution: { jobId: "job-1", statementId: "stmt-1" },
          execution_status_code: 200,
          route_decision: {
            route: "plan_domain",
            confidence: 0.91,
            reason: "education intent",
            method: "llm",
          },
        })
      ),
      http.get("*/executions/job-1/status", () =>
        HttpResponse.json({
          jobId: "job-1",
          statementId: "stmt-1",
          status: "SUCCEEDED",
        })
      ),
      http.get("*/executions/job-1/results", () =>
        HttpResponse.json({
          columns: [{ key: "student_name", label: "Student Name" }],
          rows: [{ student_name: "Holden Black" }],
          total: 1,
          assistant_message: {
            role: "assistant",
            kind: "execution_result",
            format: "markdown",
            content: "### Results\n\n| Student Name |\n| --- |\n| Holden Black |",
          },
        })
      ),
      http.patch("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: "Start pipeline",
          preview_text: "I started your query.",
          is_pinned: false,
          is_archived: false,
          last_message_at: "2026-03-02T02:00:00Z",
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T02:00:00Z",
        })
      )
    );

    renderPage(preloadedState);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^message$/i), "Start pipeline");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Results")).toBeInTheDocument();
    expect((await screen.findAllByText("Holden Black")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Query started")).not.toBeInTheDocument();
    expect(screen.queryByText("job-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show table/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show table/i }));
    expect((await screen.findAllByText("Holden Black")).length).toBeGreaterThan(1);
  });

  it("defaults ADM-shaped execution results to pivot view and supports raw toggle", async () => {
    server.use(
      http.get("*/forge-insights/projects", () => HttpResponse.json({ projects: [] })),
      http.get("*/forge-insights/threads", () => HttpResponse.json({ threads: [] })),
      http.post("*/forge-insights/threads", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        })
      ),
      http.get("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
          messages: [],
        })
      ),
      http.post("*/chat/forge-insights", () =>
        HttpResponse.json({
          mode: "education_pipeline",
          route: "plan_domain",
          conversation_id: "conv-1",
          trace_id: "trace-1",
          message: { role: "assistant", content: "Running ADM query." },
          plan_result: {
            sql_json: { version: 1 },
            validation: { is_valid: true, errors: [], repairs_applied: [] },
          },
          execution: { jobId: "job-1", statementId: "stmt-1" },
          execution_status_code: 200,
          route_decision: null,
        })
      ),
      http.get("*/executions/job-1/status", () =>
        HttpResponse.json({
          jobId: "job-1",
          statementId: "stmt-1",
          status: "SUCCEEDED",
        })
      ),
      http.get("*/executions/job-1/results", () =>
        HttpResponse.json({
          columns: [
            { key: "school_year", label: "School Year" },
            { key: "report_period", label: "Report Period" },
            { key: "total_adm", label: "Total ADM" },
          ],
          rows: [
            { school_year: 2026, report_period: 1, total_adm: 100 },
            { school_year: 2026, report_period: 2, total_adm: 101.25 },
            { school_year: 2025, report_period: 1, total_adm: 99.5 },
          ],
          total: 3,
          assistant_message: {
            role: "assistant",
            kind: "execution_result",
            format: "markdown",
            content: "### ADM summary",
          },
        })
      ),
      http.patch("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: "ADM prompt",
          preview_text: "Running ADM query.",
          is_pinned: false,
          is_archived: false,
          last_message_at: "2026-03-02T02:00:00Z",
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T02:00:00Z",
        })
      )
    );

    renderPage(preloadedState);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^message$/i), "ADM prompt");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("ADM summary")).toBeInTheDocument();

    const showTableButton = await screen.findByRole("button", { name: /show table/i });
    await user.click(showTableButton);

    expect(screen.getByRole("button", { name: /pivot view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /raw rows/i })).toBeInTheDocument();
    expect(screen.getAllByText("Grand total").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /raw rows/i }));
    expect(await screen.findByText("school_year")).toBeInTheDocument();
    expect(await screen.findByText("total_adm")).toBeInTheDocument();
  });

  it("renders education pipeline execution failure and supports retry", async () => {
    server.use(
      http.get("*/forge-insights/projects", () => HttpResponse.json({ projects: [] })),
      http.get("*/forge-insights/threads", () => HttpResponse.json({ threads: [] })),
      http.post("*/forge-insights/threads", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        })
      ),
      http.get("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
          messages: [],
        })
      ),
      http.post("*/chat/forge-insights", () =>
        HttpResponse.json({
          mode: "education_pipeline",
          route: "plan_domain",
          conversation_id: "conv-1",
          trace_id: "trace-1",
          message: { role: "assistant", content: "I started your query." },
          plan_result: {
            sql_json: { version: 1 },
            validation: { is_valid: true, errors: [], repairs_applied: [] },
          },
          execution: { jobId: "job-1", statementId: "stmt-1" },
          execution_status_code: 200,
          route_decision: null,
        })
      ),
      http.get("*/executions/job-1/status", () =>
        HttpResponse.json({
          jobId: "job-1",
          statementId: "stmt-1",
          status: "FAILED",
          error: "warehouse timeout",
        })
      ),
      http.patch("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: "Start pipeline",
          preview_text: "I started your query.",
          is_pinned: false,
          is_archived: false,
          last_message_at: "2026-03-02T02:00:00Z",
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T02:00:00Z",
        })
      )
    );

    renderPage(preloadedState);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^message$/i), "Start pipeline");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/warehouse timeout/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows retry when execution polling times out", async () => {
    server.use(
      http.get("*/forge-insights/projects", () => HttpResponse.json({ projects: [] })),
      http.get("*/forge-insights/threads", () => HttpResponse.json({ threads: [] })),
      http.post("*/forge-insights/threads", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        })
      ),
      http.get("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: null,
          preview_text: null,
          is_pinned: false,
          is_archived: false,
          last_message_at: null,
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
          messages: [],
        })
      ),
      http.post("*/chat/forge-insights", () =>
        HttpResponse.json({
          mode: "education_pipeline",
          route: "plan_domain",
          conversation_id: "conv-1",
          trace_id: "trace-1",
          message: { role: "assistant", content: "I started your query." },
          plan_result: {
            sql_json: { version: 1 },
            validation: { is_valid: true, errors: [], repairs_applied: [] },
          },
          execution: { jobId: "job-1", statementId: "stmt-1" },
          execution_status_code: 200,
          route_decision: null,
        })
      ),
      http.get("*/executions/job-1/status", () =>
        HttpResponse.json({
          jobId: "job-1",
          statementId: "stmt-1",
          status: "TIMEOUT",
        })
      ),
      http.patch("*/forge-insights/threads/thread-1", () =>
        HttpResponse.json({
          id: "thread-1",
          project_id: null,
          conversation_id: "conv-1",
          title: "Start pipeline",
          preview_text: "I started your query.",
          is_pinned: false,
          is_archived: false,
          last_message_at: "2026-03-02T02:00:00Z",
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T02:00:00Z",
        })
      )
    );

    renderPage(preloadedState);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^message$/i), "Start pipeline");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/Execution is still running/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
