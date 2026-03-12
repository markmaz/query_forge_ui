import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDomainProfileMetrics,
  updateDomainProfileMetrics,
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

describe("domainProfiles metrics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiWorkspaceId.mockReturnValue("ws-555");
  });

  it("calls GET /domains/:id/profile-metrics with workspace header", async () => {
    mocks.get.mockResolvedValue({
      data: {
        domain_id: 42,
        domain_name: "Sales Performance",
        has_profile: false,
        can_edit: true,
        metrics: [
          {
            metric_key: "total_net_amount",
            label: "Total Net Amount",
            kind: "numeric",
            agg: "sum",
            column_key: "wt180.net_amount",
            sql_metric: null,
          },
        ],
      },
    });

    const response = await getDomainProfileMetrics(42);

    expect(mocks.get).toHaveBeenCalledWith("/domains/42/profile-metrics", {
      headers: {
        "X-Workspace-Id": "ws-555",
      },
    });
    expect(response.domain_id).toBe(42);
    expect(response.metrics[0].metric_key).toBe("total_net_amount");
  });

  it("calls PUT /domains/:id/profile-metrics with full metrics payload", async () => {
    const metrics = [
      {
        metric_key: "total_net_amount",
        label: "Total Net Amount",
        kind: "numeric" as const,
        agg: "sum" as const,
        column_key: "wt180.net_amount",
        sql_metric: null,
      },
      {
        metric_key: "row_count",
        label: "Row Count",
        kind: "count" as const,
        agg: "count" as const,
        column_key: null,
        sql_metric: null,
      },
    ];
    mocks.put.mockResolvedValue({
      data: {
        domain_id: 42,
        domain_name: "Sales Performance",
        has_profile: true,
        can_edit: true,
        metrics,
      },
    });

    await updateDomainProfileMetrics(42, metrics);

    expect(mocks.put).toHaveBeenCalledWith(
      "/domains/42/profile-metrics",
      { metrics },
      {
        headers: {
          "X-Workspace-Id": "ws-555",
        },
      },
    );
  });
});

