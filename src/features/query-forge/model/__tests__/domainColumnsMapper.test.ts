import { describe, expect, it } from "vitest";
import type { BuilderColumnRow } from "@/shared/services/queryStudioAdminApi";
import { toDomainColumnRef } from "../mappers/domainColumns";

function makeRow(overrides: Partial<BuilderColumnRow> = {}): BuilderColumnRow {
  return {
    workspaceTableId: 10,
    tableAlias: null,
    fullName: "catalog.schema.students",
    baseTableName: "students",
    schemaName: "schema",
    catalogName: "catalog",
    variantCode: null,
    isQe: false,
    existsInDbx: true,
    lastSeenAt: null,
    domainId: 2,
    domainName: "Student Outcomes",
    modelTableId: null,
    modelTableName: "students",
    modelColumnId: 101,
    columnName: "student_id",
    columnLabel: "student_id",
    dataType: "string",
    nullable: false,
    ordinalPosition: 1,
    description: "Student identifier",
    sampleValuesJson: null,
    sampleStatsJson: null,
    sampleRanAt: null,
    sampleError: null,
    tableColumnCount: 22,
    ...overrides,
  };
}

describe("toDomainColumnRef description mapping", () => {
  it("uses trimmed primary description when available", () => {
    const mapped = toDomainColumnRef(makeRow({ description: "  Student identifier  " }));
    expect(mapped.description).toBe("Student identifier");
  });

  it("falls back to compatibility description keys when description is empty", () => {
    const row = {
      ...makeRow({ description: "" }),
      dict_description: "Dictionary description",
    } as BuilderColumnRow & { dict_description: string };
    const mapped = toDomainColumnRef(row);
    expect(mapped.description).toBe("Dictionary description");
  });

  it("normalizes whitespace-only descriptions to null", () => {
    const mapped = toDomainColumnRef(makeRow({ description: "   " }));
    expect(mapped.description).toBeNull();
  });
});
