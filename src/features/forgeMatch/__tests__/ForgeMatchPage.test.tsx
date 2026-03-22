import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore, type RootState } from "@/app/core/store";
import { routes } from "@/app/navigation/routes";
import ForgeMatchPage from "../pages/ForgeMatchPage";

type SessionDetail = {
  session: any;
  source_records: any[];
  mappings: any[];
  summary: any;
};

const apiMocks = vi.hoisted(() => ({
  listForgeMatchSessions: vi.fn(),
  uploadForgeMatchDocument: vi.fn(),
  startForgeMatchAnalyzeSession: vi.fn(),
  fetchForgeMatchAnalyzeStatus: vi.fn(),
  cancelForgeMatchAnalyzeSession: vi.fn(),
  fetchForgeMatchAnalyzeHistory: vi.fn(),
  fetchForgeMatchSession: vi.fn(),
  updateForgeMatchMappings: vi.fn(),
  exportForgeMatchSession: vi.fn(),
  createForgeMatchDraft: vi.fn(),
}));

vi.mock("@/features/forgeMatch/api", () => ({
  listForgeMatchSessions: apiMocks.listForgeMatchSessions,
  uploadForgeMatchDocument: apiMocks.uploadForgeMatchDocument,
  startForgeMatchAnalyzeSession: apiMocks.startForgeMatchAnalyzeSession,
  fetchForgeMatchAnalyzeStatus: apiMocks.fetchForgeMatchAnalyzeStatus,
  cancelForgeMatchAnalyzeSession: apiMocks.cancelForgeMatchAnalyzeSession,
  fetchForgeMatchAnalyzeHistory: apiMocks.fetchForgeMatchAnalyzeHistory,
  fetchForgeMatchSession: apiMocks.fetchForgeMatchSession,
  updateForgeMatchMappings: apiMocks.updateForgeMatchMappings,
  exportForgeMatchSession: apiMocks.exportForgeMatchSession,
  createForgeMatchDraft: apiMocks.createForgeMatchDraft,
}));

vi.mock("@/shared/services/queryStudioAdminApi", () => ({
  fetchBuilderDomains: vi.fn().mockResolvedValue({ rows: [{ id: 1, name: "Education" }] }),
}));

const baseSession = {
  workspace_id: "ws-123",
  file_type: "xlsx",
  created_by: "user-1",
  sheet_count: 1,
  source_record_count: 1,
  result_count: 0,
  accepted_count: 0,
  manually_mapped_count: 0,
  created_at: "2026-03-12T12:00:00Z",
  updated_at: "2026-03-12T12:00:00Z",
};

const sessionsStore = [
  {
    ...baseSession,
    id: "session-1",
    uploaded_filename: "district_mapping.xlsx",
    status: "uploaded",
  },
  {
    ...baseSession,
    id: "session-2",
    uploaded_filename: "enrollment_mapping.csv",
    status: "analyzed",
  },
  ...Array.from({ length: 28 }).map((_, index) => ({
    ...baseSession,
    id: `session-${index + 3}`,
    uploaded_filename: `mapping_${index + 3}.xlsx`,
    status: index % 3 === 0 ? "analyzed" : index % 3 === 1 ? "uploaded" : "analyzing",
  })),
];

const detailStoreById: Record<string, SessionDetail> = {
  "session-1": {
    session: {
      id: "session-1",
      workspace_id: "ws-123",
      uploaded_filename: "district_mapping.xlsx",
      file_type: "xlsx",
      created_by: "user-1",
      status: "uploaded",
      sheet_count: 1,
      source_record_count: 1,
      created_at: "2026-03-12T12:00:00Z",
      updated_at: "2026-03-12T12:00:00Z",
    },
    source_records: [
      {
        id: 1,
        row_id: "Student Fields:2",
        sheet_name: "Student Fields",
        row_number: 2,
        source_field_name: "student_id",
        source_description: "Student identifier",
        source_type: "string",
        source_object_name: "students",
      },
    ],
    mappings: [],
    summary: {
      total: 0,
      status_counts: { suggested: 0, accepted: 0, rejected: 0, needs_review: 0, manually_mapped: 0 },
      decision_counts: { matched: 0, ambiguous: 0, no_confident_match: 0 },
      confidence_bands: { high: 0, medium: 0, low: 0 },
    },
  },
  "session-2": {
    session: {
      id: "session-2",
      workspace_id: "ws-123",
      uploaded_filename: "enrollment_mapping.csv",
      file_type: "csv",
      created_by: "user-1",
      status: "analyzed",
      sheet_count: 2,
      source_record_count: 3,
      created_at: "2026-03-12T12:00:00Z",
      updated_at: "2026-03-12T12:30:00Z",
    },
    source_records: [],
    mappings: [],
    summary: {
      total: 0,
      status_counts: { suggested: 0, accepted: 0, rejected: 0, needs_review: 0, manually_mapped: 0 },
      decision_counts: { matched: 0, ambiguous: 0, no_confident_match: 0 },
      confidence_bands: { high: 0, medium: 0, low: 0 },
    },
  },
};

function renderPage(preloadedState?: Partial<RootState>, initialEntry = routes.ForgeMatch) {
  const store = createAppStore(preloadedState);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <ForgeMatchPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

const preloadedState = {
  auth: {
    isAuthenticated: true,
    bootstrapped: true,
  },
  user: {
    user: { user_id: "user-1" },
    rolesByFeature: {},
    capabilities: [],
    loading: false,
    initialized: true,
    error: null,
  },
  userWorkspaces: {
    selectedWorkspaceId: "ws-123",
  },
} as unknown as Partial<RootState>;

beforeEach(() => {
  vi.clearAllMocks();

  apiMocks.listForgeMatchSessions.mockImplementation(async (params: any = {}) => {
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 25);
    const status = params?.status;
    const q = String(params?.q ?? "").trim().toLowerCase();

    let rows = [...sessionsStore];
    if (status && status !== "all") {
      rows = rows.filter((session) => session.status === status);
    }
    if (q) {
      rows = rows.filter((session) => session.uploaded_filename.toLowerCase().includes(q));
    }

    const start = (page - 1) * pageSize;
    const paged = rows.slice(start, start + pageSize);

    return {
      rows: paged,
      total: rows.length,
      page,
      page_size: pageSize,
    };
  });

  apiMocks.uploadForgeMatchDocument.mockResolvedValue({
    session_id: "session-1",
    workspace_id: "ws-123",
    uploaded_filename: "district_mapping.xlsx",
    file_type: "xlsx",
    status: "uploaded",
    sheet_count: 1,
    source_record_count: 1,
    source_preview: [
      {
        row_id: "Student Fields:2",
        sheet_name: "Student Fields",
        row_number: 2,
        source_field_name: "student_id",
        source_description: "Student identifier",
        source_type: "string",
        source_object_name: "students",
      },
    ],
  });

  apiMocks.fetchForgeMatchSession.mockImplementation(async (sessionId: string) => {
    const detail = detailStoreById[sessionId];
    if (!detail) throw new Error("not found");
    return detail;
  });

  apiMocks.startForgeMatchAnalyzeSession.mockImplementation(async () => {
    detailStoreById["session-1"] = {
      ...detailStoreById["session-1"],
      session: {
        ...detailStoreById["session-1"].session,
        status: "analyzed",
      },
      mappings: [
        {
          mapping_id: "map-1",
          source_record_id: 1,
          source_row_id: "Student Fields:2",
          sheet_name: "Student Fields",
          row_number: 2,
          source_field_name: "student_id",
          source_description: "Student identifier",
          source_type: "string",
          source_object_name: "students",
          sample_value: null,
          best_match: {
            column_id: 100,
            table_name: "students",
            column_name: "student_id",
            display_name: "Student ID",
          },
          alternates: [
            {
              column_id: 101,
              table_name: "students",
              column_name: "person_id",
            },
          ],
          confidence_score: 88,
          confidence_band: "high",
          match_decision: "matched",
          explanation: "Strong lexical and vector alignment",
          reason_codes: ["vector_hit"],
          status: "suggested",
          review_notes: null,
          manually_selected_workspace_column_id: null,
          manual_selection: null,
          retrieved_candidates: [
            {
              column_id: 109,
              table_name: "students",
              column_name: "preferred_student_id",
            },
          ],
        },
      ],
      summary: {
        total: 1,
        status_counts: { suggested: 1, accepted: 0, rejected: 0, needs_review: 0, manually_mapped: 0 },
        decision_counts: { matched: 1, ambiguous: 0, no_confident_match: 0 },
        confidence_bands: { high: 1, medium: 0, low: 0 },
      },
    };

    return {
      job_id: "job-1",
      session_id: "session-1",
      workspace_id: "ws-123",
      status: "queued",
      source_total: 1,
    };
  });

  apiMocks.fetchForgeMatchAnalyzeStatus.mockResolvedValue({
    job_id: "job-1",
    session_id: "session-1",
    workspace_id: "ws-123",
    status: "analyzed",
    current_phase: "Preparing review results",
    source_total: 1,
    source_done: 1,
    source_skipped: 0,
    source_failed: 0,
    progress_pct: 100,
    analysis_error: null,
  });

  apiMocks.cancelForgeMatchAnalyzeSession.mockResolvedValue({
    job_id: "job-1",
    session_id: "session-1",
    workspace_id: "ws-123",
    status: "canceled",
    source_total: 1,
    source_done: 0,
    source_skipped: 0,
    source_failed: 0,
    progress_pct: 0,
    analysis_error: null,
  });

  apiMocks.fetchForgeMatchAnalyzeHistory.mockResolvedValue({ rows: [] });

  apiMocks.updateForgeMatchMappings.mockResolvedValue({
    session_id: "session-1",
    workspace_id: "ws-123",
    updated: 1,
    rows: [{ mapping_id: "map-1", status: "accepted", manual_column_id: null }],
  });

  apiMocks.exportForgeMatchSession.mockResolvedValue({
    filename: "forge_match_session_1.csv",
    blob: new Blob(["csv"], { type: "text/csv" }),
  });

  apiMocks.createForgeMatchDraft.mockResolvedValue({
    artifact_id: "fmdv_123",
    workspace_id: "ws-123",
    session_id: "session-1",
    name: "Draft",
    accepted_column_count: 0,
    columns: [],
    status: "draft_created",
    note: "draft",
  });
});

describe("ForgeMatchPage", () => {
  it("renders sessions list and paginates", async () => {
    const user = userEvent.setup();
    renderPage(preloadedState);

    await user.click(screen.getByRole("button", { name: /show sessions/i }));

    const sessionsPanel = await screen.findByLabelText(/forgematch sessions list/i);
    expect(within(sessionsPanel).getByRole("heading", { name: /^sessions$/i })).toBeInTheDocument();
    expect((await within(sessionsPanel).findAllByRole("button", { name: /^open$/i })).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/district_mapping\.xlsx/i)).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(apiMocks.listForgeMatchSessions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 25 })
      );
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(apiMocks.listForgeMatchSessions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 25 })
      );
    });
  });

  it("selects session and runs review actions", async () => {
    const user = userEvent.setup();
    renderPage(preloadedState);

    await user.click(screen.getByRole("button", { name: /show sessions/i }));

    const sessionsPanel = await screen.findByLabelText(/forgematch sessions list/i);
    const sessionsTable = within(sessionsPanel).getByRole("table");
    await within(sessionsPanel).findAllByRole("button", { name: /^open$/i });
    await user.click(within(sessionsTable).getAllByRole("button", { name: /^open$/i })[0]);

    await waitFor(() => {
      expect(apiMocks.fetchForgeMatchSession).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({ source_offset: 0, mapping_offset: 0 })
      );
    });

    await user.click(screen.getByRole("button", { name: /analyze session/i }));

    await waitFor(() => {
      expect(apiMocks.startForgeMatchAnalyzeSession).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({ top_n: 8, force: false })
      );
    });

    expect((await screen.findAllByText("students.student_id")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /queue view/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^accept$/i }));

    await waitFor(() => {
      expect(apiMocks.updateForgeMatchMappings).toHaveBeenCalledWith(
        "session-1",
        expect.arrayContaining([expect.objectContaining({ action: "accept", mapping_id: "map-1" })])
      );
    });
  }, 12_000);

  it("renders run status and supports cancel", async () => {
    const user = userEvent.setup();
    apiMocks.fetchForgeMatchAnalyzeStatus.mockResolvedValue({
      job_id: "job-9",
      session_id: "session-1",
      workspace_id: "ws-123",
      status: "analyzing",
      current_phase: "Searching semantic catalog",
      source_total: 10,
      source_done: 4,
      source_skipped: 0,
      source_failed: 0,
      progress_pct: 40,
      analysis_error: null,
    });
    apiMocks.startForgeMatchAnalyzeSession.mockResolvedValue({
      job_id: "job-9",
      session_id: "session-1",
      workspace_id: "ws-123",
      status: "queued",
      source_total: 10,
    });

    renderPage(preloadedState);
    await user.click(screen.getByRole("button", { name: /show sessions/i }));
    const sessionsPanel = await screen.findByLabelText(/forgematch sessions list/i);
    const sessionsTable = within(sessionsPanel).getByRole("table");
    await user.click(within(sessionsTable).getAllByRole("button", { name: /^open$/i })[0]);

    await user.click(screen.getByRole("button", { name: /analyze session/i }));

    await waitFor(() => {
      expect(apiMocks.fetchForgeMatchAnalyzeStatus).toHaveBeenCalledWith("job-9");
    });

    expect(await screen.findByText(/searching semantic catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/40%/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(apiMocks.cancelForgeMatchAnalyzeSession).toHaveBeenCalledWith("job-9");
    });
  }, 12_000);

  it("auto-selects uploaded session", async () => {
    const user = userEvent.setup();
    renderPage(preloadedState);

    const file = new File(["source_field\nstudent_id"], "mapping.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText(/^file$/i), file);
    await user.click(screen.getByRole("button", { name: /^upload$/i }));

    await waitFor(() => {
      expect(apiMocks.uploadForgeMatchDocument).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(apiMocks.fetchForgeMatchSession).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({ source_offset: 0, mapping_offset: 0 })
      );
    });
  });

  it("hydrates selected session from URL sessionId", async () => {
    renderPage(preloadedState, `${routes.ForgeMatch}?sessionId=session-2`);

    await waitFor(() => {
      expect(apiMocks.fetchForgeMatchSession).toHaveBeenCalledWith(
        "session-2",
        expect.objectContaining({ source_offset: 0, mapping_offset: 0 })
      );
    });

    expect((await screen.findAllByText(/enrollment_mapping\.csv/i)).length).toBeGreaterThan(0);
  });

  it("updates sessions query params from search and status filter", async () => {
    const user = userEvent.setup();
    renderPage(preloadedState);

    await user.click(screen.getByRole("button", { name: /show sessions/i }));

    const searchInput = await screen.findByLabelText(/search/i);
    await user.clear(searchInput);
    await user.type(searchInput, "enrollment");

    const statusSelect = screen.getByLabelText(/status/i);
    await user.selectOptions(statusSelect, "analyzed");

    await waitFor(() => {
      expect(apiMocks.listForgeMatchSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, pageSize: 25, status: "analyzed", q: "enrollment" })
      );
    });
  });
});
