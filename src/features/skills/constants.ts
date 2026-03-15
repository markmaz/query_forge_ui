import type {
  SkillActionBlock,
  SkillActionType,
  SkillConditionBlock,
  SkillConditionType,
  SkillStatus,
  SkillTemplate,
  SkillTriggerBlock,
  SkillTriggerType,
  SkillType,
} from "./types";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const SKILL_STATUS_LABELS: Record<SkillStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  error: "Error",
};

export const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  threshold_alert: "Threshold Alert",
  ai_summary_digest: "AI Summary Digest",
  webhook_delivery: "Webhook Delivery",
  data_freshness_check: "Data Freshness Check",
  email_report: "Email Report",
  slack_delivery: "Slack Delivery",
  custom: "Custom",
};

export const TRIGGER_LABELS: Record<SkillTriggerType, string> = {
  schedule: "Schedule",
  query_run: "Query Run",
  manual: "Manual",
  data_freshness_check: "Data Freshness Check",
  threshold_alert: "Threshold Alert",
};

export const CONDITION_LABELS: Record<SkillConditionType, string> = {
  metric_threshold: "Metric Threshold",
  row_count_threshold: "Row Count Threshold",
  changed_result: "Changed Result",
  no_new_rows: "No New Rows",
  custom_rule: "Custom Rule",
};

export const ACTION_LABELS: Record<SkillActionType, string> = {
  email_report: "Email Report",
  ai_summary_digest: "AI Summary Digest",
  webhook_delivery: "Webhook Delivery",
  slack_delivery: "Slack Delivery",
};

export function createDefaultTrigger(type: SkillTriggerType = "schedule"): SkillTriggerBlock {
  const shared = {
    id: createId("trigger"),
    kind: "trigger" as const,
    type,
    label: TRIGGER_LABELS[type],
    enabled: true,
  };

  switch (type) {
    case "schedule":
      return {
        ...shared,
        config: {
          frequency: "daily",
          day_of_week: "monday",
          time: "08:00",
          timezone: "America/Chicago",
          active: true,
        },
      };
    case "query_run":
      return {
        ...shared,
        config: {
          run_mode: "both",
          on_success_only: true,
          include_failures: false,
        },
      };
    case "threshold_alert":
      return {
        ...shared,
        config: {
          metric: "",
          operator: ">",
          threshold: 1000000,
          compare_mode: "latest",
        },
      };
    case "data_freshness_check":
      return {
        ...shared,
        config: {
          freshness_column: "",
          expected_cadence: "daily",
          interval_value: 1,
          interval_unit: "day",
        },
      };
    case "manual":
    default:
      return {
        ...shared,
        config: {
          notes: "Run manually",
        },
      };
  }
}

export function createDefaultCondition(
  type: SkillConditionType = "metric_threshold"
): SkillConditionBlock {
  const shared = {
    id: createId("condition"),
    kind: "condition" as const,
    type,
    label: CONDITION_LABELS[type],
    enabled: true,
  };

  switch (type) {
    case "metric_threshold":
      return {
        ...shared,
        config: {
          metric: "",
          operator: ">",
          value: 0,
        },
      };
    case "row_count_threshold":
      return {
        ...shared,
        config: {
          operator: ">",
          value: 0,
        },
      };
    case "changed_result":
      return {
        ...shared,
        config: {
          change_type: "any",
          minimum_percent_change: 0,
        },
      };
    case "no_new_rows":
      return {
        ...shared,
        config: {
          interval_value: 1,
          interval_unit: "day",
        },
      };
    case "custom_rule":
    default:
      return {
        ...shared,
        config: {
          expression: "",
        },
      };
  }
}

export function createDefaultAction(type: SkillActionType = "email_report"): SkillActionBlock {
  const shared = {
    id: createId("action"),
    kind: "action" as const,
    type,
    label: ACTION_LABELS[type],
    enabled: true,
  };

  switch (type) {
    case "email_report":
      return {
        ...shared,
        config: {
          recipients: "",
          cc: "",
          bcc: "",
          subject: "QueryForge report",
          message_body: "",
          include_table: true,
          include_chart: true,
          include_csv: false,
          include_ai_summary: false,
        },
      };
    case "ai_summary_digest":
      return {
        ...shared,
        config: {
          summary_style: "executive",
          prompt_template: "Summarize notable changes and key trends.",
          destinations: "email",
          length: "short",
          tone: "professional",
          model: "",
        },
      };
    case "webhook_delivery":
      return {
        ...shared,
        config: {
          endpoint_url: "",
          method: "POST",
          headers_json: "{}",
          payload_template: "default",
          retry_policy: "standard",
        },
      };
    case "slack_delivery":
    default:
      return {
        ...shared,
        config: {
          webhook_url: "",
          message_template: "",
          include_summary: true,
          include_table_preview: false,
        },
      };
  }
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: "template-threshold-alert",
    name: "Threshold Alert",
    description: "Alert when a selected metric crosses a threshold.",
    skillType: "threshold_alert",
    trigger: createDefaultTrigger("schedule"),
    conditions: [createDefaultCondition("metric_threshold")],
    actions: [createDefaultAction("email_report")],
  },
  {
    id: "template-daily-ai-summary",
    name: "Daily AI Summary",
    description: "Generate a daily executive digest from query results.",
    skillType: "ai_summary_digest",
    trigger: createDefaultTrigger("schedule"),
    conditions: [],
    actions: [createDefaultAction("ai_summary_digest")],
  },
  {
    id: "template-slack-delivery",
    name: "Slack Delivery",
    description: "Post query output to a Slack channel webhook.",
    skillType: "slack_delivery",
    trigger: createDefaultTrigger("query_run"),
    conditions: [],
    actions: [createDefaultAction("slack_delivery")],
  },
  {
    id: "template-freshness",
    name: "Data Freshness Check",
    description: "Alert when no new rows are detected in expected intervals.",
    skillType: "data_freshness_check",
    trigger: createDefaultTrigger("data_freshness_check"),
    conditions: [createDefaultCondition("no_new_rows")],
    actions: [createDefaultAction("email_report")],
  },
  {
    id: "template-email-report",
    name: "Email Report",
    description: "Send recurring query reports by email.",
    skillType: "email_report",
    trigger: createDefaultTrigger("schedule"),
    conditions: [],
    actions: [createDefaultAction("email_report")],
  },
];
