import type { FlowForgePersistedRunEvent } from "../model/runtimeTypes";
import { formatFlowForgeDate, summarizeJson } from "./runtimeFormat";

interface RunTimelineProps {
  events: FlowForgePersistedRunEvent[];
}

export default function RunTimeline({ events }: RunTimelineProps) {
  if (!events.length) {
    return <div className="ff-empty-state">No timeline events have been recorded yet.</div>;
  }

  return (
    <ol className="ff-runtime-timeline">
      {events.map((event) => (
        <li key={event.id}>
          <div className="ff-timeline-dot" aria-hidden="true" />
          <div>
            <div className="ff-timeline-title">
              <strong>{event.event_type}</strong>
              <span>{formatFlowForgeDate(event.created_at)}</span>
            </div>
            {event.message ? <p>{event.message}</p> : null}
            <small>
              {event.node_id ? `Node ${event.node_id}` : "Run event"} · {summarizeJson(event.event_payload)}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}
