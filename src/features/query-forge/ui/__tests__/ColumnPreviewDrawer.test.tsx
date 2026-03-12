import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ColumnPreviewDrawer } from "../components/ColumnPreviewDrawer";
import type { DomainColumnRef } from "../../model/domainCatalog";

const BASE_COL: DomainColumnRef = {
  modelColumnId: 1,
  identityKey: "dict:1:orders:status",
  columnName: "status",
  modelTableName: "orders",
  fullName: "main.sales.orders.status",
  dataType: "string",
  nullable: true,
  description: "Order status",
  workspaceTableId: 10,
  modelTableId: 20,
  baseTableName: "orders",
  schemaName: "sales",
  catalogName: "main",
  domainId: 30,
  domainName: "Orders",
  sampleValues: [
    { value: "SHIPPED", count: 42 },
    { value: { code: "R", label: "Returned" }, count: 3 },
  ],
  sampleStats: { sample_row_count: 100 },
  sampleRanAt: null,
  sampleError: null,
};

describe("ColumnPreviewDrawer", () => {
  it("renders object sample values without [object Object]", () => {
    render(
      <ColumnPreviewDrawer
        open
        onClose={vi.fn()}
        col={BASE_COL}
        isSelected={false}
        showSelectAction={false}
      />
    );

    expect(screen.getByText("SHIPPED (count: 42)")).toBeInTheDocument();
    expect(
      screen.getByText('{"code":"R","label":"Returned"} (count: 3)')
    ).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });
});
