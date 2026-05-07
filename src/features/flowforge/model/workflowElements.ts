import type { FlowForgeNodeType } from "./types";

export const FLOWFORGE_ELEMENT_DND_MIME = "application/queryforge-flowforge-element";

export interface FlowForgeElementDefinition {
  type: FlowForgeNodeType;
  label: string;
  description: string;
  icon: string;
  defaultData: Record<string, unknown>;
}

export const FLOWFORGE_ELEMENTS: FlowForgeElementDefinition[] = [
  {
    type: "schedule_trigger",
    label: "Schedule Trigger",
    description: "Starts a workflow from an approved recurring schedule.",
    icon: "calendar-days",
    defaultData: { rrule: "FREQ=DAILY;INTERVAL=1", mode: "test" },
  },
  {
    type: "webhook_trigger",
    label: "Webhook Trigger",
    description: "Starts from an approved inbound webhook source.",
    icon: "plug",
    defaultData: { source_key: "", event: "received", mode: "test" },
  },
  {
    type: "file_watch_trigger",
    label: "File Watch Trigger",
    description: "Starts when an allowed inbound file appears.",
    icon: "folder-open",
    defaultData: { source_key: "", event: "file_created", pattern: "*.csv", mode: "test" },
  },
  {
    type: "intake",
    label: "Intake Event",
    description: "Starts a workflow from an integration, form, or manual event.",
    icon: "inbox",
    defaultData: { source: "", event: "" },
  },
  {
    type: "matching",
    label: "Matching",
    description: "Runs a published matching policy against a resource pool and branches on matched or no match.",
    icon: "people-arrows",
    defaultData: { matching_policy_id: "" },
  },
  {
    type: "human_task",
    label: "Human Task",
    description: "Waits for a person to accept, decline, approve, or respond.",
    icon: "user-check",
    defaultData: { timeout_minutes: 120, task_mode: "sequential", communication_template_key: "flowforge.human_task" },
  },
  {
    type: "notification",
    label: "Notification",
    description: "Queues an email notification from an active communication template.",
    icon: "envelope",
    defaultData: { recipients: [], reason: "", communication_template_key: "flowforge.notification" },
  },
  {
    type: "decision",
    label: "Decision",
    description: "Branches the workflow based on response or state.",
    icon: "code-branch",
    defaultData: { outcomes: ["approved", "declined", "timed_out"] },
  },
  {
    type: "end",
    label: "End Event",
    description: "Ends the workflow and emits a final workflow event.",
    icon: "flag-checkered",
    defaultData: { event_key: "workflow_completed" },
  },
  {
    type: "event_capture",
    label: "Capture Event",
    description: "Captures reasons, notes, timings, and reporting events.",
    icon: "clipboard-list",
    defaultData: { captures: ["reason", "response_time"] },
  },
  {
    type: "iterator",
    label: "Loop / Next Item",
    description: "Moves to the next candidate or repeats part of the workflow.",
    icon: "rotate-right",
    defaultData: { loop_target: "", stop_when: "candidate_pool_exhausted" },
  },
  {
    type: "query_extract",
    label: "Query Extract",
    description: "Runs a governed saved query or semantic plan and produces a dataset artifact.",
    icon: "database",
    defaultData: { saved_query_id: "", preview_limit: "", artifact_key: "extract-results" },
  },
  {
    type: "map_transform",
    label: "Map / Transform",
    description: "Maps fields, validates rows, and normalizes values before side effects.",
    icon: "shuffle",
    defaultData: {
      mode: "run_context",
      field_mapping: [
        {
          target: "intake.requested_service",
          source: "intake.fields.serviceRequested",
          expose_to_templates: true,
        },
        {
          target: "intake.clinical_summary",
          source: "intake.fields.summary",
          expose_to_templates: true,
        },
      ],
      template_fields: ["intake.requested_service", "intake.clinical_summary"],
      validations: [{ field: "intake.requested_service", rule: "required" }],
    },
  },
  {
    type: "approval",
    label: "Approval Gate",
    description: "Requires an operator approval before risky import or export side effects.",
    icon: "stamp",
    defaultData: { approval_group: "flowforge:operator", reason: "Review data movement side effect" },
  },
  {
    type: "export",
    label: "Export",
    description: "Writes a dataset artifact to an allowlisted destination.",
    icon: "file-export",
    defaultData: { destination_key: "", format: "csv", include_header: true },
  },
  {
    type: "import",
    label: "Import",
    description: "Stages inbound data for validation before activation or publish.",
    icon: "file-import",
    defaultData: { source_key: "", filename: "", resource_set_id: "", activate: false, artifact_key: "import-results" },
  },
];

export function getFlowForgeElement(type: FlowForgeNodeType): FlowForgeElementDefinition | undefined {
  return FLOWFORGE_ELEMENTS.find((element) => element.type === type);
}

export function getFlowForgeElementIcon(type: FlowForgeNodeType): string {
  return getFlowForgeElement(type)?.icon ?? "diagram-project";
}
