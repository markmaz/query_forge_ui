import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("../../../../../../shared/services/api", () => ({
  default: {
    get: mocks.get,
  },
}));

import { getStudioDomainExplorer, listStudioDomains } from "./studioMetadataApi";

describe("studioMetadataApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and normalizes domain summaries", async () => {
    mocks.get.mockResolvedValueOnce({
      data: [
        {
          id: 12,
          key: "medical_sales",
          label: "Medical Sales",
          description: "Commercial performance",
          fieldCount: 148,
          categoryCount: 6,
          metricCount: 9,
        },
      ],
    });

    const rows = await listStudioDomains();

    expect(mocks.get).toHaveBeenCalledWith("/query-studio/domains");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 12, key: "medical_sales", label: "Medical Sales" });
  });

  it("loads and normalizes domain explorer payload", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        domain: {
          id: 12,
          key: "medical_sales",
          label: "Medical Sales",
          description: "Commercial performance",
          fieldCount: 148,
          categoryCount: 6,
          metricCount: 9,
          exampleQuestions: ["Compare territories by revenue"],
        },
        recommendedFields: [
          { id: 101, key: "revenue", label: "Revenue", path: "orders.revenue", dataType: "number" },
        ],
        fieldCategories: [
          {
            id: "revenue_sales",
            label: "Revenue & Sales",
            fields: [{ id: 101, key: "revenue", label: "Revenue", path: "orders.revenue", dataType: "number" }],
          },
        ],
      },
    });

    const payload = await getStudioDomainExplorer(12);

    expect(mocks.get).toHaveBeenCalledWith("/query-studio/domains/12/explorer");
    expect(payload.domain.label).toBe("Medical Sales");
    expect(payload.recommendedFields[0].path).toBe("orders.revenue");
    expect(payload.fieldCategories[0].label).toBe("Revenue & Sales");
  });
});
