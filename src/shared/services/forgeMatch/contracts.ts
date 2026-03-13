import { z } from "zod";

export const forgeMatchSessionStatusSchema = z.enum(["uploaded", "analyzing", "analyzed", "error"]);

export const forgeMatchReviewStatusSchema = z.enum([
  "suggested",
  "accepted",
  "rejected",
  "needs_review",
  "manually_mapped",
]);

export const forgeMatchReviewActionSchema = z.enum([
  "accept",
  "reject",
  "needs_review",
  "remap",
  "edit_notes",
]);

export const forgeMatchDecisionSchema = z.enum(["matched", "ambiguous", "no_confident_match"]);
export const forgeMatchConfidenceBandSchema = z.enum(["high", "medium", "low"]);

export const forgeMatchSourcePreviewSchema = z
  .object({
    row_id: z.string().nullable().optional(),
    sheet_name: z.string().nullable().optional(),
    row_number: z.coerce.number().int().nonnegative().nullable().optional(),
    source_field_name: z.string().nullable().optional(),
    source_description: z.string().nullable().optional(),
    source_type: z.string().nullable().optional(),
    source_object_name: z.string().nullable().optional(),
    sample_value: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchUploadResponseSchema = z
  .object({
    session_id: z.string().min(1),
    workspace_id: z.string().min(1),
    uploaded_filename: z.string().min(1),
    file_type: z.string().min(1),
    status: forgeMatchSessionStatusSchema,
    sheet_count: z.coerce.number().int().nonnegative(),
    source_record_count: z.coerce.number().int().nonnegative(),
    source_preview: z.array(forgeMatchSourcePreviewSchema),
  })
  .passthrough();

export const forgeMatchSessionRecordSchema = z
  .object({
    id: z.string().min(1),
    workspace_id: z.string().min(1),
    uploaded_filename: z.string().min(1),
    file_type: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    status: forgeMatchSessionStatusSchema,
    sheet_count: z.coerce.number().int().nonnegative(),
    source_record_count: z.coerce.number().int().nonnegative(),
    analysis_job_id: z.string().nullable().optional(),
    current_phase: z.string().nullable().optional(),
    analysis_error: z.string().nullable().optional(),
    analysis_started_at: z.string().nullable().optional(),
    analysis_completed_at: z.string().nullable().optional(),
    summary_json: z.unknown().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchSessionListStatusSchema = z.enum(["uploaded", "analyzing", "analyzed"]);

export const forgeMatchSessionListRowSchema = z
  .object({
    id: z.string().min(1),
    workspace_id: z.string().min(1),
    uploaded_filename: z.string().min(1),
    file_type: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    status: forgeMatchSessionListStatusSchema,
    sheet_count: z.coerce.number().int().nonnegative().optional(),
    source_record_count: z.coerce.number().int().nonnegative().optional(),
    result_count: z.coerce.number().int().nonnegative().optional(),
    accepted_count: z.coerce.number().int().nonnegative().optional(),
    manually_mapped_count: z.coerce.number().int().nonnegative().optional(),
    analysis_started_at: z.string().nullable().optional(),
    analysis_completed_at: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchListSessionsParamsSchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    page_size: z.coerce.number().int().positive().optional(),
    status: forgeMatchSessionListStatusSchema.optional(),
    q: z.string().trim().optional(),
  })
  .partial();

export const forgeMatchListSessionsResponseSchema = z
  .object({
    rows: z.array(forgeMatchSessionListRowSchema),
    total: z.coerce.number().int().nonnegative(),
    page: z.coerce.number().int().positive(),
    page_size: z.coerce.number().int().positive(),
  })
  .passthrough();

export const forgeMatchSourceRecordSchema = z
  .object({
    id: z.coerce.number().int().nonnegative(),
    row_id: z.string().nullable().optional(),
    sheet_name: z.string().nullable().optional(),
    row_number: z.coerce.number().int().nonnegative().nullable().optional(),
    source_field_name: z.string().nullable().optional(),
    source_description: z.string().nullable().optional(),
    source_type: z.string().nullable().optional(),
    source_object_name: z.string().nullable().optional(),
    sample_value: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchColumnRefSchema = z
  .object({
    column_id: z.coerce.number().int().positive(),
    column_name: z.string().nullable().optional(),
    display_name: z.string().nullable().optional(),
    table_name: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchRetrievedCandidateSchema = z
  .object({
    column_id: z.coerce.number().int().positive().optional(),
    column_name: z.string().nullable().optional(),
    display_name: z.string().nullable().optional(),
    table_name: z.string().nullable().optional(),
    score: z.coerce.number().nullable().optional(),
    retrieval_score: z.coerce.number().nullable().optional(),
    lexical_score: z.coerce.number().nullable().optional(),
    reason_codes: z.array(z.string()).optional(),
  })
  .passthrough();

export const forgeMatchMappingSchema = z
  .object({
    mapping_id: z.string().min(1),
    source_record_id: z.coerce.number().int().nonnegative().nullable().optional(),
    source_row_id: z.string().nullable().optional(),
    sheet_name: z.string().nullable().optional(),
    row_number: z.coerce.number().int().nonnegative().nullable().optional(),
    source_field_name: z.string().nullable().optional(),
    source_description: z.string().nullable().optional(),
    source_type: z.string().nullable().optional(),
    source_object_name: z.string().nullable().optional(),
    sample_value: z.string().nullable().optional(),
    best_match: forgeMatchColumnRefSchema.nullable().optional(),
    alternates: z.array(forgeMatchRetrievedCandidateSchema),
    confidence_score: z.coerce.number().nonnegative(),
    confidence_band: forgeMatchConfidenceBandSchema,
    match_decision: forgeMatchDecisionSchema,
    explanation: z.string().nullable().optional(),
    reason_codes: z.array(z.string()),
    status: forgeMatchReviewStatusSchema,
    review_notes: z.string().nullable().optional(),
    manually_selected_workspace_column_id: z.coerce.number().int().positive().nullable().optional(),
    manual_selection: forgeMatchColumnRefSchema.nullable().optional(),
    retrieved_candidates: z.array(forgeMatchRetrievedCandidateSchema),
    reviewer_user_id: z.string().nullable().optional(),
    reviewed_at: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchSummarySchema = z
  .object({
    total: z.coerce.number().int().nonnegative(),
    status_counts: z.record(z.string(), z.coerce.number().int().nonnegative()),
    decision_counts: z.record(z.string(), z.coerce.number().int().nonnegative()),
    confidence_bands: z.record(z.string(), z.coerce.number().int().nonnegative()),
  })
  .passthrough();

export const forgeMatchAnalyzeRequestSchema = z
  .object({
    top_n: z.coerce.number().int().min(3).max(20).default(8),
    vertical_norm: z.string().trim().toLowerCase().nullable().optional(),
    domain_id: z.coerce.number().int().positive().nullable().optional(),
    force: z.boolean().default(false),
  })
  .partial();

export const forgeMatchAnalyzeResponseSchema = z
  .object({
    session_id: z.string().min(1),
    workspace_id: z.string().min(1),
    status: z.string().min(1),
    result_count: z.coerce.number().int().nonnegative(),
    analyzed_count: z.coerce.number().int().nonnegative().optional(),
    skipped_count: z.coerce.number().int().nonnegative().optional(),
    summary: forgeMatchSummarySchema,
    mappings: z.array(forgeMatchMappingSchema),
    session: forgeMatchSessionRecordSchema.optional(),
  })
  .passthrough();

export const forgeMatchRunStatusSchema = z.enum([
  "queued",
  "analyzing",
  "analyzed",
  "failed",
  "canceled",
]);

export const forgeMatchAnalyzeStartResponseSchema = z
  .object({
    job_id: z.string().min(1),
    session_id: z.string().min(1),
    workspace_id: z.string().min(1),
    status: forgeMatchRunStatusSchema,
    source_total: z.coerce.number().int().nonnegative(),
  })
  .passthrough();

export const forgeMatchAnalyzeStatusResponseSchema = z
  .object({
    job_id: z.string().min(1).optional(),
    session_id: z.string().min(1).optional(),
    workspace_id: z.string().min(1).optional(),
    status: forgeMatchRunStatusSchema,
    current_phase: z.string().nullable().optional(),
    current_source_row_id: z.string().nullable().optional(),
    source_total: z.coerce.number().int().nonnegative().optional(),
    source_done: z.coerce.number().int().nonnegative().optional(),
    source_skipped: z.coerce.number().int().nonnegative().optional(),
    source_failed: z.coerce.number().int().nonnegative().optional(),
    progress_pct: z.coerce.number().min(0).max(100).nullable().optional(),
    analysis_error: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchAnalyzeHistoryRowSchema = z
  .object({
    job_id: z.string().min(1).optional(),
    session_id: z.string().min(1).optional(),
    workspace_id: z.string().min(1).optional(),
    status: forgeMatchRunStatusSchema,
    current_phase: z.string().nullable().optional(),
    source_total: z.coerce.number().int().nonnegative().optional(),
    source_done: z.coerce.number().int().nonnegative().optional(),
    source_skipped: z.coerce.number().int().nonnegative().optional(),
    source_failed: z.coerce.number().int().nonnegative().optional(),
    progress_pct: z.coerce.number().min(0).max(100).nullable().optional(),
    analysis_error: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchAnalyzeHistoryResponseSchema = z
  .object({
    rows: z.array(forgeMatchAnalyzeHistoryRowSchema),
  })
  .passthrough();

export const forgeMatchGetSessionParamsSchema = z
  .object({
    source_limit: z.coerce.number().int().positive().optional(),
    source_offset: z.coerce.number().int().nonnegative().optional(),
    mapping_limit: z.coerce.number().int().positive().optional(),
    mapping_offset: z.coerce.number().int().nonnegative().optional(),
  })
  .partial();

export const forgeMatchSessionResponseSchema = z
  .object({
    session: forgeMatchSessionRecordSchema,
    source_records: z.array(forgeMatchSourceRecordSchema),
    mappings: z.array(forgeMatchMappingSchema),
    summary: forgeMatchSummarySchema,
  })
  .passthrough();

export const forgeMatchPatchUpdateSchema = z
  .object({
    mapping_id: z.string().min(1),
    action: forgeMatchReviewActionSchema.optional(),
    status: forgeMatchReviewStatusSchema.optional(),
    manually_selected_workspace_column_id: z.coerce.number().int().positive().nullable().optional(),
    review_notes: z.string().nullable().optional(),
  })
  .refine((value) => Boolean(value.action || value.status || value.manually_selected_workspace_column_id != null || value.review_notes != null), {
    message: "Each update must include at least one change field.",
  });

export const forgeMatchPatchRequestSchema = z.object({
  updates: z.array(forgeMatchPatchUpdateSchema).min(1),
});

export const forgeMatchPatchRowSchema = z
  .object({
    mapping_id: z.string().min(1),
    status: forgeMatchReviewStatusSchema.nullable().optional(),
    manual_column_id: z.coerce.number().int().positive().nullable().optional(),
  })
  .passthrough();

export const forgeMatchPatchResponseSchema = z
  .object({
    session_id: z.string().min(1),
    workspace_id: z.string().min(1),
    updated: z.coerce.number().int().nonnegative(),
    rows: z.array(forgeMatchPatchRowSchema),
  })
  .passthrough();

export const forgeMatchDraftRequestSchema = z
  .object({
    name: z.string().max(255).nullable().optional(),
    include_notes: z.boolean().optional(),
  })
  .partial();

export const forgeMatchDraftColumnSchema = z
  .object({
    mapping_id: z.string().min(1),
    source_field_name: z.string().nullable().optional(),
    selected_workspace_column_id: z.coerce.number().int().positive(),
    column_name: z.string().nullable().optional(),
    table_name: z.string().nullable().optional(),
  })
  .passthrough();

export const forgeMatchDraftResponseSchema = z
  .object({
    artifact_id: z.string().min(1),
    workspace_id: z.string().min(1),
    session_id: z.string().min(1),
    name: z.string().min(1),
    accepted_column_count: z.coerce.number().int().nonnegative(),
    columns: z.array(forgeMatchDraftColumnSchema),
    status: z.string().min(1),
    note: z.string().nullable().optional(),
  })
  .passthrough();

export type ForgeMatchSessionStatus = z.infer<typeof forgeMatchSessionStatusSchema>;
export type ForgeMatchReviewStatus = z.infer<typeof forgeMatchReviewStatusSchema>;
export type ForgeMatchReviewAction = z.infer<typeof forgeMatchReviewActionSchema>;
export type ForgeMatchDecision = z.infer<typeof forgeMatchDecisionSchema>;
export type ForgeMatchConfidenceBand = z.infer<typeof forgeMatchConfidenceBandSchema>;
export type ForgeMatchUploadResponse = z.infer<typeof forgeMatchUploadResponseSchema>;
export type ForgeMatchSourcePreview = z.infer<typeof forgeMatchSourcePreviewSchema>;
export type ForgeMatchSessionRecord = z.infer<typeof forgeMatchSessionRecordSchema>;
export type ForgeMatchSessionListStatus = z.infer<typeof forgeMatchSessionListStatusSchema>;
export type ForgeMatchSessionListRow = z.infer<typeof forgeMatchSessionListRowSchema>;
export type ForgeMatchListSessionsParams = z.infer<typeof forgeMatchListSessionsParamsSchema>;
export type ForgeMatchListSessionsResponse = z.infer<typeof forgeMatchListSessionsResponseSchema>;
export type ForgeMatchSourceRecord = z.infer<typeof forgeMatchSourceRecordSchema>;
export type ForgeMatchColumnRef = z.infer<typeof forgeMatchColumnRefSchema>;
export type ForgeMatchRetrievedCandidate = z.infer<typeof forgeMatchRetrievedCandidateSchema>;
export type ForgeMatchMapping = z.infer<typeof forgeMatchMappingSchema>;
export type ForgeMatchSummary = z.infer<typeof forgeMatchSummarySchema>;
export type ForgeMatchAnalyzeRequest = z.infer<typeof forgeMatchAnalyzeRequestSchema>;
export type ForgeMatchAnalyzeResponse = z.infer<typeof forgeMatchAnalyzeResponseSchema>;
export type ForgeMatchRunStatus = z.infer<typeof forgeMatchRunStatusSchema>;
export type ForgeMatchAnalyzeStartResponse = z.infer<typeof forgeMatchAnalyzeStartResponseSchema>;
export type ForgeMatchAnalyzeStatusResponse = z.infer<typeof forgeMatchAnalyzeStatusResponseSchema>;
export type ForgeMatchAnalyzeHistoryRow = z.infer<typeof forgeMatchAnalyzeHistoryRowSchema>;
export type ForgeMatchAnalyzeHistoryResponse = z.infer<typeof forgeMatchAnalyzeHistoryResponseSchema>;
export type ForgeMatchGetSessionParams = z.infer<typeof forgeMatchGetSessionParamsSchema>;
export type ForgeMatchSessionResponse = z.infer<typeof forgeMatchSessionResponseSchema>;
export type ForgeMatchPatchUpdate = z.infer<typeof forgeMatchPatchUpdateSchema>;
export type ForgeMatchPatchRequest = z.infer<typeof forgeMatchPatchRequestSchema>;
export type ForgeMatchPatchResponse = z.infer<typeof forgeMatchPatchResponseSchema>;
export type ForgeMatchDraftRequest = z.infer<typeof forgeMatchDraftRequestSchema>;
export type ForgeMatchDraftResponse = z.infer<typeof forgeMatchDraftResponseSchema>;
