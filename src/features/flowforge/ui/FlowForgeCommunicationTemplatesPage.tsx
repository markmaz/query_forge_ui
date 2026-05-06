import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import {
  activateFlowForgeCommunicationTemplate,
  createFlowForgeCommunicationTemplateAIDraft,
  createFlowForgeCommunicationTemplate,
  listFlowForgeCommunicationTemplates,
  updateFlowForgeCommunicationTemplate,
  validateFlowForgeCommunicationTemplate,
} from "../api/communicationTemplatesApi";
import { listFlowForgeResourceRecords, listFlowForgeResourceSets } from "../api/adminApi";
import type {
  FlowForgeCommunicationTemplateAction,
  FlowForgeCommunicationTemplateAIDraft,
  FlowForgeCommunicationTemplate,
  FlowForgeCommunicationTemplateBlock,
  FlowForgeCommunicationTemplateBlockType,
  FlowForgeCommunicationTemplatePurpose,
  FlowForgeCommunicationTemplateValidation,
} from "../model/communicationTemplateTypes";
import {
  BLOCK_PALETTE,
  PURPOSE_OPTIONS,
  createBlankDraft,
  createBlock,
  draftFromTemplate,
  inferResourceFields,
  labelFor,
  payloadFromDraft,
  recordToPreviewContext,
  renderPreviewBlocks,
  renderText,
  slugifyTemplateKey,
} from "../model/communicationTemplateBuilder";
import type { TemplateDraft } from "../model/communicationTemplateBuilder";
import {
  AIDraftPanel,
  BlockInspector,
  TemplatePreview,
  ValidationSummary,
  blockSummary,
  resourceSetName,
} from "../components/CommunicationTemplateBuilderPanels";
import FlowForgePageHeader from "../components/FlowForgePageHeader";
import StatusBadge from "../components/StatusBadge";
import "./flowforge.css";
import "./flowforgeAdmin.css";

function safeReturnPath(searchParams: URLSearchParams): string | null {
  const value = searchParams.get("return_to");
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function hasCreateTemplateContext(searchParams: URLSearchParams): boolean {
  return searchParams.has("purpose") || searchParams.has("resource_set_id") || searchParams.has("channel");
}

export default function FlowForgeCommunicationTemplatesPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(() => createBlankDraft(searchParams));
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [validation, setValidation] = useState<FlowForgeCommunicationTemplateValidation | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("clear and professional");
  const [aiRequiredActions, setAiRequiredActions] = useState<FlowForgeCommunicationTemplateAction[]>(["open_task"]);
  const [latestAiDraft, setLatestAiDraft] = useState<FlowForgeCommunicationTemplateAIDraft | null>(null);
  const [notice, setNotice] = useState("");
  const returnTo = useMemo(() => safeReturnPath(searchParams), [searchParams]);
  const createTemplateContext = useMemo(() => hasCreateTemplateContext(searchParams), [searchParams]);

  const templatesQuery = useQuery({
    queryKey: ["flowforge", "communication-templates"],
    queryFn: () => listFlowForgeCommunicationTemplates(),
  });
  const resourceSetsQuery = useQuery({
    queryKey: ["flowforge", "resource-sets"],
    queryFn: listFlowForgeResourceSets,
  });

  const selectedResourceSetId = draft.resource_set_id ? Number(draft.resource_set_id) : null;
  const recordsQuery = useQuery({
    queryKey: ["flowforge", "resource-records", selectedResourceSetId],
    queryFn: () => listFlowForgeResourceRecords(selectedResourceSetId ?? 0, { limit: 25, offset: 0 }),
    enabled: Boolean(selectedResourceSetId),
  });

  const selectedTemplate = useMemo(
    () => templatesQuery.data?.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templatesQuery.data],
  );
  const resourceSets = resourceSetsQuery.data ?? [];
  const sampleRecords = recordsQuery.data?.records ?? [];
  const previewContext = useMemo(() => recordToPreviewContext(sampleRecords[0]), [sampleRecords]);
  const mergeFields = useMemo(() => inferResourceFields(sampleRecords), [sampleRecords]);
  const preview = useMemo(
    () => ({
      subject: renderText(draft.subject, previewContext),
      blocks: renderPreviewBlocks(draft.body_blocks, previewContext),
    }),
    [draft.body_blocks, draft.subject, previewContext],
  );

  useEffect(() => {
    if (!createTemplateContext && !selectedTemplateId && templatesQuery.data?.length) {
      setSelectedTemplateId(templatesQuery.data[0].id);
      setDraft(draftFromTemplate(templatesQuery.data[0]));
      setSelectedBlockIndex(0);
      setValidation(null);
    }
  }, [createTemplateContext, selectedTemplateId, templatesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      selectedTemplateId
        ? updateFlowForgeCommunicationTemplate(selectedTemplateId, payloadFromDraft(draft))
        : createFlowForgeCommunicationTemplate(payloadFromDraft(draft)),
    onSuccess: async (template) => {
      setSelectedTemplateId(template.id);
      setDraft(draftFromTemplate(template));
      setNotice("Template saved.");
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "communication-templates"] });
    },
  });

  const validateMutation = useMutation({
    mutationFn: (templateId: number) => validateFlowForgeCommunicationTemplate(templateId, { preview_context: previewContext }),
    onSuccess: (result) => {
      setValidation(result);
      setNotice(result.valid ? "Template validated." : "Template needs changes.");
    },
  });

  const activateMutation = useMutation({
    mutationFn: (templateId: number) => activateFlowForgeCommunicationTemplate(templateId),
    onSuccess: async (template) => {
      setDraft(draftFromTemplate(template));
      setNotice("Template activated.");
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "communication-templates"] });
    },
  });

  const aiDraftMutation = useMutation({
    mutationFn: () =>
      createFlowForgeCommunicationTemplateAIDraft({
        prompt: aiPrompt,
        purpose: draft.purpose,
        channel: draft.channel,
        resource_set_id: selectedResourceSetId,
        required_actions: aiRequiredActions,
        tone: aiTone,
        use_llm: true,
      }),
    onSuccess: (generated) => {
      setLatestAiDraft(generated);
      setNotice("AI draft generated.");
    },
  });

  const updateDraft = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setValidation(null);
  };

  const updateSelectedBlock = (block: FlowForgeCommunicationTemplateBlock) => {
    setDraft((current) => ({
      ...current,
      body_blocks: current.body_blocks.map((entry, index) => (index === selectedBlockIndex ? block : entry)),
    }));
    setValidation(null);
  };

  const selectedBlock = draft.body_blocks[selectedBlockIndex];
  const currentError = saveMutation.error || validateMutation.error || activateMutation.error || aiDraftMutation.error;
  const canSave = draft.display_name.trim().length > 0 && draft.template_key.trim().length > 0 && draft.subject.trim().length > 0;

  const startNewTemplate = () => {
    setSelectedTemplateId(null);
    setDraft(createBlankDraft(searchParams));
    setSelectedBlockIndex(0);
    setValidation(null);
    setNotice("");
  };

  const chooseTemplate = (template: FlowForgeCommunicationTemplate) => {
    setSelectedTemplateId(template.id);
    setDraft(draftFromTemplate(template));
    setSelectedBlockIndex(0);
    setValidation(null);
    setNotice("");
  };

  const addBlock = (type: FlowForgeCommunicationTemplateBlockType) => {
    const block = createBlock(type, mergeFields[0] ?? "resource.display_name");
    setDraft((current) => ({ ...current, body_blocks: [...current.body_blocks, block] }));
    setSelectedBlockIndex(draft.body_blocks.length);
    setValidation(null);
  };

  const moveBlock = (direction: -1 | 1) => {
    const nextIndex = selectedBlockIndex + direction;
    if (nextIndex < 0 || nextIndex >= draft.body_blocks.length) return;
    setDraft((current) => {
      const blocks = [...current.body_blocks];
      const [block] = blocks.splice(selectedBlockIndex, 1);
      blocks.splice(nextIndex, 0, block);
      return { ...current, body_blocks: blocks };
    });
    setSelectedBlockIndex(nextIndex);
    setValidation(null);
  };

  const deleteBlock = () => {
    if (draft.body_blocks.length <= 1) return;
    setDraft((current) => ({
      ...current,
      body_blocks: current.body_blocks.filter((_block, index) => index !== selectedBlockIndex),
    }));
    setSelectedBlockIndex(Math.max(0, selectedBlockIndex - 1));
    setValidation(null);
  };

  const insertMergeField = (field: string) => {
    if (!selectedBlock) {
      updateDraft("subject", `${draft.subject} {{${field}}}`);
      return;
    }
    if (selectedBlock.type === "heading" || selectedBlock.type === "text") {
      updateSelectedBlock({ ...selectedBlock, content: `${selectedBlock.content} {{${field}}}` });
    } else if (selectedBlock.type === "field_value") {
      updateSelectedBlock({ ...selectedBlock, field, label: labelFor(field.split(".").at(-1) || "Value") });
    } else if (selectedBlock.type === "field_list") {
      updateSelectedBlock({ ...selectedBlock, fields: Array.from(new Set([...selectedBlock.fields, field])) });
    } else {
      updateDraft("subject", `${draft.subject} {{${field}}}`);
    }
  };

  const toggleAiAction = (action: FlowForgeCommunicationTemplateAction) => {
    setAiRequiredActions((current) => (current.includes(action) ? current.filter((entry) => entry !== action) : [...current, action]));
  };

  const applyAiDraft = () => {
    if (!latestAiDraft) return;
    setDraft((current) => ({
      ...current,
      subject: latestAiDraft.subject,
      body_blocks: latestAiDraft.body_blocks,
      purpose: latestAiDraft.purpose,
      channel: latestAiDraft.channel,
      resource_set_id: latestAiDraft.resource_set_id ? String(latestAiDraft.resource_set_id) : current.resource_set_id,
      metadata: {
        ...current.metadata,
        ai_draft: {
          draft_id: latestAiDraft.id,
          prompt: latestAiDraft.prompt,
          tone: latestAiDraft.tone,
          model_provider: latestAiDraft.model_provider,
          model_name: latestAiDraft.model_name,
          draft_source: latestAiDraft.draft_source,
          applied_at: new Date().toISOString(),
        },
      },
    }));
    setSelectedBlockIndex(0);
    setValidation(null);
    setNotice("AI draft applied. Save the template to persist it.");
  };

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Communication Templates"
        description="Create reusable FlowForge email templates from governed blocks and resource-pool merge fields."
        actions={
          <>
            {returnTo ? (
              <Link className="btn btn-outline-secondary" to={returnTo}>
                <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Return to Designer
              </Link>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={startNewTemplate}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> New Template
            </button>
          </>
        }
      />

      <section className="ff-template-builder" aria-label="Communication template builder">
        <aside className="ff-template-rail" aria-label="Saved communication templates">
          <div className="ff-card-heading">
            <div>
              <span>Templates</span>
              <strong>{templatesQuery.data?.length ?? 0} saved</strong>
            </div>
          </div>
          <div className="ff-template-list">
            {templatesQuery.isLoading ? <p className="ff-empty-state">Loading templates...</p> : null}
            {(templatesQuery.data ?? []).map((template) => (
              <button
                type="button"
                key={template.id}
                className={`ff-template-list-item ${template.id === selectedTemplateId ? "is-selected" : ""}`}
                onClick={() => chooseTemplate(template)}
              >
                <strong>{template.display_name}</strong>
                <span>{template.template_key}</span>
                <span className="ff-template-list-meta">
                  {labelFor(template.purpose)}
                  <StatusBadge status={template.status} />
                </span>
              </button>
            ))}
            {!templatesQuery.isLoading && !(templatesQuery.data ?? []).length ? (
              <p className="ff-empty-state">No templates yet. Create the first workspace template.</p>
            ) : null}
          </div>
        </aside>

        <section className="ff-template-editor" aria-label="Template editor">
          <div className="ff-runtime-card">
            <div className="ff-card-heading">
              <div>
                <span>{selectedTemplate ? "Editing Template" : "New Template"}</span>
                <strong>{draft.display_name || "Untitled communication template"}</strong>
              </div>
              <StatusBadge status={draft.status} />
            </div>

            <div className="ff-template-form-grid">
              <label>
                Display Name
                <input
                  value={draft.display_name}
                  onChange={(event) => {
                    const displayName = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      display_name: displayName,
                      template_key:
                        selectedTemplateId || current.template_key !== "" ? current.template_key : slugifyTemplateKey(displayName) || current.template_key,
                    }));
                  }}
                />
              </label>
              <label>
                Template Key
                <input value={draft.template_key} onChange={(event) => updateDraft("template_key", slugifyTemplateKey(event.target.value))} />
              </label>
              <label className="ff-template-span-2">
                Description
                <textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} rows={2} />
              </label>
              <label className="ff-template-span-2">
                Subject
                <input value={draft.subject} onChange={(event) => updateDraft("subject", event.target.value)} />
              </label>
            </div>
          </div>

          <div className="ff-runtime-card">
            <div className="ff-card-heading">
              <div>
                <span>Block Palette</span>
                <strong>Structured content</strong>
              </div>
            </div>
            <div className="ff-template-palette" aria-label="Block palette">
              {BLOCK_PALETTE.map((item) => (
                <button type="button" key={item.type} className="btn btn-outline-secondary" onClick={() => addBlock(item.type)}>
                  <i className={`fa-solid ${item.icon}`} aria-hidden="true" /> {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ff-template-canvas" aria-label="Template body canvas">
            {draft.body_blocks.map((block, index) => (
              <button
                type="button"
                key={`${block.type}-${index}`}
                className={`ff-template-block ${index === selectedBlockIndex ? "is-selected" : ""}`}
                onClick={() => setSelectedBlockIndex(index)}
              >
                <span>{labelFor(block.type)}</span>
                <strong>{blockSummary(block)}</strong>
              </button>
            ))}
          </div>
        </section>

        <aside className="ff-template-inspector" aria-label="Template inspector">
          <div className="ff-runtime-card ff-admin-form">
            <div className="ff-card-heading">
              <div>
                <span>Settings</span>
                <strong>Compatibility</strong>
              </div>
            </div>
            <label>
              Purpose
              <select
                value={draft.purpose}
                onChange={(event) => {
                  const purpose = event.target.value as FlowForgeCommunicationTemplatePurpose;
                  updateDraft("purpose", purpose);
                }}
              >
                {PURPOSE_OPTIONS.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {labelFor(purpose)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Channel
              <select value={draft.channel} onChange={(event) => updateDraft("channel", event.target.value as "email")}>
                <option value="email">Email</option>
              </select>
            </label>
            <label>
              Resource Pool
              <select value={draft.resource_set_id} onChange={(event) => updateDraft("resource_set_id", event.target.value)}>
                <option value="">Generic template</option>
                {resourceSets.map((resourceSet) => (
                  <option key={resourceSet.id} value={resourceSet.id}>
                    {resourceSet.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as TemplateDraft["status"])}>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <div className="ff-runtime-card ff-admin-form">
            <div className="ff-card-heading">
              <div>
                <span>Selected Block</span>
                <strong>{selectedBlock ? labelFor(selectedBlock.type) : "None"}</strong>
              </div>
              <div className="ff-template-icon-row">
                <button type="button" className="btn btn-outline-secondary" aria-label="Move block up" onClick={() => moveBlock(-1)}>
                  <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-outline-secondary" aria-label="Move block down" onClick={() => moveBlock(1)}>
                  <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-outline-danger" aria-label="Delete block" onClick={deleteBlock}>
                  <i className="fa-solid fa-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
            {selectedBlock ? (
              <BlockInspector block={selectedBlock} mergeFields={mergeFields} onChange={updateSelectedBlock} />
            ) : (
              <p className="ff-empty-state">Select a block to edit its settings.</p>
            )}
          </div>

          <div className="ff-runtime-card">
            <div className="ff-card-heading">
              <div>
                <span>Merge Fields</span>
                <strong>{selectedResourceSetId ? resourceSetName(resourceSets, selectedResourceSetId) : "Runtime fields"}</strong>
              </div>
            </div>
            <div className="ff-template-field-list">
              {mergeFields.map((field) => (
                <button type="button" key={field} onClick={() => insertMergeField(field)}>
                  {field}
                </button>
              ))}
            </div>
          </div>

          <AIDraftPanel
            prompt={aiPrompt}
            tone={aiTone}
            requiredActions={aiRequiredActions}
            latestDraft={latestAiDraft}
            isGenerating={aiDraftMutation.isPending}
            onPromptChange={setAiPrompt}
            onToneChange={setAiTone}
            onToggleAction={toggleAiAction}
            onGenerate={() => aiDraftMutation.mutate()}
            onApply={applyAiDraft}
          />

          <div className="ff-runtime-card">
            <div className="ff-card-heading">
              <div>
                <span>Preview</span>
                <strong>{preview.subject || "No subject"}</strong>
              </div>
            </div>
            <TemplatePreview subject={preview.subject} blocks={preview.blocks} />
          </div>

          <div className="ff-runtime-card ff-admin-form">
            <div className="ff-template-actions">
              <button type="button" className="btn btn-primary" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Save
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={!selectedTemplateId || validateMutation.isPending}
                onClick={() => selectedTemplateId && validateMutation.mutate(selectedTemplateId)}
              >
                <i className="fa-solid fa-check" aria-hidden="true" /> Validate
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={!selectedTemplateId || draft.status === "active" || activateMutation.isPending}
                onClick={() => selectedTemplateId && activateMutation.mutate(selectedTemplateId)}
              >
                <i className="fa-solid fa-circle-check" aria-hidden="true" /> Activate
              </button>
              {returnTo ? (
                <Link className="btn btn-outline-secondary" to={returnTo}>
                  <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Return
                </Link>
              ) : null}
            </div>
            {notice ? <p className="ff-empty-state">{notice}</p> : null}
            {currentError ? <p className="ff-template-error">{currentError instanceof Error ? currentError.message : "Template action failed."}</p> : null}
            {validation ? <ValidationSummary validation={validation} /> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
