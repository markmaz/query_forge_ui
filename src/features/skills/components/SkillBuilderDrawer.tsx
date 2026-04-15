import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { getSkillScheduleUpcoming, getSkillSchedulerHealth, validateSkillSchedule } from "../api";
import { ACTION_LABELS, CONDITION_LABELS, createDefaultAction, createDefaultCondition, createDefaultTrigger, SKILL_TYPE_LABELS, TRIGGER_LABELS } from "../constants";
import { useSkillBuilder } from "../hooks";
import type {
  SkillActionType,
  SkillConditionType,
  QueryOption,
  Skill,
  SkillRun,
  SkillScheduleUpcoming,
  SkillSchedulerHealth,
  SkillScheduleValidationResult,
  SkillTemplate,
} from "../types";
import "../styles/skills.css";
import SkillBlockConfigPanel from "./SkillBlockConfigPanel";
import SkillRunsPanel from "./SkillRunsPanel";
import SkillStatusBadge from "./SkillStatusBadge";
import SkillSummaryPreview from "./SkillSummaryPreview";
import SkillTemplatePicker from "./SkillTemplatePicker";
import SkillBlockCard from "./SkillBlockCard";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  skill: Skill | null;
  workspaceId: string;
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
  onManageDestinations?: () => void;
  onSaveDraft: (payload: ReturnType<typeof useSkillBuilder>["savePayload"]) => Promise<void>;
  onSaveSkill: (payload: ReturnType<typeof useSkillBuilder>["savePayload"]) => Promise<void>;
  onDelete?: (skill: Skill) => Promise<void>;
  onTest?: (skill: Skill) => Promise<void>;
  onStatusChange?: (skill: Skill, status: Skill["status"]) => Promise<void>;
};

type BuilderStep = "basics" | "trigger" | "conditions" | "delivery" | "review";

const BUILDER_STEPS: Array<{
  id: BuilderStep;
  title: string;
  description: string;
}> = [
  { id: "basics", title: "Basics", description: "Name the skill, link the query, and choose a starting template." },
  { id: "trigger", title: "Trigger", description: "Define when the skill runs and preview the schedule." },
  { id: "conditions", title: "Conditions", description: "Add any optional rules that narrow when the skill should continue." },
  { id: "delivery", title: "Delivery", description: "Choose how the result gets delivered and attach destinations." },
  { id: "review", title: "Review", description: "Check the visual flow and final readiness before saving." },
];

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

function actionTargetSummary(action: Skill["actions"][number]): { label: string; configured: boolean } {
  const config = action.config ?? {};
  const hasDestination = Boolean(config.destination_id);
  const hasRecipients = typeof config.recipients === "string"
    ? config.recipients.trim().length > 0
    : Array.isArray(config.recipients) && config.recipients.length > 0;
  const hasWebhook = [config.webhook_url, config.endpoint_url, config.url].some(
    (value) => typeof value === "string" && value.trim().length > 0
  );

  if (action.type === "email_report" || action.type === "ai_summary_digest") {
    if (hasDestination) return { label: "Saved destination attached", configured: true };
    if (hasRecipients) return { label: "Recipients configured directly", configured: true };
    return { label: "Needs a destination or recipients", configured: false };
  }

  if (action.type === "slack_delivery" || action.type === "webhook_delivery") {
    if (hasDestination) return { label: "Saved destination attached", configured: true };
    if (hasWebhook) return { label: "Direct webhook configured", configured: true };
    return { label: "Needs a destination or webhook", configured: false };
  }

  return { label: "Review action settings", configured: true };
}

export default function SkillBuilderDrawer({
  open,
  mode,
  skill,
  workspaceId,
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
  onManageDestinations,
  onSaveDraft,
  onSaveSkill,
  onDelete,
  onTest,
  onStatusChange,
}: Props) {
  const builder = useSkillBuilder(skill, queryContext);
  const [activeTab, setActiveTab] = useState<"builder" | "runs">(initialTab);
  const [builderStep, setBuilderStep] = useState<BuilderStep>("basics");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newConditionType, setNewConditionType] = useState<SkillConditionType>("metric_threshold");
  const [newActionType, setNewActionType] = useState<SkillActionType>("email_report");
  const [scheduleValidation, setScheduleValidation] = useState<SkillScheduleValidationResult | null>(null);
  const [schedulerHealth, setSchedulerHealth] = useState<SkillSchedulerHealth | null>(null);
  const [savedSchedule, setSavedSchedule] = useState<SkillScheduleUpcoming | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    builder.reset(skill, queryContext);
    setSelectedTemplateId(defaultTemplateId);
    setActiveTab(initialTab);
    setBuilderStep("basics");
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

  useEffect(() => {
    if (!open || activeTab !== "builder") return;
    let ignore = false;

    void getSkillSchedulerHealth().then((health) => {
      if (!ignore) setSchedulerHealth(health);
    });

    return () => {
      ignore = true;
    };
  }, [open, activeTab]);

  useEffect(() => {
    if (!open || activeTab !== "builder" || !skill?.id || builder.draft.trigger.type !== "schedule") {
      setSavedSchedule(null);
      return;
    }

    let ignore = false;
    void getSkillScheduleUpcoming(skill.id).then((schedule) => {
      if (!ignore) setSavedSchedule(schedule);
    });

    return () => {
      ignore = true;
    };
  }, [open, activeTab, skill?.id, builder.draft.trigger.type]);

  useEffect(() => {
    if (!open || activeTab !== "builder" || builder.draft.trigger.type !== "schedule") {
      setScheduleValidation(null);
      setScheduleLoading(false);
      return;
    }

    let ignore = false;
    setScheduleLoading(true);

    const timer = window.setTimeout(() => {
      void validateSkillSchedule(builder.draft.trigger)
        .then((result) => {
          if (!ignore) setScheduleValidation(result);
        })
        .catch(() => {
          if (!ignore) {
            setScheduleValidation({
              valid: false,
              errors: ["Schedule preview unavailable."],
              upcoming: [],
              cronExpression: null,
              timezone: null,
            });
          }
        })
        .finally(() => {
          if (!ignore) setScheduleLoading(false);
        });
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [open, activeTab, builder.draft.trigger]);

  useEffect(() => {
    if (!open || activeTab !== "builder") return;
    if (builderStep === "trigger") {
      if (builder.selectedTrigger?.id !== builder.draft.trigger.id) {
        builder.setSelectedBlock({ kind: "trigger", id: builder.draft.trigger.id });
      }
      return;
    }
    if (builderStep === "conditions" && builder.draft.conditions.length) {
      if (builder.selectedCondition?.id !== builder.draft.conditions[0].id) {
        builder.setSelectedBlock({ kind: "condition", id: builder.draft.conditions[0].id });
      }
      return;
    }
    if (builderStep === "delivery" && builder.draft.actions.length) {
      if (builder.selectedAction?.id !== builder.draft.actions[0].id) {
        builder.setSelectedBlock({ kind: "action", id: builder.draft.actions[0].id });
      }
    }
  }, [
    open,
    activeTab,
    builderStep,
    builder.draft.trigger.id,
    builder.draft.conditions,
    builder.draft.actions,
    builder.selectedTrigger?.id,
    builder.selectedCondition?.id,
    builder.selectedAction?.id,
  ]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );
  const deliveryStatus = useMemo(() => {
    const actions = builder.draft.actions;
    if (!actions.length) return { configured: false, configuredCount: 0, total: 0 };
    const configuredCount = actions.filter((action) => actionTargetSummary(action).configured).length;
    return {
      configured: configuredCount === actions.length,
      configuredCount,
      total: actions.length,
    };
  }, [builder.draft.actions]);
  const currentStepIndex = BUILDER_STEPS.findIndex((step) => step.id === builderStep);
  const flowNodes = useMemo(() => {
    const conditionsCount = builder.draft.conditions.length;
    const deliveryLabel =
      builder.draft.actions.length === 1
        ? ACTION_LABELS[builder.draft.actions[0].type]
        : `${builder.draft.actions.length} actions`;
    const outcomeLabel =
      builder.draft.actions.length === 0
        ? "Choose a delivery"
        : deliveryStatus.configured
          ? "Ready to send"
          : "Needs setup";
    return [
      {
        key: "query",
        title: "Query",
        value: builder.draft.queryName || "Select a query",
        detail: builder.draft.queryId ? "Connected" : "Required first step",
        tone: builder.draft.queryId ? "ready" : "attention",
      },
      {
        key: "trigger",
        title: "Trigger",
        value: TRIGGER_LABELS[builder.draft.trigger.type],
        detail: builder.draft.trigger.type === "schedule" ? "Scheduled" : "Runs on event",
        tone: "ready",
      },
      {
        key: "conditions",
        title: "Conditions",
        value: conditionsCount ? `${conditionsCount} configured` : "No extra conditions",
        detail: conditionsCount ? "Logic added" : "Optional",
        tone: conditionsCount ? "ready" : "neutral",
      },
      {
        key: "delivery",
        title: "Delivery",
        value: builder.draft.actions.length ? deliveryLabel : "Add an action",
        detail: deliveryStatus.configured ? "Targets attached" : "Needs destination",
        tone: deliveryStatus.configured ? "ready" : "attention",
      },
      {
        key: "result",
        title: "Outcome",
        value: outcomeLabel,
        detail: builder.draft.name || "This skill",
        tone: deliveryStatus.configured && builder.draft.queryId ? "ready" : "neutral",
      },
    ];
  }, [builder.draft.actions, builder.draft.conditions.length, builder.draft.name, builder.draft.queryId, builder.draft.queryName, builder.draft.trigger.type, deliveryStatus.configured]);

  const handleApplyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    builder.applyTemplate(skillToTemplate(template));
  };

  const handleSaveDraft = async () => {
    if (!builder.savePayload.name.trim()) {
      toast.error("Skill name is required.");
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

  const handleSave = async () => {
    if (builder.validation.canSave) {
      await handleSaveSkill();
      return;
    }
    await handleSaveDraft();
  };

  const goToStep = (step: BuilderStep) => setBuilderStep(step);
  const goToNextStep = () => {
    const next = BUILDER_STEPS[currentStepIndex + 1];
    if (next) setBuilderStep(next.id);
  };
  const goToPreviousStep = () => {
    const prev = BUILDER_STEPS[currentStepIndex - 1];
    if (prev) setBuilderStep(prev.id);
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
          <div className="d-flex gap-2 align-items-start flex-wrap justify-content-end">
            <div className="btn-group" role="group" aria-label="Builder tabs">
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

        <div className="skills-drawer-body">
          {activeTab === "builder" ? (
            <>
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <div className="skills-builder-section-header mb-3">
                    <div>
                      <div className="text-muted text-uppercase small fw-semibold mb-1">Skill Map</div>
                      <h3 className="h6 mb-1">Visual Flow</h3>
                      <p className="text-muted mb-0">This is the skill the user is building, from query through delivery.</p>
                    </div>
                  </div>
                  <div className="skills-flow-map">
                    {flowNodes.map((node, index) => (
                      <div key={node.key} className={`skills-flow-node is-${node.tone}`}>
                        <div className="skills-flow-node__badge">{index + 1}</div>
                        <div className="skills-flow-node__body">
                          <div className="skills-flow-node__title">{node.title}</div>
                          <div className="skills-flow-node__value">{node.value}</div>
                          <div className="skills-flow-node__detail">{node.detail}</div>
                        </div>
                        {index < flowNodes.length - 1 ? <div className="skills-flow-node__arrow" aria-hidden="true">→</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="skills-wizard-layout">
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-3">Steps</div>
                    <div className="skills-wizard-steps">
                      {BUILDER_STEPS.map((step, index) => (
                        <button
                          key={step.id}
                          type="button"
                          className={`skills-wizard-step ${builderStep === step.id ? "is-active" : ""} ${index < currentStepIndex ? "is-complete" : ""}`}
                          onClick={() => goToStep(step.id)}
                        >
                          <span className="skills-wizard-step__index">{index + 1}</span>
                          <span>
                            <span className="skills-wizard-step__title">{step.title}</span>
                            <span className="skills-wizard-step__description">{step.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="skills-wizard-main">
                  {builderStep === "basics" ? (
                    <div className="card border-0 shadow-sm">
                      <div className="card-body">
                        <div className="skills-builder-section-header mb-3">
                          <div>
                            <div className="text-muted text-uppercase small fw-semibold mb-1">Step 1</div>
                            <h3 className="h6 mb-1">Basic Setup</h3>
                            <p className="text-muted mb-0">Start with the query, status, description, and an optional template.</p>
                          </div>
                        </div>

                        <div className="skills-builder-overview-grid">
                          <label className="mb-0">
                            <span className="form-label mb-1">Linked Query</span>
                            <select
                              className="form-select"
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
                          </label>

                          <label className="mb-0">
                            <span className="form-label mb-1">Status</span>
                            <select
                              className="form-select"
                              value={builder.draft.status}
                              onChange={(event) => builder.setSkillStatus(event.target.value as Skill["status"])}
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="paused">Paused</option>
                              <option value="error">Error</option>
                            </select>
                          </label>
                        </div>

                        <label className="mt-3 mb-0">
                          <span className="form-label mb-1">Description</span>
                          <textarea
                            className="form-control"
                            rows={3}
                            value={builder.draft.description ?? ""}
                            onChange={(event) => builder.setDescription(event.target.value)}
                            placeholder="Describe what the skill should do and who it is for."
                          />
                        </label>

                        {mode === "create" ? (
                          <div className="mt-4">
                            <div className="text-muted text-uppercase small fw-semibold mb-2">Templates</div>
                            <SkillTemplatePicker
                              templates={templates}
                              selectedTemplateId={selectedTemplate?.id ?? null}
                              onSelectTemplate={handleApplyTemplate}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {builderStep === "trigger" ? (
                    <div className="skills-wizard-split">
                      <div className="card border-0 shadow-sm">
                        <div className="card-body">
                          <div className="text-muted text-uppercase small fw-semibold mb-1">Step 2</div>
                          <h3 className="h6 mb-3">Trigger</h3>
                          <label className="form-label small text-muted">Trigger type</label>
                          <select
                            className="form-select form-select-sm mb-3"
                            value={builder.draft.trigger.type}
                            onChange={(event) => builder.setTriggerType(event.target.value as typeof builder.draft.trigger.type)}
                          >
                            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <SkillBlockCard
                            block={builder.draft.trigger}
                            selected={true}
                            expanded={Boolean(builder.expandedBlocks[builder.draft.trigger.id])}
                            onSelect={() => builder.setSelectedBlock({ kind: "trigger", id: builder.draft.trigger.id })}
                            onToggleExpanded={() => builder.toggleBlockExpanded(builder.draft.trigger.id)}
                          />
                        </div>
                      </div>
                      <SkillBlockConfigPanel
                        workspaceId={workspaceId}
                        selectedTrigger={builder.selectedTrigger || builder.draft.trigger}
                        selectedCondition={null}
                        selectedAction={null}
                        onUpdateTrigger={builder.updateTrigger}
                        onUpdateCondition={builder.updateCondition}
                        onUpdateAction={builder.updateAction}
                        onManageDestinations={onManageDestinations}
                        scheduleValidation={scheduleValidation}
                        schedulerHealth={schedulerHealth}
                        savedSchedule={savedSchedule}
                        scheduleLoading={scheduleLoading}
                      />
                    </div>
                  ) : null}

                  {builderStep === "conditions" ? (
                    <div className="skills-wizard-split">
                      <div className="card border-0 shadow-sm">
                        <div className="card-body">
                          <div className="text-muted text-uppercase small fw-semibold mb-1">Step 3</div>
                          <h3 className="h6 mb-3">Conditions</h3>
                          <p className="text-muted small mb-3">Add optional conditions if the skill should only continue when something specific is true.</p>
                          {builder.draft.conditions.map((condition, index) => (
                            <SkillBlockCard
                              key={condition.id}
                              block={condition}
                              selected={builder.selectedCondition?.id === condition.id}
                              expanded={Boolean(builder.expandedBlocks[condition.id])}
                              onSelect={() => builder.setSelectedBlock({ kind: "condition", id: condition.id })}
                              onToggleExpanded={() => builder.toggleBlockExpanded(condition.id)}
                              onRemove={() => builder.removeCondition(condition.id)}
                              onMoveUp={index > 0 ? () => builder.moveCondition(condition.id, "up") : undefined}
                              onMoveDown={index < builder.draft.conditions.length - 1 ? () => builder.moveCondition(condition.id, "down") : undefined}
                            />
                          ))}
                          {!builder.draft.conditions.length ? (
                            <div className="skills-empty-state-card">No conditions yet. Add one if this skill needs extra logic.</div>
                          ) : null}
                          <div className="skills-add-row">
                            <select
                              className="form-select form-select-sm"
                              value={newConditionType}
                              onChange={(event) => setNewConditionType(event.target.value as SkillConditionType)}
                            >
                              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => builder.addCondition(newConditionType)}>
                              Add condition
                            </button>
                          </div>
                        </div>
                      </div>
                      <SkillBlockConfigPanel
                        workspaceId={workspaceId}
                        selectedTrigger={null}
                        selectedCondition={builder.selectedCondition}
                        selectedAction={null}
                        onUpdateTrigger={builder.updateTrigger}
                        onUpdateCondition={builder.updateCondition}
                        onUpdateAction={builder.updateAction}
                        onManageDestinations={onManageDestinations}
                        scheduleValidation={scheduleValidation}
                        schedulerHealth={schedulerHealth}
                        savedSchedule={savedSchedule}
                        scheduleLoading={scheduleLoading}
                      />
                    </div>
                  ) : null}

                  {builderStep === "delivery" ? (
                    <div className="skills-wizard-split">
                      <div className="card border-0 shadow-sm">
                        <div className="card-body">
                          <div className="skills-builder-section-subheader mb-3">
                            <div>
                              <div className="text-muted text-uppercase small fw-semibold mb-1">Step 4</div>
                              <h3 className="h6 mb-1">Delivery</h3>
                              <p className="text-muted mb-0">Choose what happens after the query runs and attach the destination for each action.</p>
                            </div>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onManageDestinations?.()}>
                              Manage destinations
                            </button>
                          </div>
                          {builder.draft.actions.map((action, index) => {
                            const target = actionTargetSummary(action);
                            return (
                              <SkillBlockCard
                                key={action.id}
                                block={{
                                  ...action,
                                  label: `${action.label} · ${target.label}`,
                                }}
                                selected={builder.selectedAction?.id === action.id}
                                expanded={Boolean(builder.expandedBlocks[action.id])}
                                onSelect={() => builder.setSelectedBlock({ kind: "action", id: action.id })}
                                onToggleExpanded={() => builder.toggleBlockExpanded(action.id)}
                                onRemove={() => builder.removeAction(action.id)}
                                onMoveUp={index > 0 ? () => builder.moveAction(action.id, "up") : undefined}
                                onMoveDown={index < builder.draft.actions.length - 1 ? () => builder.moveAction(action.id, "down") : undefined}
                              />
                            );
                          })}
                          <div className="skills-add-row">
                            <select
                              className="form-select form-select-sm"
                              value={newActionType}
                              onChange={(event) => setNewActionType(event.target.value as SkillActionType)}
                            >
                              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => builder.addAction(newActionType)}>
                              Add action
                            </button>
                          </div>
                        </div>
                      </div>
                      <SkillBlockConfigPanel
                        workspaceId={workspaceId}
                        selectedTrigger={null}
                        selectedCondition={null}
                        selectedAction={builder.selectedAction}
                        onUpdateTrigger={builder.updateTrigger}
                        onUpdateCondition={builder.updateCondition}
                        onUpdateAction={builder.updateAction}
                        onManageDestinations={onManageDestinations}
                        scheduleValidation={scheduleValidation}
                        schedulerHealth={schedulerHealth}
                        savedSchedule={savedSchedule}
                        scheduleLoading={scheduleLoading}
                      />
                    </div>
                  ) : null}

                  {builderStep === "review" ? (
                    <div className="skills-review-grid">
                      <SkillSummaryPreview summary={builder.summary} />
                      <div className="card border-0 shadow-sm">
                        <div className="card-body">
                          <div className="text-muted text-uppercase small fw-semibold mb-1">Readiness</div>
                          <h3 className="h6 mb-3">Final Check</h3>
                          <ul className="skills-review-list">
                            <li className={builder.draft.queryId ? "is-ready" : "is-attention"}>Query linked: {builder.draft.queryName || "Select a query"}</li>
                            <li className="is-ready">Trigger: {TRIGGER_LABELS[builder.draft.trigger.type]}</li>
                            <li className={builder.draft.conditions.length ? "is-ready" : "is-neutral"}>Conditions: {builder.draft.conditions.length || 0}</li>
                            <li className={deliveryStatus.configured ? "is-ready" : "is-attention"}>
                              Delivery: {deliveryStatus.configuredCount} of {deliveryStatus.total} actions configured
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <SkillRunsPanel runs={runs} isLoading={runsLoading} disabled={!skill} />
          )}
        </div>

        <div className="skills-drawer-footer border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex gap-2 flex-wrap">
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

          <div className="d-flex gap-2 flex-wrap ms-auto">
            <button type="button" className="btn btn-light" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-outline-primary" onClick={() => void handleSave()} disabled={saving}>
              Save
            </button>
            {activeTab === "builder" && currentStepIndex > 0 ? (
              <button type="button" className="btn btn-outline-secondary" onClick={goToPreviousStep} disabled={saving}>
                Back
              </button>
            ) : null}
            {activeTab === "builder" && currentStepIndex < BUILDER_STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={goToNextStep} disabled={saving}>
                Next
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
