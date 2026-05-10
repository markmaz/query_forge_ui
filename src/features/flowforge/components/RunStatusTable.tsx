import { Link } from "react-router-dom";

import { routes } from "@/app/navigation/routes";
import type { FlowForgePersistedRun } from "../model/runtimeTypes";
import StatusBadge from "./StatusBadge";
import { formatFlowForgeDate, summarizeJson } from "./runtimeFormat";

interface RunStatusTableProps {
  runs: FlowForgePersistedRun[];
  emptyMessage?: string;
}

export default function RunStatusTable({ runs, emptyMessage = "No workflow runs found." }: RunStatusTableProps) {
  if (!runs.length) {
    return <div className="ff-empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="ff-table-wrap">
      <table className="ff-runtime-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Status</th>
            <th>Mode</th>
            <th>Workflow Version</th>
            <th>Run As</th>
            <th>Triggered By</th>
            <th>Current Node</th>
            <th>Context</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>
                <Link to={routes.FlowForgeRunDetail.replace(":runId", String(run.id))}>Run {run.id}</Link>
              </td>
              <td>
                <StatusBadge status={run.status} />
              </td>
              <td>{run.mode}</td>
              <td>Version {run.workflow_version_id}</td>
              <td>{runIdentityLabel(run.run_as_principal_type, run.run_as_principal_id)}</td>
              <td>{run.triggered_by_user_id || "System"}</td>
              <td>{run.current_node_id || "Not set"}</td>
              <td className="ff-table-summary">{summarizeJson(run.run_context)}</td>
              <td>{formatFlowForgeDate(run.updated_at || run.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function runIdentityLabel(type?: string | null, id?: string | null): string {
  if (!type || !id) return "Not set";
  return `${type.replace(/_/g, " ")} · ${id}`;
}
