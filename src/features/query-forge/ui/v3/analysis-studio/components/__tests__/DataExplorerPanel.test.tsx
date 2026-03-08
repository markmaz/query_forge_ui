import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { StudioDomainExplorer, StudioDomainSummary } from "../../model/analysisTypes";
import { DataExplorerPanel } from "../DataExplorerPanel";

const domains: StudioDomainSummary[] = [
  {
    id: 101,
    key: "medical_sales",
    label: "Medical Sales",
    description: "Commercial performance across orders, products, territories, and accounts.",
    fieldCount: 24,
    categoryCount: 4,
    metricCount: 4,
  },
];

const explorer: StudioDomainExplorer = {
  domain: {
    id: 101,
    key: "medical_sales",
    label: "Medical Sales",
    description: "Commercial performance across orders, products, territories, and accounts.",
    fieldCount: 24,
    categoryCount: 4,
    metricCount: 4,
    exampleQuestions: [
      "Which products are growing fastest?",
      "Compare territories by revenue",
      "Which hospitals increased spending?",
    ],
  },
  recommendedFields: [
    {
      id: 1011,
      key: "revenue",
      label: "Revenue",
      path: "orders.revenue",
      dataType: "decimal",
      allowedAggregations: ["sum", "avg", "count"],
    },
  ],
  fieldCategories: [
    {
      id: "orders",
      label: "Orders",
      fields: [
        { id: 1, key: "order_date", label: "Order Date", path: "orders.order_date", dataType: "date" },
        { id: 2, key: "revenue", label: "Revenue", path: "orders.revenue", dataType: "decimal" },
      ],
    },
    {
      id: "territories",
      label: "Territories",
      fields: [
        { id: 3, key: "territory_name", label: "Territory Name", path: "territories.territory_name", dataType: "string" },
        { id: 4, key: "region", label: "Region", path: "territories.region", dataType: "string" },
      ],
    },
  ],
};

describe("DataExplorerPanel", () => {
  it("shows empty state when no domain is selected", () => {
    render(
      <DataExplorerPanel
        domains={domains}
        selectedDomainId={null}
        explorer={null}
        onSelectDomain={vi.fn()}
      />,
    );

    expect(screen.getByText(/start with a domain/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a trusted business domain/i)).toBeInTheDocument();
  });

  it("renders selected domain overview context", () => {
    render(
      <DataExplorerPanel
        domains={domains}
        selectedDomainId={101}
        explorer={explorer}
        onSelectDomain={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Medical Sales").length).toBeGreaterThan(0);
    expect(screen.getByText(/commercial performance across orders/i)).toBeInTheDocument();
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getAllByText("Fields").length).toBeGreaterThan(0);
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText(/which products are growing fastest/i)).toBeInTheDocument();
  });

  it("filters grouped fields and shows empty search state", async () => {
    const user = userEvent.setup();
    render(
      <DataExplorerPanel
        domains={domains}
        selectedDomainId={101}
        explorer={explorer}
        onSelectDomain={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/search fields, paths, categories, aliases/i);
    await user.type(searchInput, "territory");

    expect(screen.getByText("Territories")).toBeInTheDocument();
    expect(screen.queryByText("Orders")).not.toBeInTheDocument();
    expect(screen.getByText("Territory Name")).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "graduatoin");
    expect(screen.getByText(/no fields matched "graduatoin"/i)).toBeInTheDocument();
  });

  it("adds clicked fields to recently used", async () => {
    const user = userEvent.setup();
    render(
      <DataExplorerPanel
        domains={domains}
        selectedDomainId={101}
        explorer={explorer}
        onSelectDomain={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /territories2/i }));
    await user.click(screen.getByRole("button", { name: /territory nameterritories\.territory_name/i }));

    expect(screen.getAllByText("Territory Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("territories.territory_name").length).toBeGreaterThan(0);
  });
});
