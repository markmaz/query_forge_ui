import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "@/app/core/store";
import FeedbackLearningPage from "../FeedbackLearningPage";

const mocks = vi.hoisted(() => ({
  useFeedbackLearningCandidates: vi.fn(),
  useFeedbackLearningCandidateDetail: vi.fn(),
  useFeedbackLearningSemanticOverrides: vi.fn(),
  useFeedbackLearningDomainOverrides: vi.fn(),
  useFeedbackLearningPromotionAudits: vi.fn(),
  useApproveFeedbackLearningCandidate: vi.fn(),
  useRejectFeedbackLearningCandidate: vi.fn(),
  useBulkApproveFeedbackLearningCandidates: vi.fn(),
  useBulkRejectFeedbackLearningCandidates: vi.fn(),
  useDeactivateFeedbackLearningSemanticOverride: vi.fn(),
  useDeactivateFeedbackLearningDomainOverride: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../hooks/useFeedbackLearning", () => ({
  useFeedbackLearningCandidates: mocks.useFeedbackLearningCandidates,
  useFeedbackLearningCandidateDetail: mocks.useFeedbackLearningCandidateDetail,
  useFeedbackLearningSemanticOverrides: mocks.useFeedbackLearningSemanticOverrides,
  useFeedbackLearningDomainOverrides: mocks.useFeedbackLearningDomainOverrides,
  useFeedbackLearningPromotionAudits: mocks.useFeedbackLearningPromotionAudits,
  useApproveFeedbackLearningCandidate: mocks.useApproveFeedbackLearningCandidate,
  useRejectFeedbackLearningCandidate: mocks.useRejectFeedbackLearningCandidate,
  useBulkApproveFeedbackLearningCandidates: mocks.useBulkApproveFeedbackLearningCandidates,
  useBulkRejectFeedbackLearningCandidates: mocks.useBulkRejectFeedbackLearningCandidates,
  useDeactivateFeedbackLearningSemanticOverride: mocks.useDeactivateFeedbackLearningSemanticOverride,
  useDeactivateFeedbackLearningDomainOverride: mocks.useDeactivateFeedbackLearningDomainOverride,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

function renderPage() {
  const store = createAppStore({
    auth: { isAuthenticated: true, bootstrapped: true },
    user: {
      user: { user_id: "admin-1" },
      rolesByFeature: { semantic: ["admin"] },
      capabilities: ["semantic:admin"],
      loading: false,
      initialized: true,
      error: null,
    },
    userWorkspaces: {
      selectedWorkspaceId: "ws-1",
      workspaces: [],
      defaultWorkspace: null,
      loaded: true,
      loading: false,
      error: null,
      needsWorkspaceSelection: false,
    },
  } as any);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FeedbackLearningPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe("FeedbackLearningPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useFeedbackLearningCandidates.mockReturnValue({
      data: {
        rows: [
          {
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
            analysis_summary: { failure_verdict: "domain_error" },
            source_feedback: { prompt_feedback_id: 77, prompt_text: "show student name" },
          },
        ],
        total: 1,
        page: 1,
        page_size: 50,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mocks.useFeedbackLearningCandidateDetail.mockReturnValue({
      data: {
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
        analysis_summary: { failure_verdict: "domain_error", analysis_json: { verdict: "domain_error" } },
        source_feedback: { prompt_feedback_id: 77, prompt_text: "show student name", normalized_prompt: "show student name" },
        effective_target_key: "student_name",
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mocks.useFeedbackLearningSemanticOverrides.mockReturnValue({
      data: { rows: [{ id: 21, status: "active", concept_key: "student_name", domain_key: null, override_type: "alias", override_key: "phrase_hint", override_value_json: { value: "pupil name" }, workspace_id: "ws-1", approved_by: "admin-1" }] },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mocks.useFeedbackLearningDomainOverrides.mockReturnValue({
      data: { rows: [{ id: 31, status: "active", concept_key: null, domain_key: "attendance", override_type: "note", override_key: "ambiguity", override_value_json: { value: "term days off" }, workspace_id: "ws-1", approved_by: "admin-1" }] },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mocks.useFeedbackLearningPromotionAudits.mockReturnValue({
      data: {
        rows: [{ id: 7, source_type: "semantic_override", source_id: 21, target_table: "semantic_concept_alias", target_record_key: "student_name", promotion_action: "insert", promotion_status: "succeeded", promoted_by: "admin-1", promoted_at: "2026-04-23T12:00:00Z", retry_count: 0, last_retry_at: null, notes: null, error_message: null }],
        total: 1,
        limit: 50,
        offset: 0,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mocks.useApproveFeedbackLearningCandidate.mockReturnValue({
      mutate: vi.fn((_candidateId, options) => options?.onSuccess?.({})),
      isPending: false,
    });
    mocks.useRejectFeedbackLearningCandidate.mockReturnValue({
      mutate: vi.fn((_payload, options) => options?.onSuccess?.({})),
      isPending: false,
    });
    mocks.useBulkApproveFeedbackLearningCandidates.mockReturnValue({
      mutate: vi.fn((_ids, options) => options?.onSuccess?.({ processed: 1 })),
      isPending: false,
    });
    mocks.useBulkRejectFeedbackLearningCandidates.mockReturnValue({
      mutate: vi.fn((_payload, options) => options?.onSuccess?.({ processed: 1 })),
      isPending: false,
    });
    mocks.useDeactivateFeedbackLearningSemanticOverride.mockReturnValue({
      mutate: vi.fn((_overrideId, options) => options?.onSuccess?.({})),
      isPending: false,
    });
    mocks.useDeactivateFeedbackLearningDomainOverride.mockReturnValue({
      mutate: vi.fn((_overrideId, options) => options?.onSuccess?.({})),
      isPending: false,
    });
  });

  it("renders the candidate queue and opens the detail drawer", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: /feedback learning/i })).toBeInTheDocument();
    expect(screen.getByText(/candidate review queue/i)).toBeInTheDocument();
    expect(screen.getByText(/student_name/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view/i }));

    expect(await screen.findByRole("dialog", { name: /feedback learning candidate/i })).toBeInTheDocument();
    expect(screen.getAllByText(/domain_error/i).length).toBeGreaterThan(0);
  });

  it("supports bulk approval from the candidate tab", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText(/select candidate 41/i));
    await user.click(screen.getByRole("button", { name: /bulk approve/i }));
    const dialog = await screen.findByRole("dialog", { name: /approve 1 candidate/i });
    await user.click(within(dialog).getByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Approved candidate #41.");
    });
  });

  it("shows overrides and promotion audits on their tabs", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: /overrides/i }));
    expect(await screen.findByText(/active semantic overrides/i)).toBeInTheDocument();
    expect(screen.getByText(/attendance/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /promotion audits/i }));
    expect(
      await screen.findByRole("heading", { name: /promotion audit history/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/semantic_concept_alias/i)).toBeInTheDocument();
  });
});
