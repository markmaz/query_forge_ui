import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FiltersSection, FiltersSectionBody } from "../FiltersSection";
import type { SqlColumnKey } from "../../../model/sqlJson";

const PATIENT_ID: SqlColumnKey = {
  modelColumnId: 101,
  columnName: "patient_id",
  workspaceTableId: 10,
  exprId: null,
  alias: null,
};

function getOperatorSelect(): HTMLSelectElement {
  const selects = screen
    .getAllByRole("combobox")
    .map((element) => element as HTMLSelectElement)
    .filter((select) => Array.from(select.options).some((option) => option.value === "not_in"));
  if (!selects[0]) {
    throw new Error("Operator select not found");
  }
  return selects[0];
}

describe("FiltersSectionBody", () => {
  it("renders operator-specific value editors and inline validation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <FiltersSectionBody
        selectedColumns={[PATIENT_ID]}
        allColumns={[PATIENT_ID]}
        value={null}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /add filter/i }));

    const opSelect = getOperatorSelect();
    await user.selectOptions(opSelect, "not_in");

    expect(await screen.findByPlaceholderText(/enter value and press enter/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one value is required/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/enter value and press enter/i), "CA{enter}");
    await waitFor(() => {
      expect(screen.queryByText(/at least one value is required/i)).not.toBeInTheDocument();
    });

    await user.selectOptions(opSelect, "between");
    expect(await screen.findByPlaceholderText(/min value/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/max value/i)).toBeInTheDocument();
    expect(screen.getByText(/between requires exactly 2 values/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/min value/i), "10");
    await user.type(screen.getByPlaceholderText(/max value/i), "20");
    await waitFor(() => {
      expect(screen.queryByText(/between requires exactly 2 values/i)).not.toBeInTheDocument();
    });

    await user.selectOptions(opSelect, "is_null");
    expect(await screen.findByText(/no value required/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/value/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/min value/i)).not.toBeInTheDocument();
  });

  it("disables Next/Save actions while filter rows are invalid", async () => {
    const user = userEvent.setup();

    const ControlledFilters = () => {
      const [value, setValue] = React.useState<any>(null);
      return (
        <FiltersSection
          collapsed={false}
          onToggleCollapsed={() => undefined}
          selectedColumns={[PATIENT_ID]}
          allColumns={[PATIENT_ID]}
          value={value}
          onChange={setValue}
          onNext={() => undefined}
          onSubmit={() => undefined}
        />
      );
    };

    render(
      <ControlledFilters />
    );

    await user.click(screen.getByRole("button", { name: /add filter/i }));
    await user.selectOptions(getOperatorSelect(), "not_in");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^next$/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
    });
  });
});
