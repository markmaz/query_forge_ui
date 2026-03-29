import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ForgeMatchResultDrawer from "../components/ForgeMatchResultDrawer";
import type { ForgeMatchMapping, ForgeMatchSessionRecord } from "../types";

vi.mock("../components/ForgeMatchConfidencePill", () => ({
  default: ({ score, band }: { score: number; band: string }) => <div>{`${score}-${band}`}</div>,
}));

vi.mock("../components/ForgeMatchStatusBadge", () => ({
  default: ({ status }: { status: string }) => <div>{status}</div>,
}));

describe("ForgeMatchResultDrawer", () => {
  it("renders session and row pipeline traces", () => {
    const row = {
      mapping_id: "map-1",
      source_field_name: "BirthDate",
      source_description: "Student date of birth",
      source_type: "date",
      source_object_name: "StudentDemographics",
      sample_value: "2010-02-14",
      sheet_name: "Sheet1",
      row_number: 2,
      confidence_score: 92,
      confidence_band: "high",
      status: "suggested",
      match_decision: "matched",
      explanation: "Selected the birth date field.",
      reason_codes: ["name_similarity"],
      best_match: {
        column_id: 202,
        table_name: "dim_student",
        column_name: "birth_date",
        display_name: "Birth Date",
      },
      alternates: [],
      retrieved_candidates: [
        {
          column_id: 202,
          table_name: "dim_student",
          column_name: "birth_date",
          display_name: "Birth Date",
          retrieval_score: 0.81,
          lexical_score: 0.77,
          score: 0.88,
        },
      ],
      shared_pipeline: {
        pipeline_name: "forge_match_row_pipeline",
        trace_id: "row-trace-1",
        vertical_norm: "education",
        debug: {
          extract_signals: {
            signals: ["age_extreme_prompt"],
          },
        },
        trace_nodes: [
          {
            pipeline_name: "forge_match_row_pipeline",
            node: "rank_candidates",
            status: "completed",
            ms: 12,
            lineage: ["forge_match_row_pipeline"],
            summary: {
              selected_candidate_id: "202",
            },
          },
        ],
      },
    } satisfies ForgeMatchMapping;

    const session = {
      id: "sess-1",
      workspace_id: "ws-1",
      uploaded_filename: "mapping.csv",
      file_type: "csv",
      status: "analyzed",
      sheet_count: 1,
      source_record_count: 1,
      summary_json: {
        analysis_trace: {
          pipeline_name: "forge_match_session_pipeline",
          trace_id: "session-trace-1",
          vertical_norm: "education",
          trace_nodes: [
            {
              pipeline_name: "forge_match_session_pipeline",
              node: "execute_session_rows",
              status: "completed",
              ms: 45,
              lineage: ["forge_match_session_pipeline"],
            },
          ],
        },
      },
    } satisfies ForgeMatchSessionRecord;

    render(
      <ForgeMatchResultDrawer
        row={row}
        session={session}
        open
        onClose={() => {}}
        onManualRemap={() => {}}
      />,
    );

    expect(screen.getByText("Session Pipeline")).toBeInTheDocument();
    expect(screen.getByText("forge_match_session_pipeline")).toBeInTheDocument();
    expect(screen.getByText("Execute Session Rows")).toBeInTheDocument();
    expect(screen.getByText("Row Pipeline")).toBeInTheDocument();
    expect(screen.getByText("forge_match_row_pipeline")).toBeInTheDocument();
    expect(screen.getByText("age_extreme_prompt")).toBeInTheDocument();
    expect(screen.getByText("Rank Candidates")).toBeInTheDocument();
  });
});
