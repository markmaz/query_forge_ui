import type { ChangeEvent } from "react";

import type { FlowForgeResourceSet } from "../model/adminTypes";
import type {
  FlowForgeCommunicationTemplateAction,
  FlowForgeCommunicationTemplateBlock,
  FlowForgeCommunicationTemplateValidation,
} from "../model/communicationTemplateTypes";
import { ACTION_OPTIONS, labelFor } from "../model/communicationTemplateBuilder";
import type { PreviewBlock } from "../model/communicationTemplateBuilder";

export function BlockInspector({
  block,
  mergeFields,
  onChange,
}: {
  block: FlowForgeCommunicationTemplateBlock;
  mergeFields: string[];
  onChange: (block: FlowForgeCommunicationTemplateBlock) => void;
}) {
  if (block.type === "heading" || block.type === "text") {
    return (
      <label>
        Content
        <textarea value={block.content} rows={block.type === "heading" ? 2 : 4} onChange={(event) => onChange({ ...block, content: event.target.value })} />
      </label>
    );
  }
  if (block.type === "field_value") {
    return (
      <>
        <label>
          Label
          <input value={block.label ?? ""} onChange={(event) => onChange({ ...block, label: event.target.value })} />
        </label>
        <label>
          Field
          <select value={block.field} onChange={(event) => onChange({ ...block, field: event.target.value })}>
            {mergeFields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }
  if (block.type === "field_list") {
    return (
      <div className="ff-admin-form">
        {block.fields.map((field, index) => (
          <label key={`${field}-${index}`}>
            Field {index + 1}
            <select
              value={field}
              onChange={(event) => {
                const fields = block.fields.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry));
                onChange({ ...block, fields });
              }}
            >
              {mergeFields.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => onChange({ ...block, fields: [...block.fields, mergeFields[0] ?? "resource.display_name"] })}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Add Field
        </button>
      </div>
    );
  }
  if (block.type === "action_buttons") {
    const onActionChange = (action: FlowForgeCommunicationTemplateAction, event: ChangeEvent<HTMLInputElement>) => {
      const actions = event.target.checked ? Array.from(new Set([...block.actions, action])) : block.actions.filter((entry) => entry !== action);
      onChange({ ...block, actions });
    };
    return (
      <div className="ff-template-action-checks">
        {ACTION_OPTIONS.map((action) => (
          <label key={action}>
            <input type="checkbox" checked={block.actions.includes(action)} onChange={(event) => onActionChange(action, event)} />
            {labelFor(action)}
          </label>
        ))}
      </div>
    );
  }
  return <p className="ff-empty-state">Divider blocks do not need configuration.</p>;
}

export function TemplatePreview({ subject, blocks }: { subject: string; blocks: PreviewBlock[] }) {
  return (
    <div className="ff-template-preview">
      <div className="ff-template-preview-subject">{subject}</div>
      <div className="ff-template-preview-body">
        {blocks.map((block, index) => {
          if (block.type === "heading") return <h2 key={index}>{block.content}</h2>;
          if (block.type === "text") return <p key={index}>{block.content}</p>;
          if (block.type === "field_value") {
            return (
              <p key={index}>
                <strong>{block.label}:</strong> {block.value}
              </p>
            );
          }
          if (block.type === "field_list") {
            return (
              <ul key={index}>
                {block.items.map((item) => (
                  <li key={item.field}>
                    <strong>{item.field}:</strong> {item.value}
                  </li>
                ))}
              </ul>
            );
          }
          if (block.type === "action_buttons") {
            return (
              <div className="ff-template-preview-actions" key={index}>
                {block.actions.map((action) => (
                  <span key={action}>{labelFor(action)}</span>
                ))}
              </div>
            );
          }
          return <hr key={index} />;
        })}
      </div>
    </div>
  );
}

export function ValidationSummary({ validation }: { validation: FlowForgeCommunicationTemplateValidation }) {
  return (
    <div className={`ff-template-validation ${validation.valid ? "is-valid" : "is-invalid"}`}>
      <strong>{validation.valid ? "Valid template" : "Validation issues"}</strong>
      {validation.errors.length ? (
        <ul>
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {validation.warnings.length ? (
        <ul>
          {validation.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function blockSummary(block: FlowForgeCommunicationTemplateBlock) {
  if (block.type === "heading" || block.type === "text") return block.content || "Empty content";
  if (block.type === "field_value") return block.field || "No field selected";
  if (block.type === "field_list") return block.fields.join(", ") || "No fields selected";
  if (block.type === "action_buttons") return block.actions.map(labelFor).join(", ") || "No actions selected";
  return "Divider";
}

export function resourceSetName(resourceSets: FlowForgeResourceSet[], resourceSetId: number) {
  return resourceSets.find((resourceSet) => resourceSet.id === resourceSetId)?.display_name ?? "Selected pool";
}
