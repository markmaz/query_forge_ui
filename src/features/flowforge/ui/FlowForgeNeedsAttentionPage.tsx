import { useQuery } from "@tanstack/react-query";

import { listFlowForgeRuns } from "../api/runsApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import RunStatusTable from "../components/RunStatusTable";
import "./flowforge.css";

export default function FlowForgeNeedsAttentionPage() {
  const runsQuery = useQuery({
    queryKey: ["flowforge", "runs", { status: "needs_attention" }],
    queryFn: () => listFlowForgeRuns({ status: "needs_attention", limit: 100, offset: 0 }),
  });

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Needs Attention"
        description="Runs that require operator review because matching, notifications, or workflow execution stalled."
      />
      <section className="ff-runtime-panel">
        {runsQuery.isLoading ? <div className="ff-empty-state">Loading runs that need attention...</div> : null}
        {runsQuery.isError ? <div className="ff-empty-state">Unable to load needs-attention runs.</div> : null}
        <RunStatusTable
          runs={runsQuery.data?.runs ?? []}
          emptyMessage="No workflow runs currently need operator attention."
        />
      </section>
    </main>
  );
}
