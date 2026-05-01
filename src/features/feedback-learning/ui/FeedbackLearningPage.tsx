import { useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useAppSelector } from "@/shared/runtime/hooks";
import {
  useApproveFeedbackLearningCandidate,
  useBulkApproveFeedbackLearningCandidates,
  useBulkRejectFeedbackLearningCandidates,
  useDeactivateFeedbackLearningDomainOverride,
  useDeactivateFeedbackLearningSemanticOverride,
  useFeedbackLearningCandidateDetail,
  useFeedbackLearningCandidates,
  useFeedbackLearningDomainOverrides,
  useFeedbackLearningPromotionAudits,
  useFeedbackLearningSemanticOverrides,
  useRejectFeedbackLearningCandidate,
} from "../hooks/useFeedbackLearning";
import type {
  FeedbackLearningCandidateFilters,
  FeedbackLearningPromotionAuditFilters,
} from "../model/types";
import { CandidateDetailsDrawer } from "./components/CandidateDetailsDrawer";
import { CandidateFilters } from "./components/CandidateFilters";
import { CandidateList } from "./components/CandidateList";
import { OverrideList } from "./components/OverrideList";
import { PromotionAuditList } from "./components/PromotionAuditList";
import { ReviewDecisionDialog } from "./components/ReviewDecisionDialog";
import "@/features/system-admin/ui/systemAdmin.css";

type ActiveTab = "candidates" | "overrides" | "audits";
type PendingAction =
  | { mode: "approve"; candidateIds: number[] }
  | { mode: "reject"; candidateIds: number[] }
  | null;

const DEFAULT_CANDIDATE_FILTERS: FeedbackLearningCandidateFilters = {
  page: 1,
  page_size: 50,
};

const DEFAULT_AUDIT_FILTERS: FeedbackLearningPromotionAuditFilters = {
  limit: 50,
  offset: 0,
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}

export default function FeedbackLearningPage() {
  const workspaceId = useAppSelector((state) => state.userWorkspaces.selectedWorkspaceId);
  const [activeTab, setActiveTab] = useState<ActiveTab>("candidates");
  const [candidateFilters, setCandidateFilters] = useState<FeedbackLearningCandidateFilters>(
    DEFAULT_CANDIDATE_FILTERS,
  );
  const [auditFilters, setAuditFilters] = useState<FeedbackLearningPromotionAuditFilters>(
    DEFAULT_AUDIT_FILTERS,
  );
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [detailCandidateId, setDetailCandidateId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const candidatesQuery = useFeedbackLearningCandidates(candidateFilters);
  const detailQuery = useFeedbackLearningCandidateDetail(detailCandidateId);
  const semanticOverridesQuery = useFeedbackLearningSemanticOverrides(workspaceId);
  const domainOverridesQuery = useFeedbackLearningDomainOverrides(workspaceId);
  const auditsQuery = useFeedbackLearningPromotionAudits(auditFilters);

  const approveMutation = useApproveFeedbackLearningCandidate();
  const rejectMutation = useRejectFeedbackLearningCandidate();
  const bulkApproveMutation = useBulkApproveFeedbackLearningCandidates();
  const bulkRejectMutation = useBulkRejectFeedbackLearningCandidates();
  const deactivateSemanticMutation = useDeactivateFeedbackLearningSemanticOverride();
  const deactivateDomainMutation = useDeactivateFeedbackLearningDomainOverride();

  const candidateRows = candidatesQuery.data?.rows ?? [];
  const candidateTotal = candidatesQuery.data?.total ?? 0;
  const candidatePage = candidatesQuery.data?.page ?? 1;
  const candidatePageSize = candidatesQuery.data?.page_size ?? (candidateFilters.page_size ?? 50);
  const totalCandidatePages = Math.max(
    1,
    Math.ceil(candidateTotal / Math.max(candidatePageSize, 1)),
  );

  const auditRows = auditsQuery.data?.rows ?? [];
  const semanticOverrides = semanticOverridesQuery.data?.rows ?? [];
  const domainOverrides = domainOverridesQuery.data?.rows ?? [];

  const selectionCount = selectedCandidateIds.length;
  const currentActionIds = pendingAction?.candidateIds ?? [];

  const queryError = useMemo(() => {
    if (activeTab === "candidates" && candidatesQuery.isError) {
      return toErrorMessage(candidatesQuery.error, "Unable to load feedback-learning candidates.");
    }
    if (activeTab === "overrides") {
      if (semanticOverridesQuery.isError) {
        return toErrorMessage(
          semanticOverridesQuery.error,
          "Unable to load semantic overrides.",
        );
      }
      if (domainOverridesQuery.isError) {
        return toErrorMessage(domainOverridesQuery.error, "Unable to load domain overrides.");
      }
    }
    if (activeTab === "audits" && auditsQuery.isError) {
      return toErrorMessage(auditsQuery.error, "Unable to load promotion audits.");
    }
    return null;
  }, [
    activeTab,
    auditsQuery.error,
    auditsQuery.isError,
    candidatesQuery.error,
    candidatesQuery.isError,
    domainOverridesQuery.error,
    domainOverridesQuery.isError,
    semanticOverridesQuery.error,
    semanticOverridesQuery.isError,
  ]);

  const detailError = detailQuery.isError
    ? toErrorMessage(detailQuery.error, "Unable to load candidate detail.")
    : null;

  const clearSelection = () => setSelectedCandidateIds([]);

  const refreshActiveTab = () => {
    if (activeTab === "candidates") {
      void candidatesQuery.refetch();
      if (detailCandidateId != null) void detailQuery.refetch();
      return;
    }
    if (activeTab === "overrides") {
      void semanticOverridesQuery.refetch();
      void domainOverridesQuery.refetch();
      return;
    }
    void auditsQuery.refetch();
  };

  const toggleSelected = (candidateId: number) => {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId],
    );
  };

  const toggleAllSelected = () => {
    if (candidateRows.length === 0) return;
    const allSelected = candidateRows.every((row) => selectedCandidateIds.includes(row.id));
    setSelectedCandidateIds(allSelected ? [] : candidateRows.map((row) => row.id));
  };

  const openApprove = (candidateIds: number[]) => {
    if (candidateIds.length === 0) return;
    setPendingAction({ mode: "approve", candidateIds });
  };

  const openReject = (candidateIds: number[]) => {
    if (candidateIds.length === 0) return;
    setPendingAction({ mode: "reject", candidateIds });
  };

  const handleConfirmReview = (reason?: string) => {
    if (!pendingAction) return;
    const ids = pendingAction.candidateIds;

    if (pendingAction.mode === "approve") {
      if (ids.length === 1) {
        approveMutation.mutate(ids[0], {
          onSuccess: () => {
            toast.success(`Approved candidate #${ids[0]}.`);
            setPendingAction(null);
            clearSelection();
          },
          onError: (error) => {
            toast.error(toErrorMessage(error, "Unable to approve candidate."));
          },
        });
        return;
      }

      bulkApproveMutation.mutate(ids, {
        onSuccess: (result) => {
          toast.success(`Approved ${result.processed} candidate(s).`);
          setPendingAction(null);
          clearSelection();
        },
        onError: (error) => {
          toast.error(toErrorMessage(error, "Unable to bulk-approve candidates."));
        },
      });
      return;
    }

    if (ids.length === 1) {
      rejectMutation.mutate(
        { candidateId: ids[0], reason: reason ?? "" },
        {
          onSuccess: () => {
            toast.success(`Rejected candidate #${ids[0]}.`);
            setPendingAction(null);
            clearSelection();
          },
          onError: (error) => {
            toast.error(toErrorMessage(error, "Unable to reject candidate."));
          },
        },
      );
      return;
    }

    bulkRejectMutation.mutate(
      { candidateIds: ids, reason: reason ?? "" },
      {
        onSuccess: (result) => {
          toast.success(`Rejected ${result.processed} candidate(s).`);
          setPendingAction(null);
          clearSelection();
        },
        onError: (error) => {
          toast.error(toErrorMessage(error, "Unable to bulk-reject candidates."));
        },
      },
    );
  };

  const handleDeactivateOverride = (overrideId: number, kind: "semantic" | "domain") => {
    const mutation =
      kind === "semantic" ? deactivateSemanticMutation : deactivateDomainMutation;
    mutation.mutate(overrideId, {
      onSuccess: () => {
        toast.success(
          `${kind === "semantic" ? "Semantic" : "Domain"} override #${overrideId} deactivated.`,
        );
      },
      onError: (error) => {
        toast.error(
          toErrorMessage(
            error,
            `Unable to deactivate ${kind === "semantic" ? "semantic" : "domain"} override.`,
          ),
        );
      },
    });
  };

  const reviewBusy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    bulkApproveMutation.isPending ||
    bulkRejectMutation.isPending;

  const semanticDeactivateBusy = deactivateSemanticMutation.isPending;
  const domainDeactivateBusy = deactivateDomainMutation.isPending;

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1>Feedback Learning</h1>
          <p className="sa-page-subtitle">
            Review negative-feedback analysis candidates, govern runtime overrides, and inspect catalog promotion audit history for the active workspace.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={refreshActiveTab}
          disabled={
            candidatesQuery.isFetching ||
            semanticOverridesQuery.isFetching ||
            domainOverridesQuery.isFetching ||
            auditsQuery.isFetching
          }
        >
          <i className="fa fa-refresh" /> Refresh
        </button>
      </header>

      {queryError ? (
        <div className="alert alert-danger" role="alert">
          {queryError}
        </div>
      ) : null}

      <section className="sa-card sa-tabbed-panel">
        <ul className="nav nav-tabs sa-tabbed-panel-tabs" role="tablist" aria-label="Feedback learning tabs">
          {[
            { key: "candidates", label: "Candidates" },
            { key: "overrides", label: "Overrides" },
            { key: "audits", label: "Promotion Audits" },
          ].map((tab) => (
            <li className="nav-item" role="presentation" key={tab.key}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`nav-link ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key as ActiveTab)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        {activeTab === "candidates" ? (
          <div className="sa-tabbed-panel-body">
            <div className="sa-card-header">
              <h2 className="sa-card-title">Candidate Review Queue</h2>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  disabled={selectionCount === 0}
                  onClick={() => openApprove(selectedCandidateIds)}
                >
                  Bulk Approve
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={selectionCount === 0}
                  onClick={() => openReject(selectedCandidateIds)}
                >
                  Bulk Reject
                </button>
              </div>
            </div>

            <CandidateFilters
              filters={candidateFilters}
              onChange={(next) => setCandidateFilters(next)}
              onReset={() => setCandidateFilters(DEFAULT_CANDIDATE_FILTERS)}
            />

            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <div className="text-muted small">
                {candidateTotal} total candidate{candidateTotal === 1 ? "" : "s"}
                {selectionCount > 0 ? ` • ${selectionCount} selected` : ""}
              </div>
              <div className="btn-group" role="group" aria-label="Candidate pagination">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={candidatePage <= 1}
                  onClick={() =>
                    setCandidateFilters((current) => ({
                      ...current,
                      page: Math.max(1, candidatePage - 1),
                    }))
                  }
                >
                  Previous
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled>
                  Page {candidatePage}/{totalCandidatePages}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={candidatePage >= totalCandidatePages}
                  onClick={() =>
                    setCandidateFilters((current) => ({
                      ...current,
                      page: Math.min(totalCandidatePages, candidatePage + 1),
                    }))
                  }
                >
                  Next
                </button>
              </div>
            </div>

            {candidatesQuery.isLoading && !candidatesQuery.data ? (
              <div className="sa-loading">
                <span className="sa-spinner lg" />
                Loading feedback-learning candidates…
              </div>
            ) : (
              <CandidateList
                rows={candidateRows}
                selectedIds={selectedCandidateIds}
                onToggleSelected={toggleSelected}
                onToggleAll={toggleAllSelected}
                onView={(candidateId) => setDetailCandidateId(candidateId)}
                onApprove={(candidateId) => openApprove([candidateId])}
                onReject={(candidateId) => openReject([candidateId])}
              />
            )}
          </div>
        ) : null}

        {activeTab === "overrides" ? (
          <div className="sa-tabbed-panel-body">
            <div className="sa-card-grid">
              <OverrideList
                title={
                  semanticDeactivateBusy ? "Active Semantic Overrides (updating…)" : "Active Semantic Overrides"
                }
                rows={semanticOverrides}
                kind="semantic"
                onDeactivate={handleDeactivateOverride}
              />
              <OverrideList
                title={
                  domainDeactivateBusy ? "Active Domain Overrides (updating…)" : "Active Domain Overrides"
                }
                rows={domainOverrides}
                kind="domain"
                onDeactivate={handleDeactivateOverride}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "audits" ? (
          <div className="sa-tabbed-panel-body">
            <div className="sa-card-header">
              <h2 className="sa-card-title">Promotion Audit History</h2>
            </div>
            <div className="sa-toolbar">
              <label className="sa-field" style={{ marginBottom: 0 }}>
                <span>Source Type</span>
                <input
                  className="form-control form-control-sm"
                  aria-label="Audit source type"
                  value={auditFilters.source_type ?? ""}
                  onChange={(event) =>
                    setAuditFilters((current) => ({
                      ...current,
                      source_type: event.target.value || undefined,
                      offset: 0,
                    }))
                  }
                  placeholder="semantic_override"
                />
              </label>

              <label className="sa-field" style={{ marginBottom: 0 }}>
                <span>Promotion Status</span>
                <input
                  className="form-control form-control-sm"
                  aria-label="Audit promotion status"
                  value={auditFilters.promotion_status ?? ""}
                  onChange={(event) =>
                    setAuditFilters((current) => ({
                      ...current,
                      promotion_status: event.target.value || undefined,
                      offset: 0,
                    }))
                  }
                  placeholder="succeeded"
                />
              </label>

              <label className="sa-field" style={{ marginBottom: 0 }}>
                <span>Limit</span>
                <select
                  className="form-select form-select-sm"
                  aria-label="Audit limit"
                  value={auditFilters.limit ?? 50}
                  onChange={(event) =>
                    setAuditFilters((current) => ({
                      ...current,
                      limit: Number(event.target.value),
                      offset: 0,
                    }))
                  }
                >
                  {[25, 50, 100, 200].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => setAuditFilters(DEFAULT_AUDIT_FILTERS)}
              >
                Clear Filters
              </button>
            </div>

            {auditsQuery.isLoading && !auditsQuery.data ? (
              <div className="sa-loading">
                <span className="sa-spinner lg" />
                Loading promotion audits…
              </div>
            ) : (
              <>
                <div className="text-muted small mb-2">
                  {auditsQuery.data?.total ?? 0} audit row{(auditsQuery.data?.total ?? 0) === 1 ? "" : "s"}
                </div>
                <PromotionAuditList rows={auditRows} />
              </>
            )}
          </div>
        ) : null}
      </section>

      <CandidateDetailsDrawer
        open={detailCandidateId != null}
        detail={detailQuery.data ?? null}
        loading={detailQuery.isLoading}
        error={detailError}
        onClose={() => setDetailCandidateId(null)}
      />

      <ReviewDecisionDialog
        open={pendingAction != null}
        mode={pendingAction?.mode ?? "approve"}
        title={
          pendingAction?.mode === "reject"
            ? `Reject ${currentActionIds.length} candidate(s)`
            : `Approve ${currentActionIds.length} candidate(s)`
        }
        busy={reviewBusy}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmReview}
      />
    </div>
  );
}
