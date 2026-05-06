import type { FlowForgeHumanTask } from "../model/runtimeTypes";
import StatusBadge from "./StatusBadge";
import { formatFlowForgeDate, summarizeJson } from "./runtimeFormat";

interface HumanTaskPanelProps {
  tasks: FlowForgeHumanTask[];
}

export default function HumanTaskPanel({ tasks }: HumanTaskPanelProps) {
  if (!tasks.length) {
    return <div className="ff-empty-state">No human tasks are attached to this run.</div>;
  }

  return (
    <div className="ff-card-stack">
      {tasks.map((task) => (
        <article key={task.id} className="ff-runtime-card">
          <div className="ff-card-heading">
            <div>
              <strong>{task.task_type}</strong>
              <span>Task {task.id}</span>
            </div>
            <StatusBadge status={task.status} />
          </div>
          <dl className="ff-definition-grid">
            <div>
              <dt>Resource</dt>
              <dd>{task.source_record_key || "Not linked"}</dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>{task.assigned_to_principal_id || "Not assigned"}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{formatFlowForgeDate(task.due_at)}</dd>
            </div>
            <div>
              <dt>Response</dt>
              <dd>{summarizeJson(task.response)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
