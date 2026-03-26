import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlannerPoliciesPage from "./PlannerPoliciesPage";

const mocks = vi.hoisted(() => ({
  fetchDomains: vi.fn(),
  usePlannerDomainCapabilities: vi.fn(),
  usePlannerRerankPolicies: vi.fn(),
  usePlannerRerankPolicyCandidates: vi.fn(),
  useUpsertPlannerDomainCapability: vi.fn(),
  useDeletePlannerDomainCapability: vi.fn(),
  useUpsertPlannerRerankPolicy: vi.fn(),
  useDeletePlannerRerankPolicy: vi.fn(),
  useCreatePlannerRerankPolicyCandidate: vi.fn(),
  useDeletePlannerRerankPolicyCandidate: vi.fn(),
  useSuggestPlannerRerankPolicyCandidate: vi.fn(),
  useApprovePlannerRerankPolicyCandidate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/shared/services/queryStudioAdminApi", () => ({
  fetchDomains: mocks.fetchDomains,
}));

vi.mock("@/features/system-admin/hooks", () => ({
  usePlannerDomainCapabilities: mocks.usePlannerDomainCapabilities,
  usePlannerRerankPolicies: mocks.usePlannerRerankPolicies,
  usePlannerRerankPolicyCandidates: mocks.usePlannerRerankPolicyCandidates,
  useUpsertPlannerDomainCapability: mocks.useUpsertPlannerDomainCapability,
  useDeletePlannerDomainCapability: mocks.useDeletePlannerDomainCapability,
  useUpsertPlannerRerankPolicy: mocks.useUpsertPlannerRerankPolicy,
  useDeletePlannerRerankPolicy: mocks.useDeletePlannerRerankPolicy,
  useCreatePlannerRerankPolicyCandidate: mocks.useCreatePlannerRerankPolicyCandidate,
  useDeletePlannerRerankPolicyCandidate: mocks.useDeletePlannerRerankPolicyCandidate,
  useSuggestPlannerRerankPolicyCandidate: mocks.useSuggestPlannerRerankPolicyCandidate,
  useApprovePlannerRerankPolicyCandidate: mocks.useApprovePlannerRerankPolicyCandidate,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlannerPoliciesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PlannerPoliciesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchDomains.mockResolvedValue({
      rows: [
        { id: 9, name: "Student Enrollment" },
        { id: 15, name: "Student Programs" },
      ],
    });
    mocks.usePlannerDomainCapabilities.mockReturnValue({
      data: {
        capabilities: [
          {
            id: 1,
            capability_key: "SCHOOL_NAME",
            scope_type: "workspace_domain",
            support_level: "direct",
            source_type: "semantic_concept",
            source_ref: "school_name",
            confidence: 0.9,
            notes: "supports school filter",
            is_active: true,
            is_inherited: false,
          },
        ],
      },
      isLoading: false,
    });
    mocks.usePlannerRerankPolicies.mockReturnValue({
      data: {
        policies: [
          {
            id: 11,
            policy_key: "student_listing_school_literal",
            name: "Student listing school literal",
            scope_type: "workspace_domain",
            priority: 100,
            is_active: true,
            is_inherited: false,
            stop_on_match: false,
            policy_json: {
              version: 1,
              when_signals_all: ["student_listing", "school_literal_present"],
              when_signals_any: [],
              exclude_signals_any: [],
              prefer_capabilities: ["SCHOOL_NAME", "STUDENT_IDENTITY"],
              penalize_missing: ["SCHOOL_NAME"],
              require_for_bonus: ["STUDENT_IDENTITY"],
              boost: 0.2,
              penalty: 0.3,
              max_effect: 0.3,
            },
          },
        ],
      },
      isLoading: false,
    });
    mocks.usePlannerRerankPolicyCandidates.mockReturnValue({
      data: {
        candidates: [
          {
            id: 21,
            candidate_key: "candidate_school_rule",
            source_type: "ai_recommendation",
            candidate_json: {
              version: 1,
              when_signals_all: ["student_listing"],
              when_signals_any: [],
              exclude_signals_any: [],
              prefer_capabilities: ["SCHOOL_NAME"],
              penalize_missing: ["SCHOOL_NAME"],
              require_for_bonus: [],
              boost: 0.2,
              penalty: 0.3,
              max_effect: 0.3,
            },
            rationale_json: { prompt: "Show students at Barksdale Elementary" },
            confidence: 0.84,
            review_status: "pending",
            approved_policy_id: null,
          },
        ],
      },
      isLoading: false,
    });
    mocks.useUpsertPlannerDomainCapability.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ capability_id: 1 }),
      isPending: false,
    });
    mocks.useDeletePlannerDomainCapability.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mocks.useUpsertPlannerRerankPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ policy_id: 11 }),
      isPending: false,
    });
    mocks.useDeletePlannerRerankPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mocks.useCreatePlannerRerankPolicyCandidate.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ candidate_id: 21 }),
      isPending: false,
    });
    mocks.useDeletePlannerRerankPolicyCandidate.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mocks.useSuggestPlannerRerankPolicyCandidate.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        candidate: {
          id: 31,
          candidate_key: "student_school_enrollment_bias",
          source_type: "ai_recommendation",
          candidate_json: {
            version: 1,
            when_signals_all: ["student_listing"],
            when_signals_any: [],
            exclude_signals_any: [],
            prefer_capabilities: ["SCHOOL_NAME"],
            penalize_missing: ["SCHOOL_NAME"],
            require_for_bonus: [],
            boost: 0.2,
            penalty: 0.3,
            max_effect: 0.3,
          },
          rationale_json: null,
          confidence: 0.9,
          review_status: "pending",
          approved_policy_id: null,
        },
        prompt_signals: ["student_listing", "school_literal_present"],
        expected_domain: null,
        observed_domain: null,
      }),
      isPending: false,
    });
    mocks.useApprovePlannerRerankPolicyCandidate.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ approved_policy_id: 77 }),
      isPending: false,
    });
  });

  it("renders the planner policies page with domain tabs", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: /planner policies/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/domain/i)).toHaveValue("9");
    });
    expect(screen.getByRole("tab", { name: /capabilities/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /policies/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /candidates/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add new capability/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add new policy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add new candidate/i })).toBeInTheDocument();
    expect(screen.getAllByText(/SCHOOL_NAME/i).length).toBeGreaterThan(0);
  });

  it("opens a capability drawer from the table and saves by row id", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ capability_id: 1 });
    mocks.useUpsertPlannerDomainCapability.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByText("supports school filter"));
    expect(await screen.findByRole("dialog", { name: /edit capability/i })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/notes/i));
    await user.type(screen.getByLabelText(/notes/i), "updated note");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          base_domain_id: 9,
          scope_type: "workspace_domain",
          scope_vertical_norm: null,
          capability_key: "SCHOOL_NAME",
          notes: "updated note",
        }),
      );
    });
  });

  it("deletes a capability from the table row action", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mocks.useDeletePlannerDomainCapability.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("button", { name: /delete capability school_name/i }));
    expect(await screen.findByRole("dialog", { name: /delete capability/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(1);
    });
  });

  it("edits policy signals and capabilities through multi-select controls", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ policy_id: 11 });
    mocks.useUpsertPlannerRerankPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /policies/i }));
    await user.click(await screen.findByText("Student listing school literal"));
    expect(await screen.findByRole("dialog", { name: /edit policy/i })).toBeInTheDocument();

    await user.click(screen.getByLabelText(/all signals/i));
    await user.click(screen.getByLabelText(/time constraint present/i));

    await user.click(screen.getByLabelText(/prefer capabilities/i));
    await user.click(screen.getByLabelText(/calendar date/i));

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 11,
          scope_type: "workspace_domain",
          scope_base_domain_id: 9,
          policy_json: expect.objectContaining({
            when_signals_all: ["student_listing", "school_literal_present", "time_constraint_present"],
            prefer_capabilities: ["SCHOOL_NAME", "STUDENT_IDENTITY", "CALENDAR_DATE"],
          }),
        }),
      );
    });
  });

  it("approves a pending candidate into the selected domain", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ approved_policy_id: 77 });
    mocks.useApprovePlannerRerankPolicyCandidate.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /candidates/i }));
    await user.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        candidateId: 21,
        payload: expect.objectContaining({
          scope_type: "workspace_domain",
          scope_base_domain_id: 9,
          policy_key: "candidate_school_rule",
        }),
      });
    });
  });

  it("opens the AI suggest drawer and submits the example prompt", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({
      candidate: {
        id: 31,
        candidate_key: "student_school_enrollment_bias",
        source_type: "ai_recommendation",
        candidate_json: {
          version: 1,
          when_signals_all: ["student_listing"],
          when_signals_any: [],
          exclude_signals_any: [],
          prefer_capabilities: ["SCHOOL_NAME"],
          penalize_missing: ["SCHOOL_NAME"],
          require_for_bonus: [],
          boost: 0.2,
          penalty: 0.3,
          max_effect: 0.3,
        },
        rationale_json: null,
        confidence: 0.9,
        review_status: "pending",
        approved_policy_id: null,
      },
      prompt_signals: ["student_listing", "school_literal_present"],
      expected_domain: null,
      observed_domain: null,
    });
    mocks.useSuggestPlannerRerankPolicyCandidate.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("button", { name: /suggest with ai/i }));
    expect(await screen.findByRole("dialog", { name: /suggest candidate with ai/i })).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/example prompt/i),
      "Show me all the students enrolled at Barksdale Elementary",
    );
    await user.selectOptions(screen.getByLabelText(/observed wrong domain/i), "15");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        prompt: "Show me all the students enrolled at Barksdale Elementary",
        vertical_norm: "education",
        expected_base_domain_id: 9,
        observed_base_domain_id: 15,
        candidate_key: null,
        notes: null,
      });
    });
  });
});
