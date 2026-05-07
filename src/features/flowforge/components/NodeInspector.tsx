import { useEffect, useState } from "react";

import type { FlowForgeCommunicationTemplate } from "../model/communicationTemplateTypes";
import type { FlowForgeIntegrationConfig, FlowForgeMatchingPolicy, FlowForgeResourceSet } from "../model/adminTypes";
import type { ResourceFieldOption } from "../model/matchingPolicyBuilder";
import type { FlowForgeNode } from "../model/types";
import type { FlowForgeNodeValidationIssue } from "../model/workflowValidation";
import CommunicationTemplateSelector, {
  communicationTemplatePurposeForNode,
  defaultCommunicationTemplateKey,
} from "./CommunicationTemplateSelector";

type NodeInspectorProps = {
  node?: FlowForgeNode;
  editable?: boolean;
  integrations?: FlowForgeIntegrationConfig[];
  integrationsLoading?: boolean;
  matchingPolicies?: FlowForgeMatchingPolicy[];
  resourceSets?: FlowForgeResourceSet[];
  intakeSourceFieldOptions?: IntakeSourceFieldOption[];
  resourceFieldOptions?: ResourceFieldOption[];
  resourceFieldsLoading?: boolean;
  communicationTemplates?: FlowForgeCommunicationTemplate[];
  communicationTemplatesLoading?: boolean;
  communicationTemplateResourceSetId?: number | null;
  validationIssues?: FlowForgeNodeValidationIssue[];
  onNodeChange?: (nodeId: string, patch: Partial<Pick<FlowForgeNode, "label" | "data">>) => void;
  onNodeDataChange?: (nodeId: string, data: Record<string, unknown>) => void;
};

type GuidedChoice = {
  value: string;
  label: string;
  description: string;
};

export type IntakeSourceFieldOption = {
  value: string;
  label: string;
  type: string;
  required?: boolean;
  sensitive?: boolean;
};

const DECISION_OUTCOMES: GuidedChoice[] = [
  { value: "approved", label: "Approved", description: "Continue when a human or policy approves the item." },
  { value: "declined", label: "Declined", description: "Branch when a person or resource declines." },
  { value: "timed_out", label: "Timed out", description: "Branch when the response window expires." },
  { value: "needs_review", label: "Needs review", description: "Route ambiguous outcomes to an operator." },
  { value: "no_match", label: "No match", description: "Branch when no eligible resource remains." },
];

const EVENT_CAPTURES: GuidedChoice[] = [
  { value: "reason", label: "Reason", description: "Capture a human-readable reason or disposition." },
  { value: "response_time", label: "Response time", description: "Capture how long the response took." },
  { value: "selected_resource", label: "Selected resource", description: "Capture the chosen resource or assignee." },
  { value: "notification_status", label: "Notification status", description: "Capture delivery, bounce, or failure state." },
  { value: "operator_note", label: "Operator note", description: "Capture a manual operator note for audit." },
];

const INTAKE_TARGET_FIELDS: GuidedChoice[] = [
  { value: "intake.client_initials", label: "Client initials", description: "A minimal identifier safe for routing emails." },
  { value: "intake.requested_service", label: "Requested service", description: "The service or care category requested by the potential patient." },
  { value: "intake.preferred_location", label: "Preferred location", description: "Location, region, or modality preference." },
  { value: "intake.preferred_days", label: "Preferred days", description: "Availability summary from the intake form." },
  { value: "intake.insurance", label: "Insurance", description: "Insurance or payment signal needed for matching decisions." },
  { value: "intake.age_range", label: "Age range", description: "Age band, not date of birth." },
  { value: "intake.clinical_summary", label: "Clinical summary", description: "Short redacted summary for accept/decline decisions." },
];

type MapTransformRow = {
  id: string;
  target: string;
  source: string;
  expose: boolean;
};

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isResourceBackedNode(node: FlowForgeNode): boolean {
  return node.type === "scoring" || node.type === "filter" || node.type === "ranking";
}

function isResourceFieldList(node: FlowForgeNode, key: string): boolean {
  return (
    (node.type === "scoring" && key === "criteria") ||
    (node.type === "filter" && key === "excludes") ||
    (node.type === "ranking" && key === "factors")
  );
}

function toEditableValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return "";
  return formatValue(value);
}

function fieldLabel(node: FlowForgeNode, key: string): string {
  if (node.type === "intake" && key === "source") return "Source integration";
  if (node.type === "intake" && key === "event") return "Event";
  if (isResourceBackedNode(node) && key === "resource_set_id") return "Resource Pool";
  if (node.type === "matching" && key === "matching_policy_id") return "Matching policy";
  if (node.type === "human_task" && key === "timeout_minutes") return "Response timeout";
  if (node.type === "human_task" && key === "communication_template_key") return "Communication template";
  if (node.type === "notification" && key === "communication_template_key") return "Communication template";
  if (node.type === "notification" && key === "recipients") return "Recipients";
  if (node.type === "notification" && key === "reason") return "Notification reason";
  if (node.type === "scoring" && key === "criteria") return "Compatibility signals";
  if (node.type === "filter" && key === "excludes") return "Eligibility exclusions";
  if (node.type === "ranking" && key === "factors") return "Ranking factors";
  if (node.type === "decision" && key === "outcomes") return "Decision outcomes";
  if (node.type === "event_capture" && key === "captures") return "Captured events";
  if (node.type === "query_extract" && key === "preview_limit") return "Row limit";
  if (node.type === "schedule_trigger" && key === "rrule") return "Schedule";
  if (node.type === "export" && key === "include_header") return "Include header";
  if (node.type === "import" && key === "resource_set_id") return "Resource set id";
  if (node.type === "import" && key === "activate") return "Activate after validation";
  return key.replace(/_/g, " ");
}

function fieldHelper(node: FlowForgeNode, key: string): string | null {
  if (node.type === "intake" && key === "source") {
    return "Choose the configured integration that starts this workflow. FlowForge stores the stable integration key.";
  }
  if (node.type === "intake" && key === "event") {
    return "Choose one of the inbound events configured for the selected integration.";
  }
  if (isResourceBackedNode(node) && key === "resource_set_id") {
    return "Choose the resource pool this action evaluates. Field choices below are loaded from that pool's active records.";
  }
  if (node.type === "matching" && key === "matching_policy_id") {
    return "Choose the published matching policy this runtime action will execute. The policy controls eligibility, scoring, ranking, and the resource pool.";
  }
  if (node.type === "human_task" && key === "timeout_minutes") {
    return "How long the selected resource has to accept or decline before FlowForge can loop to the next matched candidate.";
  }
  if (node.type === "human_task" && key === "communication_template_key") {
    return "Choose the active email template FlowForge uses when creating this task communication.";
  }
  if (node.type === "notification" && key === "communication_template_key") {
    return "Choose the active email template FlowForge uses for this notification.";
  }
  if (node.type === "notification" && key === "recipients") {
    return "Enter one or more email recipients, separated by commas. Runtime de-duplicates duplicate addresses.";
  }
  if (node.type === "notification" && key === "reason") {
    return "Short operational reason included in the notification payload and available to communication templates.";
  }
  if (node.type === "scoring" && key === "criteria") {
    return "Choose resource fields this scoring block should consider. These fields come from the selected resource pool.";
  }
  if (node.type === "filter" && key === "excludes") {
    return "Choose resource fields used to remove candidates before scoring starts.";
  }
  if (node.type === "ranking" && key === "factors") {
    return "Choose resource fields used to order eligible candidates.";
  }
  if (node.type === "decision" && key === "outcomes") {
    return "Choose the branch outcomes this decision block can emit.";
  }
  if (node.type === "event_capture" && key === "captures") {
    return "Choose the audit fields this block should capture from runtime events.";
  }
  if (node.type === "query_extract" && key === "preview_limit") {
    return "Leave blank to use the default. Set a number when this workflow should request more or fewer rows.";
  }
  if (node.type === "schedule_trigger" && key === "rrule") {
    return "Use a recurrence rule such as FREQ=DAILY;INTERVAL=1 or FREQ=HOURLY;INTERVAL=6.";
  }
  if (node.type === "export" && key === "destination_key") {
    return "Choose a key from FlowForge Data Movement destinations.";
  }
  if (node.type === "import" && key === "source_key") {
    return "Choose a key from FlowForge Data Movement sources.";
  }
  if (node.type === "import" && key === "filename") {
    return "For local_file_test sources, use a filename inside the configured source base directory.";
  }
  return null;
}

function fieldInputType(node: FlowForgeNode, key: string, value: unknown): "checkbox" | "number" | "select" | "text" {
  if (node.type === "intake" && key === "source") return "select";
  if (node.type === "intake" && key === "event") return "select";
  if (node.type === "query_extract" && key === "preview_limit") return "number";
  if (isResourceBackedNode(node) && key === "resource_set_id") return "select";
  if (node.type === "matching" && key === "matching_policy_id") return "select";
  if ((node.type === "human_task" || node.type === "notification") && key === "communication_template_key") return "select";
  if (node.type === "human_task" && key === "timeout_minutes") return "number";
  if (node.type === "import" && key === "resource_set_id") return "number";
  if (typeof value === "boolean") return "checkbox";
  if (key === "mode" || key === "format") return "select";
  return "text";
}

function fieldOptions(node: FlowForgeNode, key: string): string[] {
  if (key === "mode") return ["test", "production"];
  if (node.type === "export" && key === "format") return ["csv", "json"];
  return [];
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resourceFieldChoices(resourceFieldOptions: ResourceFieldOption[]): GuidedChoice[] {
  return resourceFieldOptions.map((field) => ({
    value: field.key,
    label: `${field.label} (${field.type})`,
    description:
      field.source === "resource"
        ? "Loaded from active records in the selected resource pool."
        : "Standard resource field available to matching policies.",
  }));
}

function guidedChoices(
  node: FlowForgeNode,
  key: string,
  value: unknown,
  resourceFieldOptions: ResourceFieldOption[],
): GuidedChoice[] {
  let choices: GuidedChoice[] = [];
  if (isResourceFieldList(node, key)) choices = resourceFieldChoices(resourceFieldOptions);
  if (node.type === "decision" && key === "outcomes") choices = DECISION_OUTCOMES;
  if (node.type === "event_capture" && key === "captures") choices = EVENT_CAPTURES;
  if (!choices.length || !Array.isArray(value)) return [];

  const known = new Set(choices.map((choice) => choice.value));
  const existingChoices = value
    .map(String)
    .filter((entry) => entry && !known.has(entry))
    .map((entry) => ({
      value: entry,
      label: titleCase(entry),
      description: "Existing saved value for this workflow.",
    }));
  return [...choices, ...existingChoices];
}

function detailEntries(node: FlowForgeNode): [string, unknown][] {
  if (node.type === "map_transform") {
    const entries = Object.entries(node.data).filter(
      ([key]) => !["field_mapping", "mapping", "template_fields", "communication_fields"].includes(key),
    );
    if (!("mode" in node.data) && !("transform_mode" in node.data)) {
      entries.unshift(["mode", "run_context"]);
    }
    return entries;
  }
  const entries = Object.entries(node.data);
  if (node.type === "intake" && !("source" in node.data)) {
    entries.unshift(["source", ""]);
  }
  if (node.type === "intake" && !("event" in node.data)) {
    entries.push(["event", ""]);
  }
  if (isResourceBackedNode(node) && !("resource_set_id" in node.data)) {
    entries.unshift(["resource_set_id", ""]);
  }
  if (node.type === "matching" && !("matching_policy_id" in node.data)) {
    entries.unshift(["matching_policy_id", ""]);
  }
  const templatePurpose = communicationTemplatePurposeForNode(node);
  if (templatePurpose && !("communication_template_key" in node.data)) {
    entries.push(["communication_template_key", defaultCommunicationTemplateKey(templatePurpose)]);
  }
  if (node.type === "query_extract" && !("preview_limit" in node.data)) {
    entries.push(["preview_limit", ""]);
  }
  if (node.type === "import" && !("filename" in node.data)) {
    entries.push(["filename", ""]);
  }
  if (node.type === "import" && !("resource_set_id" in node.data)) {
    entries.push(["resource_set_id", ""]);
  }
  if (node.type === "import" && !("activate" in node.data)) {
    entries.push(["activate", false]);
  }
  return entries;
}

function mapTransformRows(data: Record<string, unknown>): MapTransformRow[] {
  const templateFields = new Set(
    Array.isArray(data.template_fields) ? data.template_fields.map(String) : [],
  );
  const rawMapping = data.field_mapping ?? data.mapping;
  if (Array.isArray(rawMapping)) {
    return rawMapping
      .map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const row = entry as Record<string, unknown>;
        const target = String(row.target ?? row.to ?? "").trim();
        const source = String(row.source ?? row.from ?? target).trim();
        if (!target && !source) return null;
        return {
          id: `${target || source || "mapping"}-${index}`,
          target,
          source,
          expose: Boolean(row.expose_to_templates) || templateFields.has(target),
        };
      })
      .filter((entry): entry is MapTransformRow => Boolean(entry));
  }
  if (rawMapping && typeof rawMapping === "object") {
    return Object.entries(rawMapping as Record<string, unknown>).map(([target, rule], index) => ({
      id: `${target}-${index}`,
      target,
      source:
        rule && typeof rule === "object" && !Array.isArray(rule)
          ? String((rule as Record<string, unknown>).source ?? (rule as Record<string, unknown>).from ?? target)
          : String(rule ?? target),
      expose: templateFields.has(target),
    }));
  }
  return [];
}

function parseEditableValue(key: string, original: unknown, value: string): unknown {
  if (key === "preview_limit" && value.trim() === "") return "";
  if (key === "preview_limit") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : original;
  }
  if (Array.isArray(original)) {
    return splitList(value);
  }
  if (typeof original === "boolean") return value.trim().toLowerCase() === "true";
  if (key === "resource_set_id" && value.trim() === "") return "";
  if (key === "resource_set_id") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : original;
  }
  if (key === "matching_policy_id" && value.trim() === "") return "";
  if (key === "matching_policy_id") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : original;
  }
  if (typeof original === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : original;
  }
  return value;
}

function MapTransformBuilder({
  node,
  editable,
  sourceFieldOptions = [],
  onChange,
}: {
  node: FlowForgeNode;
  editable: boolean;
  sourceFieldOptions?: IntakeSourceFieldOption[];
  onChange: (data: Record<string, unknown>) => void;
}) {
  const rows = mapTransformRows(node.data);
  const commitRows = (nextRows: MapTransformRow[]) => {
    const cleanedRows = nextRows
      .map((row) => ({
        target: row.target.trim(),
        source: row.source.trim(),
        expose_to_templates: row.expose,
      }))
      .filter((row) => row.target && row.source);
    const templateFields = cleanedRows
      .filter((row) => row.expose_to_templates && row.target.startsWith("intake."))
      .map((row) => row.target);
    onChange({
      ...node.data,
      mode: "run_context",
      field_mapping: cleanedRows,
      template_fields: Array.from(new Set(templateFields)).sort(),
    });
  };
  const updateRow = (index: number, patch: Partial<MapTransformRow>) => {
    commitRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };
  const addRow = () => {
    const existingTargets = new Set(rows.map((row) => row.target));
    const nextTarget = INTAKE_TARGET_FIELDS.find((field) => !existingTargets.has(field.value))?.value ?? "intake.custom_field";
    commitRows([
      ...rows,
      {
        id: `${nextTarget}-${Date.now()}`,
        target: nextTarget,
        source: sourceFieldOptions[0]?.value ?? "",
        expose: true,
      },
    ]);
  };
  return (
    <div className="ff-field-group ff-map-transform-builder">
      <div>
        <div className="ff-field-label">Intake Field Mapper</div>
        <span className="ff-field-helper">
          Map source form paths into clean intake fields. Only fields marked for templates are available in therapist emails.
        </span>
      </div>
      <div className="ff-map-transform-rows">
        {rows.map((row, index) => (
          <div className="ff-map-transform-row" key={row.id}>
            <label>
              Source
              <select
                value={sourceFieldOptions.some((field) => field.value === row.source) ? row.source : ""}
                disabled={!editable || !sourceFieldOptions.length}
                onChange={(event) => updateRow(index, { source: event.target.value })}
              >
                <option value="">{sourceFieldOptions.length ? "Select source field" : "No source fields defined"}</option>
                {sourceFieldOptions.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                    {field.type ? ` (${field.type})` : ""}
                    {field.sensitive ? " sensitive" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Clean field
              <select
                value={row.target}
                disabled={!editable}
                onChange={(event) => updateRow(index, { target: event.target.value })}
              >
                {INTAKE_TARGET_FIELDS.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ff-map-template-toggle">
              <input
                type="checkbox"
                checked={row.expose}
                disabled={!editable}
                onChange={(event) => updateRow(index, { expose: event.target.checked })}
              />
              <span>Email field</span>
            </label>
            {editable ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => commitRows(rows.filter((_row, rowIndex) => rowIndex !== index))}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {!rows.length ? <div className="ff-policy-field-gate">No intake fields mapped yet.</div> : null}
      </div>
      {editable ? (
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!sourceFieldOptions.length} onClick={addRow}>
          Add intake field
        </button>
      ) : null}
      {!sourceFieldOptions.length ? (
        <span className="ff-field-helper">Select an intake integration with source fields before mapping intake data.</span>
      ) : null}
    </div>
  );
}

export default function NodeInspector({
  node,
  editable = false,
  integrations = [],
  integrationsLoading = false,
  matchingPolicies = [],
  resourceSets = [],
  intakeSourceFieldOptions = [],
  resourceFieldOptions = [],
  resourceFieldsLoading = false,
  communicationTemplates = [],
  communicationTemplatesLoading = false,
  communicationTemplateResourceSetId = null,
  validationIssues = [],
  onNodeChange,
  onNodeDataChange,
}: NodeInspectorProps) {
  const [activeTab, setActiveTab] = useState<"details" | "advanced">("details");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftFields, setDraftFields] = useState<Record<string, string>>({});
  const [draftJson, setDraftJson] = useState("{}");
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab("details");
    setDraftLabel(node?.label ?? "");
    setDraftFields(
      Object.fromEntries(
        Object.entries(node?.data ?? {}).map(([key, value]) => [key, toEditableValue(value)]),
      ),
    );
    setDraftJson(JSON.stringify(node?.data ?? {}, null, 2));
    setConfigError(null);
  }, [node?.id, node?.data]);

  if (!node) {
    return (
      <aside className="ff-side-panel" aria-label="Node inspector">
        <h2>Node</h2>
        <p className="ff-muted">Select a workflow node.</p>
      </aside>
    );
  }

  const applyNodeConfig = () => {
    try {
      const parsed = JSON.parse(draftJson);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        setConfigError("Node configuration must be a JSON object.");
        return;
      }
      onNodeDataChange?.(node.id, parsed as Record<string, unknown>);
      onNodeChange?.(node.id, { data: parsed as Record<string, unknown> });
      setConfigError(null);
    } catch {
      setConfigError("Node configuration is not valid JSON.");
    }
  };

  const fields = detailEntries(node);
  const dataFromDraftFields = (overrides: Record<string, string> = {}) => {
    const nextDraftFields = { ...draftFields, ...overrides };
    const nextData = { ...node.data };
    fields.forEach(([fieldKey, original]) => {
      if (typeof original === "object" && original !== null && !Array.isArray(original)) return;
      nextData[fieldKey] = parseEditableValue(fieldKey, original, nextDraftFields[fieldKey] ?? "");
    });
    return nextData;
  };

  const selectedIntakeIntegration = integrations.find(
    (integration) => integration.integration_key === (draftFields.source ?? formatValue(node.data.source)),
  );
  const selectedIntakeEvents = selectedIntakeIntegration?.source_events ?? [];

  const applyDetails = () => {
    const nextData = { ...node.data };
    fields.forEach(([key, original]) => {
      if (node.type === "intake" && key === "source") {
        const nextSource = draftFields[key] ?? "";
        nextData[key] = integrations.some((integration) => integration.integration_key === nextSource) ? nextSource : "";
        return;
      }
      if (node.type === "intake" && key === "event") {
        const nextEvent = draftFields[key] ?? "";
        nextData[key] = selectedIntakeEvents.some((sourceEvent) => sourceEvent.event_key === nextEvent) ? nextEvent : "";
        return;
      }
      nextData[key] =
        typeof original === "object" && original !== null && !Array.isArray(original)
          ? original
          : parseEditableValue(key, original, draftFields[key] ?? "");
    });
    onNodeChange?.(node.id, { label: draftLabel.trim() || node.label, data: nextData });
    onNodeDataChange?.(node.id, nextData);
    setConfigError(null);
  };

  return (
    <aside className="ff-side-panel" aria-label="Node inspector">
      <div>
        <div className="ff-eyebrow">Node inspector</div>
        <h2>{node.label}</h2>
      </div>
      <div className="ff-meta-row">
        <span>Type</span>
        <strong>{node.type.replace("_", " ")}</strong>
      </div>
      <div className="ff-meta-row">
        <span>ID</span>
        <strong>{node.id}</strong>
      </div>
      {validationIssues.length ? (
        <div className="ff-node-validation-summary" aria-label="Selected node validation">
          {validationIssues.map((issue) => (
            <div key={`${issue.severity}-${issue.message}`} className={`ff-node-validation-item is-${issue.severity}`}>
              {issue.message}
            </div>
          ))}
        </div>
      ) : null}
      <div className="ff-inspector-tabs" role="tablist" aria-label="Node inspector tabs">
        <button
          type="button"
          className={activeTab === "details" ? "active" : ""}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>
        <button
          type="button"
          className={activeTab === "advanced" ? "active" : ""}
          onClick={() => setActiveTab("advanced")}
        >
          Advanced
        </button>
      </div>

      {activeTab === "details" ? (
        <div className="ff-node-details-editor">
          {editable ? (
            <label>
              Label
              <input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} />
            </label>
          ) : null}
          {node.type === "map_transform" ? (
            <MapTransformBuilder
              node={node}
              editable={editable}
              sourceFieldOptions={intakeSourceFieldOptions}
              onChange={(nextData) => {
                onNodeChange?.(node.id, { data: nextData });
                onNodeDataChange?.(node.id, nextData);
                setDraftJson(JSON.stringify(nextData, null, 2));
              }}
            />
          ) : null}
          {fields.map(([key, value]) => {
            const objectValue = typeof value === "object" && value !== null && !Array.isArray(value);
            const helper = fieldHelper(node, key);
            const inputType = fieldInputType(node, key, value);
            const options = fieldOptions(node, key);
            const choices = guidedChoices(node, key, value, resourceFieldOptions);
            const templatePurpose = communicationTemplatePurposeForNode(node);
            if (editable && node.type === "intake" && key === "source") {
              const draftedValue = draftFields[key] ?? formatValue(value);
              const currentValue = integrations.some((integration) => integration.integration_key === draftedValue) ? draftedValue : "";
              return (
                <label key={key}>
                  {fieldLabel(node, key)}
                  <select
                    value={currentValue}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        [key]: event.target.value,
                        event: integrations
                          .find((integration) => integration.integration_key === event.target.value)
                          ?.source_events.some((sourceEvent) => sourceEvent.event_key === current.event)
                          ? current.event
                          : "",
                      }))
                    }
                  >
                    <option value="">Select configured integration</option>
                    {integrations.map((integration) => (
                      <option key={integration.id} value={integration.integration_key}>
                        {integration.display_name}
                        {integration.mode ? ` (${integration.mode})` : ""}
                        {integration.enabled ? "" : " (disabled)"}
                      </option>
                    ))}
                  </select>
                  {helper ? <span className="ff-field-helper">{helper}</span> : null}
                  {integrationsLoading ? <span className="ff-field-helper">Loading configured integrations.</span> : null}
                  {!integrationsLoading && !integrations.length ? (
                    <span className="ff-field-helper">No integrations are configured for this workspace yet.</span>
                  ) : null}
                </label>
              );
            }
            if (editable && node.type === "intake" && key === "event") {
              const draftedValue = draftFields[key] ?? formatValue(value);
              const currentValue = selectedIntakeEvents.some((sourceEvent) => sourceEvent.event_key === draftedValue) ? draftedValue : "";
              return (
                <label key={key}>
                  {fieldLabel(node, key)}
                  <select
                    value={currentValue}
                    disabled={!selectedIntakeEvents.length}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">{selectedIntakeEvents.length ? "Select event" : "No events defined"}</option>
                    {selectedIntakeEvents.map((sourceEvent) => (
                      <option key={sourceEvent.event_key} value={sourceEvent.event_key}>
                        {sourceEvent.display_name}
                      </option>
                    ))}
                  </select>
                  {helper ? <span className="ff-field-helper">{helper}</span> : null}
                  {draftFields.source && !selectedIntakeEvents.length ? (
                    <span className="ff-field-helper">No source events are configured for this integration.</span>
                  ) : null}
                </label>
              );
            }
            if (editable && templatePurpose && key === "communication_template_key") {
              return (
                <CommunicationTemplateSelector
                  key={key}
                  value={draftFields[key] ?? formatValue(value)}
                  purpose={templatePurpose}
                  templates={communicationTemplates}
                  resourceSetId={communicationTemplateResourceSetId}
                  loading={communicationTemplatesLoading}
                  helper={helper}
                  onChange={(nextValue) => {
                    setDraftFields((current) => ({
                      ...current,
                      [key]: nextValue,
                    }));
                    const nextData = dataFromDraftFields({ communication_template_key: nextValue });
                    onNodeChange?.(node.id, { data: nextData });
                    onNodeDataChange?.(node.id, nextData);
                  }}
                />
              );
            }
            if (editable && node.type === "matching" && key === "matching_policy_id") {
              return (
                <label key={key}>
                  {fieldLabel(node, key)}
                  <select
                    value={draftFields[key] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraftFields((current) => ({
                        ...current,
                        [key]: nextValue,
                      }));
                      const parsed = Number(nextValue);
                      const policy = matchingPolicies.find((item) => item.id === parsed);
                      const nextData = {
                        ...node.data,
                        matching_policy_id: nextValue && Number.isFinite(parsed) ? parsed : "",
                        resource_set_id: policy?.resource_set_id ?? node.data.resource_set_id ?? "",
                      };
                      onNodeChange?.(node.id, { data: nextData });
                      onNodeDataChange?.(node.id, nextData);
                    }}
                  >
                    <option value="">Select matching policy</option>
                    {matchingPolicies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.display_name}
                        {policy.latest_published_version_id ? "" : " (not published)"}
                      </option>
                    ))}
                  </select>
                  {helper ? <span className="ff-field-helper">{helper}</span> : null}
                </label>
              );
            }
            if (editable && isResourceBackedNode(node) && key === "resource_set_id") {
              return (
                <label key={key}>
                  {fieldLabel(node, key)}
                  <select
                    value={draftFields[key] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraftFields((current) => ({
                        ...current,
                        [key]: nextValue,
                      }));
                      const parsed = Number(nextValue);
                      const nextData = {
                        ...node.data,
                        resource_set_id: nextValue && Number.isFinite(parsed) ? parsed : "",
                      };
                      onNodeChange?.(node.id, { data: nextData });
                      onNodeDataChange?.(node.id, nextData);
                    }}
                  >
                    <option value="">Select resource pool</option>
                    {resourceSets.map((resourceSet) => (
                      <option key={resourceSet.id} value={resourceSet.id}>
                        {resourceSet.display_name}
                      </option>
                    ))}
                  </select>
                  {helper ? <span className="ff-field-helper">{helper}</span> : null}
                </label>
              );
            }
            if (editable && Array.isArray(value) && isResourceFieldList(node, key) && !choices.length) {
              return (
                <div className="ff-field-group" key={key}>
                  <div className="ff-field-label">{fieldLabel(node, key)}</div>
                  <div className="ff-policy-field-gate">
                    {resourceFieldsLoading ? "Loading resource pool fields." : "Select a resource pool to load available fields."}
                  </div>
                  {helper ? <span className="ff-field-helper">{helper}</span> : null}
                </div>
              );
            }
            if (editable && Array.isArray(value) && choices.length) {
              const selectedValues = new Set(splitList(draftFields[key] ?? toEditableValue(value)));
              return (
                <div className="ff-field-group" key={key}>
                  <div className="ff-field-label">{fieldLabel(node, key)}</div>
                  <div className="ff-choice-list">
                    {choices.map((choice) => (
                      <label className="ff-choice-row" key={choice.value}>
                        <input
                          type="checkbox"
                          checked={selectedValues.has(choice.value)}
                          onChange={(event) => {
                            const nextValues = new Set(selectedValues);
                            if (event.target.checked) {
                              nextValues.add(choice.value);
                            } else {
                              nextValues.delete(choice.value);
                            }
                            setDraftFields((current) => ({
                              ...current,
                              [key]: Array.from(nextValues).join(", "),
                            }));
                          }}
                        />
                        <span>
                          <strong>{choice.label}</strong>
                          <small>{choice.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {helper ? <span className="ff-field-helper">{helper}</span> : null}
                </div>
              );
            }
            return (
              <label key={key}>
                {fieldLabel(node, key)}
                {editable && !objectValue && inputType === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={(draftFields[key] ?? formatValue(value)).toLowerCase() === "true"}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        [key]: event.target.checked ? "true" : "false",
                      }))
                    }
                  />
                ) : null}
                {editable && !objectValue && inputType === "select" ? (
                  <select
                    value={draftFields[key] ?? ""}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : null}
                {editable && !objectValue && inputType !== "checkbox" && inputType !== "select" ? (
                  <input
                    min={key === "preview_limit" || key === "resource_set_id" ? 1 : undefined}
                    placeholder={key === "preview_limit" ? "Use default" : undefined}
                    step={key === "preview_limit" || key === "resource_set_id" ? 1 : undefined}
                    type={inputType}
                    value={draftFields[key] ?? ""}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                ) : null}
                {!editable || objectValue ? (
                  <strong>{objectValue ? "Configured object. Use Advanced to edit." : formatValue(value)}</strong>
                ) : null}
                {helper ? <span className="ff-field-helper">{helper}</span> : null}
              </label>
            );
          })}
          {editable ? (
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={applyDetails}>
              Apply details
            </button>
          ) : null}
        </div>
      ) : editable ? (
        <div className="ff-node-config-editor">
          <label htmlFor={`ff-node-config-${node.id}`}>Node configuration JSON</label>
          <textarea
            id={`ff-node-config-${node.id}`}
            value={draftJson}
            onChange={(event) => setDraftJson(event.target.value)}
            spellCheck={false}
          />
          {configError ? <div className="text-danger small">{configError}</div> : null}
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={applyNodeConfig}>
            Apply node config
          </button>
        </div>
      ) : null}
    </aside>
  );
}
