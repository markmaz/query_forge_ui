import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDomainTimePolicy,
  updateDomainTimePolicy,
} from "./domainProfiles";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  getApiWorkspaceId: vi.fn(),
}));

vi.mock("@/shared/services/api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    delete: mocks.delete,
  },
  getApiWorkspaceId: mocks.getApiWorkspaceId,
}));

describe("domainProfiles time policy API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiWorkspaceId.mockReturnValue("ws-99");
  });

  it("calls GET /domains/:id/time-policy with workspace header", async () => {
    mocks.get.mockResolvedValue({
      data: {
        domain_id: 7,
        domain_name: "Sales",
        has_policy: true,
        can_edit: true,
        policy: {
          calendar_mode: "fiscal",
          fiscal_year_start_month: 7,
          timezone: "America/Chicago",
          week_start: "sunday",
          default_time_concept_key: "ORDER_DATE",
          allow_relative_ranges: true,
          default_grain: "month",
          prefer_time_object_over_filter: false,
          strict_mode: true,
          relative_map: { last_30_days: "P30D" },
          notes: "policy notes",
        },
      },
    });

    const response = await getDomainTimePolicy(7);

    expect(mocks.get).toHaveBeenCalledWith("/domains/7/time-policy", {
      headers: {
        "X-Workspace-Id": "ws-99",
      },
    });
    expect(response.policy.calendar_mode).toBe("fiscal");
    expect(response.policy.fiscal_year_start_month).toBe(7);
    expect(response.policy.relative_map.last_30_days).toBe("P30D");
  });

  it("calls PUT /domains/:id/time-policy with policy object", async () => {
    const policy = {
      calendar_mode: "calendar" as const,
      fiscal_year_start_month: null,
      timezone: "UTC",
      week_start: "monday" as const,
      default_time_concept_key: null,
      allow_relative_ranges: true,
      default_grain: "month" as const,
      prefer_time_object_over_filter: true,
      strict_mode: false,
      relative_map: {
        today: "P0D",
      },
      notes: null,
    };
    mocks.put.mockResolvedValue({
      data: {
        domain_id: 7,
        domain_name: "Sales",
        has_policy: true,
        can_edit: true,
        policy,
      },
    });

    await updateDomainTimePolicy(7, policy);

    expect(mocks.put).toHaveBeenCalledWith(
      "/domains/7/time-policy",
      { policy },
      {
        headers: {
          "X-Workspace-Id": "ws-99",
        },
      },
    );
  });
});

