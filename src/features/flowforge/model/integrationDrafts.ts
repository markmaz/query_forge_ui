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

export type FlowForgeIntegrationProviderOption = {
  value: string;
  label: string;
  description: string;
  available: boolean;
};

type IntegrationDraftDefaults = {
  provider: string;
  integrationKey: string;
  displayName: string;
  mode: string;
  sourceEvents: SourceEventDraft[];
  sourceFields: SourceFieldDraft[];
};

const defaultWebhookSourceEvents: SourceEventDraft[] = [
  { id: "webhook_received", event_key: "webhook_received", display_name: "Webhook Received", description: "Generic webhook event received." },
];

const defaultWebhookSourceFields: SourceFieldDraft[] = [
  { id: "eventType", path: "event_key", label: "Event Type", type: "text", required: true, sensitive: false },
  { id: "externalEventId", path: "external_event_id", label: "External Event Id", type: "text", required: false, sensitive: false },
  { id: "summary", path: "fields.summary", label: "Summary", type: "text", required: false, sensitive: true },
  { id: "source", path: "fields.source", label: "Source", type: "text", required: false, sensitive: false },
];

const defaultJotformSourceEvents: SourceEventDraft[] = [
  { id: "intake_submitted", event_key: "intake_submitted", display_name: "Intake Submitted", description: "New Jotform intake submission." },
];

const defaultJotformSourceFields: SourceFieldDraft[] = [
  { id: "submissionId", path: "submission_id", label: "Submission Id", type: "text", required: true, sensitive: false },
  { id: "serviceRequested", path: "serviceRequested", label: "Requested Service", type: "text", required: false, sensitive: false },
  { id: "preferredLocation", path: "preferredLocation", label: "Preferred Location", type: "text", required: false, sensitive: false },
  { id: "summary", path: "summary", label: "Clinical Summary", type: "text", required: false, sensitive: true },
];

const defaultFileWatchSourceEvents: SourceEventDraft[] = [
  { id: "file_created", event_key: "file_created", display_name: "File Created", description: "New file appears in the watched source." },
  { id: "file_updated", event_key: "file_updated", display_name: "File Updated", description: "Existing file changes in the watched source." },
];

const defaultFileWatchSourceFields: SourceFieldDraft[] = [
  { id: "fileName", path: "file.name", label: "File Name", type: "text", required: true, sensitive: false },
  { id: "filePath", path: "file.path", label: "File Path", type: "text", required: true, sensitive: false },
  { id: "fileSize", path: "file.size_bytes", label: "File Size", type: "number", required: false, sensitive: false },
  { id: "modifiedAt", path: "file.modified_at", label: "Modified At", type: "datetime", required: false, sensitive: false },
];

export const integrationProviders: FlowForgeIntegrationProviderOption[] = [
  {
    value: "webhook",
    label: "Webhook",
    description: "Generic signed webhook ingress for custom systems and external event sources.",
    available: true,
  },
  {
    value: "file_watch",
    label: "File Watch",
    description: "Allowlisted file source that can start workflows when files arrive or change.",
    available: true,
  },
  {
    value: "jotform",
    label: "Jotform",
    description: "Form submission source with generated workflow webhook details.",
    available: true,
  },
  {
    value: "api",
    label: "API",
    description: "Direct API ingress for custom systems and application events.",
    available: false,
  },
  {
    value: "slack",
    label: "Slack",
    description: "Slack event and command integrations for team workflow actions.",
    available: false,
  },
];

export function freshIntegrationDraft(provider = "webhook"): IntegrationDraftDefaults {
  if (provider === "jotform") {
    return {
      provider: "jotform",
      integrationKey: "jotform-intake",
      displayName: "Jotform Intake",
      mode: "test",
      sourceEvents: defaultJotformSourceEvents.map((event) => ({ ...event })),
      sourceFields: defaultJotformSourceFields.map((field) => ({ ...field })),
    };
  }
  if (provider === "file_watch") {
    return {
      provider: "file_watch",
      integrationKey: "file-watch-source",
      displayName: "File Watch Source",
      mode: "test",
      sourceEvents: defaultFileWatchSourceEvents.map((event) => ({ ...event })),
      sourceFields: defaultFileWatchSourceFields.map((field) => ({ ...field })),
    };
  }
  return {
    provider: "webhook",
    integrationKey: "webhook-intake",
    displayName: "Webhook Intake",
    mode: "test",
    sourceEvents: defaultWebhookSourceEvents.map((event) => ({ ...event })),
    sourceFields: defaultWebhookSourceFields.map((field) => ({ ...field })),
  };
}
