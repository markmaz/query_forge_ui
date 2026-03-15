import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { createDefaultAction, createDefaultCondition, createDefaultTrigger, SKILL_TYPE_LABELS } from "../constants";
import { useSkillBuilder } from "../hooks";
import type { QueryOption, Skill, SkillRun, SkillTemplate } from "../types";
import "../styles/skills.css";
import SkillBlockConfigPanel from "./SkillBlockConfigPanel";
import SkillRunsPanel from "./SkillRunsPanel";
import SkillStatusBadge from "./SkillStatusBadge";
import SkillSummaryPreview from "./SkillSummaryPreview";
import SkillTemplatePicker from "./SkillTemplatePicker";
import SkillWorkflowBuilder from "./SkillWorkflowBuilder";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  skill: Skill | null;
  queryContext?: { queryId?: string | null; queryName?: string | null };
  queryOptions: QueryOption[];
  templates: SkillTemplate[];
  runs: SkillRun[];
  runsLoading?: boolean;
  saving?: boolean;
  deleting?: boolean;
  testing?: boolean;
  initialTab?: "builder" | "runs";
  defaultTemplateId?: string | null;
  onClose: () => void;
  onSaveDraft: (payload: ReturnType<typeof useSkillBuilder>["savePayload"]) => Promise<void>;
  onSaveSkill: (payload: ReturnType<typeof useSkillBuilder>["savePayload"]) => Promise<void>;
  onDelete?: (skill: Skill) => Promise<void>;
  onTest?: (skill: Skill) => Promise<void>;
  onStatusChange?: (skill: Skill, status: Skill["status"]) => Promise<void>;
};

function skillToTemplate(skill: SkillTemplate): ReturnType<typeof useSkillBuilder>["draft"] {
  return {
    name: skill.name,
    description: skill.description,
    queryId: null,
    queryName: null,
    skillType: skill.skillType,
    status: "draft",
    trigger: { ...skill.trigger, id: createDefaultTrigger(skill.trigger.type).id },
    conditions: skill.conditions.map((item) => ({
      ...item,
      id: createDefaultCondition(item.type).id,
    })),
    actions: skill.actions.map((item) => ({
      ...item,
      id: createDefaultAction(item.type).id,
    })),
  };
}

export default function SkillBuilderDrawer({
  open,
  mode,
  skill,
  queryContext,
  queryOptions,
  templates,
  runs,
  runsLoading = false,
  saving = false,
  deleting = false,
  testing = false,
  initialTab = "builder",
  defaultTemplateId = null,
  onClose,
  onSaveDraft,
  onSaveSkill,
  onDelete,
  onTest,
  onStatusChange,
}: Props) {
  const builder = useSkillBuilder(skill, queryContext);
  const [activeTab, setActiveTab] = useState<"builder" | "runs">(initialTab);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    builder.reset(skill, queryContext);
    setSelectedTemplateId(defaultTemplateId);
    setActiveTab(initialTab);
    if (mode === "create" && defaultTemplateId) {
      const template = templates.find((item) => item.id === defaultTemplateId);
      if (template) {
        builder.applyTemplate(skillToTemplate(template));
      }
    }
  }, [open, skill, queryContext, initialTab, defaultTemplateId, mode, templates]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const handleApplyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    builder.applyTemplate(skillToTemplate(template));
  };

  const handleSaveDraft = async () => {
    if (!builder.validation.canSave) {
      toast.error(builder.validation.errors.join(" "));
      return;
    }
    await onSaveDraft(builder.savePayload);
  };

  const handleSaveSkill = async () => {
    if (!builder.validation.canSave) {
      toast.error(builder.validation.errors.join(" "));
      return;
    }
    await onSaveSkill(builder.savePayload);
  };

  if (!open) return null;

  return (
    <>
      <div className="skills-drawer-backdrop" onClick={onClose} />
      <aside className="skills-drawer" role="dialog" aria-modal="true" aria-label="Skill builder">
        <div className="skills-drawer-header border-bottom">
          <div>
            <div className="text-muted small mb-1">{mode === "create" ? "Create Skill" : "Edit Skill"}</div>
            <input
              className="form-control form-control-lg skills-name-input"
              placeholder="Skill name"
              value={builder.draft.name}
              onChange={(event) => builder.setName(event.target.value)}
            />
            <div className="d-flex flex-wrap align-items-center gap-2 mt-2 small text-muted">
              <span>
                Query: <strong>{builder.draft.queryName || "Unlinked query"}</strong>
              </span>
              {skill ? <SkillStatusBadge status={builder.draft.status} /> : null}
              <span className="badge text-bg-light">{SKILL_TYPE_LABELS[builder.savePayload.skillType]}</span>
            </div>
          </div>
          <div className="d-flex gap-2 align-items-start">
            {skill && onStatusChange ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() =>
                  onStatusChange(skill, builder.draft.status === "active" ? "paused" : "active")
                }
              >
                {builder.draft.status === "active" ? "Pause" : "Resume"}
              </button>
            ) : null}
            <button type="button" className="btn btn-sm btn-light" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="skills-drawer-meta border-bottom">
          <div className="row g-2 align-items-end">
            <div className="col-md-6">
              <label className="form-label mb-1">Linked Query</label>
              <select
                className="form-select form-select-sm"
                value={builder.draft.queryId ?? ""}
                onChange={(event) => {
                  const nextId = event.target.value || null;
                  const option = queryOptions.find((item) => item.id === nextId) ?? null;
                  builder.setQuery(nextId, option?.name ?? builder.draft.queryName);
                }}
              >
                <option value="">Select a query</option>
                {queryOptions.map((query) => (
                  <option key={query.id} value={query.id}>
                    {query.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={builder.draft.status}
                onChange={(event) => builder.setSkillStatus(event.target.value as Skill["status"])}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label mb-1">View</label>
              <div className="btn-group w-100" role="group" aria-label="Builder tabs">
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === "builder" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setActiveTab("builder")}
                >
                  Builder
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === "runs" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setActiveTab("runs")}
                >
                  Runs
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="skills-drawer-body">
          {activeTab === "builder" ? (
            <div className="skills-builder-layout">
              <div className="skills-builder-left">
                {mode === "create" ? (
                  <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body">
                      <SkillTemplatePicker
                        templates={templates}
                        selectedTemplateId={selectedTemplate?.id ?? null}
                        onSelectTemplate={handleApplyTemplate}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body">
                    <SkillWorkflowBuilder
                      trigger={builder.draft.trigger}
                      conditions={builder.draft.conditions}
                      actions={builder.draft.actions}
                      selectedBlock={builder.selectedBlock}
                      expandedBlocks={builder.expandedBlocks}
                      onSelectBlock={builder.setSelectedBlock}
                      onSetTriggerType={builder.setTriggerType}
                      onAddCondition={builder.addCondition}
                      onAddAction={builder.addAction}
                      onRemoveCondition={builder.removeCondition}
                      onRemoveAction={builder.removeAction}
                      onMoveCondition={builder.moveCondition}
                      onMoveAction={builder.moveAction}
                      onToggleExpanded={builder.toggleBlockExpanded}
                    />
                  </div>
                </div>

                <SkillSummaryPreview summary={builder.summary} />
              </div>

              <div className="skills-builder-right">
                <SkillBlockConfigPanel
                  selectedTrigger={builder.selectedTrigger}
                  selectedCondition={builder.selectedCondition}
                  selectedAction={builder.selectedAction}
                  onUpdateTrigger={builder.updateTrigger}
                  onUpdateCondition={builder.updateCondition}
                  onUpdateAction={builder.updateAction}
                />
              </div>
            </div>
          ) : (
            <SkillRunsPanel runs={runs} isLoading={runsLoading} disabled={!skill} />
          )}
        </div>

        <div className="skills-drawer-footer border-top">
          <div className="d-flex gap-2">
            {skill && onDelete ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={deleting}
                onClick={() => onDelete(skill)}
              >
                Delete
              </button>
            ) : null}
            {skill && onTest ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={testing}
                onClick={() => onTest(skill)}
              >
                Run Test
              </button>
            ) : null}
          </div>

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-light" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-outline-primary" onClick={() => void handleSaveDraft()} disabled={saving}>
              Save Draft
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handleSaveSkill()} disabled={saving}>
              {mode === "create" ? "Save Skill" : "Update Skill"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
