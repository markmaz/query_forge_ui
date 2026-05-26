import type { FlowForgePersistedRun, FlowForgePersistedRunEvent, FlowForgeHumanTask } from "../model/runtimeTypes";
import { summarizeJson } from "./runtimeFormat";

interface MatchingExplanationPanelProps {
  run?: FlowForgePersistedRun;
  events: FlowForgePersistedRunEvent[];
  tasks: FlowForgeHumanTask[];
}

export default function MatchingExplanationPanel({ run, events, tasks }: MatchingExplanationPanelProps) {
  const matchingEvents = events.filter((event) => event.event_type.includes("matching") || event.event_type.includes("human_response"));
  const pendingTask = tasks.find((task) => task.status === "pending");
  const noMatchReason =
    matchingEvents.find((event) => event.event_type.includes("no_match"))?.event_payload?.reason ??
    run?.run_context?.no_match_reason;

  return (
    <section className="ff-runtime-panel">
      <h2>Matching Explanation</h2>
      <div className="ff-explanation-grid">
        <div>
          <span>Current state</span>
          <strong>{run?.status?.replace(/_/g, " ") || "Unknown"}</strong>
        </div>
        <div>
          <span>Pending human task</span>
          <strong>{pendingTask ? `${pendingTask.task_type} for ${pendingTask.source_record_key || "resource"}` : "None"}</strong>
        </div>
        <div>
          <span>Matching signals</span>
          <strong>{matchingEvents.length ? `${matchingEvents.length} matching/runtime events` : "No matching events yet"}</strong>
        </div>
        <div>
          <span>No-match reason</span>
          <strong>{summarizeJson(noMatchReason)}</strong>
        </div>
      </div>
    </section>
  );
}
