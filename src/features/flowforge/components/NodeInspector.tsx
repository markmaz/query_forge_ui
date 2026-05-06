import { useEffect, useState } from "react";

import type { FlowForgeMatchingPolicy, FlowForgeResourceSet } from "../model/adminTypes";
import type { ResourceFieldOption } from "../model/matchingPolicyBuilder";
import type { FlowForgeNode } from "../model/types";

type NodeInspectorProps = {
  node?: FlowForgeNode;
  editable?: boolean;
  matchingPolicies?: FlowForgeMatchingPolicy[];
  resourceSets?: FlowForgeResourceSet[];
  resourceFieldOptions?: ResourceFieldOption[];
  resourceFieldsLoading?: boolean;
  onNodeChange?: (nodeId: string, patch: Partial<Pick<FlowForgeNode, "label" | "data">>) => void;
  onNodeDataChange?: (nodeId: string, data: Record<string, unknown>) => void;
};

type GuidedChoice = {
  value: string;
  label: string;
  description: string;
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
  if (isResourceBackedNode(node) && key === "resource_set_id") return "Resource Pool";
  if (node.type === "matching" && key === "matching_policy_id") return "Matching policy";
  if (node.type === "human_task" && key === "timeout_minutes") return "Response timeout";
  if (node.type === "human_task" && key === "communication_template_key") return "Communication template";
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
    return "Template key used when FlowForge creates the communication for this task.";
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
  if (node.type === "query_extract" && key === "preview_limit") return "number";
  if (isResourceBackedNode(node) && key === "resource_set_id") return "select";
  if (node.type === "matching" && key === "matching_policy_id") return "select";
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
  const entries = Object.entries(node.data);
  if (isResourceBackedNode(node) && !("resource_set_id" in node.data)) {
    entries.unshift(["resource_set_id", ""]);
  }
  if (node.type === "matching" && !("matching_policy_id" in node.data)) {
    entries.unshift(["matching_policy_id", ""]);
  }
  if (node.type === "human_task" && !("communication_template_key" in node.data)) {
    entries.push(["communication_template_key", "flowforge.human_task"]);
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

export default function NodeInspector({
  node,
  editable = false,
  matchingPolicies = [],
  resourceSets = [],
  resourceFieldOptions = [],
  resourceFieldsLoading = false,
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

  const applyDetails = () => {
    const nextData = { ...node.data };
    fields.forEach(([key, original]) => {
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
          {fields.map(([key, value]) => {
            const objectValue = typeof value === "object" && value !== null && !Array.isArray(value);
            const helper = fieldHelper(node, key);
            const inputType = fieldInputType(node, key, value);
            const options = fieldOptions(node, key);
            const choices = guidedChoices(node, key, value, resourceFieldOptions);
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
