import type { ChangeEvent } from "react";

import type { FlowForgeResourceSet } from "../model/adminTypes";
import type {
  FlowForgeCommunicationTemplateAIDraft,
  FlowForgeCommunicationTemplateAction,
  FlowForgeCommunicationTemplateBlock,
  FlowForgeCommunicationTemplateValidation,
} from "../model/communicationTemplateTypes";
import { normalizeWorkflowStudioCopy, WORKFLOW_AI_LABEL } from "../model/branding";
import { labelFor } from "../model/communicationTemplateBuilder";
import type { PreviewBlock } from "../model/communicationTemplateBuilder";

export function BlockInspector({
  allowedActions,
  block,
  mergeFields,
  onChange,
}: {
  allowedActions: FlowForgeCommunicationTemplateAction[];
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
  if (block.type === "image") {
    return (
      <>
        <label>
          Image URL
          <input value={block.src} placeholder="https://example.com/logo.png" onChange={(event) => onChange({ ...block, src: event.target.value })} />
        </label>
        <label>
          Alt Text
          <input value={block.alt ?? ""} onChange={(event) => onChange({ ...block, alt: event.target.value })} />
        </label>
        <label>
          Width
          <input
            type="number"
            min={48}
            max={640}
            value={block.width ?? 160}
            onChange={(event) => onChange({ ...block, width: event.target.value ? Number(event.target.value) : 160 })}
          />
        </label>
        <label>
          Link URL
          <input value={block.href ?? ""} placeholder="Optional" onChange={(event) => onChange({ ...block, href: event.target.value || undefined })} />
        </label>
      </>
    );
  }
  if (block.type === "action_buttons") {
    const onActionChange = (action: FlowForgeCommunicationTemplateAction, event: ChangeEvent<HTMLInputElement>) => {
      const actions = event.target.checked ? Array.from(new Set([...block.actions, action])) : block.actions.filter((entry) => entry !== action);
      onChange({ ...block, actions });
    };
    return (
      <div className="ff-template-action-checks">
        {allowedActions.map((action) => (
          <label key={action}>
            <input type="checkbox" checked={block.actions.includes(action)} onChange={(event) => onActionChange(action, event)} />
            {labelFor(action)}
          </label>
        ))}
        {!allowedActions.length ? <p className="ff-empty-state">This template purpose does not support email action buttons.</p> : null}
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
          if (block.type === "image") {
            const image = block.src ? (
              <img src={block.src} alt={block.alt} width={block.width ? Number(block.width) : 160} />
            ) : (
              <span className="ff-template-image-placeholder">Image URL required</span>
            );
            return (
              <p className="ff-template-preview-image" key={index}>
                {block.href ? (
                  <a href={block.href} onClick={(event) => event.preventDefault()}>
                    {image}
                  </a>
                ) : (
                  image
                )}
              </p>
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

export function AIDraftPanel({
  allowedActions,
  prompt,
  tone,
  requiredActions,
  latestDraft,
  isGenerating,
  onPromptChange,
  onToneChange,
  onToggleAction,
  onGenerate,
  onApply,
  onClearDraft,
  onNewSession,
}: {
  allowedActions: FlowForgeCommunicationTemplateAction[];
  prompt: string;
  tone: string;
  requiredActions: FlowForgeCommunicationTemplateAction[];
  latestDraft: FlowForgeCommunicationTemplateAIDraft | null;
  isGenerating: boolean;
  onPromptChange: (value: string) => void;
  onToneChange: (value: string) => void;
  onToggleAction: (action: FlowForgeCommunicationTemplateAction) => void;
  onGenerate: () => void;
  onApply: () => void;
  onClearDraft: () => void;
  onNewSession: () => void;
}) {
  const canGenerate = prompt.trim().length > 0 && !isGenerating;

  return (
    <div className="ff-template-ai-draft ff-admin-form">
      <div className="ncqv2-ai-thread" aria-live="polite">
        {!latestDraft && !isGenerating ? (
          <div className="ncqv2-ai-empty-state">
            <div className="small text-muted">Ask Workflow AI to draft reusable communication template content.</div>
          </div>
        ) : null}
      {latestDraft ? (
          <article className="ncqv2-ai-turn">
            <div className="ncqv2-ai-bubble ncqv2-ai-bubble-user">
              <div className="ncqv2-ai-bubble-label">You</div>
              <div className="ncqv2-ai-bubble-text">{latestDraft.prompt}</div>
            </div>
            <div className="ncqv2-ai-bubble ncqv2-ai-bubble-assistant">
              <div className="ncqv2-ai-bubble-label">{WORKFLOW_AI_LABEL}</div>
              <div className="ncqv2-ai-bubble-text">{normalizeWorkflowStudioCopy(latestDraft.plain_language_summary) || "Draft generated."}</div>
              <div className="ff-template-ai-result">
                <p>
                  {latestDraft.model_provider || "generator"}
                  {latestDraft.model_name ? ` / ${latestDraft.model_name}` : ""}
                </p>
                <button type="button" className="btn btn-primary" onClick={onApply}>
                  Apply Draft
                </button>
              </div>
            </div>
          </article>
        ) : null}
        {isGenerating ? (
          <article className="ncqv2-ai-turn">
            {prompt.trim() ? (
              <div className="ncqv2-ai-bubble ncqv2-ai-bubble-user">
                <div className="ncqv2-ai-bubble-label">You</div>
                <div className="ncqv2-ai-bubble-text">{prompt}</div>
              </div>
            ) : null}
            <div className="ncqv2-ai-bubble ncqv2-ai-bubble-assistant ncqv2-ai-thinking-bubble" aria-label="Thinking">
              <span className="ncqv2-ai-thinking-word">Thinking</span>
              <span className="ncqv2-ai-thinking-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          </article>
        ) : null}
      </div>

      <div className="ff-template-ai-options">
        <label>
          Tone
          <select value={tone} onChange={(event) => onToneChange(event.target.value)}>
            <option value="clear and professional">Clear and professional</option>
            <option value="warm and concise">Warm and concise</option>
            <option value="direct and operational">Direct and operational</option>
            <option value="formal">Formal</option>
          </select>
        </label>
        <div className="ff-template-action-checks" aria-label="AI draft required actions">
          {allowedActions.map((action) => (
            <label key={action}>
              <input type="checkbox" checked={requiredActions.includes(action)} onChange={() => onToggleAction(action)} />
              {labelFor(action)}
            </label>
          ))}
          {!allowedActions.length ? <p className="ff-empty-state">This template purpose does not support email action buttons.</p> : null}
        </div>
      </div>

      <div className="ncqv2-ai-composer">
        <form
          className="ncqv2-ai-goal"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canGenerate) return;
            onGenerate();
          }}
        >
          <label htmlFor="flowforge-template-ai-prompt" className="visually-hidden">
            Prompt
          </label>
          <div className="ncqv2-ai-goal-box">
            <textarea
              id="flowforge-template-ai-prompt"
              className="form-control ncqv2-ai-goal-input"
              value={prompt}
              rows={3}
              onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                event.preventDefault();
                if (!canGenerate) return;
                onGenerate();
              }}
              placeholder="Ask Workflow AI to draft or refine this template"
            />
            <div className="ncqv2-ai-composer-tools">
              <button
                type="button"
                className="btn btn-sm ncqv2-ai-tool-btn"
                onClick={onClearDraft}
                disabled={isGenerating || !latestDraft}
                aria-label="Clear chat"
                title="Clear chat"
                data-tooltip="Clear chat"
              >
                <i className="fa fa-trash" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-sm ncqv2-ai-tool-btn"
                onClick={onNewSession}
                disabled={isGenerating}
                aria-label="New session"
                title="Start a new drafting session"
                data-tooltip="New session"
              >
                <i className="fa fa-rotate-right" aria-hidden="true" />
              </button>
            </div>
            <button type="submit" className="ncqv2-ai-send-btn" disabled={!canGenerate} aria-label="Generate Draft" title="Generate Draft">
              <i className="fa fa-arrow-up" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function blockSummary(block: FlowForgeCommunicationTemplateBlock) {
  if (block.type === "heading" || block.type === "text") return block.content || "Empty content";
  if (block.type === "field_value") return block.field || "No field selected";
  if (block.type === "field_list") return block.fields.join(", ") || "No fields selected";
  if (block.type === "image") return block.src || "No image URL";
  if (block.type === "action_buttons") return block.actions.map(labelFor).join(", ") || "No actions selected";
  return "Divider";
}

export function resourceSetName(resourceSets: FlowForgeResourceSet[], resourceSetId: number) {
  return resourceSets.find((resourceSet) => resourceSet.id === resourceSetId)?.display_name ?? "Selected pool";
}
