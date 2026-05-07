import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { routes } from "@/app/navigation/routes";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { approveFlowForgeHumanTask, declineFlowForgeHumanTask } from "../api/runsApi";
import type { FlowForgeHumanTask } from "../model/runtimeTypes";
import StatusBadge from "./StatusBadge";
import { formatFlowForgeDate, summarizeJson } from "./runtimeFormat";

type ApprovalAction = "approve" | "decline";

type PendingDecision = {
  action: ApprovalAction;
  task: FlowForgeHumanTask;
};

interface ApprovalTaskQueueProps {
  tasks: FlowForgeHumanTask[];
  loading?: boolean;
  error?: boolean;
}

function approvalContext(task: FlowForgeHumanTask): Record<string, unknown> {
  const response = task.response || {};
  const approval = response.approval;
  return approval && typeof approval === "object" && !Array.isArray(approval)
    ? (approval as Record<string, unknown>)
    : {};
}

function textValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function displayValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return textValue(value);
}

function taskTitle(task: FlowForgeHumanTask): string {
  const approval = approvalContext(task);
  return textValue(approval.approval_reason) || textValue(approval.reason) || "Approval required";
}

function taskDestination(task: FlowForgeHumanTask): string {
  const approval = approvalContext(task);
  return textValue(approval.destination_key) || summarizeJson(approval.destination_ref) || "Not specified";
}

function taskArtifact(task: FlowForgeHumanTask): string {
  const approval = approvalContext(task);
  const artifact = approval.artifact;
  if (artifact && typeof artifact === "object" && !Array.isArray(artifact)) {
    const artifactRecord = artifact as Record<string, unknown>;
    return textValue(artifactRecord.artifact_key) || textValue(artifactRecord.artifact_type) || summarizeJson(artifactRecord);
  }
  return displayValue(approval.dataset_artifact_id) || "Not attached";
}

function canDecide(task: FlowForgeHumanTask): boolean {
  return task.task_type === "approval" && ["pending", "waiting"].includes(task.status);
}

export default function ApprovalTaskQueue({ tasks, loading = false, error = false }: ApprovalTaskQueueProps) {
  const queryClient = useQueryClient();
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  const decisionMutation = useMutation({
    mutationFn: async ({ action, task }: PendingDecision) => {
      const payload =
        action === "approve"
          ? { decision_note: decisionNote.trim() || null }
          : { decline_reason: declineReason.trim() || null, decision_note: decisionNote.trim() || null };
      return action === "approve"
        ? approveFlowForgeHumanTask(task.id, payload)
        : declineFlowForgeHumanTask(task.id, payload);
    },
    onSuccess: async () => {
      setPendingDecision(null);
      setDecisionNote("");
      setDeclineReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flowforge", "human-tasks", "approval-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["flowforge", "runs"] }),
      ]);
    },
  });

  if (loading) {
    return <div className="ff-empty-state">Loading approval tasks...</div>;
  }
  if (error) {
    return <div className="ff-empty-state">Unable to load approval tasks.</div>;
  }
  if (!tasks.length) {
    return <div className="ff-empty-state">No approval gates are waiting for operator review.</div>;
  }

  return (
    <>
      <div className="ff-card-stack">
        {tasks.map((task) => (
          <article key={task.id} className="ff-runtime-card">
            <div className="ff-card-heading">
              <div>
                <strong>{taskTitle(task)}</strong>
                <span>
                  Task {task.id} · <Link to={routes.FlowForgeRunDetail.replace(":runId", String(task.run_id))}>Run {task.run_id}</Link>
                </span>
              </div>
              <StatusBadge status={task.status} />
            </div>
            <dl className="ff-definition-grid">
              <div>
                <dt>Assignee</dt>
                <dd>{task.assigned_to_principal_id || "Not assigned"}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{formatFlowForgeDate(task.due_at)}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>{taskDestination(task)}</dd>
              </div>
              <div>
                <dt>Artifact</dt>
                <dd>{taskArtifact(task)}</dd>
              </div>
            </dl>
            {canDecide(task) ? (
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => setPendingDecision({ action: "decline", task })}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setPendingDecision({ action: "approve", task })}
                >
                  Approve
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDecision)}
        title={pendingDecision?.action === "approve" ? "Approve Gate" : "Decline Gate"}
        tone={pendingDecision?.action === "approve" ? "primary" : "danger"}
        confirmLabel={pendingDecision?.action === "approve" ? "Approve" : "Decline"}
        busy={decisionMutation.isPending}
        onClose={() => {
          if (decisionMutation.isPending) return;
          setPendingDecision(null);
          setDecisionNote("");
          setDeclineReason("");
        }}
        onConfirm={() => {
          if (!pendingDecision) return;
          decisionMutation.mutate(pendingDecision);
        }}
        message={
          <div className="ff-card-stack">
            <p className="mb-0">
              {pendingDecision?.action === "approve"
                ? "Approve this guarded workflow step and continue the run."
                : "Decline this guarded workflow step. The workflow will follow a decline branch or fail safely."}
            </p>
            {pendingDecision?.action === "decline" ? (
              <label>
                Decline reason
                <textarea
                  className="form-control"
                  rows={3}
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                />
              </label>
            ) : null}
            <label>
              Decision note
              <textarea
                className="form-control"
                rows={3}
                value={decisionNote}
                onChange={(event) => setDecisionNote(event.target.value)}
              />
            </label>
            {decisionMutation.isError ? <div className="text-danger small">Approval decision failed. Check permissions and task status.</div> : null}
          </div>
        }
      />
    </>
  );
}
