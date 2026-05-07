import type { FlowForgeIntegrationConfig, FlowForgeIntegrationTrigger } from "../model/adminTypes";
import StatusBadge from "./StatusBadge";

export type SourceFieldDraft = {
  id: string;
  path: string;
  label: string;
  type: string;
  required: boolean;
  sensitive: boolean;
};

export type SourceEventDraft = {
  id: string;
  event_key: string;
  display_name: string;
  description: string;
};

export type FlowForgeIntegrationDrawerMode = "create" | "details";

export type FlowForgeIntegrationSecret = {
  integrationId: number;
  secret: string;
};

export type FlowForgeIntegrationProviderOption = {
  value: string;
  label: string;
  description: string;
  available: boolean;
};

type FlowForgeIntegrationDrawerProps = {
  mode: FlowForgeIntegrationDrawerMode;
  integration: FlowForgeIntegrationConfig | null;
  lastSecret: FlowForgeIntegrationSecret | null;
  provider: string;
  providerOptions: FlowForgeIntegrationProviderOption[];
  triggers: FlowForgeIntegrationTrigger[];
  triggersLoading: boolean;
  workflowDefinitionId: string;
  workflowVersionId: string;
  integrationKey: string;
  displayName: string;
  integrationMode: string;
  sourceEvents: SourceEventDraft[];
  sourceFields: SourceFieldDraft[];
  createIntegrationPending: boolean;
  createTriggerPending: boolean;
  onClose: () => void;
  onCreateIntegration: () => void;
  onCreateTrigger: () => void;
  onSetWorkflowDefinitionId: (value: string) => void;
  onSetWorkflowVersionId: (value: string) => void;
  onSetIntegrationKey: (value: string) => void;
  onSetDisplayName: (value: string) => void;
  onSetProvider: (value: string) => void;
  onSetMode: (value: string) => void;
  onUpdateSourceEvent: (id: string, patch: Partial<SourceEventDraft>) => void;
  onAddSourceEvent: () => void;
  onRemoveSourceEvent: (id: string) => void;
  onUpdateSourceField: (id: string, patch: Partial<SourceFieldDraft>) => void;
  onAddSourceField: () => void;
  onRemoveSourceField: (id: string) => void;
};

export default function FlowForgeIntegrationDrawer({
  mode,
  integration,
  lastSecret,
  provider,
  providerOptions,
  triggers,
  triggersLoading,
  workflowDefinitionId,
  workflowVersionId,
  integrationKey,
  displayName,
  integrationMode,
  sourceEvents,
  sourceFields,
  createIntegrationPending,
  createTriggerPending,
  onClose,
  onCreateIntegration,
  onCreateTrigger,
  onSetWorkflowDefinitionId,
  onSetWorkflowVersionId,
  onSetIntegrationKey,
  onSetDisplayName,
  onSetProvider,
  onSetMode,
  onUpdateSourceEvent,
  onAddSourceEvent,
  onRemoveSourceEvent,
  onUpdateSourceField,
  onAddSourceField,
  onRemoveSourceField,
}: FlowForgeIntegrationDrawerProps) {
  const title = mode === "create" ? "Add integration" : integration ? integration.display_name : "Integration details";

  return (
    <>
      <div className="ff-integrations-drawer-backdrop" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={title} className="ff-integrations-drawer">
        <header className="ff-integrations-drawer__header">
          <div>
            <div className="ff-integrations-drawer__eyebrow">FlowForge Integration</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ff-integrations-drawer__close" aria-label="Close integration drawer" onClick={onClose}>
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="ff-integrations-drawer__body">
          {mode === "create" ? (
            <IntegrationCreateForm
              integrationKey={integrationKey}
              displayName={displayName}
              provider={provider}
              providerOptions={providerOptions}
              mode={integrationMode}
              sourceEvents={sourceEvents}
              sourceFields={sourceFields}
              pending={createIntegrationPending}
              onSubmit={onCreateIntegration}
              onSetIntegrationKey={onSetIntegrationKey}
              onSetDisplayName={onSetDisplayName}
              onSetProvider={onSetProvider}
              onSetMode={onSetMode}
              onUpdateSourceEvent={onUpdateSourceEvent}
              onAddSourceEvent={onAddSourceEvent}
              onRemoveSourceEvent={onRemoveSourceEvent}
              onUpdateSourceField={onUpdateSourceField}
              onAddSourceField={onAddSourceField}
              onRemoveSourceField={onRemoveSourceField}
            />
          ) : (
            <IntegrationDetails
              integration={integration}
              lastSecret={lastSecret}
              triggers={triggers}
              triggersLoading={triggersLoading}
              workflowDefinitionId={workflowDefinitionId}
              workflowVersionId={workflowVersionId}
              createTriggerPending={createTriggerPending}
              onCreateTrigger={onCreateTrigger}
              onSetWorkflowDefinitionId={onSetWorkflowDefinitionId}
              onSetWorkflowVersionId={onSetWorkflowVersionId}
            />
          )}
        </div>
      </aside>
    </>
  );
}

function IntegrationCreateForm({
  integrationKey,
  displayName,
  provider,
  providerOptions,
  mode,
  sourceEvents,
  sourceFields,
  pending,
  onSubmit,
  onSetIntegrationKey,
  onSetDisplayName,
  onSetProvider,
  onSetMode,
  onUpdateSourceEvent,
  onAddSourceEvent,
  onRemoveSourceEvent,
  onUpdateSourceField,
  onAddSourceField,
  onRemoveSourceField,
}: {
  integrationKey: string;
  displayName: string;
  provider: string;
  providerOptions: FlowForgeIntegrationProviderOption[];
  mode: string;
  sourceEvents: SourceEventDraft[];
  sourceFields: SourceFieldDraft[];
  pending: boolean;
  onSubmit: () => void;
  onSetIntegrationKey: (value: string) => void;
  onSetDisplayName: (value: string) => void;
  onSetProvider: (value: string) => void;
  onSetMode: (value: string) => void;
  onUpdateSourceEvent: (id: string, patch: Partial<SourceEventDraft>) => void;
  onAddSourceEvent: () => void;
  onRemoveSourceEvent: (id: string) => void;
  onUpdateSourceField: (id: string, patch: Partial<SourceFieldDraft>) => void;
  onAddSourceField: () => void;
  onRemoveSourceField: (id: string) => void;
}) {
  return (
    <form
      className="ff-admin-form ff-integrations-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        Integration Key
        <input value={integrationKey} onChange={(event) => onSetIntegrationKey(event.target.value)} />
      </label>
      <label>
        Display Name
        <input value={displayName} onChange={(event) => onSetDisplayName(event.target.value)} />
      </label>
      <label>
        Provider
        <select aria-label="Provider" value={provider} onChange={(event) => onSetProvider(event.target.value)}>
          {providerOptions.map((option) => (
            <option key={option.value} value={option.value} disabled={!option.available}>
              {option.label}
              {option.available ? "" : " (coming soon)"}
            </option>
          ))}
        </select>
        <span className="ff-field-helper">
          {providerOptions.find((option) => option.value === provider)?.description ?? "Choose the external system that sends or receives events."}
        </span>
      </label>
      <div className="ff-integrations-provider-list" aria-label="Integration provider roadmap">
        {providerOptions.map((option) => (
          <article key={option.value} className={option.available ? "is-available" : ""}>
            <strong>{option.label}</strong>
            <span>{option.available ? "Available now" : "Planned"}</span>
            <p>{option.description}</p>
          </article>
        ))}
      </div>
      <label>
        Mode
        <select value={mode} onChange={(event) => onSetMode(event.target.value)}>
          <option value="test">test</option>
          <option value="production">production</option>
        </select>
      </label>
      <SourceEventsEditor
        sourceEvents={sourceEvents}
        onUpdateSourceEvent={onUpdateSourceEvent}
        onAddSourceEvent={onAddSourceEvent}
        onRemoveSourceEvent={onRemoveSourceEvent}
      />
      <SourceFieldsEditor
        sourceFields={sourceFields}
        onUpdateSourceField={onUpdateSourceField}
        onAddSourceField={onAddSourceField}
        onRemoveSourceField={onRemoveSourceField}
      />
      <div className="ff-integrations-drawer__footer">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          Create Integration
        </button>
      </div>
    </form>
  );
}

function SourceEventsEditor({
  sourceEvents,
  onUpdateSourceEvent,
  onAddSourceEvent,
  onRemoveSourceEvent,
}: {
  sourceEvents: SourceEventDraft[];
  onUpdateSourceEvent: (id: string, patch: Partial<SourceEventDraft>) => void;
  onAddSourceEvent: () => void;
  onRemoveSourceEvent: (id: string) => void;
}) {
  return (
    <div className="ff-field-group">
      <div className="ff-field-label">Source Events</div>
      <span className="ff-field-helper">Define the inbound events this integration can start in a workflow.</span>
      <div className="ff-map-transform-rows">
        {sourceEvents.map((event, index) => (
          <div className="ff-map-transform-row" key={event.id}>
            <label>
              Event Key
              <input
                aria-label={`Source Event Key ${index + 1}`}
                value={event.event_key}
                placeholder="intake_submitted"
                onChange={(changeEvent) => onUpdateSourceEvent(event.id, { event_key: changeEvent.target.value })}
              />
            </label>
            <label>
              Display Name
              <input
                aria-label={`Source Event Display Name ${index + 1}`}
                value={event.display_name}
                placeholder="Intake Submitted"
                onChange={(changeEvent) => onUpdateSourceEvent(event.id, { display_name: changeEvent.target.value })}
              />
            </label>
            <label>
              Description
              <input
                aria-label={`Source Event Description ${index + 1}`}
                value={event.description}
                placeholder="New intake form submission"
                onChange={(changeEvent) => onUpdateSourceEvent(event.id, { description: changeEvent.target.value })}
              />
            </label>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onRemoveSourceEvent(event.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onAddSourceEvent}>
        Add source event
      </button>
    </div>
  );
}

function SourceFieldsEditor({
  sourceFields,
  onUpdateSourceField,
  onAddSourceField,
  onRemoveSourceField,
}: {
  sourceFields: SourceFieldDraft[];
  onUpdateSourceField: (id: string, patch: Partial<SourceFieldDraft>) => void;
  onAddSourceField: () => void;
  onRemoveSourceField: (id: string) => void;
}) {
  return (
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
                onChange={(event) => onUpdateSourceField(field.id, { path: event.target.value })}
              />
            </label>
            <label>
              Label
              <input
                aria-label={`Source Field Label ${index + 1}`}
                value={field.label}
                placeholder="Requested Service"
                onChange={(event) => onUpdateSourceField(field.id, { label: event.target.value })}
              />
            </label>
            <label>
              Type
              <select
                aria-label={`Source Field Type ${index + 1}`}
                value={field.type}
                onChange={(event) => onUpdateSourceField(field.id, { type: event.target.value })}
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
                onChange={(event) => onUpdateSourceField(field.id, { required: event.target.checked })}
              />
              <span>Required</span>
            </label>
            <label className="ff-map-template-toggle">
              <input
                type="checkbox"
                checked={field.sensitive}
                onChange={(event) => onUpdateSourceField(field.id, { sensitive: event.target.checked })}
              />
              <span>Sensitive</span>
            </label>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onRemoveSourceField(field.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onAddSourceField}>
        Add source field
      </button>
    </div>
  );
}

function IntegrationDetails({
  integration,
  lastSecret,
  triggers,
  triggersLoading,
  workflowDefinitionId,
  workflowVersionId,
  createTriggerPending,
  onCreateTrigger,
  onSetWorkflowDefinitionId,
  onSetWorkflowVersionId,
}: {
  integration: FlowForgeIntegrationConfig | null;
  lastSecret: FlowForgeIntegrationSecret | null;
  triggers: FlowForgeIntegrationTrigger[];
  triggersLoading: boolean;
  workflowDefinitionId: string;
  workflowVersionId: string;
  createTriggerPending: boolean;
  onCreateTrigger: () => void;
  onSetWorkflowDefinitionId: (value: string) => void;
  onSetWorkflowVersionId: (value: string) => void;
}) {
  if (!integration) {
    return <div className="ff-empty-state">Integration details are loading...</div>;
  }

  return (
    <div className="ff-integrations-detail">
      {lastSecret?.integrationId === integration.id ? (
        <div className="ff-admin-secret">
          One-time webhook secret: <strong>{lastSecret.secret}</strong>
        </div>
      ) : null}
      <section className="ff-integrations-detail-card">
        <div>
          <span>Provider</span>
          <strong>{integration.provider}</strong>
        </div>
        <div>
          <span>Mode</span>
          <strong>{integration.mode}</strong>
        </div>
        <div>
          <span>Status</span>
          <StatusBadge status={integration.enabled ? "enabled" : "disabled"} />
        </div>
        <div>
          <span>Webhook</span>
          <strong className="ff-integrations-detail-card__url">{integration.webhook_url}</strong>
        </div>
      </section>
      <section>
        <h3>Source events</h3>
        <div className="ff-integrations-chip-list">
          {integration.source_events.map((event) => (
            <span key={event.event_key}>{event.display_name || event.event_key}</span>
          ))}
          {!integration.source_events.length ? <p className="ff-integrations-muted">No source events configured.</p> : null}
        </div>
      </section>
      <section>
        <h3>Source fields</h3>
        <div className="ff-integrations-field-list">
          {integration.source_fields.map((field) => (
            <article key={field.path}>
              <strong>{field.label || field.path}</strong>
              <span>
                {field.path} - {field.type}
                {field.required ? " - required" : ""}
                {field.sensitive ? " - sensitive" : ""}
              </span>
            </article>
          ))}
          {!integration.source_fields.length ? <p className="ff-integrations-muted">No source fields configured.</p> : null}
        </div>
      </section>
      <section>
        <h3>Workflow triggers</h3>
        <form
          className="ff-admin-form ff-integrations-trigger-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateTrigger();
          }}
        >
          <label>
            Workflow Definition Id
            <input value={workflowDefinitionId} onChange={(event) => onSetWorkflowDefinitionId(event.target.value)} />
          </label>
          <label>
            Workflow Version Id
            <input value={workflowVersionId} onChange={(event) => onSetWorkflowVersionId(event.target.value)} placeholder="Optional for latest published" />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={createTriggerPending}>
            Add Trigger
          </button>
        </form>
        {triggersLoading ? <div className="ff-empty-state">Loading triggers...</div> : null}
        <div className="ff-admin-list">
          {triggers.map((trigger) => (
            <article key={trigger.id} className="ff-admin-card">
              <h3>{trigger.display_name}</h3>
              <p>
                Workflow {trigger.workflow_definition_id} - {trigger.version_strategy} - priority {trigger.priority}
              </p>
            </article>
          ))}
          {!triggers.length && !triggersLoading ? <div className="ff-empty-state">No triggers configured for this integration.</div> : null}
        </div>
      </section>
    </div>
  );
}
