import type { FlowForgeRunInspector } from "../model/types";

type RunPanelProps = {
  inspector: FlowForgeRunInspector;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function RunPanel({ inspector }: RunPanelProps) {
  return (
    <section className="ff-side-panel" aria-label="Run inspector">
      <div>
        <div className="ff-eyebrow">Run inspector</div>
        <h2>Event-first runtime</h2>
        <p className="ff-muted">Placeholder until persisted runs and simulation are implemented.</p>
      </div>
      <div className="ff-run-status">
        <span>{inspector.mode}</span>
        <strong>{inspector.status.replace("_", " ")}</strong>
      </div>
      <ol className="ff-event-list">
        {inspector.events.map((event) => (
          <li key={event.id}>
            <span>{formatTime(event.timestamp)}</span>
            <strong>{event.message}</strong>
            <small>{event.event_type}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
