import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../test/msw/server";
import PlannerPage from "../PlannerPage";
import { renderSemanticPage } from "./renderSemanticPage";

const userState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "user-1" },
    rolesByProduct: {
      semantic: ["user"],
    },
    capabilities: ["semantic:user"],
    loading: false,
    initialized: true,
    error: null,
  },
  userWorkspaces: {
    selectedWorkspaceId: "ws-88",
  },
};

const plannerPayload = {
  prompt: "show active students",
  deterministic: { matched: [], unmatched_tokens: [] },
  concept_vector: { query_text: "show active students", hits: [] },
  concept_mapping: { concepts: ["students"], mapped_columns: [] },
  column_vector: { filtered_to_candidate_count: 0, hits: [] },
  llm_plan: {
    model: "gpt-4o-mini",
    sql_json: { select: ["student_id"] },
    selected_columns: [{ concept_key: "student_id", model_column_id: 11 }],
    filters: [],
    join_plan: { joins: [] },
    confidence: 0.8,
    notes: ["Looks good"],
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
  edits: [
    {
      op: "addSort",
      col: { columnName: "student_id" },
      dir: "asc",
    },
  ],
  explanation: "Suggested student columns.",
  confidence: 0.91,
  spacy: {
    normalized_text: "show active students",
    ents: [{ start: 0, end: 7, label: "ACTION", text: "show" }],
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
};

describe("PlannerPage", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    window.localStorage.clear();
  });

  afterAll(() => {
    server.close();
  });

  it("submits suggest and plan requests then renders response sections", async () => {
    let suggestCount = 0;
    let planCount = 0;
    let suggestWorkspaceHeader: string | null = null;
    let planWorkspaceHeader: string | null = null;

    server.use(
      http.post("*/semantic/suggest-columns", async ({ request }) => {
        suggestCount += 1;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.workspace_id).toBe("ws-88");
        suggestWorkspaceHeader = request.headers.get("x-workspace-id");
        return HttpResponse.json(plannerPayload);
      }),
      http.post("*/semantic/plan", async ({ request }) => {
        planCount += 1;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.workspace_id).toBe("ws-88");
        planWorkspaceHeader = request.headers.get("x-workspace-id");
        return HttpResponse.json({ ...plannerPayload, explanation: "Generated final plan." });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<PlannerPage />, { route: "/semantic/planner", preloadedState: userState as any });

    await user.type(screen.getByLabelText(/^prompt$/i), "show active students");

    await user.click(screen.getByRole("button", { name: /suggest columns/i }));
    expect(await screen.findByText(/Suggested student columns/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /generate plan/i }));
    expect(await screen.findByText(/Generated final plan/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /llm plan/i }));
    expect(await screen.findByText(/SQL JSON/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /spacy extraction/i }));
    expect(await screen.findByText(/normalized text/i)).toBeInTheDocument();
    expect(screen.getByText(/show active students/i)).toBeInTheDocument();
    expect(screen.getByText(/low_confidence_metric/i)).toBeInTheDocument();

    expect(suggestCount).toBe(1);
    expect(planCount).toBe(1);
    expect(suggestWorkspaceHeader).toBe("ws-88");
    expect(planWorkspaceHeader).toBe("ws-88");
  });

  it("calls extraction test endpoint and renders spacy section", async () => {
    let extractCount = 0;
    server.use(
      http.post("*/planner/extract", async ({ request }) => {
        extractCount += 1;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.prompt).toBe("show active students");
        return HttpResponse.json({
          spacy: plannerPayload.spacy,
        });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<PlannerPage />, { route: "/semantic/planner", preloadedState: userState as any });

    await user.type(screen.getByLabelText(/^prompt$/i), "show active students");
    await user.click(screen.getByRole("button", { name: /test extraction/i }));

    expect(await screen.findByText(/normalized text/i)).toBeInTheDocument();
    expect(screen.getByText(/show active students/i)).toBeInTheDocument();
    expect(extractCount).toBe(1);
  });

  it("clears previous result when running a new planner action", async () => {
    server.use(
      http.post("*/semantic/suggest-columns", async () => HttpResponse.json(plannerPayload)),
      http.post("*/semantic/plan", async () => {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return HttpResponse.json({ ...plannerPayload, explanation: "Generated final plan." });
      })
    );

    const user = userEvent.setup();
    renderSemanticPage(<PlannerPage />, { route: "/semantic/planner", preloadedState: userState as any });

    await user.type(screen.getByLabelText(/^prompt$/i), "show active students");
    await user.click(screen.getByRole("button", { name: /suggest columns/i }));
    expect(await screen.findByText(/Suggested student columns/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(screen.queryByText(/Suggested student columns/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/Generated final plan/i)).toBeInTheDocument();
  });

  it("persists prompt across unmount and remount", async () => {
    server.use(
      http.post("*/semantic/suggest-columns", async () => HttpResponse.json(plannerPayload)),
      http.post("*/semantic/plan", async () => HttpResponse.json(plannerPayload))
    );

    const user = userEvent.setup();
    const firstRender = renderSemanticPage(<PlannerPage />, { route: "/semantic/planner", preloadedState: userState as any });
    const promptInput = screen.getByLabelText(/^prompt$/i);
    await user.type(promptInput, "debug prompt should persist");

    firstRender.unmount();

    renderSemanticPage(<PlannerPage />, { route: "/semantic/planner", preloadedState: userState as any });
    expect(screen.getByLabelText(/^prompt$/i)).toHaveValue("debug prompt should persist");
  });
});
