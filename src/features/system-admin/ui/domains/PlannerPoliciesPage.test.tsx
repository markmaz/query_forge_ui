import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlannerPoliciesPage from "./PlannerPoliciesPage";

const mocks = vi.hoisted(() => ({
  fetchDomains: vi.fn(),
  usePlannerDomainCapabilities: vi.fn(),
  usePlannerPromptIntentPolicies: vi.fn(),
  usePlannerProjectionPolicies: vi.fn(),
  usePlannerRerankPolicies: vi.fn(),
  usePlannerRerankPolicyCandidates: vi.fn(),
  usePlannerSignalPolicies: vi.fn(),
  usePlannerDomainCoverage: vi.fn(),
  useUpsertPlannerDomainCapability: vi.fn(),
  useUpsertPlannerPromptIntentPolicy: vi.fn(),
  useUpsertPlannerProjectionPolicy: vi.fn(),
  useDeletePlannerDomainCapability: vi.fn(),
  useDeletePlannerDomainSelectionPolicy: vi.fn(),
  useDeletePlannerPromptIntentPolicy: vi.fn(),
  useDeletePlannerProjectionPolicy: vi.fn(),
  useDeletePlannerRetrievalPolicy: vi.fn(),
  useUpsertPlannerSignalPolicy: vi.fn(),
  useUpsertPlannerRerankPolicy: vi.fn(),
  useDeletePlannerRerankPolicy: vi.fn(),
  useDeletePlannerSignalPolicy: vi.fn(),
  usePlannerDomainSelectionPolicies: vi.fn(),
  useCreatePlannerRerankPolicyCandidate: vi.fn(),
  usePlannerRetrievalPolicies: vi.fn(),
  useDeletePlannerRerankPolicyCandidate: vi.fn(),
  useSuggestPlannerRerankPolicyCandidate: vi.fn(),
  useApprovePlannerRerankPolicyCandidate: vi.fn(),
  useUpsertPlannerDomainSelectionPolicy: vi.fn(),
  useUpsertPlannerRetrievalPolicy: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/shared/services/queryStudioAdminApi", () => ({
  fetchDomains: mocks.fetchDomains,
}));

vi.mock("@/features/system-admin/hooks", () => ({
  usePlannerDomainCapabilities: mocks.usePlannerDomainCapabilities,
  usePlannerPromptIntentPolicies: mocks.usePlannerPromptIntentPolicies,
  usePlannerProjectionPolicies: mocks.usePlannerProjectionPolicies,
  usePlannerRerankPolicies: mocks.usePlannerRerankPolicies,
  usePlannerRerankPolicyCandidates: mocks.usePlannerRerankPolicyCandidates,
  usePlannerSignalPolicies: mocks.usePlannerSignalPolicies,
  usePlannerDomainCoverage: mocks.usePlannerDomainCoverage,
  useUpsertPlannerDomainCapability: mocks.useUpsertPlannerDomainCapability,
  useUpsertPlannerPromptIntentPolicy: mocks.useUpsertPlannerPromptIntentPolicy,
  useUpsertPlannerProjectionPolicy: mocks.useUpsertPlannerProjectionPolicy,
  useDeletePlannerDomainCapability: mocks.useDeletePlannerDomainCapability,
  useDeletePlannerDomainSelectionPolicy: mocks.useDeletePlannerDomainSelectionPolicy,
  useDeletePlannerPromptIntentPolicy: mocks.useDeletePlannerPromptIntentPolicy,
  useDeletePlannerProjectionPolicy: mocks.useDeletePlannerProjectionPolicy,
  useDeletePlannerRetrievalPolicy: mocks.useDeletePlannerRetrievalPolicy,
  usePlannerDomainSelectionPolicies: mocks.usePlannerDomainSelectionPolicies,
  useUpsertPlannerSignalPolicy: mocks.useUpsertPlannerSignalPolicy,
  useUpsertPlannerRerankPolicy: mocks.useUpsertPlannerRerankPolicy,
  useDeletePlannerRerankPolicy: mocks.useDeletePlannerRerankPolicy,
  useDeletePlannerSignalPolicy: mocks.useDeletePlannerSignalPolicy,
  useCreatePlannerRerankPolicyCandidate: mocks.useCreatePlannerRerankPolicyCandidate,
  usePlannerRetrievalPolicies: mocks.usePlannerRetrievalPolicies,
  useDeletePlannerRerankPolicyCandidate: mocks.useDeletePlannerRerankPolicyCandidate,
  useSuggestPlannerRerankPolicyCandidate: mocks.useSuggestPlannerRerankPolicyCandidate,
  useApprovePlannerRerankPolicyCandidate: mocks.useApprovePlannerRerankPolicyCandidate,
  useUpsertPlannerDomainSelectionPolicy: mocks.useUpsertPlannerDomainSelectionPolicy,
  useUpsertPlannerRetrievalPolicy: mocks.useUpsertPlannerRetrievalPolicy,
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
    mocks.usePlannerDomainCoverage.mockReturnValue({
      rows: [
        {
          domainId: 9,
          domainName: "Student Enrollment",
          capabilityCount: 1,
          policyCount: 1,
          projectionPolicyCount: 1,
          totalCount: 3,
          status: "configured",
        },
        {
          domainId: 15,
          domainName: "Student Programs",
          capabilityCount: 0,
          policyCount: 0,
          projectionPolicyCount: 0,
          totalCount: 0,
          status: "empty",
        },
      ],
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
    mocks.usePlannerProjectionPolicies.mockReturnValue({
      data: {
        policies: [
          {
            id: 0,
            policy_key: "student_listing_identity_projection",
            name: "Student listing identity projection",
            scope_type: "global",
            priority: 100,
            is_active: true,
            stop_on_match: false,
            is_seeded: true,
            is_effective: true,
            can_edit: false,
            can_delete: false,
            policy_json: {
              version: 1,
              when_signals_all: ["student_listing"],
              when_signals_any: [],
              exclude_signals_any: [],
              projection_mode: "prepend",
              required_concept_keys: ["STUDENT_ID", "STUDENT_FIRST_NAME", "STUDENT_LAST_NAME"],
              excluded_concept_keys: [],
              required_column_names: [],
              excluded_column_names: [],
              required_filter_concept_keys: [],
              required_join_tables: [],
            },
          },
          {
            id: 44,
            policy_key: "human_school_filter_projection",
            name: "Human school filter projection",
            scope_type: "workspace_domain",
            priority: 120,
            is_active: true,
            stop_on_match: false,
            is_seeded: false,
            is_effective: true,
            can_edit: true,
            can_delete: true,
            policy_json: {
              version: 1,
              when_signals_all: ["needs_school_filter"],
              when_signals_any: [],
              exclude_signals_any: ["explicit_school_key_request"],
              projection_mode: "prepend",
              required_concept_keys: ["SCHOOL_NAME"],
              excluded_concept_keys: ["SCHOOL_ID"],
              required_column_names: [],
              excluded_column_names: [],
              required_filter_concept_keys: [],
              required_join_tables: [],
            },
          },
        ],
      },
      isLoading: false,
    });
    mocks.usePlannerSignalPolicies.mockReturnValue({
      data: {
        policies: [
          {
            id: 55,
            policy_key: "custom_listing_signal",
            name: "Custom listing signal",
            scope_type: "workspace",
            priority: 100,
            is_active: true,
            stop_on_match: false,
            is_seeded: false,
            is_effective: true,
            can_edit: true,
            can_delete: true,
            policy_json: {
              version: 1,
              signal_keys: ["listing_intent"],
              match_type: "regex",
              patterns: ["provider roster"],
              helper_name: null,
              suffixes: [],
              stopwords: [],
              case_sensitive: false,
            },
          },
        ],
      },
      isLoading: false,
    });
    mocks.usePlannerPromptIntentPolicies.mockReturnValue({
      data: {
        policies: [
          {
            id: 66,
            policy_key: "custom_list_students",
            name: "Custom list students",
            scope_type: "workspace",
            priority: 100,
            is_active: true,
            stop_on_match: false,
            is_seeded: false,
            is_effective: true,
            can_edit: true,
            can_delete: true,
            policy_json: {
              version: 1,
              action_key: "list_students",
              regex_patterns: ["provider roster"],
              substring_patterns: [],
              state_codes: [],
            },
          },
        ],
      },
      isLoading: false,
    });
    mocks.usePlannerRetrievalPolicies.mockReturnValue({
      data: {
        policies: [
          {
            id: 77,
            policy_key: "custom_retrieval",
            name: "Custom retrieval",
            scope_type: "workspace",
            priority: 100,
            is_active: true,
            stop_on_match: false,
            is_seeded: false,
            is_effective: true,
            can_edit: true,
            can_delete: true,
            policy_json: {
              version: 1,
              when_signals_all: [],
              when_signals_any: ["staff_work_context_prompt"],
              exclude_signals_any: [],
              when_concept_key_patterns_any: ["PROVIDER"],
              query_specs: [{ query: "provider territory", source: "vector", score_boost: 0.1, reasons: [] }],
              domain_name_prefer_tokens: ["provider"],
              domain_name_avoid_tokens: ["student"],
              domain_name_positive_bias: 0.2,
              domain_name_negative_bias: 0.1,
            },
          },
        ],
      },
      isLoading: false,
    });
    mocks.usePlannerDomainSelectionPolicies.mockReturnValue({
      data: {
        policies: [
          {
            id: 78,
            policy_key: "custom_domain_selection",
            name: "Custom domain selection",
            scope_type: "workspace",
            priority: 100,
            is_active: true,
            stop_on_match: false,
            is_seeded: false,
            is_effective: true,
            can_edit: true,
            can_delete: true,
            policy_json: {
              version: 1,
              when_signals_all: ["staff_work_context_prompt"],
              when_signals_any: [],
              exclude_signals_any: [],
              required_shortlist_features: ["STAFF_IDENTITY_COLUMN"],
              required_capability_features: [],
              score_delta: 0.33,
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
    mocks.useUpsertPlannerProjectionPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: 44 }),
      isPending: false,
    });
    mocks.useDeletePlannerProjectionPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mocks.useUpsertPlannerSignalPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: 55 }),
      isPending: false,
    });
    mocks.useDeletePlannerSignalPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mocks.useUpsertPlannerPromptIntentPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: 66 }),
      isPending: false,
    });
    mocks.useDeletePlannerPromptIntentPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mocks.useUpsertPlannerRetrievalPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: 77 }),
      isPending: false,
    });
    mocks.useDeletePlannerRetrievalPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mocks.useUpsertPlannerDomainSelectionPolicy.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: 78 }),
      isPending: false,
    });
    mocks.useDeletePlannerDomainSelectionPolicy.mockReturnValue({
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
      expect(screen.getByLabelText(/^domain$/i)).toHaveValue("9");
    });
    expect(screen.getByRole("tab", { name: /domain-scoped/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /cross-domain/i })).toBeInTheDocument();
    expect(screen.getByText(/this tab uses the selected domain/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /capabilities/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^policies/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /projection policies/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /candidates/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add new capability/i })).toBeInTheDocument();
    expect(screen.getByText(/domain coverage/i)).toBeInTheDocument();
    expect(screen.getAllByText("Student Enrollment").length).toBeGreaterThan(0);
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.getAllByText(/SCHOOL_NAME/i).length).toBeGreaterThan(0);
  });

  it("filters the domain coverage list to configured domains only", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText(/configured only/i));

    expect(screen.getByRole("option", { name: /student enrollment \(1 caps, 1 policies, 1 projections\)/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /student programs \(0 caps, 0 policies, 0 projections\)/i })).not.toBeInTheDocument();
  });

  it("switches to cross-domain tabs and hides domain-specific controls", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /cross-domain/i }));
    expect(screen.getByRole("tab", { name: /signal policies/i })).toBeInTheDocument();
    await user.click(await screen.findByRole("tab", { name: /signal policies/i }));

    expect(screen.getByText(/this tab applies across the workspace or globally/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^domain$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/include inactive/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add new signal policy/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add new capability/i })).not.toBeInTheDocument();
  });

  it("shows candidate-specific filters and actions on the candidates tab", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /candidates/i }));

    expect(screen.getByText(/uses the selected domain when reviewing candidate policies before promotion/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^domain$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/vertical norm/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/candidate status/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/include inactive/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add new candidate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /suggest with ai/i })).toBeInTheDocument();
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

    await user.click(await screen.findByRole("tab", { name: /^policies/i }));
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

  it("edits a projection policy through the projection tab", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 44 });
    mocks.useUpsertPlannerProjectionPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /projection policies/i }));
    await user.click(await screen.findByText("Human school filter projection"));
    expect(await screen.findByRole("dialog", { name: /edit projection policy/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/required concepts/i), "DISTRICT_NAME{enter}");
    await user.selectOptions(screen.getByLabelText(/projection mode/i), "append");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 44,
          scope_type: "workspace_domain",
          scope_base_domain_id: 9,
          policy_json: expect.objectContaining({
            projection_mode: "append",
            required_concept_keys: ["SCHOOL_NAME", "DISTRICT_NAME"],
          }),
        }),
      );
    });
  });

  it("deletes a projection policy from the projection tab", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mocks.useDeletePlannerProjectionPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /projection policies/i }));
    await user.click(screen.getByRole("button", { name: /delete projection policy human school filter projection/i }));
    expect(await screen.findByRole("dialog", { name: /delete projection_policy/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(44);
    });
  });

  it("edits a signal policy through the signal tab", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 55 });
    mocks.useUpsertPlannerSignalPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /cross-domain/i }));
    await user.click(await screen.findByRole("tab", { name: /signal policies/i }));
    await user.click(await screen.findByText("Custom listing signal"));
    expect(await screen.findByRole("dialog", { name: /edit signal policy/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/patterns/i), "provider list{enter}");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 55,
          scope_type: "workspace",
          policy_json: expect.objectContaining({
            signal_keys: ["listing_intent"],
            patterns: ["provider roster", "provider list"],
          }),
        }),
      );
    });
  });

  it("deletes a signal policy from the signal tab", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mocks.useDeletePlannerSignalPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /cross-domain/i }));
    await user.click(await screen.findByRole("tab", { name: /signal policies/i }));
    await user.click(screen.getByRole("button", { name: /delete signal policy custom listing signal/i }));
    expect(await screen.findByRole("dialog", { name: /delete signal_policy/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(55);
    });
  });

  it("edits a prompt intent policy through the prompt intent tab", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 66 });
    mocks.useUpsertPlannerPromptIntentPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /cross-domain/i }));
    await user.click(await screen.findByRole("tab", { name: /prompt intent policies/i }));
    await user.click(await screen.findByText("Custom list students"));
    expect(await screen.findByRole("dialog", { name: /edit prompt intent policy/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/substring patterns/i), "provider roster{enter}");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 66,
          scope_type: "workspace",
          policy_json: expect.objectContaining({
            action_key: "list_students",
            substring_patterns: ["provider roster"],
          }),
        }),
      );
    });
  });

  it("deletes a prompt intent policy from the prompt intent tab", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mocks.useDeletePlannerPromptIntentPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /cross-domain/i }));
    await user.click(await screen.findByRole("tab", { name: /prompt intent policies/i }));
    await user.click(screen.getByRole("button", { name: /delete prompt intent policy custom list students/i }));
    expect(await screen.findByRole("dialog", { name: /delete prompt_intent_policy/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(66);
    });
  });

  it("edits a retrieval policy through the retrieval tab", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 77 });
    mocks.useUpsertPlannerRetrievalPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /cross-domain/i }));
    await user.click(await screen.findByRole("tab", { name: /retrieval policies/i }));
    await user.click(await screen.findByText("Custom retrieval"));
    expect(await screen.findByRole("dialog", { name: /edit retrieval policy/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/prefer name tokens/i), "territory{enter}");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 77,
          scope_type: "workspace",
          policy_json: expect.objectContaining({
            when_signals_any: ["staff_work_context_prompt"],
            domain_name_prefer_tokens: ["provider", "territory"],
          }),
        }),
      );
    });
  });

  it("edits a domain selection policy through the domain selection tab", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 78 });
    mocks.useUpsertPlannerDomainSelectionPolicy.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    await user.click(await screen.findByRole("tab", { name: /cross-domain/i }));
    await user.click(await screen.findByRole("tab", { name: /domain selection policies/i }));
    await user.click(await screen.findByText("Custom domain selection"));
    expect(await screen.findByRole("dialog", { name: /edit domain selection policy/i })).toBeInTheDocument();
    await user.click(screen.getByLabelText(/required capability features/i));
    await user.click(screen.getByLabelText(/adm metric/i));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 78,
          scope_type: "workspace",
          policy_json: expect.objectContaining({
            required_shortlist_features: ["STAFF_IDENTITY_COLUMN"],
            required_capability_features: ["ADM_METRIC"],
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

    await user.click(await screen.findByRole("tab", { name: /candidates/i }));
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
        expected_base_domain_id: 9,
        observed_base_domain_id: 15,
        candidate_key: null,
        notes: null,
      });
    });
  });
});
