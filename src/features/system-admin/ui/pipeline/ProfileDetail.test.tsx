import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProfileDetail from "./ProfileDetail";

vi.mock("./StepChart", () => ({
  default: ({ steps }: { steps: Array<{ label: string }> }) => (
    <div data-testid="step-chart">{steps.map((step) => step.label).join(", ")}</div>
  ),
}));

vi.mock("@/features/admin/charts/AdminChartCard", () => ({
  default: ({
    title,
    subtitle,
    children,
  }: {
    title: ReactNode;
    subtitle?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  ),
}));

describe("ProfileDetail", () => {
  it("renders shared pipeline nodes and trace steps", () => {
    render(
      <ProfileDetail
        profile={{
          trace_id: "trace-123",
          workspace_id: "ws-1",
          user_id: "user-1",
          conversation_id: "pdc-1",
          total_ms: 812,
          timestamp: "2026-03-29 10:00:00",
          prompt: "show me the eldest student",
          steps: [{ index: 1, label: "Domain selection", ms: 25 }],
          pipeline_trace: {
            trace_enabled: true,
            log_file: "/tmp/plan_domain_pipeline_trace.jsonl",
            steps: [
              {
                step: "domain_selection",
                data: { selected_domain_id: 21 },
              },
            ],
            response: {
              debug: {
                projection_policy: {
                  matched_policies: ["student_listing_identity_projection"],
                  prompt_signals: ["student_listing", "listing_intent"],
                  projection_mode: "prepend",
                  required_concept_keys: ["STUDENT_ID", "STUDENT_FIRST_NAME", "STUDENT_LAST_NAME"],
                },
                shared_pipeline: {
                  domain_selection: {
                    pipeline_name: "planner_domain_selection_pipeline",
                    trace_id: "planner-domain-shared",
                    vertical_norm: "education",
                    debug: {
                      extract_signals: {
                        signals: ["age_extreme_prompt", "student_listing"],
                      },
                      resolve_capabilities: {
                        capability_counts: {
                          "21": 3,
                        },
                      },
                    },
                    trace_nodes: [
                      {
                        pipeline_name: "planner_domain_selection_pipeline",
                        node: "extract_signals",
                        status: "completed",
                        ms: 2,
                        lineage: ["planner_domain_selection_pipeline"],
                      },
                    ],
                  },
                },
              },
            },
          },
        }}
      />
    );

    expect(screen.getByText("Shared Pipeline Nodes")).toBeInTheDocument();
    expect(
      screen.getByText("Domain Selection", {
        selector: ".sa-pipeline-shared-card__title",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("age_extreme_prompt")).toBeInTheDocument();
    expect(screen.getByText("Candidate 21")).toBeInTheDocument();
    expect(screen.getByText("Extract Signals")).toBeInTheDocument();
    expect(screen.getByText("Projection Policies")).toBeInTheDocument();
    expect(screen.getByText("student_listing_identity_projection")).toBeInTheDocument();
    expect(screen.getByText("Required Concepts")).toBeInTheDocument();
    expect(screen.getByText("Trace Steps")).toBeInTheDocument();
    expect(screen.getByText("Domain Selection", { selector: ".sa-pipeline-trace-card__title" })).toBeInTheDocument();
    expect(screen.getByText("/tmp/plan_domain_pipeline_trace.jsonl")).toBeInTheDocument();
  });
});
