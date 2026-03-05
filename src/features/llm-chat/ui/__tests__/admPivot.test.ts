import { describe, expect, it } from "vitest";

import { buildAdmPivot, isAdmResult } from "../admPivot";

describe("admPivot utilities", () => {
  it("detects and pivots school_year/report_period ADM rows", () => {
    const rows = [
      { school_year: 2026, report_period: 1, total_adm: 100 },
      { school_year: 2026, report_period: 2, total_adm: 105.5 },
      { school_year: 2025, report_period: 1, total_adm: 98.25 },
    ];

    expect(isAdmResult([{ key: "report_period" }, { key: "total_adm" }], rows)).toBe(true);

    const pivot = buildAdmPivot([{ key: "report_period" }, { key: "total_adm" }], rows);
    expect(pivot.columns).toEqual(["1", "2"]);
    expect(pivot.rows).toHaveLength(2);
    expect(pivot.rows.find((row) => row.label === "2026")?.values["1"]).toBe(100);
    expect(pivot.rows.find((row) => row.label === "2026")?.values["2"]).toBe(105.5);
    expect(pivot.grandTotals["1"]).toBe(198.25);
    expect(pivot.grandTotals["2"]).toBe(105.5);
  });

  it("renders one pivot row per school_name (+school_year)", () => {
    const rows = [
      { school_name: "Alpha HS", school_year: 2026, report_period: 1, total_adm: 50 },
      { school_name: "Alpha HS", school_year: 2026, report_period: 2, total_adm: 51 },
      { school_name: "Beta HS", school_year: 2026, report_period: 1, total_adm: 45 },
    ];

    const pivot = buildAdmPivot([{ key: "report_period" }, { label: "Total ADM", key: "total_adm" }], rows);
    expect(pivot.rows).toHaveLength(2);
    expect(pivot.rows.find((row) => row.label === "Alpha HS (2026)")?.values["2"]).toBe(51);
  });

  it("renders one pivot row per student shape", () => {
    const rows = [
      {
        student_unique_id: "stu-1",
        first_name: "Holden",
        last_name: "Black",
        school_year: 2026,
        report_period: 1,
        total_adm: 1,
      },
      {
        student_unique_id: "stu-1",
        first_name: "Holden",
        last_name: "Black",
        school_year: 2026,
        report_period: 2,
        total_adm: 1,
      },
      {
        student_unique_id: "stu-2",
        first_name: "Mina",
        last_name: "Sato",
        school_year: 2026,
        report_period: 1,
        total_adm: 0.75,
      },
    ];

    const pivot = buildAdmPivot([{ key: "report_period" }, { key: "total_adm" }], rows);
    expect(pivot.rows).toHaveLength(2);
    expect(pivot.rows[0].label.toLowerCase()).toContain("holden");
  });

  it("falls back to non-ADM when metric key does not match", () => {
    const rows = [{ school_year: 2026, report_period: 1, attendance_rate: 99 }];
    expect(isAdmResult([{ key: "report_period" }, { key: "attendance_rate" }], rows)).toBe(false);
    expect(buildAdmPivot([{ key: "report_period" }, { key: "attendance_rate" }], rows)).toEqual({
      columns: [],
      rows: [],
      grandTotals: {},
    });
  });
});
