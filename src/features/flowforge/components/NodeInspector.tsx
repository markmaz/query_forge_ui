import { useEffect, useState } from "react";

import type { FlowForgeNode } from "../model/types";

type NodeInspectorProps = {
  node?: FlowForgeNode;
  editable?: boolean;
  onNodeChange?: (nodeId: string, patch: Partial<Pick<FlowForgeNode, "label" | "data">>) => void;
  onNodeDataChange?: (nodeId: string, data: Record<string, unknown>) => void;
};

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toEditableValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return "";
  return formatValue(value);
}

function fieldLabel(node: FlowForgeNode, key: string): string {
  if (node.type === "query_extract" && key === "preview_limit") return "Row limit";
  if (node.type === "schedule_trigger" && key === "rrule") return "Schedule";
  if (node.type === "export" && key === "include_header") return "Include header";
  if (node.type === "import" && key === "resource_set_id") return "Resource set id";
  if (node.type === "import" && key === "activate") return "Activate after validation";
  return key.replace(/_/g, " ");
}

function fieldHelper(node: FlowForgeNode, key: string): string | null {
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

function detailEntries(node: FlowForgeNode): [string, unknown][] {
  const entries = Object.entries(node.data);
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
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof original === "boolean") return value.trim().toLowerCase() === "true";
  if (key === "resource_set_id" && value.trim() === "") return "";
  if (key === "resource_set_id") {
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
