import type { FlowForgeResourceRecord } from "./adminTypes";
import type {
  FlowForgeCommunicationTemplate,
  FlowForgeCommunicationTemplateAction,
  FlowForgeCommunicationTemplateBlock,
  FlowForgeCommunicationTemplateBlockType,
  FlowForgeCommunicationTemplatePayload,
  FlowForgeCommunicationTemplatePurpose,
} from "./communicationTemplateTypes";

export type TemplateDraft = {
  template_key: string;
  display_name: string;
  description: string;
  channel: "email";
  purpose: FlowForgeCommunicationTemplatePurpose;
  resource_set_id: string;
  subject: string;
  body_blocks: FlowForgeCommunicationTemplateBlock[];
  status: "draft" | "active" | "archived";
  metadata: Record<string, unknown>;
};

export type PreviewBlock =
  | { type: "heading"; content: string }
  | { type: "text"; content: string }
  | { type: "field_value"; label: string; value: string }
  | { type: "field_list"; items: Array<{ field: string; value: string }> }
  | { type: "divider" }
  | { type: "action_buttons"; actions: FlowForgeCommunicationTemplateAction[] };

export const PURPOSE_OPTIONS: FlowForgeCommunicationTemplatePurpose[] = ["human_task", "notification", "approval", "alert", "report"];
export const ACTION_OPTIONS: FlowForgeCommunicationTemplateAction[] = ["accept", "decline", "approve", "reject", "open_task"];
export const BLOCK_PALETTE: Array<{ type: FlowForgeCommunicationTemplateBlockType; label: string; icon: string }> = [
  { type: "heading", label: "Heading", icon: "fa-heading" },
  { type: "text", label: "Text", icon: "fa-align-left" },
  { type: "field_value", label: "Field", icon: "fa-tag" },
  { type: "field_list", label: "Field List", icon: "fa-list" },
  { type: "divider", label: "Divider", icon: "fa-minus" },
  { type: "action_buttons", label: "Actions", icon: "fa-square-check" },
];

const STANDARD_RUNTIME_FIELDS = [
  "task.due_at",
  "task.id",
  "task.type",
  "run.id",
  "run.mode",
  "run.status",
  "workflow.name",
  "workflow.version_number",
  "selected_resource.source_record_key",
  "selected_resource.display_name",
  "intake.requested_date",
  "context.priority",
];
const MERGE_FIELD_RE = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;

export const labelFor = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const slugifyTemplateKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

const createTemplateKeySuffix = () => Date.now().toString(36).slice(-5);

const defaultBlocks = (purpose: FlowForgeCommunicationTemplatePurpose): FlowForgeCommunicationTemplateBlock[] => {
  if (purpose === "human_task" || purpose === "approval") {
    return [
      { type: "heading", content: "Review {{resource.display_name}}" },
      { type: "text", content: "Please review this task before {{task.due_at}}." },
      { type: "field_list", fields: ["resource.display_name", "task.due_at"] },
      { type: "action_buttons", actions: purpose === "approval" ? ["approve", "reject", "open_task"] : ["accept", "decline", "open_task"] },
    ];
  }
  return [
    { type: "heading", content: "{{workflow.name}}" },
    { type: "text", content: "A FlowForge update is available for run {{run.id}}." },
    { type: "field_list", fields: ["workflow.name", "run.status"] },
  ];
};

export const createBlankDraft = (params: URLSearchParams): TemplateDraft => {
  const requestedPurpose = params.get("purpose") as FlowForgeCommunicationTemplatePurpose | null;
  const purpose = requestedPurpose && PURPOSE_OPTIONS.includes(requestedPurpose) ? requestedPurpose : "notification";
  const resourceSetId = params.get("resource_set_id") ?? "";
  return {
    template_key: `communication-template-${createTemplateKeySuffix()}`,
    display_name: "",
    description: "",
    channel: "email",
    purpose,
    resource_set_id: resourceSetId,
    subject: purpose === "human_task" ? "Action requested for {{resource.display_name}}" : "FlowForge update for {{workflow.name}}",
    body_blocks: defaultBlocks(purpose),
    status: "draft",
    metadata: {},
  };
};

export const draftFromTemplate = (template: FlowForgeCommunicationTemplate): TemplateDraft => ({
  template_key: template.template_key,
  display_name: template.display_name,
  description: template.description ?? "",
  channel: template.channel,
  purpose: template.purpose,
  resource_set_id: template.resource_set_id ? String(template.resource_set_id) : "",
  subject: template.subject,
  body_blocks: template.body_blocks,
  status: template.status,
  metadata: template.metadata ?? {},
});

export const payloadFromDraft = (draft: TemplateDraft): FlowForgeCommunicationTemplatePayload => ({
  template_key: draft.template_key.trim(),
  display_name: draft.display_name.trim(),
  description: draft.description.trim() || null,
  channel: draft.channel,
  purpose: draft.purpose,
  resource_set_id: draft.resource_set_id ? Number(draft.resource_set_id) : null,
  subject: draft.subject,
  body_blocks: draft.body_blocks,
  status: draft.status,
  metadata: draft.metadata,
});

const getValueAtPath = (context: Record<string, unknown>, path: string): unknown => {
  let current: unknown = context;
  for (const part of path.split(".")) {
    if (!part) return undefined;
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
};

const stringValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(", ");
  if (typeof value === "object") return "";
  return String(value);
};

export const renderText = (value: string, context: Record<string, unknown>) =>
  value.replace(MERGE_FIELD_RE, (_match, field: string) => stringValue(getValueAtPath(context, field)));

export const recordToPreviewContext = (record?: FlowForgeResourceRecord): Record<string, unknown> => {
  const resource = record
    ? {
        source_record_key: record.source_record_key,
        display_name: record.display_name,
        primary_email: record.primary_email,
        primary_phone: record.primary_phone,
        status: record.status,
        effective_status: record.effective_status,
        availability_status: record.availability_status,
        capacity_total: record.capacity_total,
        capacity_used: record.capacity_used,
        capacity_available: record.capacity_available,
        current_load: record.current_load,
        service_area: record.service_area,
        timezone: record.timezone,
        attributes: record.attributes ?? {},
        normalized_profile: record.normalized_profile ?? {},
      }
    : {
        source_record_key: "sample-resource",
        display_name: "Sample Resource",
        primary_email: "resource@example.com",
        availability_status: "available",
        capacity_available: 2,
        attributes: { specialty: "Sample specialty" },
        normalized_profile: {},
      };
  return {
    resource,
    selected_resource: resource,
    task: { id: "task-1001", type: "human_task", due_at: "2026-05-06T18:00:00Z" },
    run: { id: "run-1001", mode: "test", status: "waiting" },
    workflow: { name: "Sample Workflow", version_number: 1 },
    intake: { requested_date: "Friday" },
    context: { priority: "normal" },
  };
};

export const renderPreviewBlocks = (blocks: FlowForgeCommunicationTemplateBlock[], context: Record<string, unknown>): PreviewBlock[] =>
  blocks.map((block) => {
    if (block.type === "heading" || block.type === "text") {
      return { type: block.type, content: renderText(block.content, context) };
    }
    if (block.type === "field_value") {
      return {
        type: "field_value",
        label: block.label || block.field || "Value",
        value: stringValue(getValueAtPath(context, block.field)),
      };
    }
    if (block.type === "field_list") {
      return {
        type: "field_list",
        items: block.fields.map((field) => ({ field, value: stringValue(getValueAtPath(context, field)) })),
      };
    }
    if (block.type === "action_buttons") {
      return { type: "action_buttons", actions: block.actions };
    }
    return { type: "divider" };
  });

export const inferResourceFields = (records: FlowForgeResourceRecord[]) => {
  const fields = new Set<string>([
    "resource.source_record_key",
    "resource.display_name",
    "resource.primary_email",
    "resource.primary_phone",
    "resource.effective_status",
    "resource.availability_status",
    "resource.capacity_available",
    "selected_resource.source_record_key",
    "selected_resource.display_name",
  ]);
  for (const record of records) {
    Object.entries(record).forEach(([key, value]) => {
      if (value !== null && value !== undefined && typeof value !== "object") {
        fields.add(`resource.${key}`);
        fields.add(`selected_resource.${key}`);
      }
    });
    Object.keys(record.attributes ?? {}).forEach((key) => {
      fields.add(`resource.attributes.${key}`);
      fields.add(`selected_resource.attributes.${key}`);
    });
    Object.keys(record.normalized_profile ?? {}).forEach((key) => {
      fields.add(`resource.normalized_profile.${key}`);
      fields.add(`selected_resource.normalized_profile.${key}`);
    });
  }
  return Array.from(new Set([...fields, ...STANDARD_RUNTIME_FIELDS])).sort();
};

export const createBlock = (type: FlowForgeCommunicationTemplateBlockType, field = "resource.display_name"): FlowForgeCommunicationTemplateBlock => {
  if (type === "heading") return { type: "heading", content: "New section" };
  if (type === "text") return { type: "text", content: "Write the message content here." };
  if (type === "field_value") return { type: "field_value", field, label: labelFor(field.split(".").at(-1) || "Value") };
  if (type === "field_list") return { type: "field_list", fields: [field] };
  if (type === "action_buttons") return { type: "action_buttons", actions: ["open_task"] };
  return { type: "divider" };
};
