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
  getActionsForPurpose,
  inferResourceFields,
  labelFor,
  payloadFromDraft,
  recordToPreviewContext,
  renderPreviewBlocks,
  renderText,
  sanitizeActionsForPurpose,
  sanitizeBlocksForPurpose,
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

function TemplateCardMenu({
  archivePending,
  onArchive,
  onOpen,
}: {
  archivePending: boolean;
  onArchive: () => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-workflow-card-menu">
      <button
        type="button"
        className="ff-workflow-card-menu-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        title="Template options"
        aria-label="Template options"
      >
        <i className="fa fa-ellipsis-v" aria-hidden="true" />
      </button>
      {open ? (
        <div className="ff-workflow-menu-popover" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            Open template
          </button>
          <div className="ff-workflow-menu-divider" />
          <button
            type="button"
            disabled={archivePending}
            onClick={() => {
              setOpen(false);
              onArchive();
            }}
          >
            Archive template
          </button>
        </div>
      ) : null}
      {open ? <div className="ff-workflow-menu-backdrop" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}

export default function FlowForgeCommunicationTemplatesPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(() => createBlankDraft(searchParams));
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [activeEditorTab, setActiveEditorTab] = useState<"metadata" | "layout">(
    () => (hasCreateTemplateContext(searchParams) ? "metadata" : "layout"),
  );
  const [savedTemplatesOpen, setSavedTemplatesOpen] = useState(true);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [mergeFieldFilter, setMergeFieldFilter] = useState("");
  const [mergeFieldSort, setMergeFieldSort] = useState<"az" | "za">("az");
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
  const allowedActions = useMemo(() => getActionsForPurpose(draft.purpose), [draft.purpose]);
  const sortedMergeFields = useMemo(
    () => [...mergeFields].sort((left, right) => (mergeFieldSort === "az" ? left.localeCompare(right) : right.localeCompare(left))),
    [mergeFieldSort, mergeFields],
  );
  const visibleMergeFields = useMemo(() => {
    const filter = mergeFieldFilter.trim().toLowerCase();
    if (!filter) return sortedMergeFields;
    return sortedMergeFields.filter((field) => field.toLowerCase().includes(filter));
  }, [mergeFieldFilter, sortedMergeFields]);
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
      setActiveEditorTab("layout");
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
  const archiveMutation = useMutation({
    mutationFn: (template: FlowForgeCommunicationTemplate) =>
      updateFlowForgeCommunicationTemplate(template.id, {
        ...payloadFromDraft(draftFromTemplate(template)),
        status: "archived",
      }),
    onSuccess: async (template) => {
      if (selectedTemplateId === template.id) startNewTemplate();
      setNotice("Template archived.");
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

  const updatePurpose = (purpose: FlowForgeCommunicationTemplatePurpose) => {
    setDraft((current) => ({
      ...current,
      purpose,
      body_blocks: sanitizeBlocksForPurpose(current.body_blocks, purpose),
    }));
    setAiRequiredActions((current) => sanitizeActionsForPurpose(current, purpose));
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
  const currentError = saveMutation.error || validateMutation.error || activateMutation.error || aiDraftMutation.error || archiveMutation.error;
  const canSave = draft.display_name.trim().length > 0 && draft.template_key.trim().length > 0 && draft.subject.trim().length > 0;

  const startNewTemplate = () => {
    setSelectedTemplateId(null);
    setDraft(createBlankDraft(searchParams));
    setSelectedBlockIndex(0);
    setValidation(null);
    setActiveEditorTab("metadata");
    setNotice("");
  };

  const chooseTemplate = (template: FlowForgeCommunicationTemplate) => {
    setSelectedTemplateId(template.id);
    setDraft(draftFromTemplate(template));
    setSelectedBlockIndex(0);
    setValidation(null);
    setActiveEditorTab("layout");
    setNotice("");
  };

  const addBlock = (type: FlowForgeCommunicationTemplateBlockType) => {
    const block = createBlock(type, mergeFields[0] ?? "resource.display_name", draft.purpose);
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
    if (!allowedActions.includes(action)) return;
    setAiRequiredActions((current) => {
      const next = current.includes(action) ? current.filter((entry) => entry !== action) : [...current, action];
      return sanitizeActionsForPurpose(next, draft.purpose);
    });
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
  const clearAiDraft = () => {
    setLatestAiDraft(null);
    setNotice("");
  };
  const startNewAiSession = () => {
    setAiPrompt("");
    setLatestAiDraft(null);
    setNotice("");
  };

  return (
    <main className="ff-page">
      <FlowForgePageHeader
        title="Communication Templates"
        description="Create reusable Workflow Studio email templates from governed blocks and resource-pool merge fields."
        actions={
          <>
            {returnTo ? (
              <Link className="btn btn-outline-secondary" to={returnTo}>
                <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Return to Designer
              </Link>
            ) : null}
          </>
        }
      />

      <section
        className={`ff-template-builder ${savedTemplatesOpen ? "is-saved-open" : "is-saved-collapsed"}`}
        aria-label="Communication template builder"
      >
        <div className={`ff-template-left-cluster ${savedTemplatesOpen ? "is-open" : "is-collapsed"}`}>
          <aside className="ncqv2-builder-rail ff-template-saved-rail" aria-label="Communication template tools">
            <div className="ncqv2-rail-top">
              <button type="button" className="btn btn-primary" onClick={startNewTemplate} title="New Template" aria-label="New Template">
                <i className="fa fa-plus" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSave || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                title="Save Template"
                aria-label="Save Template"
              >
                <i className="fa fa-save" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`btn ${savedTemplatesOpen ? "btn-primary" : "btn-outline-secondary"}`}
                title={savedTemplatesOpen ? "Hide Saved Templates" : "Show Saved Templates"}
                aria-label="Saved Templates"
                aria-expanded={savedTemplatesOpen}
                onClick={() => setSavedTemplatesOpen((current) => !current)}
              >
                <i className="fa fa-folder-open" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`btn ${aiDrawerOpen ? "btn-primary" : "btn-outline-secondary"}`}
                title="Workflow AI"
                aria-label="Workflow AI"
                aria-expanded={aiDrawerOpen}
                onClick={() => setAiDrawerOpen(true)}
              >
                <i className="fa fa-wand-magic-sparkles" aria-hidden="true" />
              </button>
            </div>
            <div className="ncqv2-rail-divider" />
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!selectedTemplateId || validateMutation.isPending}
              onClick={() => selectedTemplateId && validateMutation.mutate(selectedTemplateId)}
              title="Validate Template"
              aria-label="Validate Template"
            >
              <i className="fa fa-check" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!selectedTemplateId || draft.status === "active" || activateMutation.isPending}
              onClick={() => selectedTemplateId && activateMutation.mutate(selectedTemplateId)}
              title="Activate Template"
              aria-label="Activate Template"
            >
              <i className="fa fa-circle-check" aria-hidden="true" />
            </button>
          </aside>

          <aside className="ff-template-saved-panel" aria-label="Saved communication templates" aria-hidden={!savedTemplatesOpen}>
            <section className="ff-policy-sidebar-section" aria-labelledby="ff-saved-templates-heading">
              <div className="ff-policy-panel-header">
                <div>
                  <h2 id="ff-saved-templates-heading">Saved Templates</h2>
                  <p className="ff-admin-helper">Open a template, start a new draft, or archive old communication content.</p>
                </div>
              </div>
              {selectedTemplateId === null ? (
                <div className="ff-policy-new-state">
                  <strong>New template draft</strong>
                  <p>Fill out metadata, compose the layout, then save before validation or activation.</p>
                </div>
              ) : null}
              <div className="ff-admin-list">
                {templatesQuery.isLoading ? <p className="ff-empty-state">Loading templates...</p> : null}
                {(templatesQuery.data ?? []).map((template) => (
                  <article key={template.id} className={`ff-admin-card ff-template-card ${template.id === selectedTemplateId ? "is-active" : ""}`}>
                    <button type="button" className="ff-template-card-main" onClick={() => chooseTemplate(template)}>
                      <div>
                        <span className="ff-policy-card-title">{template.display_name}</span>
                        <span className="ff-policy-card-meta">
                          {template.template_key} · {labelFor(template.purpose)}
                          {template.resource_set_id ? ` · resource set ${template.resource_set_id}` : " · generic"}
                        </span>
                      </div>
                      <StatusBadge status={template.status} />
                    </button>
                    <TemplateCardMenu
                      archivePending={archiveMutation.isPending}
                      onArchive={() => archiveMutation.mutate(template)}
                      onOpen={() => chooseTemplate(template)}
                    />
                  </article>
                ))}
                {!templatesQuery.isLoading && !(templatesQuery.data ?? []).length ? (
                  <div className="ff-empty-state">No templates yet. Create the first workspace template.</div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        <main className="ff-runtime-panel ff-template-workspace" aria-label="Template editor">
          <div className="ff-template-workspace-header">
            <div>
              <div className="ff-eyebrow">{selectedTemplate ? "Editing Template" : "New Template"}</div>
              <h2>{draft.display_name || "Untitled communication template"}</h2>
            </div>
            <StatusBadge status={draft.status} />
          </div>

          <div className="ff-inspector-tabs ff-template-editor-tabs" role="tablist" aria-label="Template editor tabs">
            <button
              type="button"
              className={activeEditorTab === "metadata" ? "active" : ""}
              onClick={() => setActiveEditorTab("metadata")}
            >
              Metadata
            </button>
            <button
              type="button"
              className={activeEditorTab === "layout" ? "active" : ""}
              onClick={() => setActiveEditorTab("layout")}
            >
              Layout
            </button>
          </div>

          {activeEditorTab === "metadata" ? (
            <section className="ff-template-tab-panel ff-admin-form" aria-label="Template metadata">
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
                <label>
                  Purpose
                  <select
                    value={draft.purpose}
                    onChange={(event) => {
                      const purpose = event.target.value as FlowForgeCommunicationTemplatePurpose;
                      updatePurpose(purpose);
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
            </section>
          ) : (
            <section className="ff-template-tab-panel ff-admin-form" aria-label="Template layout">
              <div className="ff-template-layout-split">
                <div className="ff-template-builder-column">
                  <label className="ff-template-subject-field">
                    Subject
                    <input value={draft.subject} onChange={(event) => updateDraft("subject", event.target.value)} />
                  </label>
                  <div className="ff-template-layout-grid">
                    <section className="ff-runtime-card">
                      <div className="ff-card-heading">
                        <div>
                          <span>Block Palette</span>
                          <strong>Structured content</strong>
                        </div>
                      </div>
                      <div className="ff-template-palette" aria-label="Block palette">
                        {BLOCK_PALETTE.map((item) => (
                          <button
                            type="button"
                            key={item.type}
                            className="btn btn-outline-secondary"
                            disabled={item.type === "action_buttons" && !allowedActions.length}
                            title={item.type === "action_buttons" && !allowedActions.length ? "This purpose does not support email action buttons" : item.label}
                            onClick={() => addBlock(item.type)}
                          >
                            <i className={`fa-solid ${item.icon}`} aria-hidden="true" /> {item.label}
                          </button>
                        ))}
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

                    <section className="ff-template-layout-tools">
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
                          <div className="ff-template-block-inspector">
                            <BlockInspector allowedActions={allowedActions} block={selectedBlock} mergeFields={sortedMergeFields} onChange={updateSelectedBlock} />
                          </div>
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
                        <div className="ff-template-field-controls">
                          <label>
                            <span className="visually-hidden">Filter merge fields</span>
                            <input
                              value={mergeFieldFilter}
                              onChange={(event) => setMergeFieldFilter(event.target.value)}
                              placeholder="Filter fields"
                              aria-label="Filter merge fields"
                            />
                          </label>
                          <label>
                            <span className="visually-hidden">Sort merge fields</span>
                            <select
                              value={mergeFieldSort}
                              onChange={(event) => setMergeFieldSort(event.target.value as "az" | "za")}
                              aria-label="Sort merge fields"
                            >
                              <option value="az">A-Z</option>
                              <option value="za">Z-A</option>
                            </select>
                          </label>
                        </div>
                        <div className="ff-template-field-list">
                          {visibleMergeFields.map((field) => (
                            <button type="button" key={field} onClick={() => insertMergeField(field)}>
                              {field}
                            </button>
                          ))}
                          {!visibleMergeFields.length ? <p className="ff-empty-state">No fields match that filter.</p> : null}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <aside className="ff-template-preview-panel" aria-label="Template preview">
                  <div className="ff-card-heading">
                    <div>
                      <span>Preview</span>
                      <strong>{preview.subject || "No subject"}</strong>
                    </div>
                  </div>
                  <TemplatePreview subject={preview.subject} blocks={preview.blocks} />
                </aside>
              </div>
            </section>
          )}

          <div className="ff-template-footer-actions">
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
        </main>

        {aiDrawerOpen ? (
          <>
            <button type="button" className="ff-template-ai-backdrop" aria-label="Close Workflow AI" onClick={() => setAiDrawerOpen(false)} />
            <aside className="ff-template-ai-drawer ff-policy-copilot ncqv2-ai-panel" aria-label="Workflow AI template drafting">
              <div className="ncqv2-ai-panel-header">
                <div className="ncqv2-ai-brand">
                  <h2 className="ncqv2-ai-title">
                    <span className="ncqv2-ai-title-query">Workflow</span>{" "}
                    <span className="ncqv2-ai-title-ai">AI</span>
                  </h2>
                </div>
                <button type="button" className="ff-template-ai-close" aria-label="Close Workflow AI" onClick={() => setAiDrawerOpen(false)}>
                  <i className="fa fa-times" aria-hidden="true" />
                </button>
              </div>
              <div className="ncqv2-ai-panel-body">
                <AIDraftPanel
                  allowedActions={allowedActions}
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
                  onClearDraft={clearAiDraft}
                  onNewSession={startNewAiSession}
                />
              </div>
            </aside>
          </>
        ) : null}
      </section>
    </main>
  );
}
