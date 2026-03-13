import { describe, expect, it } from "vitest";

import {
  analyzeForgeMatchRecords,
  buildForgeMatchConfidenceBreakdown,
  createLocalForgeMatchSession,
  mergeForgeMatchCandidates,
  parseForgeMatchWorkbook,
  patchMappings,
  summarizeForgeMatchResults,
  type ParseWorkbookResult,
} from "../pipeline";
import type { ForgeMatchCandidate } from "../contracts";

function candidate(overrides: Partial<ForgeMatchCandidate> & Pick<ForgeMatchCandidate, "column_id" | "table_name" | "column_name">): ForgeMatchCandidate {
  return {
    column_id: overrides.column_id,
    table_name: overrides.table_name,
    column_name: overrides.column_name,
    domain_name: null,
    concept_key: null,
    retrieval_score: overrides.retrieval_score ?? 0,
    lexical_score: overrides.lexical_score ?? 0,
    merged_score: overrides.merged_score ?? 0,
    reason_codes: overrides.reason_codes ?? [],
    selected_by_llm: false,
  };
}

async function workbookFile(): Promise<File> {
  const csv = [
    "Source Field,Description,Data Type,Source Table,Examples",
    "student_id,Student identifier,string,students,1001;1002",
    "district_name,District Name,string,districts,Austin",
  ].join("\n");

  const bytes = new TextEncoder().encode(csv);
  return {
    name: "mapping.csv",
    type: "text/csv",
    size: bytes.byteLength,
    async text() {
      return csv;
    },
    async arrayBuffer() {
      return bytes.buffer.slice(0);
    },
  } as unknown as File;
}

function parsedSeed(): ParseWorkbookResult {
  return {
    sheet_names: ["Sheet1"],
    source_records: [
      {
        id: "src-1",
        source_field: "student_id",
        description: "Student identifier",
        data_type: "string",
        source_object: "students",
        example_values: ["1001"],
        raw_values: {},
        provenance: {
          sheet_name: "Sheet1",
          row_number: 2,
        },
      },
    ],
    parse_stats: {
      sheets_processed: 1,
      rows_scanned: 2,
      rows_extracted: 1,
    },
  };
}

describe("forgeMatch pipeline", () => {
  it("parses uploaded workbook and extracts source records", async () => {
    const file = await workbookFile();
    const parsed = await parseForgeMatchWorkbook(file);

    expect(parsed.sheet_names.length).toBe(1);
    expect(parsed.source_records).toHaveLength(2);
    expect(parsed.source_records[0]).toMatchObject({
      source_field: "student_id",
      description: "Student identifier",
      data_type: "string",
      source_object: "students",
    });
    expect(parsed.parse_stats.rows_extracted).toBe(2);
  });

  it("merges vector and lexical candidates by column id", () => {
    const merged = mergeForgeMatchCandidates({
      vectorCandidates: [
        candidate({
          column_id: 101,
          table_name: "students",
          column_name: "student_id",
          retrieval_score: 0.92,
          reason_codes: ["vector_hit"],
        }),
      ],
      lexicalCandidates: [
        candidate({
          column_id: 101,
          table_name: "students",
          column_name: "student_id",
          lexical_score: 0.88,
          reason_codes: ["lexical_match"],
        }),
        candidate({
          column_id: 102,
          table_name: "students",
          column_name: "school_id",
          lexical_score: 0.55,
          reason_codes: ["lexical_match"],
        }),
      ],
    });

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      column_id: 101,
      retrieval_score: 0.92,
      lexical_score: 0.88,
    });
    expect(merged[0].reason_codes).toEqual(expect.arrayContaining(["vector_hit", "lexical_match"]));
  });

  it("derives confidence breakdown from candidate quality and metadata completeness", () => {
    const breakdown = buildForgeMatchConfidenceBreakdown({
      best: candidate({
        column_id: 100,
        table_name: "students",
        column_name: "student_id",
        retrieval_score: 0.91,
        lexical_score: 0.79,
        merged_score: 0.86,
      }),
      alternates: [
        candidate({
          column_id: 101,
          table_name: "students",
          column_name: "person_id",
          merged_score: 0.52,
        }),
      ],
      llmUsed: true,
      sourceRecord: {
        id: "s1",
        source_field: "Student ID",
        description: "Student identifier",
        data_type: "string",
        source_object: "students",
        example_values: ["1001"],
        raw_values: {},
        provenance: { sheet_name: "Sheet1", row_number: 2 },
      },
    });

    expect(breakdown.total).toBeGreaterThan(0.7);
    expect(breakdown.penalties).toBeLessThan(0.4);
  });

  it("analyzes records and supports manual remap patching", async () => {
    const seed = parsedSeed();
    const session = createLocalForgeMatchSession("sample.xlsx", seed, "2026-03-12T10:00:00Z");

    const analyzed = await analyzeForgeMatchRecords(session, seed.source_records, {
      retrieveCandidates: async () => ({
        candidates: [
          candidate({
            column_id: 200,
            table_name: "students",
            column_name: "student_id",
            retrieval_score: 0.95,
            lexical_score: 0.82,
            merged_score: 0.9,
            reason_codes: ["vector_hit"],
          }),
          candidate({
            column_id: 201,
            table_name: "students",
            column_name: "person_id",
            retrieval_score: 0.52,
            lexical_score: 0.4,
            merged_score: 0.46,
          }),
        ],
        retrievalLatencyMs: 10,
        llmLatencyMs: 0,
        llmUsed: false,
        llmError: null,
      }),
    });

    expect(analyzed.results).toHaveLength(1);
    expect(analyzed.results[0].best_match?.column_id).toBe(200);

    const patched = patchMappings(analyzed.results, [
      {
        mapping_id: analyzed.results[0].mapping_id,
        status: "manually_mapped",
        manually_selected_column_id: 201,
        review_notes: "Reviewed by analyst",
      },
    ]);

    expect(patched[0].status).toBe("manually_mapped");
    expect(patched[0].best_match?.column_id).toBe(201);
    expect(patched[0].review_notes).toBe("Reviewed by analyst");

    const summary = summarizeForgeMatchResults(patched);
    expect(summary.accepted).toBe(1);
  });
});
