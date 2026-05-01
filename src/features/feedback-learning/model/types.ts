export type FeedbackLearningGovernanceStatus =
  | "pending"
  | "auto_applied"
  | "approved"
  | "rejected"
  | "needs_review";

export type FeedbackLearningRiskLevel = "low" | "medium" | "high";

export type FeedbackLearningTargetType =
  | "semantic_override"
  | "domain_override"
  | "planner_rule"
  | "manual_review";

export type FeedbackLearningChangeType = string;

export interface FeedbackLearningAnalysisSummary {
  analysis_id?: number | null;
  prompt_feedback_id?: number | null;
  status?: string | null;
  failure_verdict?: string | null;
  confidence?: number | null;
  analysis_json?: Record<string, unknown> | null;
}

export interface FeedbackLearningSourceFeedbackSummary {
  prompt_feedback_id?: number | null;
  workspace_id?: string | null;
  user_id?: string | null;
  vote?: string | null;
  normalized_prompt?: string | null;
  prompt_text?: string | null;
}

export interface FeedbackLearningCandidateRow {
  id: number;
  failure_analysis_id: number;
  target_type: FeedbackLearningTargetType;
  concept_key: string | null;
  domain_key: string | null;
  change_type: FeedbackLearningChangeType;
  payload_json: Record<string, unknown>;
  payload_hash: string;
  risk_level: FeedbackLearningRiskLevel;
  evidence_count: number;
  confidence: number;
  governance_status: FeedbackLearningGovernanceStatus;
  auto_apply_eligible: boolean;
  governance_reason_code: string | null;
  review_notes: string | null;
  workspace_id: string | null;
  source_scope: string;
  workspace_scope_key: string;
  analysis_summary?: FeedbackLearningAnalysisSummary | null;
  source_feedback?: FeedbackLearningSourceFeedbackSummary | null;
}

export interface FeedbackLearningCandidateDetail {
  candidate: FeedbackLearningCandidateRow;
  analysis_summary?: FeedbackLearningAnalysisSummary | null;
  source_feedback?: FeedbackLearningSourceFeedbackSummary | null;
  effective_target_key?: string | null;
}

export interface FeedbackLearningOverrideRow {
  id: number;
  status: string;
  workspace_id: string | null;
  concept_key: string | null;
  domain_key: string | null;
  override_type: string | null;
  override_key: string | null;
  override_value_json: Record<string, unknown> | null;
  approved_by: string | null;
}

export interface FeedbackLearningPromotionAuditRow {
  id: number;
  source_type: string | null;
  source_id: number | null;
  target_table: string | null;
  target_record_key: string | null;
  promotion_action: string | null;
  promotion_status: string | null;
  promoted_by: string | null;
  promoted_at: string | null;
  retry_count: number | null;
  last_retry_at: string | null;
  notes: string | null;
  error_message: string | null;
}

export interface FeedbackLearningCandidateListResponse {
  rows: FeedbackLearningCandidateRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface FeedbackLearningOverrideListResponse {
  rows: FeedbackLearningOverrideRow[];
}

export interface FeedbackLearningPromotionAuditListResponse {
  rows: FeedbackLearningPromotionAuditRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface FeedbackLearningCandidateDecisionResponse {
  candidate: FeedbackLearningCandidateRow;
  candidate_status?: string | null;
  override?: FeedbackLearningOverrideRow | Record<string, unknown> | null;
}

export interface FeedbackLearningBulkDecisionResponse {
  processed: number;
  results: FeedbackLearningCandidateDecisionResponse[];
}

export interface FeedbackLearningCandidateFilters {
  governance_status?: FeedbackLearningGovernanceStatus;
  risk_level?: FeedbackLearningRiskLevel;
  target_type?: FeedbackLearningTargetType;
  workspace_id?: string;
  change_type?: string;
  concept_key?: string;
  domain_key?: string;
  page?: number;
  page_size?: number;
}

export interface FeedbackLearningPromotionAuditFilters {
  source_type?: string;
  promotion_status?: string;
  limit?: number;
  offset?: number;
}
