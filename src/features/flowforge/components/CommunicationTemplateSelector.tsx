import { Link } from "react-router-dom";

import { routes } from "@/app/navigation/routes";
import type {
  FlowForgeCommunicationTemplate,
  FlowForgeCommunicationTemplatePurpose,
} from "../model/communicationTemplateTypes";
import type { FlowForgeNode } from "../model/types";

type CommunicationTemplateSelectorProps = {
  value: string;
  purpose: FlowForgeCommunicationTemplatePurpose;
  templates: FlowForgeCommunicationTemplate[];
  resourceSetId?: number | null;
  loading?: boolean;
  helper?: string | null;
  onChange: (templateKey: string) => void;
};

const DEFAULT_TEMPLATE_KEYS: Partial<Record<FlowForgeCommunicationTemplatePurpose, string>> = {
  human_task: "flowforge.human_task",
  notification: "flowforge.notification",
};

export function communicationTemplatePurposeForNode(node?: FlowForgeNode): FlowForgeCommunicationTemplatePurpose | null {
  if (node?.type === "human_task") return "human_task";
  if (node?.type === "notification") return "notification";
  return null;
}

export function defaultCommunicationTemplateKey(purpose: FlowForgeCommunicationTemplatePurpose): string {
  return DEFAULT_TEMPLATE_KEYS[purpose] ?? "flowforge.notification";
}

function createTemplateHref(purpose: FlowForgeCommunicationTemplatePurpose, resourceSetId?: number | null): string {
  const params = new URLSearchParams({
    purpose,
    channel: "email",
    return_to: routes.FlowForgeStudio,
  });
  if (resourceSetId) params.set("resource_set_id", String(resourceSetId));
  return `${routes.FlowForgeAdminCommunicationTemplates}?${params.toString()}`;
}

function optionLabel(template: FlowForgeCommunicationTemplate): string {
  return template.resource_set_id ? `${template.display_name} (resource pool)` : `${template.display_name} (generic)`;
}

export default function CommunicationTemplateSelector({
  value,
  purpose,
  templates,
  resourceSetId,
  loading = false,
  helper,
  onChange,
}: CommunicationTemplateSelectorProps) {
  const defaultKey = defaultCommunicationTemplateKey(purpose);
  const selectedValue = value || defaultKey;
  const templateKeys = new Set(templates.map((template) => template.template_key));
  const includeSavedValue = selectedValue && selectedValue !== defaultKey && !templateKeys.has(selectedValue);

  return (
    <div className="ff-field-group">
      <label className="ff-template-select-field">
        Communication template
        <select value={selectedValue} disabled={loading} onChange={(event) => onChange(event.target.value)}>
          <option value={defaultKey}>Built-in {purpose.replace("_", " ")} template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.template_key}>
              {optionLabel(template)}
            </option>
          ))}
          {includeSavedValue ? <option value={selectedValue}>Saved template key: {selectedValue}</option> : null}
        </select>
      </label>
      {helper ? <span className="ff-field-helper">{helper}</span> : null}
      {!resourceSetId ? (
        <span className="ff-field-helper">Generic templates shown. Select matching or resource context to filter pool-specific templates.</span>
      ) : null}
      {!loading && !templates.length ? <span className="ff-field-helper">No active compatible templates yet.</span> : null}
      <div className="ff-template-actions">
        <Link className="btn btn-outline-secondary btn-sm" to={createTemplateHref(purpose, resourceSetId)}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Create template
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" to={routes.FlowForgeAdminCommunicationTemplates}>
          <i className="fa-solid fa-list" aria-hidden="true" /> Manage templates
        </Link>
      </div>
    </div>
  );
}
