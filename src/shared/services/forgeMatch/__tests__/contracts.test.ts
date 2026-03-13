import { describe, expect, it } from "vitest";

import {
  forgeMatchAnalyzeHistoryResponseSchema,
  forgeMatchAnalyzeStartResponseSchema,
  forgeMatchAnalyzeStatusResponseSchema,
  forgeMatchAnalyzeResponseSchema,
  forgeMatchListSessionsResponseSchema,
  forgeMatchPatchRequestSchema,
  forgeMatchUploadResponseSchema,
} from "../contracts";

describe("forgeMatch contracts", () => {
  it("validates upload response shape", () => {
    const parsed = forgeMatchUploadResponseSchema.parse({
      session_id: "session-1",
      workspace_id: "ws-1",
      uploaded_filename: "district_mapping.xlsx",
      file_type: "xlsx",
      status: "uploaded",
      sheet_count: 2,
      source_record_count: 128,
      source_preview: [
        {
          row_id: "Student Fields:2",
          sheet_name: "Student Fields",
          row_number: 2,
          source_field_name: "student_id",
          source_description: "Identifier",
          source_type: "string",
          source_object_name: "students",
          sample_value: "1001",
          category: "id",
        },
      ],
    });

    expect(parsed.session_id).toBe("session-1");
    expect(parsed.source_preview).toHaveLength(1);
  });

  it("validates analyze response with mappings", () => {
    const parsed = forgeMatchAnalyzeResponseSchema.parse({
      session_id: "session-1",
      workspace_id: "ws-1",
      status: "analyzed",
      result_count: 1,
      analyzed_count: 1,
      skipped_count: 0,
      summary: {
        total: 1,
        status_counts: { suggested: 1, accepted: 0, rejected: 0, needs_review: 0, manually_mapped: 0 },
        decision_counts: { matched: 1, ambiguous: 0, no_confident_match: 0 },
        confidence_bands: { high: 1, medium: 0, low: 0 },
      },
      mappings: [
        {
          mapping_id: "map-1",
          source_record_id: 1,
          source_row_id: "Student Fields:2",
          sheet_name: "Student Fields",
          row_number: 2,
          source_field_name: "student_id",
          source_description: "Identifier",
          source_type: "string",
          source_object_name: "students",
          sample_value: "1001",
          best_match: {
            column_id: 55,
            column_name: "student_id",
            display_name: "Student ID",
            table_name: "students",
          },
          alternates: [],
          confidence_score: 87,
          confidence_band: "high",
          match_decision: "matched",
          explanation: "Strong lexical overlap",
          reason_codes: ["lexical_overlap"],
          status: "suggested",
          review_notes: null,
          manually_selected_workspace_column_id: null,
          manual_selection: null,
          retrieved_candidates: [],
        },
      ],
    });

    expect(parsed.summary.total).toBe(1);
    expect(parsed.mappings[0].status).toBe("suggested");
  });

  it("validates patch request shape", () => {
    const parsed = forgeMatchPatchRequestSchema.parse({
      updates: [
        {
          mapping_id: "map-1",
          action: "accept",
        },
        {
          mapping_id: "map-2",
          action: "remap",
          manually_selected_workspace_column_id: 4828,
          review_notes: "Customer confirmed local equivalent",
        },
      ],
    });

    expect(parsed.updates[1].manually_selected_workspace_column_id).toBe(4828);
  });

  it("validates list sessions response shape", () => {
    const parsed = forgeMatchListSessionsResponseSchema.parse({
      rows: [
        {
          id: "session-1",
          workspace_id: "ws-1",
          uploaded_filename: "district_mapping.xlsx",
          file_type: "xlsx",
          created_by: "user-1",
          status: "analyzed",
          sheet_count: 3,
          source_record_count: 120,
          result_count: 118,
          accepted_count: 40,
          manually_mapped_count: 5,
          created_at: "2026-03-12T12:00:00Z",
          updated_at: "2026-03-12T13:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
    });

    expect(parsed.rows[0].status).toBe("analyzed");
    expect(parsed.total).toBe(1);
  });

  it("validates analyze start and status response shapes", () => {
    const started = forgeMatchAnalyzeStartResponseSchema.parse({
      job_id: "job-1",
      session_id: "session-1",
      workspace_id: "ws-1",
      status: "queued",
      source_total: 120,
    });

    const status = forgeMatchAnalyzeStatusResponseSchema.parse({
      job_id: "job-1",
      session_id: "session-1",
      workspace_id: "ws-1",
      status: "analyzing",
      current_phase: "Searching semantic catalog",
      source_total: 120,
      source_done: 72,
      source_skipped: 2,
      source_failed: 0,
      progress_pct: 60,
      analysis_error: null,
    });

    expect(started.job_id).toBe("job-1");
    expect(status.progress_pct).toBe(60);
  });

  it("validates analyze history response shape", () => {
    const parsed = forgeMatchAnalyzeHistoryResponseSchema.parse({
      rows: [
        {
          job_id: "job-1",
          session_id: "session-1",
          workspace_id: "ws-1",
          status: "analyzed",
          source_total: 120,
          source_done: 120,
          source_skipped: 0,
          source_failed: 0,
          progress_pct: 100,
        },
      ],
    });

    expect(parsed.rows[0].status).toBe("analyzed");
  });
});
