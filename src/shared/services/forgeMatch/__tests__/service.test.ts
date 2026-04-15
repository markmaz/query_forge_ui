import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  analyzeForgeMatch,
  cancelForgeMatchAnalyze,
  createForgeMatchDomainDraft,
  createForgeMatchViewDraft,
  deleteForgeMatchSession,
  executeForgeMatchViewDraftSql,
  exportForgeMatch,
  getForgeMatchAnalyzeHistory,
  getForgeMatchAnalyzeStatus,
  getForgeMatchSession,
  listForgeMatchSessions,
  patchForgeMatchMappings,
  startForgeMatchAnalyze,
  uploadForgeMatchFile,
} from "../service";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../api", () => ({
    default: {
      get: mocks.get,
      post: mocks.post,
      patch: mocks.patch,
      delete: mocks.delete,
    },
}));

describe("forgeMatch service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads file to /forge-match/upload", async () => {
    mocks.post.mockResolvedValue({
      data: {
        session_id: "session-1",
        workspace_id: "ws-1",
        uploaded_filename: "mapping.csv",
        file_type: "csv",
        status: "uploaded",
        sheet_count: 1,
        source_record_count: 1,
        source_preview: [],
      },
    });

    const file = new File(["source_field\nstudent_id"], "mapping.csv", { type: "text/csv" });
    const result = await uploadForgeMatchFile(file);

    expect(mocks.post).toHaveBeenCalledWith(
      "/forge-match/upload",
      expect.any(FormData),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } })
    );
    expect(result.session_id).toBe("session-1");
  });

  it("lists sessions with serialized params", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            id: "session-1",
            workspace_id: "ws-1",
            uploaded_filename: "mapping.csv",
            file_type: "csv",
            created_by: "user-1",
            status: "uploaded",
            sheet_count: 1,
            source_record_count: 1,
            result_count: 0,
            accepted_count: 0,
            manually_mapped_count: 0,
          },
        ],
        total: 1,
        page: 2,
        page_size: 10,
      },
    });

    const result = await listForgeMatchSessions({
      page: 2,
      page_size: 10,
      status: "uploaded",
      q: "map",
    });

    expect(mocks.get).toHaveBeenCalledWith("/forge-match", {
      params: {
        page: 2,
        page_size: 10,
        status: "uploaded",
        q: "map",
      },
    });
    expect(result.page).toBe(2);
  });

  it("posts analyze request shape", async () => {
    mocks.post.mockResolvedValue({
      data: {
        session_id: "session-1",
        workspace_id: "ws-1",
        status: "analyzed",
        result_count: 0,
        summary: {
          total: 0,
          status_counts: {},
          decision_counts: {},
          confidence_bands: {},
        },
        mappings: [],
      },
    });

    await analyzeForgeMatch("session-1", {
      top_n: 10,
      domain_id: 4,
      force: true,
    });

    expect(mocks.post).toHaveBeenCalledWith("/forge-match/session-1/analyze", {
      top_n: 10,
      domain_id: 4,
      force: true,
    });
  });

  it("starts async analyze run", async () => {
    mocks.post.mockResolvedValue({
      data: {
        job_id: "job-1",
        session_id: "session-1",
        workspace_id: "ws-1",
        status: "queued",
        source_total: 12,
      },
    });

    const result = await startForgeMatchAnalyze("session-1", {
      top_n: 10,
      force: true,
    });

    expect(mocks.post).toHaveBeenCalledWith("/forge-match/session-1/analyze/start", {
      top_n: 10,
      force: true,
    });
    expect(result.job_id).toBe("job-1");
  });

  it("gets analyze run status", async () => {
    mocks.get.mockResolvedValue({
      data: {
        job_id: "job-1",
        session_id: "session-1",
        workspace_id: "ws-1",
        status: "analyzing",
        current_phase: "Searching semantic catalog",
        source_total: 12,
        source_done: 6,
        source_skipped: 0,
        source_failed: 0,
        progress_pct: 50,
      },
    });

    const result = await getForgeMatchAnalyzeStatus("job-1");

    expect(mocks.get).toHaveBeenCalledWith("/forge-match/status/job-1");
    expect(result.status).toBe("analyzing");
    expect(result.progress_pct).toBe(50);
  });

  it("cancels analyze run", async () => {
    mocks.post.mockResolvedValue({
      data: {
        job_id: "job-1",
        session_id: "session-1",
        workspace_id: "ws-1",
        status: "canceled",
        source_total: 12,
        source_done: 5,
        source_skipped: 0,
        source_failed: 0,
        progress_pct: 42,
      },
    });

    const result = await cancelForgeMatchAnalyze("job-1");

    expect(mocks.post).toHaveBeenCalledWith("/forge-match/cancel/job-1");
    expect(result.status).toBe("canceled");
  });

  it("loads analyze history with limit", async () => {
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            job_id: "job-1",
            session_id: "session-1",
            workspace_id: "ws-1",
            status: "analyzed",
            source_total: 12,
            source_done: 12,
            progress_pct: 100,
          },
        ],
      },
    });

    const result = await getForgeMatchAnalyzeHistory(20);

    expect(mocks.get).toHaveBeenCalledWith("/forge-match/history", {
      params: { limit: 20 },
    });
    expect(result.rows).toHaveLength(1);
  });

  it("gets session with pagination params", async () => {
    mocks.get.mockResolvedValue({
      data: {
        session: {
          id: "session-1",
          workspace_id: "ws-1",
          uploaded_filename: "mapping.csv",
          file_type: "csv",
          status: "uploaded",
          sheet_count: 1,
          source_record_count: 1,
        },
        source_records: [],
        mappings: [],
        summary: {
          total: 0,
          status_counts: {},
          decision_counts: {},
          confidence_bands: {},
        },
      },
    });

    await getForgeMatchSession("session-1", {
      source_limit: 100,
      source_offset: 20,
      mapping_limit: 200,
      mapping_offset: 40,
    });

    expect(mocks.get).toHaveBeenCalledWith("/forge-match/session-1", {
      params: {
        source_limit: 100,
        source_offset: 20,
        mapping_limit: 200,
        mapping_offset: 40,
      },
    });
  });

  it("deletes a session", async () => {
    mocks.delete.mockResolvedValue({
      data: {
        session_id: "session-1",
        workspace_id: "ws-1",
        deleted: true,
        message: "ForgeMatch session deleted",
      },
    });

    const result = await deleteForgeMatchSession("session-1");

    expect(mocks.delete).toHaveBeenCalledWith("/forge-match/session-1");
    expect(result.deleted).toBe(true);
  });

  it("patches mappings using action/status update shape", async () => {
    mocks.patch.mockResolvedValue({
      data: {
        session_id: "session-1",
        workspace_id: "ws-1",
        updated: 1,
        rows: [{ mapping_id: "map-1", status: "accepted", manual_column_id: null }],
      },
    });

    await patchForgeMatchMappings("session-1", [
      {
        mapping_id: "map-1",
        action: "accept",
      },
      {
        mapping_id: "map-2",
        action: "remap",
        manually_selected_workspace_column_id: 4828,
      },
    ]);

    expect(mocks.patch).toHaveBeenCalledWith("/forge-match/session-1/mappings", {
      updates: [
        { mapping_id: "map-1", action: "accept" },
        {
          mapping_id: "map-2",
          action: "remap",
          manually_selected_workspace_column_id: 4828,
        },
      ],
    });
  });

  it("exports CSV and parses response filename", async () => {
    mocks.get.mockResolvedValue({
      data: new Blob(["a,b\n1,2"], { type: "text/csv" }),
      headers: {
        "content-disposition": 'attachment; filename="forge_match_export.csv"',
      },
    });

    const result = await exportForgeMatch("session-1", "csv");

    expect(mocks.get).toHaveBeenCalledWith("/forge-match/session-1/export", {
      params: { format: "csv" },
      responseType: "blob",
    });
    expect(result.filename).toBe("forge_match_export.csv");
  });

  it("creates view and domain drafts", async () => {
    mocks.post
      .mockResolvedValueOnce({
        data: {
          artifact_id: "fmdv_1",
          workspace_id: "ws-1",
          session_id: "session-1",
          name: "View Draft",
          accepted_column_count: 2,
          columns: [],
          status: "draft_created",
          view_name: "view_draft",
          base_table_name: "catalog.analytics.dim_student",
          is_executable: true,
          blocking_reason: null,
          select_sql: "SELECT 1",
          create_view_sql: "CREATE VIEW `view_draft` AS SELECT 1;",
          editable_sql: "CREATE VIEW `view_draft` AS SELECT 1;",
          join_domain_id: null,
          join_domain_name: null,
          involved_tables: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          artifact_id: "fmdd_1",
          workspace_id: "ws-1",
          session_id: "session-1",
          name: "Domain Draft",
          accepted_column_count: 2,
          columns: [],
          status: "draft_created",
        },
      });

    await createForgeMatchViewDraft("session-1", { name: "View Draft" });
    await createForgeMatchDomainDraft("session-1", { name: "Domain Draft" });

    expect(mocks.post).toHaveBeenNthCalledWith(1, "/forge-match/session-1/create-view-draft", {
      name: "View Draft",
    });
    expect(mocks.post).toHaveBeenNthCalledWith(2, "/forge-match/session-1/create-domain-draft", {
      name: "Domain Draft",
    });
  });

  it("executes draft SQL", async () => {
    mocks.post.mockResolvedValue({
      data: {
        workspace_id: "ws-1",
        session_id: "session-1",
        statement_type: "create_view",
        status: "SUCCEEDED",
        catalog_name: "analytics",
        schema_name: "staging",
        effective_sql: "CREATE VIEW `analytics`.`staging`.`view_draft` AS SELECT 1;",
        row_count: 0,
        rows: [],
        message: "View statement executed successfully.",
      },
    });

    const result = await executeForgeMatchViewDraftSql("session-1", {
      sql: "CREATE VIEW `view_draft` AS SELECT 1;",
      catalog_name: "analytics",
      schema_name: "staging",
    });

    expect(mocks.post).toHaveBeenCalledWith("/forge-match/session-1/execute-view-draft-sql", {
      sql: "CREATE VIEW `view_draft` AS SELECT 1;",
      catalog_name: "analytics",
      schema_name: "staging",
    });
    expect(result.status).toBe("SUCCEEDED");
  });
});
