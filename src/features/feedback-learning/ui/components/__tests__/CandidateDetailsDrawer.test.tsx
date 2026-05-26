import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CandidateDetailsDrawer } from "../CandidateDetailsDrawer";

describe("CandidateDetailsDrawer", () => {
  it("renders candidate detail summaries and payloads", async () => {
    render(
      <CandidateDetailsDrawer
        open
        loading={false}
        error={null}
        onClose={() => {}}
        detail={{
          candidate: {
            id: 41,
            failure_analysis_id: 9,
            target_type: "semantic_override",
            concept_key: "student_name",
            domain_key: null,
            change_type: "add_alias",
            payload_json: { alias: "pupil name" },
            payload_hash: "hash-1",
            risk_level: "low",
            evidence_count: 3,
            confidence: 0.88,
            governance_status: "pending",
            auto_apply_eligible: true,
            governance_reason_code: null,
            review_notes: null,
            workspace_id: "ws-1",
            source_scope: "workspace",
            workspace_scope_key: "ws-1",
          },
          analysis_summary: {
            failure_verdict: "domain_error",
            analysis_json: { verdict: "domain_error" },
          },
          source_feedback: {
            prompt_feedback_id: 77,
            prompt_text: "show student name",
            normalized_prompt: "show student name",
          },
          effective_target_key: "student_name",
        }}
      />,
    );

    expect(await screen.findByRole("dialog", { name: /feedback learning candidate/i })).toBeInTheDocument();
    expect(screen.getByText(/candidate #41/i)).toBeInTheDocument();
    expect(screen.getAllByText(/show student name/i).length).toBe(2);
    expect(screen.getByText(/student_name/i)).toBeInTheDocument();
    expect(screen.getAllByText(/domain_error/i).length).toBeGreaterThan(0);
  });
});
