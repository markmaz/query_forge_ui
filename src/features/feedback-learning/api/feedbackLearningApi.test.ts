import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  getAccessToken: vi.fn(),
  getApiWorkspaceId: vi.fn(),
}));

vi.mock("@/shared/runtime/accessTokenStore", () => ({
  getAccessToken: mocks.getAccessToken,
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
  },
  getApiWorkspaceId: mocks.getApiWorkspaceId,
}));

describe("feedbackLearningApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockReturnValue("token-1");
    mocks.getApiWorkspaceId.mockReturnValue("ws-1");
  });

  it("normalizes candidate list responses", async () => {
    const { listFeedbackLearningCandidates } = await import("./feedbackLearningApi");
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            id: "41",
            failure_analysis_id: 9,
            target_type: "semantic_override",
            concept_key: "student_name",
            change_type: "add_alias",
            payload_json: { alias: "pupil name" },
            payload_hash: "hash-1",
            risk_level: "low",
            evidence_count: "3",
            confidence: "0.88",
            governance_status: "pending",
            auto_apply_eligible: 1,
            source_scope: "workspace",
            workspace_scope_key: "ws-1",
            analysis_summary: { failure_verdict: "domain_error" },
            source_feedback: { prompt_feedback_id: 77, prompt_text: "show student name" },
          },
        ],
        total: 1,
        page: 2,
        page_size: 25,
      },
    });

    const response = await listFeedbackLearningCandidates({ page: 2, page_size: 25 });

    expect(mocks.get).toHaveBeenCalledWith("/feedback-learning/candidates", {
      params: { page: 2, page_size: 25 },
      headers: {
        Authorization: "Bearer token-1",
        "X-Workspace-Id": "ws-1",
      },
    });
    expect(response.total).toBe(1);
    expect(response.rows[0].id).toBe(41);
    expect(response.rows[0].auto_apply_eligible).toBe(true);
    expect(response.rows[0].analysis_summary?.failure_verdict).toBe("domain_error");
  });

  it("sends bulk reject payloads with the provided reason", async () => {
    const { bulkRejectFeedbackLearningCandidates } = await import("./feedbackLearningApi");
    mocks.post.mockResolvedValue({
      data: {
        processed: 2,
        results: [{ candidate: { id: 1 } }, { candidate: { id: 2 } }],
      },
    });

    const response = await bulkRejectFeedbackLearningCandidates([1, 2], "Not safe");

    expect(mocks.post).toHaveBeenCalledWith(
      "/feedback-learning/candidates/bulk-reject",
      { candidate_ids: [1, 2], reason: "Not safe" },
      {
        headers: {
          Authorization: "Bearer token-1",
          "X-Workspace-Id": "ws-1",
        },
      },
    );
    expect(response.processed).toBe(2);
  });
});
