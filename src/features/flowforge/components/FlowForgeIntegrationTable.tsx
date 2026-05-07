import type { KeyboardEvent } from "react";

import type { FlowForgeIntegrationConfig } from "../model/adminTypes";
import StatusBadge from "./StatusBadge";

type FlowForgeIntegrationTableProps = {
  integrations: FlowForgeIntegrationConfig[];
  onOpen: (integration: FlowForgeIntegrationConfig) => void;
};

const providerMeta: Record<string, { label: string; icon: string }> = {
  api: { label: "API", icon: "fa fa-code" },
  jotform: { label: "Jotform", icon: "fa fa-wpforms" },
  slack: { label: "Slack", icon: "fa-brands fa-slack" },
};

export default function FlowForgeIntegrationTable({ integrations, onOpen }: FlowForgeIntegrationTableProps) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="table-responsive">
        <table className="table align-middle mb-0 ff-integrations-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Mode</th>
              <th>Source model</th>
              <th>Webhook</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {integrations.map((integration) => (
              <IntegrationRow key={integration.id} integration={integration} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IntegrationRow({
  integration,
  onOpen,
}: {
  integration: FlowForgeIntegrationConfig;
  onOpen: (integration: FlowForgeIntegrationConfig) => void;
}) {
  const meta = providerMeta[integration.provider] ?? { label: integration.provider, icon: "fa fa-plug" };
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(integration);
    }
  };

  return (
    <tr
      className="ff-integrations-table__row"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(integration)}
      onKeyDown={handleKeyDown}
    >
      <td>
        <div className="ff-integrations-table__name">{integration.display_name}</div>
        <div className="ff-integrations-table__description">{integration.integration_key}</div>
      </td>
      <td>
        <span className="ff-integrations-table__type-badge">
          <i className={meta.icon} aria-hidden="true" />
          <span>{meta.label}</span>
        </span>
      </td>
      <td>{integration.mode}</td>
      <td className="ff-integrations-table__muted">
        {integration.source_events.length} events - {integration.source_fields.length} source fields
      </td>
      <td className="ff-integrations-table__webhook">{integration.webhook_url}</td>
      <td>
        <StatusBadge status={integration.enabled ? "enabled" : "disabled"} />
      </td>
      <td className="text-end">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          aria-label={`Open ${integration.display_name}`}
          title="Open integration"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(integration);
          }}
        >
          <i className="fa fa-ellipsis-h" aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}
