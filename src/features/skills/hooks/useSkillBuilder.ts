import { useMemo, useState } from "react";
import {
  ACTION_LABELS,
  CONDITION_LABELS,
  createDefaultAction,
  createDefaultCondition,
  createDefaultTrigger,
  SKILL_TYPE_LABELS,
  TRIGGER_LABELS,
} from "../constants";
import type {
  SaveSkillPayload,
  Skill,
  SkillActionBlock,
  SkillActionType,
  SkillConditionBlock,
  SkillConditionType,
  SkillDraft,
  SkillTriggerBlock,
  SkillTriggerType,
  SkillType,
} from "../types";

type SelectedBlock =
  | { kind: "trigger"; id: string }
  | { kind: "condition"; id: string }
  | { kind: "action"; id: string }
  | null;

type QueryContext = {
  queryId?: string | null;
  queryName?: string | null;
};

function buildDraftFromSkill(skill: Skill): SkillDraft {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description ?? null,
    queryId: skill.queryId,
    queryName: skill.queryName,
    skillType: skill.skillType,
    status: skill.status,
    trigger: skill.trigger,
    conditions: skill.conditions,
    actions: skill.actions,
    runCount: skill.runCount,
    errorMessage: skill.errorMessage,
  };
}

function buildNewDraft(queryContext?: QueryContext): SkillDraft {
  return {
    name: "",
    description: "",
    queryId: queryContext?.queryId ?? null,
    queryName: queryContext?.queryName ?? null,
    skillType: "threshold_alert",
    status: "draft",
    trigger: createDefaultTrigger("schedule"),
    conditions: [],
    actions: [createDefaultAction("email_report")],
  };
}

function inferSkillType(draft: SkillDraft): SkillType {
  if (draft.actions.some((action) => action.type === "slack_delivery")) return "slack_delivery";
  if (draft.actions.some((action) => action.type === "webhook_delivery")) return "webhook_delivery";
  if (draft.actions.some((action) => action.type === "ai_summary_digest")) return "ai_summary_digest";
  if (draft.trigger.type === "data_freshness_check" || draft.conditions.some((c) => c.type === "no_new_rows")) {
    return "data_freshness_check";
  }
  if (draft.conditions.some((c) => c.type === "metric_threshold" || c.type === "row_count_threshold")) {
    return "threshold_alert";
  }
  if (draft.actions.some((action) => action.type === "email_report")) return "email_report";
  return "custom";
}

function applyTemplateToDraft(template: SkillDraft, current: SkillDraft): SkillDraft {
  return {
    ...template,
    queryId: current.queryId,
    queryName: current.queryName,
    status: current.status,
    name: current.name || template.name,
  };
}

function summarizeSchedule(config: Record<string, unknown>): string {
  const frequency = String(config.frequency ?? "daily");
  const time = String(config.time ?? "08:00");
  const tz = String(config.timezone ?? "UTC");
  return `Run on a ${frequency} schedule at ${time} (${tz})`;
}

function summarizeTrigger(trigger: SkillTriggerBlock): string {
  if (trigger.type === "schedule") return summarizeSchedule(trigger.config);
  if (trigger.type === "query_run") return "Run whenever the query executes";
  if (trigger.type === "threshold_alert") {
    const metric = String(trigger.config.metric ?? "metric");
    const operator = String(trigger.config.operator ?? ">");
    const threshold = String(trigger.config.threshold ?? "0");
    return `Evaluate when ${metric} ${operator} ${threshold}`;
  }
  if (trigger.type === "data_freshness_check") {
    const column = String(trigger.config.freshness_column ?? "timestamp column");
    return `Check freshness from ${column}`;
  }
  return "Run manually";
}

function summarizeConditions(conditions: SkillConditionBlock[]): string {
  if (!conditions.length) return "No additional conditions";
  return conditions
    .map((condition) => {
      if (condition.type === "metric_threshold") {
        const metric = String(condition.config.metric ?? "metric");
        const operator = String(condition.config.operator ?? ">");
        const value = String(condition.config.value ?? "0");
        return `${metric} ${operator} ${value}`;
      }
      if (condition.type === "row_count_threshold") {
        const operator = String(condition.config.operator ?? ">");
        const value = String(condition.config.value ?? "0");
        return `row count ${operator} ${value}`;
      }
      if (condition.type === "no_new_rows") {
        const amount = String(condition.config.interval_value ?? "1");
        const unit = String(condition.config.interval_unit ?? "day");
        return `no new rows in ${amount} ${unit}`;
      }
      return CONDITION_LABELS[condition.type].toLowerCase();
    })
    .join(" and ");
}

function summarizeActions(actions: SkillActionBlock[]): string {
  return actions.map((action) => ACTION_LABELS[action.type]).join(", ");
}

export function useSkillBuilder(initialSkill?: Skill | null, queryContext?: QueryContext) {
  const [draft, setDraft] = useState<SkillDraft>(() =>
    initialSkill ? buildDraftFromSkill(initialSkill) : buildNewDraft(queryContext)
  );

  const [selectedBlock, setSelectedBlock] = useState<SelectedBlock>(() =>
    initialSkill
      ? { kind: "trigger", id: initialSkill.trigger.id }
      : { kind: "trigger", id: draft.trigger.id }
  );

  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const setName = (name: string) => {
    setDraft((previous) => ({ ...previous, name }));
  };

  const setDescription = (description: string) => {
    setDraft((previous) => ({ ...previous, description }));
  };

  const setQuery = (queryId: string | null, queryName: string | null) => {
    setDraft((previous) => ({ ...previous, queryId, queryName }));
  };

  const setTriggerType = (type: SkillTriggerType) => {
    setDraft((previous) => {
      const next = createDefaultTrigger(type);
      setSelectedBlock({ kind: "trigger", id: next.id });
      return { ...previous, trigger: next };
    });
  };

  const addCondition = (type: SkillConditionType) => {
    const condition = createDefaultCondition(type);
    setDraft((previous) => ({ ...previous, conditions: [...previous.conditions, condition] }));
    setSelectedBlock({ kind: "condition", id: condition.id });
  };

  const addAction = (type: SkillActionType) => {
    const action = createDefaultAction(type);
    setDraft((previous) => ({ ...previous, actions: [...previous.actions, action] }));
    setSelectedBlock({ kind: "action", id: action.id });
  };

  const removeCondition = (id: string) => {
    setDraft((previous) => ({
      ...previous,
      conditions: previous.conditions.filter((item) => item.id !== id),
    }));
    setSelectedBlock((previous) => (previous?.id === id ? null : previous));
  };

  const removeAction = (id: string) => {
    setDraft((previous) => {
      const nextActions = previous.actions.filter((item) => item.id !== id);
      return {
        ...previous,
        actions: nextActions.length ? nextActions : [createDefaultAction("email_report")],
      };
    });
    setSelectedBlock((previous) => (previous?.id === id ? null : previous));
  };

  const moveCondition = (id: string, direction: "up" | "down") => {
    setDraft((previous) => {
      const index = previous.conditions.findIndex((item) => item.id === id);
      if (index < 0) return previous;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= previous.conditions.length) return previous;
      const next = [...previous.conditions];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...previous, conditions: next };
    });
  };

  const moveAction = (id: string, direction: "up" | "down") => {
    setDraft((previous) => {
      const index = previous.actions.findIndex((item) => item.id === id);
      if (index < 0) return previous;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= previous.actions.length) return previous;
      const next = [...previous.actions];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...previous, actions: next };
    });
  };

  const updateTrigger = (patch: Record<string, unknown>) => {
    setDraft((previous) => ({
      ...previous,
      trigger: {
        ...previous.trigger,
        config: {
          ...previous.trigger.config,
          ...patch,
        },
      },
    }));
  };

  const updateCondition = (id: string, patch: Record<string, unknown>) => {
    setDraft((previous) => ({
      ...previous,
      conditions: previous.conditions.map((condition) =>
        condition.id === id
          ? {
              ...condition,
              config: {
                ...condition.config,
                ...patch,
              },
            }
          : condition
      ),
    }));
  };

  const updateAction = (id: string, patch: Record<string, unknown>) => {
    setDraft((previous) => ({
      ...previous,
      actions: previous.actions.map((action) =>
        action.id === id
          ? {
              ...action,
              config: {
                ...action.config,
                ...patch,
              },
            }
          : action
      ),
    }));
  };

  const toggleBlockExpanded = (id: string) => {
    setExpandedBlocks((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const setSkillStatus = (status: SkillDraft["status"]) => {
    setDraft((previous) => ({ ...previous, status }));
  };

  const applyTemplate = (templateDraft: SkillDraft) => {
    setDraft((previous) => applyTemplateToDraft(templateDraft, previous));
    setSelectedBlock({ kind: "trigger", id: templateDraft.trigger.id });
  };

  const reset = (skill?: Skill | null, nextContext?: QueryContext) => {
    const nextDraft = skill ? buildDraftFromSkill(skill) : buildNewDraft(nextContext);
    setDraft(nextDraft);
    setSelectedBlock({ kind: "trigger", id: nextDraft.trigger.id });
    setExpandedBlocks({});
  };

  const selectedTrigger = selectedBlock?.kind === "trigger" ? draft.trigger : null;
  const selectedCondition =
    selectedBlock?.kind === "condition"
      ? draft.conditions.find((condition) => condition.id === selectedBlock.id) ?? null
      : null;
  const selectedAction =
    selectedBlock?.kind === "action"
      ? draft.actions.find((action) => action.id === selectedBlock.id) ?? null
      : null;

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!draft.name.trim()) errors.push("Skill name is required.");
    if (!draft.trigger) errors.push("A trigger block is required.");
    if (!draft.actions.length) errors.push("At least one action is required.");
    draft.actions.forEach((action) => {
      const cfg = action.config ?? {};
      const hasDestination = Boolean(cfg.destination_id);
      const hasRecipients = typeof cfg.recipients === "string"
        ? cfg.recipients.trim().length > 0
        : Array.isArray(cfg.recipients) && cfg.recipients.length > 0;
      const hasWebhook = [
        cfg.webhook_url,
        cfg.endpoint_url,
        cfg.url,
      ].some((value) => typeof value === "string" && value.trim().length > 0);

      if ((action.type === "email_report" || action.type === "ai_summary_digest") && !hasDestination && !hasRecipients) {
        errors.push(`${ACTION_LABELS[action.type]} needs a saved destination or recipients.`);
      }
      if ((action.type === "slack_delivery" || action.type === "webhook_delivery") && !hasDestination && !hasWebhook) {
        errors.push(`${ACTION_LABELS[action.type]} needs a saved destination or webhook URL.`);
      }
    });
    return {
      errors,
      canSave: errors.length === 0,
    };
  }, [draft.actions, draft.name, draft.trigger]);

  const summary = useMemo(() => {
    const triggerSummary = summarizeTrigger(draft.trigger);
    const conditionSummary = summarizeConditions(draft.conditions);
    const actionSummary = summarizeActions(draft.actions);
    const typeLabel = SKILL_TYPE_LABELS[inferSkillType(draft)];
    const queryName = draft.queryName || "this query";

    return `${typeLabel}: ${triggerSummary}. If ${conditionSummary}, then ${actionSummary} for ${queryName}.`;
  }, [draft]);

  const savePayload: SaveSkillPayload = {
    name: draft.name.trim(),
    description: draft.description ?? null,
    queryId: draft.queryId,
    queryName: draft.queryName,
    skillType: inferSkillType(draft),
    status: draft.status,
    trigger: draft.trigger,
    conditions: draft.conditions,
    actions: draft.actions,
  };

  return {
    draft,
    selectedBlock,
    expandedBlocks,
    selectedTrigger,
    selectedCondition,
    selectedAction,
    triggerLabel: TRIGGER_LABELS[draft.trigger.type],
    validation,
    summary,
    savePayload,
    setName,
    setDescription,
    setQuery,
    setSkillStatus,
    setTriggerType,
    addCondition,
    addAction,
    removeCondition,
    removeAction,
    moveCondition,
    moveAction,
    updateTrigger,
    updateCondition,
    updateAction,
    setSelectedBlock,
    toggleBlockExpanded,
    applyTemplate,
    reset,
  };
}
