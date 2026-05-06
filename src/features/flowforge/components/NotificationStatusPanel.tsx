import type { FlowForgeNotification } from "../model/runtimeTypes";
import StatusBadge from "./StatusBadge";
import { formatFlowForgeDate, summarizeJson } from "./runtimeFormat";

interface NotificationStatusPanelProps {
  notifications: FlowForgeNotification[];
}

export default function NotificationStatusPanel({ notifications }: NotificationStatusPanelProps) {
  if (!notifications.length) {
    return <div className="ff-empty-state">No notifications have been queued for this run.</div>;
  }

  return (
    <div className="ff-card-stack">
      {notifications.map((notification) => (
        <article key={notification.id} className="ff-runtime-card">
          <div className="ff-card-heading">
            <div>
              <strong>{notification.template_key}</strong>
              <span>{notification.recipient}</span>
            </div>
            <StatusBadge status={notification.status} />
          </div>
          <dl className="ff-definition-grid">
            <div>
              <dt>Channel</dt>
              <dd>{notification.channel}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatFlowForgeDate(notification.created_at)}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{notification.provider_message_id || "Not sent"}</dd>
            </div>
            <div>
              <dt>Summary</dt>
              <dd>{notification.error_message || summarizeJson(notification.payload_summary)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
