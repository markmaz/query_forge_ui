import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { routes } from "@/app/navigation/routes";
import { listFlowForgeHumanTasks, listFlowForgeRuns } from "../api/runsApi";
import { listFlowForgeWorkflows } from "../api/workflowsApi";
import ApprovalTaskQueue from "../components/ApprovalTaskQueue";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import RunStatusTable from "../components/RunStatusTable";
import type { FlowForgeWorkflowDefinition } from "../model/types";
import "./flowforge.css";

function workflowRunAsLabel(workflow: FlowForgeWorkflowDefinition): string {
  const type = workflow.run_as_principal?.principal_type;
  const id = workflow.run_as_principal?.principal_id;
  if (!type || !id) return "Not set";
  return `${type.replace(/_/g, " ")} · ${id}`;
}

function hasInvalidProductionRunAs(workflow: FlowForgeWorkflowDefinition): boolean {
  if (workflow.lifecycle !== "production") return false;
  const type = workflow.run_as_principal?.principal_type;
  const id = workflow.run_as_principal?.principal_id;
  return !id || !["service_principal", "workspace_principal"].includes(String(type || ""));
}

export default function FlowForgeNeedsAttentionPage() {
  const runsQuery = useQuery({
    queryKey: ["flowforge", "runs", { status: "needs_attention" }],
    queryFn: () => listFlowForgeRuns({ status: "needs_attention", limit: 100, offset: 0 }),
  });
  const approvalTasksQuery = useQuery({
    queryKey: ["flowforge", "human-tasks", "approval-queue"],
    queryFn: () =>
      listFlowForgeHumanTasks({
        task_type: "approval",
        status: "pending,waiting",
        limit: 100,
        offset: 0,
      }),
  });
  const workflowsQuery = useQuery({
    queryKey: ["flowforge", "workflows", "governance-attention"],
    queryFn: listFlowForgeWorkflows,
  });
  const approvalTasks = approvalTasksQuery.data?.tasks ?? [];
  const attentionRuns = runsQuery.data?.runs ?? [];
  const governanceWarnings = (workflowsQuery.data ?? []).filter(hasInvalidProductionRunAs);

  return (
    <main className="ff-page ff-needs-attention-page">
      <FlowForgePageHeader
        title="Needs Attention"
        description="Operator queue for approval gates and workflow runs that need review."
      />
      <section className="ff-operator-summary" aria-label="Needs attention summary">
        <article className="ff-operator-stat is-primary">
          <span>Approval gates</span>
          <strong>{approvalTasksQuery.isLoading ? "..." : approvalTasks.length}</strong>
        </article>
        <article className="ff-operator-stat">
          <span>Runs needing review</span>
          <strong>{runsQuery.isLoading ? "..." : attentionRuns.length}</strong>
        </article>
        <article className="ff-operator-stat">
          <span>Governance warnings</span>
          <strong>{workflowsQuery.isLoading ? "..." : governanceWarnings.length}</strong>
        </article>
        <article className="ff-operator-stat">
          <span>Queue status</span>
          <strong>{approvalTasks.length || attentionRuns.length || governanceWarnings.length ? "Open" : "Clear"}</strong>
        </article>
      </section>

      <section className="ff-runtime-panel ff-needs-attention-panel">
        <div className="ff-section-heading">
          <div>
            <span className="ff-eyebrow">Operator decision queue</span>
            <h2>Approval Gates</h2>
          </div>
          <span className="ff-section-count">{approvalTasks.length} open</span>
        </div>
        <ApprovalTaskQueue
          tasks={approvalTasks}
          loading={approvalTasksQuery.isLoading}
          error={approvalTasksQuery.isError}
        />
      </section>

      <section className="ff-runtime-panel ff-needs-attention-panel">
        <div className="ff-section-heading">
          <div>
            <span className="ff-eyebrow">Production governance</span>
            <h2>Workflow Run-As Warnings</h2>
          </div>
          <span className="ff-section-count">{governanceWarnings.length} open</span>
        </div>
        {workflowsQuery.isLoading ? <div className="ff-empty-state">Loading workflow governance warnings...</div> : null}
        {workflowsQuery.isError ? <div className="ff-empty-state">Unable to load workflow governance warnings.</div> : null}
        {!workflowsQuery.isLoading && !workflowsQuery.isError && !governanceWarnings.length ? (
          <div className="ff-empty-state">No production workflow run-as warnings are open.</div>
        ) : null}
        {governanceWarnings.length ? (
          <div className="ff-card-stack">
            {governanceWarnings.map((workflow) => (
              <article key={workflow.id} className="ff-runtime-card">
                <div className="ff-card-heading">
                  <div>
                    <strong>{workflow.name}</strong>
                    <span>Production workflow requires a service or workspace run-as principal.</span>
                  </div>
                  <Link className="btn btn-outline-secondary btn-sm" to={routes.FlowForgeStudio}>
                    Open Designer
                  </Link>
                </div>
                <dl className="ff-definition-grid">
                  <div>
                    <dt>Owner</dt>
                    <dd>{workflow.owner_user_id || "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Run as</dt>
                    <dd>{workflowRunAsLabel(workflow)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{workflow.status}</dd>
                  </div>
                  <div>
                    <dt>Required action</dt>
                    <dd>Set run-as to a workspace or service principal before publishing.</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="ff-runtime-panel ff-needs-attention-panel">
        <div className="ff-section-heading">
          <div>
            <span className="ff-eyebrow">Runtime exceptions</span>
            <h2>Runs Needing Attention</h2>
          </div>
          <span className="ff-section-count">{attentionRuns.length} open</span>
        </div>
        {runsQuery.isLoading ? <div className="ff-empty-state">Loading runs that need attention...</div> : null}
        {runsQuery.isError ? <div className="ff-empty-state">Unable to load needs-attention runs.</div> : null}
        <RunStatusTable
          runs={attentionRuns}
          emptyMessage="No workflow runs currently need operator attention."
        />
      </section>
    </main>
  );
}
