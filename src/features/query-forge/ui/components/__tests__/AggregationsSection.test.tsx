import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AggregationsSection from "../AggregationsSection";
import type { SqlAggregationsJson, SqlColumnKey } from "../../../model/sqlJson";

const STUDENT_COL: SqlColumnKey = {
  modelColumnId: 101,
  workspaceTableId: 61,
  columnName: "k_student",
};

const STAFF_COL: SqlColumnKey = {
  modelColumnId: 202,
  workspaceTableId: 30,
  columnName: "k_staff_school_association",
};

const COUNTY_COL: SqlColumnKey = {
  modelColumnId: 303,
  workspaceTableId: 20,
  columnName: "county_fips_code",
};

describe("AggregationsSection", () => {
  it("rehydrates and renders derived metric references", async () => {
    const value: SqlAggregationsJson = {
      enabled: true,
      metrics: [
        {
          id: "m1",
          metricRef: {
            type: "derived",
            name: "students_per_teacher",
            label: "Students per Teacher",
          },
        },
      ],
      groupBy: [COUNTY_COL],
      derivedMetrics: [
        {
          kind: "ratio",
          name: "students_per_teacher",
          label: "Students per Teacher",
          numerator: { columnKey: STUDENT_COL, agg: "count_distinct", filters: [] },
          denominator: { columnKey: STAFF_COL, agg: "count_distinct", filters: [] },
          safeDivide: true,
          multiplyBy: null,
        },
      ],
    };

    render(
      <AggregationsSection
        selectedColumns={[COUNTY_COL]}
        allColumns={[STUDENT_COL, STAFF_COL, COUNTY_COL]}
        value={value}
      />
    );

    expect(screen.getByText(/Derived metrics/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Students per Teacher/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/COUNT_DISTINCT\(k_student\) \/ COUNT_DISTINCT\(k_staff_school_association\)/i).length
    ).toBeGreaterThan(0);
  });

  it("adds Students per Teacher preset and emits derived metric payload", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AggregationsSection
        selectedColumns={[COUNTY_COL]}
        allColumns={[STUDENT_COL, STAFF_COL, COUNTY_COL]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /students per teacher/i }));

    expect(onChange).toHaveBeenCalled();
    const latest = onChange.mock.calls.at(-1)?.[0] as SqlAggregationsJson | null;
    expect(latest?.derivedMetrics?.[0]).toMatchObject({
      kind: "ratio",
      name: "students_per_teacher",
      safeDivide: true,
      numerator: { agg: "count_distinct" },
      denominator: { agg: "count_distinct" },
    });
  });
});
