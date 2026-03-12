export type PromptFeedbackVote = "up" | "down";

export interface PromptFeedbackRow {
  id: number;
  vote: PromptFeedbackVote;
  user_id: string | null;
  trace_id: string | null;
  normalized_prompt: string | null;
  prompt_text: string | null;
  created_at: string | null;
  updated_at: string | null;
  payload?: Record<string, unknown> | null;
}

export interface PromptFeedbackListResponse {
  rows: PromptFeedbackRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface PromptFeedbackListParams {
  limit?: number;
  offset?: number;
  vote?: PromptFeedbackVote;
  user_id?: string;
  trace_id?: string;
  include_payload?: boolean;
}
