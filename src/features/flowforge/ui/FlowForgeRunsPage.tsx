import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listFlowForgeRuns } from "../api/runsApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import RunStatusTable from "../components/RunStatusTable";
import "./flowforge.css";

const statusOptions = ["", "queued", "running", "waiting", "needs_attention", "completed", "failed"];
const modeOptions = ["", "production", "test"];

export default function FlowForgeRunsPage() {
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const runsQuery = useQuery({
    queryKey: ["flowforge", "runs", { status, mode }],
    queryFn: () => listFlowForgeRuns({ status, mode, limit: 100, offset: 0 }),
  });

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Workflow Runs"
        description="Monitor live and test workflow execution, current wait states, and recent outcomes."
      />

      <section className="ff-runtime-panel">
        <div className="ff-toolbar">
          <label>
            Status
            <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option ? option.replace(/_/g, " ") : "All statuses"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select className="form-select" value={mode} onChange={(event) => setMode(event.target.value)}>
              {modeOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All modes"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {runsQuery.isLoading ? <div className="ff-empty-state">Loading workflow runs...</div> : null}
        {runsQuery.isError ? <div className="ff-empty-state">Unable to load workflow runs.</div> : null}
        <RunStatusTable runs={runsQuery.data?.runs ?? []} />
      </section>
    </main>
  );
}
