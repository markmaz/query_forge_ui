import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createFlowForgeIntegration, createIntegrationTrigger, listFlowForgeIntegrations, listIntegrationTriggers } from "../api/adminApi";
import FlowForgeIntegrationDrawer, { type FlowForgeIntegrationDrawerMode, type FlowForgeIntegrationSecret } from "../components/FlowForgeIntegrationDrawer";
import FlowForgeIntegrationTable from "../components/FlowForgeIntegrationTable";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import type { FlowForgeIntegrationConfig } from "../model/adminTypes";
import { freshIntegrationDraft, integrationProviders, type SourceEventDraft, type SourceFieldDraft } from "../model/integrationDrafts";
import "./flowforge.css";
import "./flowforgeAdmin.css";

export default function FlowForgeIntegrationsPage() {
  const queryClient = useQueryClient();
  const initialDraft = freshIntegrationDraft();
  const [provider, setProvider] = useState(initialDraft.provider);
  const [integrationKey, setIntegrationKey] = useState(initialDraft.integrationKey);
  const [displayName, setDisplayName] = useState(initialDraft.displayName);
  const [mode, setMode] = useState(initialDraft.mode);
  const [drawerMode, setDrawerMode] = useState<FlowForgeIntegrationDrawerMode | null>(null);
  const [drawerIntegrationId, setDrawerIntegrationId] = useState<number | null>(null);
  const [createdIntegration, setCreatedIntegration] = useState<FlowForgeIntegrationConfig | null>(null);
  const [lastSecret, setLastSecret] = useState<FlowForgeIntegrationSecret | null>(null);
  const [workflowDefinitionId, setWorkflowDefinitionId] = useState("1");
  const [workflowVersionId, setWorkflowVersionId] = useState("");
  const [sourceEvents, setSourceEvents] = useState<SourceEventDraft[]>(initialDraft.sourceEvents);
  const [sourceFields, setSourceFields] = useState<SourceFieldDraft[]>(initialDraft.sourceFields);

  const integrationsQuery = useQuery({
    queryKey: ["flowforge", "admin", "integrations"],
    queryFn: listFlowForgeIntegrations,
  });
  const integrations = integrationsQuery.data ?? [];
  const selectedIntegration =
    integrations.find((integration) => integration.id === drawerIntegrationId) ??
    (createdIntegration?.id === drawerIntegrationId ? createdIntegration : null);
  const activeIntegrationId = drawerMode === "details" ? drawerIntegrationId : null;

  const triggersQuery = useQuery({
    queryKey: ["flowforge", "admin", "integration-triggers", activeIntegrationId],
    queryFn: () => listIntegrationTriggers(activeIntegrationId as number),
    enabled: Boolean(activeIntegrationId),
  });

  const createIntegrationMutation = useMutation({
    mutationFn: () =>
      createFlowForgeIntegration(provider, {
        integration_key: integrationKey,
        display_name: displayName,
        mode,
        source_events: sourceEvents
          .map(({ event_key, display_name, description }) => ({
            event_key: event_key.trim(),
            display_name: display_name.trim() || event_key.trim(),
            description: description.trim() || null,
          }))
          .filter((event) => event.event_key),
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
      setCreatedIntegration(created);
      if (created.webhook_secret) {
        setLastSecret({ integrationId: created.id, secret: created.webhook_secret });
      }
      queryClient.setQueryData<FlowForgeIntegrationConfig[]>(["flowforge", "admin", "integrations"], (current) => {
        const existing = current ?? [];
        return [created, ...existing.filter((integration) => integration.id !== created.id)];
      });
      setDrawerMode("details");
      setDrawerIntegrationId(created.id);
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

  const updateSourceEvent = (id: string, patch: Partial<SourceEventDraft>) => {
    setSourceEvents((current) => current.map((event) => (event.id === id ? { ...event, ...patch } : event)));
  };

  const updateSourceField = (id: string, patch: Partial<SourceFieldDraft>) => {
    setSourceFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };

  const handleSetProvider = (nextProvider: string) => {
    const draft = freshIntegrationDraft(nextProvider);
    setProvider(draft.provider);
    setIntegrationKey(draft.integrationKey);
    setDisplayName(draft.displayName);
    setSourceEvents(draft.sourceEvents);
    setSourceFields(draft.sourceFields);
  };

  const openCreateDrawer = () => {
    const draft = freshIntegrationDraft();
    setProvider(draft.provider);
    setIntegrationKey(draft.integrationKey);
    setDisplayName(draft.displayName);
    setMode(draft.mode);
    setSourceEvents(draft.sourceEvents);
    setSourceFields(draft.sourceFields);
    setWorkflowDefinitionId("1");
    setWorkflowVersionId("");
    setDrawerIntegrationId(null);
    setDrawerMode("create");
  };

  const openDetailsDrawer = (integration: FlowForgeIntegrationConfig) => {
    setDrawerIntegrationId(integration.id);
    setDrawerMode("details");
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setDrawerIntegrationId(null);
  };

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Integrations"
        description="Connect external systems to FlowForge events, source fields, workflow triggers, and delivery actions."
      />
      <section className="ff-integrations">
        <div className="ff-integrations__toolbar">
          <div>
            <h2>Configured integrations</h2>
            <p>Review inbound sources, webhook endpoints, source fields, and workflow triggers.</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateDrawer}>
            Add new integration
          </button>
        </div>

        {integrationsQuery.isLoading ? <div className="ff-empty-state">Loading integrations...</div> : null}
        {integrationsQuery.isError ? <div className="ff-empty-state">Unable to load integrations.</div> : null}
        {!integrationsQuery.isLoading && !integrations.length ? (
          <div className="ff-integrations-empty">
            <div className="ff-integrations-empty__icon">
              <i className="fa fa-plug" aria-hidden="true" />
            </div>
            <h3>No integrations configured</h3>
            <p>Add an integration to define source events, source fields, webhook details, and workflow trigger routing.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateDrawer}>
              Add first integration
            </button>
          </div>
        ) : null}
        {integrations.length ? <FlowForgeIntegrationTable integrations={integrations} onOpen={openDetailsDrawer} /> : null}
      </section>
      {drawerMode ? (
        <FlowForgeIntegrationDrawer
          mode={drawerMode}
          integration={selectedIntegration}
          lastSecret={lastSecret}
          provider={provider}
          providerOptions={integrationProviders}
          triggers={triggersQuery.data ?? []}
          triggersLoading={triggersQuery.isLoading}
          workflowDefinitionId={workflowDefinitionId}
          workflowVersionId={workflowVersionId}
          integrationKey={integrationKey}
          displayName={displayName}
          integrationMode={mode}
          sourceEvents={sourceEvents}
          sourceFields={sourceFields}
          createIntegrationPending={createIntegrationMutation.isPending}
          createTriggerPending={createTriggerMutation.isPending}
          onClose={closeDrawer}
          onCreateIntegration={() => createIntegrationMutation.mutate()}
          onCreateTrigger={() => createTriggerMutation.mutate()}
          onSetWorkflowDefinitionId={setWorkflowDefinitionId}
          onSetWorkflowVersionId={setWorkflowVersionId}
          onSetIntegrationKey={setIntegrationKey}
          onSetDisplayName={setDisplayName}
          onSetProvider={handleSetProvider}
          onSetMode={setMode}
          onUpdateSourceEvent={updateSourceEvent}
          onAddSourceEvent={() =>
            setSourceEvents((current) => [...current, { id: `event-${Date.now()}`, event_key: "", display_name: "", description: "" }])
          }
          onRemoveSourceEvent={(id) => setSourceEvents((current) => current.filter((entry) => entry.id !== id))}
          onUpdateSourceField={updateSourceField}
          onAddSourceField={() =>
            setSourceFields((current) => [...current, { id: `field-${Date.now()}`, path: "", label: "", type: "text", required: false, sensitive: false }])
          }
          onRemoveSourceField={(id) => setSourceFields((current) => current.filter((entry) => entry.id !== id))}
        />
      ) : null}
    </main>
  );
}
