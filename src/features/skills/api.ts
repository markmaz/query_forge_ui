import api from "@/shared/services/api";
import {
  ACTION_LABELS,
  CONDITION_LABELS,
  createDefaultAction,
  createDefaultCondition,
  createDefaultTrigger,
  SKILL_TYPE_LABELS,
  TRIGGER_LABELS,
} from "./constants";
import type {
  SaveSkillPayload,
  Skill,
  SkillActionBlock,
  SkillActionType,
  SkillConditionBlock,
  SkillConditionType,
  SkillListParams,
  SkillListResult,
  SkillLogEvent,
  SkillRun,
  SkillRunStatus,
  SkillScheduleUpcoming,
  SkillSchedulerHealth,
  SkillScheduleValidationResult,
  SkillStatus,
  SkillTriggerBlock,
  SkillTriggerType,
  SkillType,
} from "./types";

type RawRecord = Record<string, unknown>;

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeTimestampString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    return `${trimmed}Z`;
  }
  return trimmed;
}

function pickString(record: RawRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function pickNullableString(record: RawRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function pickNullableTimestamp(record: RawRecord, keys: string[]): string | null {
  return normalizeTimestampString(pickNullableString(record, keys));
}

function pickNumber(record: RawRecord, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function pickArray(value: unknown): RawRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is RawRecord => Boolean(item && typeof item === "object"));
  }
  return [];
}

function toRecord(value: unknown): RawRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as RawRecord;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as RawRecord;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeStatus(value: unknown, fallbackIsActive?: unknown): SkillStatus {
  const normalized = safeText(value).trim().toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "paused") return "paused";
  if (normalized === "error" || normalized === "failed") return "error";
  if (fallbackIsActive != null) {
    if (typeof fallbackIsActive === "number") return fallbackIsActive > 0 ? "active" : "draft";
    if (typeof fallbackIsActive === "boolean") return fallbackIsActive ? "active" : "draft";
    if (typeof fallbackIsActive === "string") {
      const lowered = fallbackIsActive.trim().toLowerCase();
      if (["1", "true", "yes", "active"].includes(lowered)) return "active";
      if (["0", "false", "no", "inactive"].includes(lowered)) return "draft";
    }
  }
  return "draft";
}

function normalizeSkillType(value: unknown): SkillType {
  const normalized = safeText(value).trim().toLowerCase();
  if (normalized === "email_delivery") return "email_report";
  if (normalized in SKILL_TYPE_LABELS) return normalized as SkillType;
  return "custom";
}

function toTriggerType(value: unknown): SkillTriggerType {
  const normalized = safeText(value).trim().toLowerCase();
  if (normalized in TRIGGER_LABELS) return normalized as SkillTriggerType;
  return "schedule";
}

function toConditionType(value: unknown): SkillConditionType {
  const normalized = safeText(value).trim().toLowerCase();
  if (normalized in CONDITION_LABELS) return normalized as SkillConditionType;
  return "metric_threshold";
}

function toActionType(value: unknown): SkillActionType {
  const normalized = safeText(value).trim().toLowerCase();
  if (normalized in ACTION_LABELS) return normalized as SkillActionType;
  return "email_report";
}

function normalizeTrigger(value: unknown): SkillTriggerBlock {
  if (!value || typeof value !== "object") return createDefaultTrigger("schedule");
  const record = value as RawRecord;
  const type = toTriggerType(record.type ?? record.trigger_type);
  return {
    ...createDefaultTrigger(type),
    id: pickString(record, ["id", "block_id"], `trigger_${type}`),
    label: pickString(record, ["label"], TRIGGER_LABELS[type]),
    enabled: record.enabled !== false,
    config: (record.config as Record<string, unknown>) ?? {},
  };
}

function normalizeCondition(value: unknown, index: number): SkillConditionBlock {
  if (!value || typeof value !== "object") return createDefaultCondition("metric_threshold");
  const record = value as RawRecord;
  const type = toConditionType(record.type ?? record.condition_type);
  return {
    ...createDefaultCondition(type),
    id: pickString(record, ["id", "block_id"], `condition_${index}_${type}`),
    label: pickString(record, ["label"], CONDITION_LABELS[type]),
    enabled: record.enabled !== false,
    config: (record.config as Record<string, unknown>) ?? {},
  };
}

function normalizeAction(value: unknown, index: number): SkillActionBlock {
  if (!value || typeof value !== "object") return createDefaultAction("email_report");
  const record = value as RawRecord;
  const type = toActionType(record.type ?? record.action_type);
  return {
    ...createDefaultAction(type),
    id: pickString(record, ["id", "block_id"], `action_${index}_${type}`),
    label: pickString(record, ["label"], ACTION_LABELS[type]),
    enabled: record.enabled !== false,
    config: (record.config as Record<string, unknown>) ?? {},
  };
}

function normalizeSkill(record: RawRecord): Skill {
  const workflowBlocks = pickArray(record.workflow);
  const configJson = record.config_json && typeof record.config_json === "object"
    ? (record.config_json as Record<string, unknown>)
    : null;
  const trigger =
    record.trigger && typeof record.trigger === "object"
      ? normalizeTrigger(record.trigger)
      : normalizeTrigger(workflowBlocks.find((block) => block.kind === "trigger"));

  const conditions =
    Array.isArray(record.conditions) && record.conditions.length
      ? record.conditions.map((item, index) => normalizeCondition(item, index))
      : workflowBlocks
          .filter((block) => block.kind === "condition")
          .map((item, index) => normalizeCondition(item, index));

  const actions =
    Array.isArray(record.actions) && record.actions.length
      ? record.actions.map((item, index) => normalizeAction(item, index))
      : workflowBlocks
          .filter((block) => block.kind === "action")
          .map((item, index) => normalizeAction(item, index));

  const fallbackSkillType = normalizeSkillType(record.skill_type);
  const normalizedActions = actions.length
    ? actions
    : [
        {
          ...createDefaultAction(
            fallbackSkillType === "slack_delivery"
              ? "slack_delivery"
              : fallbackSkillType === "webhook_delivery"
                ? "webhook_delivery"
                : fallbackSkillType === "ai_summary_digest"
                  ? "ai_summary_digest"
                  : "email_report"
          ),
          config: configJson ?? createDefaultAction("email_report").config,
        },
      ];

  return {
    id: pickString(record, ["id", "skill_id"]),
    name: pickString(record, ["name"], "Untitled Skill"),
    description: pickNullableString(record, ["description"]),
    queryId: pickNullableString(record, ["query_id", "queryId"]),
    queryName: pickNullableString(record, ["query_name", "queryName"]),
    skillType: fallbackSkillType,
    status: normalizeStatus(record.status, record.is_active),
    trigger,
    conditions,
    actions: normalizedActions,
    createdAt: pickNullableTimestamp(record, ["created_at", "createdAt"]),
    updatedAt: pickNullableTimestamp(record, ["updated_at", "updatedAt"]),
    lastRunAt: pickNullableTimestamp(record, ["last_run_at", "lastRunAt"]),
    runCount: pickNumber(record, ["run_count", "runCount"], 0),
    errorMessage: pickNullableString(record, ["error", "error_message"]),
  };
}

function unwrapRows(payload: unknown): RawRecord[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as RawRecord;
  if (Array.isArray(record.rows)) return pickArray(record.rows);
  if (Array.isArray(record.data)) return pickArray(record.data);
  if (record.data && typeof record.data === "object") {
    const nested = record.data as RawRecord;
    if (Array.isArray(nested.rows)) return pickArray(nested.rows);
    if (Array.isArray(nested.data)) return pickArray(nested.data);
  }
  if (Array.isArray(payload)) return pickArray(payload);
  return [];
}

function unwrapTotal(payload: unknown, rows: RawRecord[]): number {
  if (!payload || typeof payload !== "object") return rows.length;
  const record = payload as RawRecord;
  if (typeof record.total === "number") return record.total;
  if (record.data && typeof record.data === "object") {
    const nested = record.data as RawRecord;
    if (typeof nested.total === "number") return nested.total;
  }
  return rows.length;
}

function unwrapItem(payload: unknown): RawRecord {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as RawRecord;
  if (record.data && typeof record.data === "object") return record.data as RawRecord;
  return record;
}

function serializeBlock(block: SkillTriggerBlock | SkillConditionBlock | SkillActionBlock) {
  let config = block.config;
  if (block.kind === "action") {
    const actionConfig = { ...(block.config ?? {}) } as Record<string, unknown>;
    const rawDestinationId = actionConfig.destination_id;
    const parsedDestinationId =
      typeof rawDestinationId === "number"
        ? rawDestinationId
        : typeof rawDestinationId === "string" && rawDestinationId.trim()
          ? Number(rawDestinationId)
          : null;
    const hasDestination = typeof parsedDestinationId === "number" && Number.isFinite(parsedDestinationId) && parsedDestinationId > 0;

    if (hasDestination) {
      actionConfig.destination_id = parsedDestinationId;
      if (block.type === "slack_delivery") {
        actionConfig.webhook_url = "";
      }
      if (block.type === "webhook_delivery") {
        actionConfig.webhook_url = "";
        actionConfig.endpoint_url = "";
        actionConfig.url = "";
      }
    }
    delete actionConfig.delivery_target_mode;
    config = actionConfig;
  }
  return {
    id: block.id,
    kind: block.kind,
    type: block.type,
    label: block.label,
    enabled: block.enabled,
    config,
  };
}

function serializeSkillPayload(payload: SaveSkillPayload) {
  return {
    name: payload.name,
    description: payload.description ?? null,
    query_id: payload.queryId,
    query_name: payload.queryName ?? null,
    skill_type: payload.skillType,
    status: payload.status,
    trigger: serializeBlock(payload.trigger),
    conditions: payload.conditions.map(serializeBlock),
    actions: payload.actions.map(serializeBlock),
    workflow: [
      serializeBlock(payload.trigger),
      ...payload.conditions.map(serializeBlock),
      ...payload.actions.map(serializeBlock),
    ],
  };
}

function normalizeRunStatus(value: unknown): SkillRunStatus {
  const normalized = safeText(value).toLowerCase();
  if (normalized === "success" || normalized === "failed" || normalized === "skipped" || normalized === "pending") {
    return normalized;
  }
  return "pending";
}

function normalizeLogEvent(value: unknown, index: number): SkillLogEvent {
  const record = value && typeof value === "object" ? (value as RawRecord) : {};
  return {
    id: pickString(record, ["id", "event_id"], `event_${index}`),
    status: normalizeRunStatus(record.status ?? "pending"),
    timestamp: pickNullableTimestamp(record, ["timestamp", "created_at", "createdAt"]),
    message: pickString(record, ["message", "event", "detail"], "Event recorded."),
  };
}

function normalizeRun(value: unknown): SkillRun {
  const record = value && typeof value === "object" ? (value as RawRecord) : {};
  const events = pickArray(record.events).map((item, index) => normalizeLogEvent(item, index));
  const result = toRecord(record.result_json ?? record.result ?? null);
  return {
    id: pickString(record, ["id", "run_id"]),
    skillId: pickString(record, ["skill_id", "skillId"]),
    status: normalizeRunStatus(record.status),
    startedAt: pickNullableTimestamp(record, ["started_at", "startedAt"]),
    finishedAt: pickNullableTimestamp(record, ["finished_at", "finishedAt"]),
    createdAt: pickNullableTimestamp(record, ["created_at", "createdAt"]),
    durationMs: pickNumber(record, ["duration_ms", "durationMs"], 0),
    message: pickString(record, ["message", "summary"], "Run complete."),
    errorMessage: pickNullableString(record, ["error_message", "errorMessage", "error"]),
    result,
    triggeredBy: pickNullableString(record, ["triggered_by", "triggeredBy"]),
    jobId: pickNullableString(record, ["job_id", "jobId"]),
    scheduleId: pickNullableString(record, ["schedule_id", "scheduleId"]),
    events,
  };
}

export async function listSkills(params: SkillListParams = {}): Promise<SkillListResult> {
  const response = await api.get("/skills", {
    params: {
      q: params.q?.trim() || undefined,
      status: params.status && params.status !== "all" ? params.status : undefined,
      skill_type:
        params.skillType && params.skillType !== "all" ? params.skillType : undefined,
    },
  });
  const rows = unwrapRows(response.data);
  return {
    rows: rows.map(normalizeSkill),
    total: unwrapTotal(response.data, rows),
  };
}

export async function getSkill(skillId: string): Promise<Skill> {
  const response = await api.get(`/skills/${skillId}`);
  return normalizeSkill(unwrapItem(response.data));
}

export async function createSkill(payload: SaveSkillPayload): Promise<Skill> {
  const response = await api.post("/skills", serializeSkillPayload(payload));
  return normalizeSkill(unwrapItem(response.data));
}

export async function updateSkill(skillId: string, payload: SaveSkillPayload): Promise<Skill> {
  const body = serializeSkillPayload(payload);
  try {
    const response = await api.put(`/skills/${skillId}`, body);
    return normalizeSkill(unwrapItem(response.data));
  } catch {
    const response = await api.patch(`/skills/${skillId}`, body);
    return normalizeSkill(unwrapItem(response.data));
  }
}

export async function patchSkillStatus(skillId: string, status: SkillStatus): Promise<Skill> {
  const response = await api.patch(`/skills/${skillId}`, { status });
  return normalizeSkill(unwrapItem(response.data));
}

export async function deleteSkill(skillId: string): Promise<void> {
  await api.delete(`/skills/${skillId}`);
}

export async function executeSkill(skillId: string): Promise<{ ok: boolean; message: string }> {
  const response = await api.post(`/skills/${skillId}/execute`, {});
  const payload = unwrapItem(response.data);
  return {
    ok: payload.success !== false,
    message: pickString(payload, ["message"], "Skill test queued."),
  };
}

export async function listSkillRuns(skillId: string, limit = 20): Promise<SkillRun[]> {
  try {
    const response = await api.get(`/skills/${skillId}/runs`, { params: { limit } });
    const rows = unwrapRows(response.data);
    return rows.map(normalizeRun);
  } catch {
    return [];
  }
}

export async function validateSkillSchedule(trigger: SkillTriggerBlock): Promise<SkillScheduleValidationResult> {
  const response = await api.post("/skills/schedule/validate", {
    trigger: serializeBlock(trigger),
  });
  const payload = response.data && typeof response.data === "object" ? (response.data as RawRecord) : {};
  return {
    valid: payload.valid === true,
    errors: Array.isArray(payload.errors) ? payload.errors.map((item) => safeText(item)).filter(Boolean) : [],
    upcoming: Array.isArray(payload.upcoming) ? payload.upcoming.map((item) => safeText(item)).filter(Boolean) : [],
    cronExpression: pickNullableString(payload, ["cron_expression", "cronExpression"]),
    timezone: pickNullableString(payload, ["timezone"]),
  };
}

export async function getSkillSchedulerHealth(): Promise<SkillSchedulerHealth> {
  try {
    const response = await api.get("/skills/scheduler/status");
    const payload = response.data && typeof response.data === "object" ? (response.data as RawRecord) : {};
    return {
      healthy: payload.healthy === true,
      reason: pickNullableString(payload, ["reason"]),
      lastDispatchAt: pickNullableString(payload, ["last_dispatch_at", "lastDispatchAt"]),
      secondsSinceDispatch: typeof payload.seconds_since_dispatch === "number"
        ? payload.seconds_since_dispatch
        : typeof payload.secondsSinceDispatch === "number"
          ? payload.secondsSinceDispatch
          : null,
    };
  } catch {
    return {
      healthy: false,
      reason: "Scheduler status unavailable.",
      lastDispatchAt: null,
      secondsSinceDispatch: null,
    };
  }
}

export async function getSkillScheduleUpcoming(skillId: string): Promise<SkillScheduleUpcoming> {
  try {
    const response = await api.get(`/skills/${skillId}/schedule/upcoming`);
    const payload = response.data && typeof response.data === "object" ? (response.data as RawRecord) : {};
    return {
      upcoming: Array.isArray(payload.upcoming) ? payload.upcoming.map((item) => safeText(item)).filter(Boolean) : [],
      cronExpression: pickNullableString(payload, ["cron_expr", "cronExpression"]),
      timezone: pickNullableString(payload, ["timezone"]),
      reason: pickNullableString(payload, ["reason"]),
    };
  } catch {
    return {
      upcoming: [],
      cronExpression: null,
      timezone: null,
      reason: "Saved schedule unavailable.",
    };
  }
}
