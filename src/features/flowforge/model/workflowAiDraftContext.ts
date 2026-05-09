import type { FlowForgeCommunicationTemplate } from "./communicationTemplateTypes";
import type { FlowForgeIntegrationConfig, FlowForgeMatchingPolicy, FlowForgeResourceSet } from "./adminTypes";
import type { FlowForgeSavedQueryOption } from "./savedQueryOptions";

type WorkflowAIDraftContextInput = {
  integrations: FlowForgeIntegrationConfig[];
  matchingPolicies: FlowForgeMatchingPolicy[];
  resourceSets: FlowForgeResourceSet[];
  communicationTemplates: FlowForgeCommunicationTemplate[];
  savedQueries: FlowForgeSavedQueryOption[];
};

export function buildWorkflowAIDraftContext({
  integrations,
  matchingPolicies,
  resourceSets,
  communicationTemplates,
  savedQueries,
}: WorkflowAIDraftContextInput): Record<string, unknown> {
  return {
    integrations: integrations.map((integration) => ({
      id: integration.id,
      provider: integration.provider,
      integration_key: integration.integration_key,
      display_name: integration.display_name,
      enabled: integration.enabled,
      source_events: integration.source_events.map((event) => ({
        event_key: event.event_key,
        display_name: event.display_name,
      })),
      source_fields: integration.source_fields.map((field) => ({
        path: field.path,
        label: field.label,
        type: field.type,
        required: field.required,
        sensitive: field.sensitive,
      })),
      workflow_values: integration.workflow_value_schema.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        expose_to_templates: field.expose_to_templates,
      })),
    })),
    matching_policies: matchingPolicies.map((policy) => ({
      id: policy.id,
      policy_key: policy.policy_key,
      display_name: policy.display_name,
      resource_set_id: policy.resource_set_id,
      status: policy.status,
      published: Boolean(policy.latest_published_version_id),
    })),
    resource_sets: resourceSets.map((resourceSet) => ({
      id: resourceSet.id,
      resource_set_key: resourceSet.resource_set_key,
      display_name: resourceSet.display_name,
      enabled: resourceSet.enabled,
    })),
    communication_templates: communicationTemplates.map((template) => ({
      id: template.id,
      template_key: template.template_key,
      display_name: template.display_name,
      purpose: template.purpose,
      status: template.status,
      resource_set_id: template.resource_set_id ?? null,
    })),
    saved_queries: savedQueries.slice(0, 20).map((query) => ({
      id: query.id,
      name: query.name,
      location: query.location,
      query_type: query.queryType,
    })),
  };
}
