import type { FlowForgeIntegrationConfig, FlowForgeIntegrationSourceField } from "./adminTypes";
import { titleize } from "./matchingPolicyBuilder";

export type IntakeContextFieldOption = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  sensitive: boolean;
};

export const buildIntakeContextFieldOptions = (sourceFields: FlowForgeIntegrationSourceField[] = []): IntakeContextFieldOption[] => {
  const fields = new Map<string, IntakeContextFieldOption>();
  sourceFields.forEach((field) => {
    const key = String(field.path || "").trim();
    if (!key || fields.has(key)) return;
    fields.set(key, {
      key,
      label: field.label || titleize(key),
      type: field.type || "unknown",
      required: Boolean(field.required),
      sensitive: Boolean(field.sensitive),
    });
  });
  return [...fields.values()].sort((left, right) => left.label.localeCompare(right.label));
};

export const intakeSourceSummary = (integration?: FlowForgeIntegrationConfig | null, eventKey?: string) => {
  if (!integration) return null;
  const event = integration.source_events.find((sourceEvent) => sourceEvent.event_key === eventKey);
  return {
    integration_key: integration.integration_key,
    integration_id: integration.id,
    provider: integration.provider,
    display_name: integration.display_name,
    event_key: event?.event_key ?? eventKey ?? "",
    event_name: event?.display_name ?? eventKey ?? "",
  };
};
