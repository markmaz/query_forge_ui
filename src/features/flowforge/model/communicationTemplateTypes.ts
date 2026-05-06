export type FlowForgeCommunicationTemplatePurpose = "human_task" | "notification" | "approval" | "alert" | "report";
export type FlowForgeCommunicationTemplateStatus = "draft" | "active" | "archived";
export type FlowForgeCommunicationTemplateValidationStatus = "pending" | "valid" | "invalid" | "warning";
export type FlowForgeCommunicationTemplateBlockType =
  | "heading"
  | "text"
  | "field_value"
  | "field_list"
  | "divider"
  | "action_buttons";

export type FlowForgeCommunicationTemplateAction = "accept" | "decline" | "approve" | "reject" | "open_task";

export type FlowForgeCommunicationTemplateBlock =
  | { type: "heading"; content: string }
  | { type: "text"; content: string }
  | { type: "field_value"; field: string; label?: string }
  | { type: "field_list"; fields: string[] }
  | { type: "divider" }
  | { type: "action_buttons"; actions: FlowForgeCommunicationTemplateAction[] };

export interface FlowForgeCommunicationTemplateValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  referenced_fields: string[];
  referenced_actions: string[];
  preview?: {
    subject?: string;
    html?: string;
  };
}

export interface FlowForgeCommunicationTemplate {
  id: number;
  workspace_id: string;
  template_key: string;
  display_name: string;
  description?: string | null;
  channel: "email";
  purpose: FlowForgeCommunicationTemplatePurpose;
  resource_set_id?: number | null;
  subject: string;
  body_blocks: FlowForgeCommunicationTemplateBlock[];
  status: FlowForgeCommunicationTemplateStatus;
  validation_status: FlowForgeCommunicationTemplateValidationStatus;
  validation_result: Partial<FlowForgeCommunicationTemplateValidation> & Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
  activated_at?: string | null;
}

export interface FlowForgeCommunicationTemplatePayload {
  template_key?: string;
  display_name: string;
  description?: string | null;
  channel?: "email";
  purpose?: FlowForgeCommunicationTemplatePurpose;
  resource_set_id?: number | null;
  subject: string;
  body_blocks: FlowForgeCommunicationTemplateBlock[];
  status?: FlowForgeCommunicationTemplateStatus;
  metadata?: Record<string, unknown>;
}

export interface FlowForgeCommunicationTemplateAIDraftRequest {
  prompt: string;
  purpose: FlowForgeCommunicationTemplatePurpose;
  channel: "email";
  resource_set_id?: number | null;
  required_actions?: FlowForgeCommunicationTemplateAction[];
  tone?: string | null;
  use_llm?: boolean;
}

export interface FlowForgeCommunicationTemplateAIDraft {
  id: number;
  workspace_id: string;
  purpose: FlowForgeCommunicationTemplatePurpose;
  channel: "email";
  resource_set_id?: number | null;
  prompt: string;
  tone?: string | null;
  required_actions: FlowForgeCommunicationTemplateAction[];
  subject: string;
  body_blocks: FlowForgeCommunicationTemplateBlock[];
  plain_language_summary?: string | null;
  validation_status: FlowForgeCommunicationTemplateValidationStatus;
  validation_result: Partial<FlowForgeCommunicationTemplateValidation> & Record<string, unknown>;
  model_provider?: string | null;
  model_name?: string | null;
  status: string;
  draft_source?: string | null;
  created_at?: string | null;
}
