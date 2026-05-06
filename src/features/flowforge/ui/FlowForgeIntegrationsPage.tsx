import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createJotformIntegration, createIntegrationTrigger, listFlowForgeIntegrations, listIntegrationTriggers } from "../api/adminApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import StatusBadge from "../components/StatusBadge";
import "./flowforge.css";
import "./flowforgeAdmin.css";

export default function FlowForgeIntegrationsPage() {
  const queryClient = useQueryClient();
  const [integrationKey, setIntegrationKey] = useState("jotform-intake");
  const [displayName, setDisplayName] = useState("Jotform Intake");
  const [mode, setMode] = useState("test");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | null>(null);
  const [lastSecret, setLastSecret] = useState<string | null>(null);
  const [workflowDefinitionId, setWorkflowDefinitionId] = useState("1");
  const [workflowVersionId, setWorkflowVersionId] = useState("");

  const integrationsQuery = useQuery({
    queryKey: ["flowforge", "admin", "integrations"],
    queryFn: listFlowForgeIntegrations,
  });
  const activeIntegrationId = selectedIntegrationId ?? integrationsQuery.data?.[0]?.id ?? null;
  const triggersQuery = useQuery({
    queryKey: ["flowforge", "admin", "integration-triggers", activeIntegrationId],
    queryFn: () => listIntegrationTriggers(activeIntegrationId as number),
    enabled: Boolean(activeIntegrationId),
  });
  const createIntegrationMutation = useMutation({
    mutationFn: () => createJotformIntegration({ integration_key: integrationKey, display_name: displayName, mode }),
    onSuccess: async (created) => {
      setLastSecret(created.webhook_secret ?? null);
      setSelectedIntegrationId(created.id);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "integrations"] });
    },
  });
  const createTriggerMutation = useMutation({
    mutationFn: () =>
      createIntegrationTrigger(activeIntegrationId as number, {
        trigger_key: `trigger-${Date.now()}`,
        display_name: "Start intake workflow",
        workflow_definition_id: Number(workflowDefinitionId),
        workflow_version_id: workflowVersionId ? Number(workflowVersionId) : null,
        version_strategy: workflowVersionId ? "pinned" : "latest_published",
        priority: 100,
        trigger_mode: "always",
        trigger_policy: "all_matching",
        no_match_config: {},
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "integration-triggers", activeIntegrationId] });
    },
  });

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Integrations"
        description="Create Jotform intake endpoints and connect inbound submissions to workflow triggers."
      />
      <section className="ff-admin-grid">
        <div className="ff-runtime-panel">
          <h2>Configured Integrations</h2>
          <div className="ff-admin-list">
            {(integrationsQuery.data ?? []).map((integration) => (
              <article key={integration.id} className="ff-admin-card">
                <header>
                  <div>
                    <h3>{integration.display_name}</h3>
                    <p>{integration.webhook_url}</p>
                  </div>
                  <StatusBadge status={integration.enabled ? "running" : "queued"} />
                </header>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setSelectedIntegrationId(integration.id)}>
                  View Triggers
                </button>
              </article>
            ))}
            {!integrationsQuery.data?.length ? <div className="ff-empty-state">No integrations configured yet.</div> : null}
          </div>
          {lastSecret ? (
            <div className="ff-admin-secret">
              One-time webhook secret: <strong>{lastSecret}</strong>
            </div>
          ) : null}
        </div>
        <div className="ff-runtime-panel">
          <h2>Create Jotform Integration</h2>
          <form
            className="ff-admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              createIntegrationMutation.mutate();
            }}
          >
            <label>
              Integration Key
              <input value={integrationKey} onChange={(event) => setIntegrationKey(event.target.value)} />
            </label>
            <label>
              Display Name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>
              Mode
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="test">test</option>
                <option value="production">production</option>
              </select>
            </label>
            <button type="submit" className="btn btn-primary" disabled={createIntegrationMutation.isPending}>
              Create Integration
            </button>
          </form>
        </div>
      </section>

      <section className="ff-runtime-panel">
        <h2>Triggers</h2>
        {activeIntegrationId ? (
          <form
            className="ff-admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              createTriggerMutation.mutate();
            }}
          >
            <label>
              Workflow Definition Id
              <input value={workflowDefinitionId} onChange={(event) => setWorkflowDefinitionId(event.target.value)} />
            </label>
            <label>
              Workflow Version Id
              <input value={workflowVersionId} onChange={(event) => setWorkflowVersionId(event.target.value)} placeholder="Optional for latest published" />
            </label>
            <button type="submit" className="btn btn-primary" disabled={createTriggerMutation.isPending}>
              Add Trigger
            </button>
          </form>
        ) : null}
        <div className="ff-admin-list">
          {(triggersQuery.data ?? []).map((trigger) => (
            <article key={trigger.id} className="ff-admin-card">
              <h3>{trigger.display_name}</h3>
              <p>
                Workflow {trigger.workflow_definition_id} · {trigger.version_strategy} · priority {trigger.priority}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
