import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createJotformIntegration, createIntegrationTrigger, listFlowForgeIntegrations, listIntegrationTriggers } from "../api/adminApi";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import StatusBadge from "../components/StatusBadge";
import "./flowforge.css";
import "./flowforgeAdmin.css";

type SourceFieldDraft = {
  id: string;
  path: string;
  label: string;
  type: string;
  required: boolean;
  sensitive: boolean;
};

const defaultSourceFields: SourceFieldDraft[] = [
  { id: "serviceRequested", path: "serviceRequested", label: "Requested Service", type: "text", required: true, sensitive: false },
  { id: "preferredDays", path: "preferredDays", label: "Preferred Days", type: "text", required: false, sensitive: false },
  { id: "insurance", path: "insurance", label: "Insurance", type: "text", required: false, sensitive: true },
  { id: "summary", path: "summary", label: "Clinical Summary", type: "text", required: false, sensitive: true },
];

export default function FlowForgeIntegrationsPage() {
  const queryClient = useQueryClient();
  const [integrationKey, setIntegrationKey] = useState("jotform-intake");
  const [displayName, setDisplayName] = useState("Jotform Intake");
  const [mode, setMode] = useState("test");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | null>(null);
  const [lastSecret, setLastSecret] = useState<string | null>(null);
  const [workflowDefinitionId, setWorkflowDefinitionId] = useState("1");
  const [workflowVersionId, setWorkflowVersionId] = useState("");
  const [sourceFields, setSourceFields] = useState<SourceFieldDraft[]>(defaultSourceFields);

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
    mutationFn: () =>
      createJotformIntegration({
        integration_key: integrationKey,
        display_name: displayName,
        mode,
        source_fields: sourceFields
          .map(({ path, label, type, required, sensitive }) => ({
            path: path.trim(),
            label: label.trim() || path.trim(),
            type,
            required,
            sensitive,
          }))
          .filter((field) => field.path),
      }),
    onSuccess: async (created) => {
      setLastSecret(created.webhook_secret ?? null);
      setSelectedIntegrationId(created.id);
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "integrations"] });
    },
  });
  const updateSourceField = (id: string, patch: Partial<SourceFieldDraft>) => {
    setSourceFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };
  const addSourceField = () => {
    const id = `field-${Date.now()}`;
    setSourceFields((current) => [
      ...current,
      { id, path: "", label: "", type: "text", required: false, sensitive: false },
    ]);
  };
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
                <p>{integration.source_fields.length} source fields configured</p>
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
            <div className="ff-field-group">
              <div className="ff-field-label">Source Fields</div>
              <span className="ff-field-helper">Define the provider fields this integration sends so workflow mapping can use dropdowns.</span>
              <div className="ff-map-transform-rows">
                {sourceFields.map((field, index) => (
                  <div className="ff-map-transform-row" key={field.id}>
                    <label>
                      Path
                      <input
                        aria-label={`Source Field Path ${index + 1}`}
                        value={field.path}
                        placeholder="serviceRequested"
                        onChange={(event) => updateSourceField(field.id, { path: event.target.value })}
                      />
                    </label>
                    <label>
                      Label
                      <input
                        aria-label={`Source Field Label ${index + 1}`}
                        value={field.label}
                        placeholder="Requested Service"
                        onChange={(event) => updateSourceField(field.id, { label: event.target.value })}
                      />
                    </label>
                    <label>
                      Type
                      <select
                        aria-label={`Source Field Type ${index + 1}`}
                        value={field.type}
                        onChange={(event) => updateSourceField(field.id, { type: event.target.value })}
                      >
                        <option value="text">text</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="date">date</option>
                        <option value="datetime">datetime</option>
                        <option value="email">email</option>
                        <option value="phone">phone</option>
                        <option value="json">json</option>
                      </select>
                    </label>
                    <label className="ff-map-template-toggle">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateSourceField(field.id, { required: event.target.checked })}
                      />
                      <span>Required</span>
                    </label>
                    <label className="ff-map-template-toggle">
                      <input
                        type="checkbox"
                        checked={field.sensitive}
                        onChange={(event) => updateSourceField(field.id, { sensitive: event.target.checked })}
                      />
                      <span>Sensitive</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setSourceFields((current) => current.filter((entry) => entry.id !== field.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addSourceField}>
                Add source field
              </button>
            </div>
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
