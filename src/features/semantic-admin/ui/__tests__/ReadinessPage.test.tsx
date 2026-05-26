import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../qa/msw/server";
import ReadinessPage from "../ReadinessPage";
import { renderSemanticPage } from "./renderSemanticPage";

const adminState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "user-1" },
    rolesByFeature: {
      semantic: ["admin"],
    },
    capabilities: ["semantic:admin"],
    loading: false,
    initialized: true,
    error: null,
  },
  userWorkspaces: {
    selectedWorkspaceId: "ws-1",
  },
};

const readinessPayload = {
  workspace_id: "ws-1",
  status: "needs_attention",
  summary: {
    domain_count: 1,
    ready_domain_count: 0,
    issue_domain_count: 1,
    generated_concept_count: 7,
    generated_registry_count: 7,
    concept_column_map_count: 6,
    semantic_column_map_count: 6,
    alias_count: 20,
    metric_count: 5,
    bound_metric_count: 4,
    missing_metric_binding_count: 1,
  },
  domains: [
    {
      domain_key: "flowforge_workflow_runs",
      display_name: "FlowForge Workflow Runs",
      read_model: "v_flowforge_report_workflow_runs",
      registration_status: "registered",
      status: "needs_attention",
      issues: ["flowforge_workflow_runs has unbound generated metrics: completed_run_count."],
      suggested_action: "Run Workflow Intelligence semantic sync, then rebuild semantic indexes.",
      expected: {
        metrics: 5,
        dimensions: 7,
        identifiers: 5,
        time_fields: 5,
      },
      counts: {
        generated_concept_count: 7,
        generated_registry_count: 7,
        concept_column_map_count: 6,
        semantic_column_map_count: 6,
        alias_count: 20,
      },
      metric_bindings: {
        metric_count: 5,
        profile_metric_count: 5,
        bound_metric_count: 4,
        missing_metric_count: 0,
        missing_metric_binding_count: 1,
        missing_metrics: [],
        unbound_metrics: ["completed_run_count"],
        bound_metrics: ["run_count", "active_run_count", "failed_run_count", "needs_attention_count"],
      },
    },
  ],
  actions: [],
};

describe("ReadinessPage", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("renders Workflow Intelligence semantic readiness details", async () => {
    server.use(
      http.get("*/semantic/registry/workflow-intelligence/readiness", () => HttpResponse.json(readinessPayload)),
    );

    renderSemanticPage(<ReadinessPage />, {
      route: "/semantic/readiness",
      preloadedState: adminState as any,
    });

    expect(await screen.findByRole("heading", { name: /semantic readiness/i })).toBeInTheDocument();
    expect(await screen.findByText(/semantic layer needs attention/i)).toBeInTheDocument();
    expect(screen.getByText("FlowForge Workflow Runs")).toBeInTheDocument();
    expect(screen.getByText("completed_run_count")).toBeInTheDocument();
    expect(screen.getByText(/run workflow intelligence semantic sync/i)).toBeInTheDocument();
  });

  it("runs semantic sync from the readiness tab", async () => {
    let syncCalled = false;
    server.use(
      http.get("*/semantic/registry/workflow-intelligence/readiness", () => HttpResponse.json(readinessPayload)),
      http.post("*/semantic/registry/workflow-intelligence/sync", () => {
        syncCalled = true;
        return HttpResponse.json({
          workspace_id: "ws-1",
          dry_run: false,
          status: "ok",
          registered_count: 13,
        });
      }),
    );

    const user = userEvent.setup();
    renderSemanticPage(<ReadinessPage />, {
      route: "/semantic/readiness",
      preloadedState: adminState as any,
    });

    await screen.findByText("FlowForge Workflow Runs");
    await user.click(screen.getByRole("button", { name: /sync semantics/i }));

    await waitFor(() => {
      expect(syncCalled).toBe(true);
    });
  });
});
