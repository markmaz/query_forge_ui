import { useEffect, useMemo, useState } from "react";

import type { FlowForgeWorkflowValueSchemaField } from "../model/adminTypes";
import type { FlowForgeNode } from "../model/types";

export type IntakeSourceFieldOption = {
  value: string;
  label: string;
  type: string;
  required?: boolean;
  sensitive?: boolean;
};

type CleanFieldOption = {
  value: string;
  label: string;
  type?: string;
};

type MapTransformRow = {
  id: string;
  target: string;
  source: string;
  sources: string[];
  transform: string;
  separator: string;
  template: string;
  expose: boolean;
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function splitSources(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues.map((item) => String(item || "").trim()).filter(Boolean);
}

export function mapTransformRows(data: Record<string, unknown>): MapTransformRow[] {
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
        const sources = splitSources(row.sources ?? row.source ?? row.from ?? target);
        const source = String(row.source ?? row.from ?? sources[0] ?? target).trim();
        const transform = String(row.transform ?? (sources.length > 1 ? "concat" : "copy")).trim();
        if (!target && !source && !sources.length) return null;
        return {
          id: `${target || source || "mapping"}-${index}`,
          target,
          source,
          sources: sources.length ? sources : source ? [source] : [],
          transform,
          separator: String(row.separator ?? " "),
          template: String(row.template ?? ""),
          expose: Boolean(row.expose_to_templates) || templateFields.has(target),
        };
      })
      .filter((entry): entry is MapTransformRow => Boolean(entry));
  }
  if (rawMapping && typeof rawMapping === "object") {
    return Object.entries(rawMapping as Record<string, unknown>).map(([target, rule], index) => {
      const ruleObject = rule && typeof rule === "object" && !Array.isArray(rule) ? (rule as Record<string, unknown>) : null;
      const source = ruleObject ? String(ruleObject.source ?? ruleObject.from ?? target) : String(rule ?? target);
      const sources = splitSources(ruleObject?.sources ?? source);
      return {
        id: `${target}-${index}`,
        target,
        source,
        sources,
        transform: String(ruleObject?.transform ?? (sources.length > 1 ? "concat" : "copy")),
        separator: String(ruleObject?.separator ?? " "),
        template: String(ruleObject?.template ?? ""),
        expose: templateFields.has(target),
      };
    });
  }
  return [];
}

export function workflowValueOptions(nodes: FlowForgeNode[]): Array<{ value: string; label: string; sourceNodeLabel: string }> {
  const options: Array<{ value: string; label: string; sourceNodeLabel: string }> = [];
  const seen = new Set<string>();
  nodes.forEach((node) => {
    if (node.type !== "map_transform") return;
    mapTransformRows(node.data).forEach((row) => {
      const target = row.target.trim();
      if (!target.startsWith("values.") || seen.has(target)) return;
      seen.add(target);
      options.push({
        value: target,
        label: titleCase(target.replace(/^values\./, "")),
        sourceNodeLabel: node.label,
      });
    });
  });
  return options;
}

function cleanFieldOptions(schemaFields: FlowForgeWorkflowValueSchemaField[]): CleanFieldOption[] {
  return schemaFields.map((field) => ({
    value: field.key,
    label: field.label || titleCase(field.key.replace(/^values\./, "")),
    type: field.type,
  }));
}

function defaultSchemaField(index: number): FlowForgeWorkflowValueSchemaField {
  return {
    key: `values.custom.field_${index + 1}`,
    label: `Custom Field ${index + 1}`,
    type: "text",
    required: false,
    sensitive: false,
    source_paths: [],
    transform: "copy",
    separator: " ",
    template: "",
    expose_to_templates: true,
  };
}

function rowFromSchemaField(field: FlowForgeWorkflowValueSchemaField): MapTransformRow {
  const sources = splitSources(field.source_paths);
  return {
    id: `${field.key}-${Date.now()}`,
    target: field.key,
    source: sources[0] ?? "",
    sources,
    transform: field.transform || (sources.length > 1 ? "concat" : "copy"),
    separator: field.separator || " ",
    template: field.template || "",
    expose: field.expose_to_templates,
  };
}

function patchFromSchemaField(field: FlowForgeWorkflowValueSchemaField): Partial<MapTransformRow> {
  const sources = splitSources(field.source_paths);
  return {
    target: field.key,
    source: sources[0] ?? "",
    sources,
    transform: field.transform || (sources.length > 1 ? "concat" : "copy"),
    separator: field.separator || " ",
    template: field.template || "",
    expose: field.expose_to_templates,
  };
}

function SourceSelect({
  disabled,
  label,
  sourceFieldOptions,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  sourceFieldOptions: IntakeSourceFieldOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={sourceFieldOptions.some((field) => field.value === value) ? value : ""} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
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
  );
}

function SourceComposer({
  editable,
  field,
  index,
  sourceFieldOptions,
  onChange,
}: {
  editable: boolean;
  field: FlowForgeWorkflowValueSchemaField;
  index: number;
  sourceFieldOptions: IntakeSourceFieldOption[];
  onChange: (patch: Partial<FlowForgeWorkflowValueSchemaField>) => void;
}) {
  const sources = splitSources(field.source_paths);
  const transform = field.transform || (sources.length > 1 ? "concat" : "copy");
  const updateSource = (sourceIndex: number, value: string) => {
    const next = (sources.length ? sources : [""]).map((source, index) => (index === sourceIndex ? value : source)).filter(Boolean);
    onChange({ source_paths: next });
  };
  const moveSource = (sourceIndex: number, direction: -1 | 1) => {
    const nextIndex = sourceIndex + direction;
    if (nextIndex < 0 || nextIndex >= sources.length) return;
    const next = sources.slice();
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(nextIndex, 0, moved);
    onChange({ source_paths: next });
  };

  return (
    <div className="ff-map-transform-composer">
      <label>
        Builder
        <select
          value={transform}
          disabled={!editable}
          aria-label={`Schema builder ${index + 1}`}
          onChange={(event) => {
            const nextTransform = event.target.value;
            onChange({
              transform: nextTransform,
              source_paths: sources.length ? sources : sourceFieldOptions[0]?.value ? [sourceFieldOptions[0].value] : [],
              separator: field.separator || " ",
            });
          }}
        >
          <option value="copy">Copy one source</option>
          <option value="concat">Concatenate sources</option>
          <option value="template">Template expression</option>
        </select>
      </label>
      {transform === "template" ? (
        <label className="ff-map-transform-template-field">
          Template
          <input
            value={field.template}
            disabled={!editable}
            placeholder="{{intake.fields.firstName}} {{intake.fields.lastName}}"
            aria-label={`Schema template ${index + 1}`}
            onChange={(event) => onChange({ template: event.target.value })}
          />
        </label>
      ) : (
        <div className="ff-map-transform-source-list">
          {(sources.length ? sources : [""]).map((source, sourceIndex) => (
            <div className="ff-map-transform-source-item" key={`${field.key}-schema-source-${sourceIndex}`}>
              <SourceSelect
                disabled={!editable || !sourceFieldOptions.length}
                label={transform === "concat" ? `Source ${sourceIndex + 1}` : "Source"}
                sourceFieldOptions={sourceFieldOptions}
                value={source}
                onChange={(value) => updateSource(sourceIndex, value)}
              />
              {transform === "concat" && editable ? (
                <div className="ff-map-transform-source-actions">
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={sourceIndex === 0} onClick={() => moveSource(sourceIndex, -1)}>
                    Up
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={sourceIndex === sources.length - 1} onClick={() => moveSource(sourceIndex, 1)}>
                    Down
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onChange({ source_paths: sources.filter((_source, index) => index !== sourceIndex) })}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {transform === "concat" ? (
            <div className="ff-map-transform-concat-footer">
              <label>
                Separator
                <input value={field.separator} disabled={!editable} aria-label={`Schema separator ${index + 1}`} onChange={(event) => onChange({ separator: event.target.value })} />
              </label>
              {editable ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    const nextSource = sourceFieldOptions.find((option) => !sources.includes(option.value))?.value ?? sourceFieldOptions[0]?.value ?? "";
                    onChange({ source_paths: nextSource ? [...sources, nextSource] : sources });
                  }}
                >
                  Add source
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function MapTransformBuilder({
  editable,
  node,
  schemaSaving = false,
  sourceFieldOptions = [],
  onChange,
  onDraftSchema,
  onSaveSchema,
}: {
  editable: boolean;
  node: FlowForgeNode;
  schemaSaving?: boolean;
  sourceFieldOptions?: IntakeSourceFieldOption[];
  onChange: (data: Record<string, unknown>) => void;
  onDraftSchema?: () => Promise<FlowForgeWorkflowValueSchemaField[] | undefined>;
  onSaveSchema?: (fields: FlowForgeWorkflowValueSchemaField[]) => void;
}) {
  const rows = mapTransformRows(node.data);
  const [schemaDraft, setSchemaDraft] = useState<FlowForgeWorkflowValueSchemaField[]>([]);
  const [schemaDrafting, setSchemaDrafting] = useState(false);
  const targetOptions = useMemo(() => cleanFieldOptions(schemaDraft), [schemaDraft]);

  useEffect(() => {
    setSchemaDraft([]);
  }, [node.id]);

  const commitRows = (nextRows: MapTransformRow[]) => {
    const cleanedRows = nextRows
      .map((row) => {
        const base = {
          target: row.target.trim(),
          expose_to_templates: row.expose,
        };
        if (row.transform === "concat") {
          return {
            ...base,
            transform: "concat",
            sources: row.sources.map((source) => source.trim()).filter(Boolean),
            separator: row.separator,
          };
        }
        if (row.transform === "template") {
          return {
            ...base,
            transform: "template",
            template: row.template.trim(),
          };
        }
        return {
          ...base,
          source: row.source.trim(),
        };
      })
      .filter((row) => row.target && ("source" in row ? row.source : "sources" in row ? row.sources.length : row.template));
    const templateFields = cleanedRows
      .filter((row) => row.expose_to_templates && (row.target.startsWith("values.") || row.target.startsWith("intake.")))
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
    const nextSchemaField = schemaDraft.find((field) => !existingTargets.has(field.key));
    if (!nextSchemaField) return;
    commitRows([...rows, rowFromSchemaField(nextSchemaField)]);
  };
  const updateSchemaField = (index: number, patch: Partial<FlowForgeWorkflowValueSchemaField>) => {
    setSchemaDraft((current) => current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  };
  const schemaFieldByKey = useMemo(() => new Map(schemaDraft.map((field) => [field.key, field])), [schemaDraft]);
  const handleDraftSchema = async () => {
    if (!onDraftSchema) return;
    setSchemaDrafting(true);
    try {
      const fields = await onDraftSchema();
      setSchemaDraft(fields ?? []);
    } finally {
      setSchemaDrafting(false);
    }
  };

  return (
    <div className="ff-field-group ff-map-transform-builder">
      <div>
        <div className="ff-field-label">Workflow Value Mapper</div>
        <span className="ff-field-helper">
          Map source fields into governed workflow values. A source can feed multiple clean fields, and concat/template utilities can combine source values.
        </span>
      </div>
      <div className="ff-map-transform-schema">
        <div className="ff-field-label">Workflow value schema</div>
        <div className="ff-map-transform-actions">
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!editable || schemaSaving || schemaDrafting || !onDraftSchema} onClick={handleDraftSchema}>
            Generate from source fields
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={!editable || schemaSaving || schemaDrafting}
            onClick={() => setSchemaDraft((current) => [...current, defaultSchemaField(current.length)])}
          >
            Add schema field
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!editable || schemaSaving || schemaDrafting || !onSaveSchema} onClick={() => onSaveSchema?.(schemaDraft)}>
            Save schema
          </button>
        </div>
        {schemaDraft.map((field, index) => (
          <div className="ff-map-transform-schema-row" key={`${field.key}-${index}`}>
            <div className="ff-map-transform-schema-meta">
              <input value={field.label} disabled={!editable} aria-label={`Schema label ${index + 1}`} onChange={(event) => updateSchemaField(index, { label: event.target.value })} />
              <input value={field.key} disabled={!editable} aria-label={`Schema key ${index + 1}`} onChange={(event) => updateSchemaField(index, { key: event.target.value })} />
              <select value={field.type} disabled={!editable} aria-label={`Schema type ${index + 1}`} onChange={(event) => updateSchemaField(index, { type: event.target.value })}>
                {["text", "number", "boolean", "date", "datetime", "email", "phone", "json", "unknown"].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <SourceComposer
              editable={editable}
              field={field}
              index={index}
              sourceFieldOptions={sourceFieldOptions}
              onChange={(patch) => updateSchemaField(index, patch)}
            />
            <div className="ff-map-transform-schema-flags">
              <label className="ff-map-template-toggle">
                <input type="checkbox" checked={field.required} disabled={!editable} onChange={(event) => updateSchemaField(index, { required: event.target.checked })} />
                <span>Required</span>
              </label>
              <label className="ff-map-template-toggle">
                <input type="checkbox" checked={field.sensitive} disabled={!editable} onChange={(event) => updateSchemaField(index, { sensitive: event.target.checked })} />
                <span>Sensitive</span>
              </label>
              <label className="ff-map-template-toggle">
                <input type="checkbox" checked={field.expose_to_templates} disabled={!editable} onChange={(event) => updateSchemaField(index, { expose_to_templates: event.target.checked })} />
                <span>Email field</span>
              </label>
              {editable ? (
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSchemaDraft((current) => current.filter((_field, fieldIndex) => fieldIndex !== index))}>
                  Remove schema field
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {!schemaDraft.length ? <div className="ff-policy-field-gate">No workflow value schema yet. Generate one from the trigger source fields.</div> : null}
      </div>
      <div className="ff-map-transform-rows">
        {rows.map((row, index) => (
          <div className="ff-map-transform-row" key={row.id}>
            <label>
              Clean field
              <select
                value={row.target}
                disabled={!editable}
                onChange={(event) => {
                  const schemaField = schemaFieldByKey.get(event.target.value);
                  updateRow(index, schemaField ? patchFromSchemaField(schemaField) : { target: event.target.value });
                }}
              >
                <option value="">{targetOptions.length ? "Select schema field" : "No schema fields"}</option>
                {targetOptions.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                    {field.type ? ` (${field.type})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Utility
              <select value={row.transform || "copy"} disabled={!editable} onChange={(event) => updateRow(index, { transform: event.target.value })}>
                <option value="copy">Copy source value</option>
                <option value="concat">Concatenate sources</option>
                <option value="template">Template expression</option>
              </select>
            </label>
            {row.transform === "concat" ? (
              <div className="ff-map-transform-sources">
                {row.sources.map((source, sourceIndex) => (
                  <SourceSelect
                    key={`${row.id}-source-${sourceIndex}`}
                    disabled={!editable || !sourceFieldOptions.length}
                    label={`Source ${sourceIndex + 1}`}
                    sourceFieldOptions={sourceFieldOptions}
                    value={source}
                    onChange={(value) => updateRow(index, { sources: row.sources.map((item, itemIndex) => (itemIndex === sourceIndex ? value : item)) })}
                  />
                ))}
                <label>
                  Separator
                  <input value={row.separator} disabled={!editable} onChange={(event) => updateRow(index, { separator: event.target.value })} />
                </label>
                {editable ? (
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => updateRow(index, { sources: [...row.sources, ""] })}>
                    Add source
                  </button>
                ) : null}
              </div>
            ) : row.transform === "template" ? (
              <label>
                Template
                <input value={row.template} disabled={!editable} placeholder="{{intake.fields.firstName}} {{intake.fields.lastName}}" onChange={(event) => updateRow(index, { template: event.target.value })} />
              </label>
            ) : (
              <SourceSelect
                disabled={!editable || !sourceFieldOptions.length}
                label="Source"
                sourceFieldOptions={sourceFieldOptions}
                value={row.source}
                onChange={(value) => updateRow(index, { source: value, sources: [value] })}
              />
            )}
            <label className="ff-map-template-toggle">
              <input type="checkbox" checked={row.expose} disabled={!editable} onChange={(event) => updateRow(index, { expose: event.target.checked })} />
              <span>Email field</span>
            </label>
            {editable ? (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => commitRows(rows.filter((_row, rowIndex) => rowIndex !== index))}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {!rows.length ? <div className="ff-policy-field-gate">No workflow values mapped yet.</div> : null}
      </div>
      {editable ? (
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!targetOptions.length} onClick={addRow}>
          Add mapping
        </button>
      ) : null}
      {!sourceFieldOptions.length ? <span className="ff-field-helper">Select an intake integration with source fields before mapping workflow data.</span> : null}
    </div>
  );
}
