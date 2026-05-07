import { useQuery } from "@tanstack/react-query";

import { listFlowForgeHumanTasks, listFlowForgeRuns } from "../api/runsApi";
import ApprovalTaskQueue from "../components/ApprovalTaskQueue";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import RunStatusTable from "../components/RunStatusTable";
import "./flowforge.css";

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
  const approvalTasks = approvalTasksQuery.data?.tasks ?? [];
  const attentionRuns = runsQuery.data?.runs ?? [];

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
          <span>Queue status</span>
          <strong>{approvalTasks.length || attentionRuns.length ? "Open" : "Clear"}</strong>
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
