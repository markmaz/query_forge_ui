export type SkillStatus = "draft" | "active" | "paused" | "error";

export type SkillType =
  | "threshold_alert"
  | "ai_summary_digest"
  | "webhook_delivery"
  | "data_freshness_check"
  | "email_report"
  | "slack_delivery"
  | "custom";

export type SkillBlockKind = "trigger" | "condition" | "action";

export type SkillTriggerType =
  | "schedule"
  | "query_run"
  | "manual"
  | "data_freshness_check"
  | "threshold_alert";

export type SkillConditionType =
  | "metric_threshold"
  | "row_count_threshold"
  | "changed_result"
  | "no_new_rows"
  | "custom_rule";

export type SkillActionType =
  | "email_report"
  | "ai_summary_digest"
  | "webhook_delivery"
  | "slack_delivery";

export type SkillRunStatus = "success" | "failed" | "skipped" | "pending";

export interface SkillBlockBase {
  id: string;
  kind: SkillBlockKind;
  type: string;
  label: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface SkillTriggerBlock extends SkillBlockBase {
  kind: "trigger";
  type: SkillTriggerType;
}

export interface SkillConditionBlock extends SkillBlockBase {
  kind: "condition";
  type: SkillConditionType;
}

export interface SkillActionBlock extends SkillBlockBase {
  kind: "action";
  type: SkillActionType;
}

export interface Skill {
  id: string;
  name: string;
  description?: string | null;
  queryId: string | null;
  queryName: string | null;
  skillType: SkillType;
  status: SkillStatus;
  trigger: SkillTriggerBlock;
  conditions: SkillConditionBlock[];
  actions: SkillActionBlock[];
  createdAt: string | null;
  updatedAt: string | null;
  lastRunAt: string | null;
  runCount?: number;
  errorMessage?: string | null;
}

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  skillType: SkillType;
  trigger: SkillTriggerBlock;
  conditions: SkillConditionBlock[];
  actions: SkillActionBlock[];
}

export interface SkillRun {
  id: string;
  skillId: string;
  status: SkillRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
  durationMs: number | null;
  message: string;
  errorMessage: string | null;
  result: Record<string, unknown> | null;
  triggeredBy: string | null;
  jobId: string | null;
  scheduleId: string | null;
  events: SkillLogEvent[];
}

export interface SkillLogEvent {
  id: string;
  status: SkillRunStatus | "info";
  timestamp: string | null;
  message: string;
}

export type SkillDraft = Omit<Skill, "id" | "createdAt" | "updatedAt" | "lastRunAt"> & {
  id?: string;
};

export interface SkillListParams {
  q?: string;
  status?: SkillStatus | "all";
  skillType?: SkillType | "all";
}

export interface SkillListResult {
  rows: Skill[];
  total: number;
}

export interface SaveSkillPayload {
  name: string;
  description?: string | null;
  queryId: string | null;
  queryName?: string | null;
  skillType: SkillType;
  status: SkillStatus;
  trigger: SkillTriggerBlock;
  conditions: SkillConditionBlock[];
  actions: SkillActionBlock[];
}

export type SkillLifecycleAction = "pause" | "resume" | "duplicate" | "delete" | "edit" | "view_runs";

export interface QueryOption {
  id: string;
  name: string;
}

export interface SkillScheduleValidationResult {
  valid: boolean;
  errors: string[];
  upcoming: string[];
  cronExpression: string | null;
  timezone: string | null;
}

export interface SkillSchedulerHealth {
  healthy: boolean;
  reason: string | null;
  lastDispatchAt: string | null;
  secondsSinceDispatch: number | null;
}

export interface SkillScheduleUpcoming {
  upcoming: string[];
  cronExpression: string | null;
  timezone: string | null;
  reason: string | null;
}
