import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CandidateList } from "../CandidateList";

const rows = [
  {
    id: 41,
    failure_analysis_id: 9,
    target_type: "semantic_override" as const,
    concept_key: "student_name",
    domain_key: null,
    change_type: "add_alias",
    payload_json: { alias: "pupil name" },
    payload_hash: "hash-1",
    risk_level: "low" as const,
    evidence_count: 3,
    confidence: 0.88,
    governance_status: "pending" as const,
    auto_apply_eligible: true,
    governance_reason_code: null,
    review_notes: null,
    workspace_id: "ws-1",
    source_scope: "workspace",
    workspace_scope_key: "ws-1",
  },
];

describe("CandidateList", () => {
  it("routes row actions to the provided callbacks", async () => {
    const user = userEvent.setup();
    const onToggleSelected = vi.fn();
    const onToggleAll = vi.fn();
    const onView = vi.fn();
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <CandidateList
        rows={rows}
        selectedIds={[]}
        onToggleSelected={onToggleSelected}
        onToggleAll={onToggleAll}
        onView={onView}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    await user.click(screen.getByLabelText(/select candidate 41/i));
    await user.click(screen.getByRole("button", { name: /view/i }));
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await user.click(screen.getByRole("button", { name: /reject/i }));

    expect(onToggleSelected).toHaveBeenCalledWith(41);
    expect(onView).toHaveBeenCalledWith(41);
    expect(onApprove).toHaveBeenCalledWith(41);
    expect(onReject).toHaveBeenCalledWith(41);
  });
});
