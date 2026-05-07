import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  completeFlowForgePublicSignedAction,
  getFlowForgePublicSignedActionDetails,
  type FlowForgePublicSignedActionResult,
} from "../api/publicActionsApi";
import "./flowforge.css";

const COMPLETABLE_ACTIONS = ["accept", "decline"] as const;
type CompletableAction = (typeof COMPLETABLE_ACTIONS)[number];

function normalizeAction(value: string | null): CompletableAction | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return COMPLETABLE_ACTIONS.includes(normalized as CompletableAction) ? (normalized as CompletableAction) : null;
}

function actionLabel(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function errorMessage(error: unknown) {
  const responseError = error as { response?: { data?: { message?: string; error?: string } }; message?: string };
  return responseError.response?.data?.message ?? responseError.response?.data?.error ?? responseError.message ?? "Action failed.";
}

export default function FlowForgePublicActionPage() {
  const { token = "" } = useParams();
  const [searchParams] = useSearchParams();
  const requestedAction = normalizeAction(searchParams.get("action"));
  const [selectedAction, setSelectedAction] = useState<CompletableAction | null>(requestedAction);
  const [declineReason, setDeclineReason] = useState("");

  const detailsQuery = useQuery({
    queryKey: ["flowforge", "public-action", token],
    queryFn: () => getFlowForgePublicSignedActionDetails(token),
    enabled: token.trim().length > 0,
    retry: false,
  });

  const allowedActions = useMemo(
    () => new Set((detailsQuery.data?.allowed_actions ?? []).map((action) => action.toLowerCase())),
    [detailsQuery.data?.allowed_actions],
  );
  const availableActions = COMPLETABLE_ACTIONS.filter((action) => allowedActions.has(action));
  const requestedActionUnavailable = Boolean(requestedAction && detailsQuery.data && !allowedActions.has(requestedAction));
  const selectedActionAvailable = Boolean(selectedAction && allowedActions.has(selectedAction));

  const completeMutation = useMutation({
    mutationFn: (action: CompletableAction) =>
      completeFlowForgePublicSignedAction({
        token,
        action,
        payload: action === "decline" ? { decline_reason: declineReason.trim() || null } : {},
      }),
  });

  const result = completeMutation.data as FlowForgePublicSignedActionResult | undefined;

  return (
    <main className="ff-public-action-page">
      <section className="ff-public-action-card" aria-label="Signed workflow action">
        <div className="ff-public-action-brand">
          <span>Flow</span>
          <strong>Forge</strong>
        </div>

        {detailsQuery.isLoading ? <p className="ff-empty-state">Loading action details...</p> : null}

        {detailsQuery.isError ? (
          <div className="ff-template-error" role="alert">
            {errorMessage(detailsQuery.error)}
          </div>
        ) : null}

        {detailsQuery.data && !result ? (
          <>
            <div className="ff-public-action-heading">
              <p>Secure workflow action</p>
              <h1>{selectedAction ? `${actionLabel(selectedAction)} task` : "Review task"}</h1>
            </div>
            <dl className="ff-public-action-details">
              <div>
                <dt>Task Type</dt>
                <dd>{detailsQuery.data.task.task_type || "Task"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{detailsQuery.data.task.status || "Pending"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{detailsQuery.data.task.source_record_key || "Not provided"}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{detailsQuery.data.expires_at || "Not provided"}</dd>
              </div>
            </dl>

            {requestedActionUnavailable ? (
              <p className="ff-template-error">The requested action is not available for this task.</p>
            ) : null}

            <div className="ff-public-action-options" aria-label="Available actions">
              {availableActions.map((action) => (
                <button
                  type="button"
                  key={action}
                  className={`btn ${selectedAction === action ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setSelectedAction(action)}
                >
                  {actionLabel(action)}
                </button>
              ))}
            </div>

            {selectedAction === "decline" ? (
              <label className="ff-public-action-reason">
                Decline Reason
                <textarea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} rows={3} />
              </label>
            ) : null}

            <button
              type="button"
              className="btn btn-success ff-public-action-submit"
              disabled={!selectedActionAvailable || completeMutation.isPending}
              onClick={() => selectedAction && completeMutation.mutate(selectedAction)}
            >
              {completeMutation.isPending ? "Submitting..." : selectedAction ? `Confirm ${actionLabel(selectedAction)}` : "Choose an action"}
            </button>
          </>
        ) : null}

        {result ? (
          <div className="ff-public-action-success" role="status">
            <h1>{actionLabel(result.action)} recorded</h1>
            <p>Your response was recorded securely. You can close this page.</p>
          </div>
        ) : null}

        {completeMutation.isError ? (
          <div className="ff-template-error" role="alert">
            {errorMessage(completeMutation.error)}
          </div>
        ) : null}

        <Link className="ff-public-action-footer-link" to="/auth">
          Go to QueryForge
        </Link>
      </section>
    </main>
  );
}
