import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../qa/msw/server";
import PlannerPage from "../PlannerPage";
import { renderSemanticPage } from "./renderSemanticPage";

const userState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "user-1" },
    rolesByFeature: {
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
        expect(body.vertical_norm).toBe("education");
        suggestWorkspaceHeader = request.headers.get("x-workspace-id");
        return HttpResponse.json(plannerPayload);
      }),
      http.post("*/semantic/plan", async ({ request }) => {
        planCount += 1;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.workspace_id).toBe("ws-88");
        expect(body.vertical_norm).toBe("education");
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

  it("routes generate plan to llm_v2 endpoint and persists planner engine", async () => {
    let llmPlanCount = 0;

    server.use(
      http.post("*/planner/plan_llm", async ({ request }) => {
        llmPlanCount += 1;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.workspace_id).toBe("ws-88");
        expect(body.prompt).toBe("show active students");
        expect(body.vertical).toBe("education");
        expect(body.constraints).toMatchObject({
          max_domains: 3,
          max_columns: 50,
          max_concepts: 25,
          allow_pii: false,
        });
        return HttpResponse.json({
          sql_json: { select: ["student_id"] },
          validation: {
            is_valid: true,
            errors: [],
            repairs_applied: [],
          },
          candidates: {
            domains: [],
            concepts: [],
            columns: [],
          },
          trace_id: "trace-123",
          timings_ms: { llm: 14 },
          cache: { hit: false, key: "abc" },
          debug_artifacts: {},
        });
      })
    );

    const user = userEvent.setup();
    const firstRender = renderSemanticPage(<PlannerPage />, { route: "/semantic/planner", preloadedState: userState as any });

    const engineSelect = screen.getByRole("combobox", { name: /planner engine/i });
    expect(engineSelect).toHaveValue("legacy");
    await user.selectOptions(engineSelect, "llm_v2");
    expect(window.localStorage.getItem("semanticPlanner.engine")).toBe("llm_v2");

    await user.type(screen.getByLabelText(/^prompt$/i), "show active students");
    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(await screen.findByText(/LLM v2 plan validated\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/Engine:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LLM v2 \(planner\/plan_llm\)/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /debug timings/i }));
    expect(await screen.findByText(/planner_engine/i)).toBeInTheDocument();
    expect(screen.getAllByText(/trace-123/i).length).toBeGreaterThan(0);
    expect(llmPlanCount).toBe(1);

    firstRender.unmount();
    renderSemanticPage(<PlannerPage />, { route: "/semantic/planner", preloadedState: userState as any });
    expect(screen.getByRole("combobox", { name: /planner engine/i })).toHaveValue("llm_v2");
  });

  it("renders plan_json in LLM plan tab when llm_v2 sql_json is empty", async () => {
    server.use(
      http.post("*/planner/plan_llm", async () =>
        HttpResponse.json({
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
          candidates: {
            domains: [],
            concepts: [],
            columns: [],
          },
          trace_id: "trace-llm-plan",
          timings_ms: { total: 2 },
        })
      )
    );

    const user = userEvent.setup();
    renderSemanticPage(<PlannerPage />, { route: "/semantic/planner", preloadedState: userState as any });

    await user.selectOptions(screen.getByRole("combobox", { name: /planner engine/i }), "llm_v2");
    await user.type(screen.getByLabelText(/^prompt$/i), "average students per teacher by county");
    await user.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(await screen.findByText(/LLM v2 plan returned validation issues/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /llm plan/i }));
    expect(await screen.findByText(/\"intent\": \"aggregate\"/i)).toBeInTheDocument();
    expect(screen.getByText(/wt20.county_fips_code/i)).toBeInTheDocument();
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
