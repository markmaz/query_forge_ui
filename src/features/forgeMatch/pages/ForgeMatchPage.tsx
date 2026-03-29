import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { fetchBuilderDomains } from "@/shared/services/queryStudioAdminApi";

import { deleteForgeMatchSession, listForgeMatchSessions } from "../api";
import {
  useDebouncedValue,
  useForgeMatchQueue,
  useForgeMatchSession,
  useForgeMatchSummary,
  useForgeMatchWorkflow,
} from "../hooks";
import type {
  ForgeMatchAnalyzeRequest,
  ForgeMatchMapping,
  ForgeMatchReviewStatus,
  ForgeMatchSessionListRow,
  ForgeMatchSessionListStatus,
} from "../types";
import ForgeMatchAnalysisOverlay from "../components/ForgeMatchAnalysisOverlay";
import ForgeMatchAnalyzeControls from "../components/ForgeMatchAnalyzeControls";
import ForgeMatchCharts from "../components/ForgeMatchCharts";
import ForgeMatchExtractionPreview from "../components/ForgeMatchExtractionPreview";
import ForgeMatchFilters from "../components/ForgeMatchFilters";
import ForgeMatchFinalizeBar from "../components/ForgeMatchFinalizeBar";
import ForgeMatchHeader from "../components/ForgeMatchHeader";
import ForgeMatchManualRemapModal from "../components/ForgeMatchManualRemapModal";
import ForgeMatchNotesModal from "../components/ForgeMatchNotesModal";
import ForgeMatchRecentSessions from "../components/ForgeMatchRecentSessions";
import ForgeMatchResultDrawer from "../components/ForgeMatchResultDrawer";
import ForgeMatchReviewWorkspace, { type ReviewMode } from "../components/ForgeMatchReviewWorkspace";
import ForgeMatchSessionsPanel from "../components/ForgeMatchSessionsPanel";
import ForgeMatchStepper from "../components/ForgeMatchStepper";
import ForgeMatchSummaryCards from "../components/ForgeMatchSummaryCards";
import ForgeMatchToolRail from "../components/ForgeMatchToolRail";
import ForgeMatchTriagePanel, { type FocusFilter } from "../components/ForgeMatchTriagePanel";
import ForgeMatchUploadCard from "../components/ForgeMatchUploadCard";
import "../styles/forgeMatch.css";
import "@/features/query-forge/ui/v2/v2.css";

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "-";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

export default function ForgeMatchPage() {
  const {
    sessionId,
    activeJobId,
    runStatus,
    state,
    draftResponse,
    upload,
    analyze,
    cancelAnalyze,
    applyAction,
    exportFile,
    createDraft,
    selectSession,
    selectJob,
    clearError,
    isSessionLoading,
    isSessionError,
    sessionError,
    runStatusUpdatedAt,
    isRunStatusPolling,
    isCancelingAnalyze,
  } = useForgeMatchWorkflow();

  const [searchParams, setSearchParams] = useSearchParams();
  const invalidSessionIdRef = useRef<string | null>(null);

  const [selectedRow, setSelectedRow] = useState<ForgeMatchMapping | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [remapOpen, setRemapOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ForgeMatchSessionListRow | null>(null);

  const [analyzeRequest, setAnalyzeRequest] = useState<ForgeMatchAnalyzeRequest>({
    top_n: 8,
    force: false,
  });

  const [reviewMode, setReviewMode] = useState<ReviewMode>("queue");
  const [selectedQueueMappingId, setSelectedQueueMappingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ForgeMatchReviewStatus | "all">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [textFilter, setTextFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");

  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsPageSize, setSessionsPageSize] = useState(25);
  const [sessionsStatus, setSessionsStatus] = useState<ForgeMatchSessionListStatus | "all">("all");
  const [sessionsSearch, setSessionsSearch] = useState("");
  const [sessionsPanelOpen, setSessionsPanelOpen] = useState(false);
  const debouncedSessionsSearch = useDebouncedValue(sessionsSearch, 300);

  const urlSessionId = searchParams.get("sessionId")?.trim() || null;
  const urlJobId = searchParams.get("jobId")?.trim() || null;

  useEffect(() => {
    if (urlSessionId !== sessionId) {
      selectSession(urlSessionId);
    }
  }, [sessionId, selectSession, urlSessionId]);

  useEffect(() => {
    if (activeJobId) {
      return;
    }
    if (urlJobId !== activeJobId) {
      selectJob(urlJobId);
    }
  }, [activeJobId, selectJob, urlJobId]);

  const setUrlParams = (params: { sessionId?: string | null; jobId?: string | null }) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);

      if ("sessionId" in params) {
        const nextSessionId = String(params.sessionId ?? "").trim();
        if (nextSessionId) {
          next.set("sessionId", nextSessionId);
        } else {
          next.delete("sessionId");
        }
      }

      if ("jobId" in params) {
        const nextJobId = String(params.jobId ?? "").trim();
        if (nextJobId) {
          next.set("jobId", nextJobId);
        } else {
          next.delete("jobId");
        }
      }
      return next;
    });
  };

  const openSession = (nextSessionId: string) => {
    const normalized = String(nextSessionId ?? "").trim();
    if (!normalized) return;
    setUrlParams({ sessionId: normalized, jobId: null });
    selectSession(normalized);
  };

  const clearActiveSession = () => {
    setUrlParams({ sessionId: null, jobId: null });
    selectSession(null);
  };

  useEffect(() => {
    if (!isSessionError || !sessionId) {
      invalidSessionIdRef.current = null;
      return;
    }

    const statusCode =
      sessionError && typeof sessionError === "object" && "status" in sessionError
        ? Number((sessionError as { status?: number }).status)
        : undefined;

    if (statusCode === 404 && invalidSessionIdRef.current !== sessionId) {
      invalidSessionIdRef.current = sessionId;
      toast.error("Selected ForgeMatch session was not found.");
      clearActiveSession();
    }
  }, [isSessionError, sessionError, sessionId]);

  const sessionsQ = useQuery({
    queryKey: [
      "forge-match-sessions",
      {
        page: sessionsPage,
        pageSize: sessionsPageSize,
        status: sessionsStatus,
        q: debouncedSessionsSearch,
      },
    ],
    queryFn: () =>
      listForgeMatchSessions({
        page: sessionsPage,
        pageSize: sessionsPageSize,
        status: sessionsStatus,
        q: debouncedSessionsSearch,
      }),
    staleTime: 5_000,
    placeholderData: (previous) => previous,
  });

  const deleteSessionM = useMutation({
    mutationFn: async (targetSessionId: string) => deleteForgeMatchSession(targetSessionId),
    onSuccess: async (payload) => {
      if (payload.session_id === sessionId) {
        clearActiveSession();
      }
      await sessionsQ.refetch();
      toast.success("ForgeMatch session deleted.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Unable to delete ForgeMatch session.";
      toast.error(message);
    },
  });

  const domainsQ = useQuery({
    queryKey: ["forge-match", "domains"],
    queryFn: fetchBuilderDomains,
    staleTime: 60_000,
  });

  const summaryData = useForgeMatchSummary(state.mappings, state.summary);
  const sessionView = useForgeMatchSession({
    session: state.session,
    mappings: state.mappings,
    isAnalyzing: state.isAnalyzing,
  });

  const domainOptions = useMemo(() => {
    const options = new Set<string>();
    state.mappings.forEach((row) => {
      const name = row.manual_selection?.table_name ?? row.best_match?.table_name;
      if (name && name.trim()) options.add(name.trim());
    });
    return [...options].sort((a, b) => a.localeCompare(b));
  }, [state.mappings]);

  const filteredMappings = useMemo(() => {
    const q = normalizeSearch(textFilter);

    return state.mappings.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (confidenceFilter !== "all" && row.confidence_band !== confidenceFilter) return false;

      if (domainFilter) {
        const rowDomain = row.manual_selection?.table_name ?? row.best_match?.table_name ?? "";
        if (normalizeSearch(rowDomain) !== normalizeSearch(domainFilter)) return false;
      }

      if (focusFilter === "ambiguous" && row.match_decision !== "ambiguous") return false;
      if (focusFilter === "no_match" && row.match_decision !== "no_confident_match") return false;
      if (focusFilter === "low_confidence" && row.confidence_band !== "low") return false;
      if (focusFilter === "accepted" && row.status !== "accepted") return false;
      if (focusFilter === "manual" && row.status !== "manually_mapped") return false;

      if (!q) return true;

      const haystack = normalizeSearch(
        [
          row.source_field_name,
          row.source_description,
          row.source_type,
          row.source_object_name,
          row.best_match?.table_name,
          row.best_match?.column_name,
          row.explanation,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return haystack.includes(q);
    });
  }, [confidenceFilter, domainFilter, focusFilter, state.mappings, statusFilter, textFilter]);

  const queueRows = useForgeMatchQueue(filteredMappings);

  useEffect(() => {
    if (queueRows.length === 0) {
      setSelectedQueueMappingId(null);
      return;
    }

    const stillPresent = selectedQueueMappingId
      ? queueRows.some((row) => row.mapping_id === selectedQueueMappingId)
      : false;

    if (!stillPresent) {
      setSelectedQueueMappingId(queueRows[0]?.mapping_id ?? null);
    }
  }, [queueRows, selectedQueueMappingId]);

  const selectedInspectorRow = useMemo(() => {
    if (!selectedQueueMappingId) return queueRows[0] ?? null;
    return queueRows.find((row) => row.mapping_id === selectedQueueMappingId) ?? queueRows[0] ?? null;
  }, [queueRows, selectedQueueMappingId]);

  const previewRows = useMemo(() => {
    if (state.sourceRecords.length > 0) return state.sourceRecords.slice(0, 30);
    return state.uploadPreview.slice(0, 30);
  }, [state.sourceRecords, state.uploadPreview]);

  const handlePrint = () => {
    setReviewMode("table");
    window.setTimeout(() => {
      window.print();
    }, 50);
  };

  const selectedSession = state.session;
  const hasSelectedSession = Boolean(sessionId);
  useEffect(() => {
    if (activeJobId && urlJobId !== activeJobId) {
      setUrlParams({ jobId: activeJobId });
    }
  }, [activeJobId, urlJobId]);

  const handleAnalyze = async () => {
    try {
      const started = await analyze(analyzeRequest);
      if (started?.job_id) {
        setUrlParams({ jobId: started.job_id });
      }
    } catch {
      // Error message is handled in hook state.
    }
  };

  const handleDeleteSession = async (targetSession: { id: string; uploaded_filename: string; status: string }) => {
    if (targetSession.status === "analyzing") {
      toast.error("Stop the active analysis before deleting this session.");
      return;
    }
    setDeleteTarget(targetSession as ForgeMatchSessionListRow);
  };

  return (
    <div className="fm-page">
      <div className="fm-layout ncqv2-layout">
        <div className="fm-layout-left-cluster ncqv2-rails">
          <aside className="fm-layout-rail">
            <ForgeMatchToolRail
              sessionsOpen={sessionsPanelOpen}
              onToggleSessions={() => setSessionsPanelOpen((current) => !current)}
            />
          </aside>

          <aside className={`fm-layout-left ${sessionsPanelOpen ? "is-open" : "is-closed"}`} aria-hidden={!sessionsPanelOpen}>
            <div className="fm-layout-left-shell">
              <ForgeMatchSessionsPanel
                rows={sessionsQ.data?.rows ?? []}
                total={sessionsQ.data?.total ?? 0}
                page={sessionsQ.data?.page ?? sessionsPage}
                pageSize={sessionsQ.data?.page_size ?? sessionsPageSize}
                status={sessionsStatus}
                query={sessionsSearch}
                selectedSessionId={sessionId}
                isLoading={sessionsQ.isLoading}
                isFetching={sessionsQ.isFetching}
                deletingSessionId={deleteSessionM.isPending ? deleteSessionM.variables ?? null : null}
                onPageChange={setSessionsPage}
                onPageSizeChange={(next) => {
                  setSessionsPageSize(next);
                  setSessionsPage(1);
                }}
                onStatusChange={(next) => {
                  setSessionsStatus(next);
                  setSessionsPage(1);
                }}
                onQueryChange={(next) => {
                  setSessionsSearch(next);
                  setSessionsPage(1);
                }}
                onRefresh={() => {
                  void sessionsQ.refetch();
                }}
                onOpen={openSession}
                onDelete={(session) => void handleDeleteSession(session)}
              />
            </div>
          </aside>
        </div>

        <main className="fm-layout-right ncqv2-canvas">
          <ForgeMatchHeader statusLabel={sessionView.statusLabel} />
          <ForgeMatchStepper currentStepIndex={sessionView.stepIndex} />

          {state.error ? (
            <div className="alert alert-danger" role="alert">
              <div className="d-flex justify-content-between align-items-center gap-2">
                <span>{state.error}</span>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={clearError}>Dismiss</button>
              </div>
            </div>
          ) : null}

          {!hasSelectedSession ? (
            <>
              <ForgeMatchUploadCard
                disabled={false}
                isUploading={state.isUploading}
                session={state.session}
                onUpload={async (file) => {
                  const uploaded = await upload(file);
                  if (uploaded?.session_id) {
                    openSession(uploaded.session_id);
                    void sessionsQ.refetch();
                  }
                }}
              />

              <ForgeMatchRecentSessions
                rows={sessionsQ.data?.rows ?? []}
                isLoading={sessionsQ.isLoading || sessionsQ.isFetching}
                onOpen={openSession}
              />
            </>
          ) : isSessionLoading && !selectedSession ? (
            <section className="fm-card" aria-label="Loading selected session">
              <div className="placeholder-glow mb-2">
                <span className="placeholder col-6" />
              </div>
              <div className="placeholder-glow">
                <span className="placeholder col-12" />
                <span className="placeholder col-10" />
                <span className="placeholder col-8" />
              </div>
            </section>
          ) : (
            <>
              <section className="fm-card" aria-label="Selected ForgeMatch session">
                <div className="fm-section-head">
                  <div>
                    <h2 className="fm-card-title">{selectedSession?.uploaded_filename ?? "ForgeMatch Session"}</h2>
                    <p className="fm-card-subtitle">
                      Status <strong>{selectedSession?.status ?? "-"}</strong> · Created by {selectedSession?.created_by ?? "-"} · {formatTimestamp(selectedSession?.created_at)}
                    </p>
                  </div>

                  <div className="fm-summary-actions">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={clearActiveSession}
                      disabled={state.isUploading || state.isAnalyzing || state.isSaving}
                    >
                      New Upload
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={state.isAnalyzing || state.isSaving}
                      onClick={() => void handleAnalyze()}
                    >
                      {state.isAnalyzing ? "Analyzing..." : selectedSession?.status === "analyzed" ? "Re-analyze" : "Analyze"}
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled={state.mappings.length === 0} onClick={() => void exportFile("csv").then((result) => downloadBlob(result.filename, result.blob))}>Export CSV</button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled={state.mappings.length === 0} onClick={() => void exportFile("xlsx").then((result) => downloadBlob(result.filename, result.blob))}>Export XLSX</button>
                    <button type="button" className="btn btn-outline-primary btn-sm" disabled={state.mappings.length === 0} onClick={() => void createDraft("view_draft")}>Create View Draft</button>
                    <button type="button" className="btn btn-outline-primary btn-sm" disabled={state.mappings.length === 0} onClick={() => void createDraft("domain_draft")}>Create Domain Draft</button>
                  </div>
                </div>
              </section>

              <ForgeMatchExtractionPreview rows={previewRows} />

              <ForgeMatchAnalyzeControls
                session={state.session}
                analyzeRequest={analyzeRequest}
                domainOptions={domainsQ.data?.rows ?? []}
                disableAnalyze={!state.session || state.isUploading || state.isSaving}
                isAnalyzing={state.isAnalyzing}
                onAnalyzeRequestChange={setAnalyzeRequest}
                onAnalyze={handleAnalyze}
              />

              <ForgeMatchAnalysisOverlay
                isAnalyzing={state.isAnalyzing}
                runStatus={runStatus}
                activeJobId={activeJobId}
                runStatusUpdatedAt={runStatusUpdatedAt}
                isPolling={isRunStatusPolling}
                isCanceling={isCancelingAnalyze}
                onCancel={cancelAnalyze}
              />

              <details className="fm-card fm-collapsible-card" open>
                <summary className="fm-collapsible-summary">
                  <div>
                    <h2 className="fm-card-title">Review Filters</h2>
                    <p className="fm-card-subtitle">Use filters and quick triage chips to narrow the queue.</p>
                  </div>
                  <span className="fm-collapsible-kicker">{filteredMappings.length.toLocaleString()} rows</span>
                </summary>
                <div className="fm-collapsible-body">
                  <ForgeMatchTriagePanel
                    ambiguous={summaryData.triage.ambiguous}
                    noMatch={summaryData.triage.noMatch}
                    lowConfidence={summaryData.triage.lowConfidence}
                    onSetFocus={(next) => {
                      setFocusFilter(next);
                      setReviewMode("queue");
                    }}
                  />

                  <ForgeMatchFilters
                    statusFilter={statusFilter}
                    confidenceFilter={confidenceFilter}
                    textFilter={textFilter}
                    domainFilter={domainFilter}
                    domainOptions={domainOptions}
                    focusFilter={focusFilter}
                    resultCount={filteredMappings.length}
                    onStatusFilterChange={setStatusFilter}
                    onConfidenceFilterChange={setConfidenceFilter}
                    onTextFilterChange={setTextFilter}
                    onDomainFilterChange={setDomainFilter}
                    onFocusFilterChange={setFocusFilter}
                  />
                </div>
              </details>

              <details className="fm-card fm-collapsible-card">
                <summary className="fm-collapsible-summary">
                  <div>
                    <h2 className="fm-card-title">Analysis Overview</h2>
                    <p className="fm-card-subtitle">Summary cards and charts are available here when you need the broader picture.</p>
                  </div>
                  <span className="fm-collapsible-kicker">Optional</span>
                </summary>
                <div className="fm-collapsible-body">
                  <ForgeMatchSummaryCards counts={summaryData.counts} />

                  <ForgeMatchCharts
                    confidenceData={summaryData.confidenceData}
                    outcomeData={summaryData.outcomeData}
                    domainData={summaryData.domainData}
                  />
                </div>
              </details>

              <ForgeMatchReviewWorkspace
                mode={reviewMode}
                onModeChange={setReviewMode}
                queueRows={queueRows}
                tableRows={filteredMappings}
                selectedMappingId={selectedQueueMappingId}
                selectedRow={selectedInspectorRow}
                isSaving={state.isSaving}
                onSelectMapping={setSelectedQueueMappingId}
                onAccept={(row) => applyAction(row, "accept")}
                onReject={(row) => applyAction(row, "reject")}
                onNeedsReview={(row) => applyAction(row, "needs_review")}
                onOpenDrawer={(row) => {
                  setSelectedRow(row);
                  setDrawerOpen(true);
                }}
                onManualRemap={(row) => {
                  setSelectedRow(row);
                  setRemapOpen(true);
                }}
                onEditNotes={(row) => {
                  setSelectedRow(row);
                  setNotesOpen(true);
                }}
              />

              <ForgeMatchFinalizeBar
                disableActions={state.mappings.length === 0 || state.isSaving || state.isAnalyzing}
                onExport={async (format) => {
                  const exported = await exportFile(format);
                  downloadBlob(exported.filename, exported.blob);
                }}
                onCreateDraft={async (kind) => {
                  const draftName = window.prompt("Optional draft name", "") ?? "";
                  await createDraft(kind, { name: draftName || undefined });
                }}
                onPrint={handlePrint}
                draftResponse={draftResponse}
              />
            </>
          )}
        </main>
      </div>

      <ForgeMatchResultDrawer
        row={selectedRow}
        session={state.session}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onManualRemap={(row) => {
          setSelectedRow(row);
          setDrawerOpen(false);
          setRemapOpen(true);
        }}
      />

      <ForgeMatchManualRemapModal
        open={remapOpen}
        row={selectedRow}
        onClose={() => setRemapOpen(false)}
        onConfirm={async ({ mappingId, columnId, notes }) => {
          if (!selectedRow || selectedRow.mapping_id !== mappingId) return;
          await applyAction(selectedRow, "remap", {
            manually_selected_workspace_column_id: columnId,
            review_notes: notes || undefined,
          });
          setRemapOpen(false);
        }}
      />

      <ForgeMatchNotesModal
        open={notesOpen}
        row={selectedRow}
        onClose={() => setNotesOpen(false)}
        onSave={async ({ mappingId, notes }) => {
          if (!selectedRow || selectedRow.mapping_id !== mappingId) return;
          await applyAction(selectedRow, "edit_notes", {
            review_notes: notes,
          });
          setNotesOpen(false);
        }}
      />

      {deleteTarget && (
        <div className="fm-drawer-overlay" role="presentation" onClick={() => setDeleteTarget(null)}>
          <div
            className="fm-modal"
            role="dialog"
            aria-label="Delete ForgeMatch session"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="fm-modal-header">
              <h3 className="mb-0">Delete Session</h3>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDeleteTarget(null)}>
                Close
              </button>
            </div>

            <p className="mb-2">
              Delete <strong>{deleteTarget.uploaded_filename}</strong>?
            </p>
            <p className="small text-muted mb-3">
              This removes the source rows and all mapping results for the session.
            </p>

            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteSessionM.isPending}
                onClick={() => {
                  void deleteSessionM.mutateAsync(deleteTarget.id).finally(() => {
                    setDeleteTarget(null);
                  });
                }}
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
