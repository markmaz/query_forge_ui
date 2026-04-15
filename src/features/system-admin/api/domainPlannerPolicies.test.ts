import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deletePlannerDomainSelectionPolicy,
  deletePlannerPromptIntentPolicy,
  deletePlannerProjectionPolicy,
  deletePlannerRetrievalPolicy,
  deletePlannerSignalPolicy,
  getPlannerDomainSelectionPolicies,
  getPlannerPromptIntentPolicies,
  getPlannerProjectionPolicies,
  getPlannerRetrievalPolicies,
  getPlannerSignalPolicies,
  upsertPlannerDomainSelectionPolicy,
  upsertPlannerPromptIntentPolicy,
  upsertPlannerProjectionPolicy,
  upsertPlannerRetrievalPolicy,
  upsertPlannerSignalPolicy,
} from "./domainPlannerPolicies";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  getApiWorkspaceId: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    get: mocks.get,
    put: mocks.put,
    delete: mocks.delete,
  },
  getApiWorkspaceId: mocks.getApiWorkspaceId,
}));

describe("domainPlannerPolicies projection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiWorkspaceId.mockReturnValue("ws-42");
  });

  it("loads planner projection policies with workspace headers", async () => {
    mocks.get.mockResolvedValue({
      data: {
        workspace_id: "ws-42",
        base_domain_id: 9,
        can_edit: true,
        policies: [
          {
            id: 44,
            policy_key: "human_school_filter_projection",
            name: "Human school filter projection",
            description: "Prefer school name.",
            scope_type: "workspace_domain",
            scope_workspace_id: "ws-42",
            scope_base_domain_id: 9,
            priority: 120,
            is_active: 1,
            stop_on_match: 0,
            is_seeded: 0,
            is_effective: 1,
            can_edit: 1,
            can_delete: 1,
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
    });

    const response = await getPlannerProjectionPolicies(9, false, true);

    expect(mocks.get).toHaveBeenCalledWith("/admin/planner-projection-policies", {
      headers: { "X-Workspace-Id": "ws-42" },
      params: {
        base_domain_id: 9,
        include_inactive: false,
        include_seeded: true,
      },
    });
    expect(response.policies[0]?.policy_json.required_concept_keys).toEqual(["SCHOOL_NAME"]);
  });

  it("saves planner projection policy payloads through PUT", async () => {
    const payload = {
      id: 44,
      policy_key: "human_school_filter_projection",
      name: "Human school filter projection",
      description: "Prefer school name.",
      scope_type: "workspace_domain" as const,
      scope_base_domain_id: 9,
      priority: 120,
      is_active: true,
      stop_on_match: false,
      policy_json: {
        version: 1 as const,
        when_signals_all: ["needs_school_filter" as const],
        when_signals_any: [],
        exclude_signals_any: ["explicit_school_key_request" as const],
        projection_mode: "append" as const,
        required_concept_keys: ["SCHOOL_NAME", "DISTRICT_NAME"],
        excluded_concept_keys: ["SCHOOL_ID"],
        required_column_names: [],
        excluded_column_names: [],
        required_filter_concept_keys: [],
        required_join_tables: ["dim_school"],
      },
    };
    mocks.put.mockResolvedValue({
      data: {
        ...payload,
        scope_workspace_id: "ws-42",
        can_edit: 1,
        can_delete: 1,
      },
    });

    await upsertPlannerProjectionPolicy(payload);

    expect(mocks.put).toHaveBeenCalledWith(
      "/admin/planner-projection-policies",
      payload,
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("deletes planner projection policies through DELETE", async () => {
    mocks.delete.mockResolvedValue({ data: {} });

    await deletePlannerProjectionPolicy(44);

    expect(mocks.delete).toHaveBeenCalledWith(
      "/admin/planner-projection-policies/44",
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("loads planner signal policies with workspace headers", async () => {
    mocks.get.mockResolvedValue({
      data: {
        workspace_id: "ws-42",
        can_edit: true,
        policies: [
          {
            id: 12,
            policy_key: "custom_listing_signal",
            name: "Custom listing signal",
            scope_type: "workspace",
            scope_workspace_id: "ws-42",
            priority: 100,
            is_active: 1,
            stop_on_match: 0,
            is_seeded: 0,
            is_effective: 1,
            can_edit: 1,
            can_delete: 1,
            policy_json: {
              version: 1,
              signal_keys: ["listing_intent"],
              match_type: "regex",
              patterns: ["provider roster"],
              suffixes: [],
              stopwords: [],
              case_sensitive: false,
            },
          },
        ],
      },
    });

    const response = await getPlannerSignalPolicies(false, true);

    expect(mocks.get).toHaveBeenCalledWith("/admin/planner-signal-policies", {
      headers: { "X-Workspace-Id": "ws-42" },
      params: { include_inactive: false, include_seeded: true },
    });
    expect(response.policies[0]?.policy_json.signal_keys).toEqual(["listing_intent"]);
  });

  it("saves planner signal policy payloads through PUT", async () => {
    const payload = {
      policy_key: "custom_listing_signal",
      name: "Custom listing signal",
      scope_type: "workspace" as const,
      priority: 100,
      is_active: true,
      stop_on_match: false,
      policy_json: {
        version: 1 as const,
        signal_keys: ["listing_intent" as const],
        match_type: "regex" as const,
        patterns: ["provider roster"],
        helper_name: null,
        suffixes: [],
        stopwords: [],
        case_sensitive: false,
      },
    };
    mocks.put.mockResolvedValue({
      data: {
        ...payload,
        id: 12,
        scope_workspace_id: "ws-42",
        can_edit: 1,
        can_delete: 1,
      },
    });

    await upsertPlannerSignalPolicy(payload);

    expect(mocks.put).toHaveBeenCalledWith(
      "/admin/planner-signal-policies",
      payload,
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("deletes planner signal policies through DELETE", async () => {
    mocks.delete.mockResolvedValue({ data: {} });

    await deletePlannerSignalPolicy(12);

    expect(mocks.delete).toHaveBeenCalledWith(
      "/admin/planner-signal-policies/12",
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("loads planner prompt intent policies with workspace headers", async () => {
    mocks.get.mockResolvedValue({
      data: {
        workspace_id: "ws-42",
        can_edit: true,
        policies: [
          {
            id: 13,
            policy_key: "custom_list_students",
            name: "Custom list students",
            scope_type: "workspace",
            scope_workspace_id: "ws-42",
            priority: 100,
            is_active: 1,
            stop_on_match: 0,
            is_seeded: 0,
            is_effective: 1,
            can_edit: 1,
            can_delete: 1,
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
    });

    const response = await getPlannerPromptIntentPolicies(false, true);

    expect(mocks.get).toHaveBeenCalledWith("/admin/planner-prompt-intent-policies", {
      headers: { "X-Workspace-Id": "ws-42" },
      params: { include_inactive: false, include_seeded: true },
    });
    expect(response.policies[0]?.policy_json.action_key).toBe("list_students");
  });

  it("saves planner prompt intent policy payloads through PUT", async () => {
    const payload = {
      policy_key: "custom_list_students",
      name: "Custom list students",
      scope_type: "workspace" as const,
      priority: 100,
      is_active: true,
      stop_on_match: false,
      policy_json: {
        version: 1 as const,
        action_key: "list_students" as const,
        regex_patterns: ["provider roster"],
        substring_patterns: [],
        state_codes: [],
      },
    };
    mocks.put.mockResolvedValue({
      data: {
        ...payload,
        id: 13,
        scope_workspace_id: "ws-42",
        can_edit: 1,
        can_delete: 1,
      },
    });

    await upsertPlannerPromptIntentPolicy(payload);

    expect(mocks.put).toHaveBeenCalledWith(
      "/admin/planner-prompt-intent-policies",
      payload,
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("deletes planner prompt intent policies through DELETE", async () => {
    mocks.delete.mockResolvedValue({ data: {} });

    await deletePlannerPromptIntentPolicy(13);

    expect(mocks.delete).toHaveBeenCalledWith(
      "/admin/planner-prompt-intent-policies/13",
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("loads planner retrieval policies with workspace headers", async () => {
    mocks.get.mockResolvedValue({
      data: {
        workspace_id: "ws-42",
        can_edit: true,
        policies: [
          {
            id: 21,
            policy_key: "custom_retrieval",
            name: "Custom retrieval",
            scope_type: "workspace",
            scope_workspace_id: "ws-42",
            priority: 100,
            is_active: 1,
            stop_on_match: 0,
            is_seeded: 0,
            is_effective: 1,
            can_edit: 1,
            can_delete: 1,
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
    });

    const response = await getPlannerRetrievalPolicies(false, true);

    expect(mocks.get).toHaveBeenCalledWith("/admin/planner-retrieval-policies", {
      headers: { "X-Workspace-Id": "ws-42" },
      params: { include_inactive: false, include_seeded: true },
    });
    expect(response.policies[0]?.policy_json.query_specs[0]?.query).toBe("provider territory");
  });

  it("saves planner retrieval policy payloads through PUT", async () => {
    const payload = {
      policy_key: "custom_retrieval",
      name: "Custom retrieval",
      scope_type: "workspace" as const,
      priority: 100,
      is_active: true,
      stop_on_match: false,
      policy_json: {
        version: 1 as const,
        when_signals_all: [],
        when_signals_any: ["staff_work_context_prompt" as const],
        exclude_signals_any: [],
        when_concept_key_patterns_any: ["PROVIDER"],
        query_specs: [{ query: "provider territory", source: "vector" as const, score_boost: 0.1, reasons: [] }],
        domain_name_prefer_tokens: ["provider"],
        domain_name_avoid_tokens: ["student"],
        domain_name_positive_bias: 0.2,
        domain_name_negative_bias: 0.1,
      },
    };
    mocks.put.mockResolvedValue({
      data: {
        ...payload,
        id: 21,
        scope_workspace_id: "ws-42",
        can_edit: 1,
        can_delete: 1,
      },
    });

    await upsertPlannerRetrievalPolicy(payload);

    expect(mocks.put).toHaveBeenCalledWith(
      "/admin/planner-retrieval-policies",
      payload,
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("deletes planner retrieval policies through DELETE", async () => {
    mocks.delete.mockResolvedValue({ data: {} });

    await deletePlannerRetrievalPolicy(21);

    expect(mocks.delete).toHaveBeenCalledWith(
      "/admin/planner-retrieval-policies/21",
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("loads planner domain selection policies with workspace headers", async () => {
    mocks.get.mockResolvedValue({
      data: {
        workspace_id: "ws-42",
        can_edit: true,
        policies: [
          {
            id: 31,
            policy_key: "custom_domain_selection",
            name: "Custom domain selection",
            scope_type: "workspace",
            scope_workspace_id: "ws-42",
            priority: 100,
            is_active: 1,
            stop_on_match: 0,
            is_seeded: 0,
            is_effective: 1,
            can_edit: 1,
            can_delete: 1,
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
    });

    const response = await getPlannerDomainSelectionPolicies(false, true);

    expect(mocks.get).toHaveBeenCalledWith("/admin/planner-domain-selection-policies", {
      headers: { "X-Workspace-Id": "ws-42" },
      params: { include_inactive: false, include_seeded: true },
    });
    expect(response.policies[0]?.policy_json.score_delta).toBe(0.33);
  });

  it("saves planner domain selection policy payloads through PUT", async () => {
    const payload = {
      policy_key: "custom_domain_selection",
      name: "Custom domain selection",
      scope_type: "workspace" as const,
      priority: 100,
      is_active: true,
      stop_on_match: false,
      policy_json: {
        version: 1 as const,
        when_signals_all: ["staff_work_context_prompt" as const],
        when_signals_any: [],
        exclude_signals_any: [],
        required_shortlist_features: ["STAFF_IDENTITY_COLUMN" as const],
        required_capability_features: [],
        score_delta: 0.33,
      },
    };
    mocks.put.mockResolvedValue({
      data: {
        ...payload,
        id: 31,
        scope_workspace_id: "ws-42",
        can_edit: 1,
        can_delete: 1,
      },
    });

    await upsertPlannerDomainSelectionPolicy(payload);

    expect(mocks.put).toHaveBeenCalledWith(
      "/admin/planner-domain-selection-policies",
      payload,
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });

  it("deletes planner domain selection policies through DELETE", async () => {
    mocks.delete.mockResolvedValue({ data: {} });

    await deletePlannerDomainSelectionPolicy(31);

    expect(mocks.delete).toHaveBeenCalledWith(
      "/admin/planner-domain-selection-policies/31",
      { headers: { "X-Workspace-Id": "ws-42" } },
    );
  });
});
