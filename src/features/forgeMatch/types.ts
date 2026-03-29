import type {
  ForgeMatchAnalyzeRequest,
  ForgeMatchAnalyzeHistoryResponse,
  ForgeMatchAnalyzeHistoryRow,
  ForgeMatchAnalyzeStartResponse,
  ForgeMatchAnalyzeStatusResponse,
  ForgeMatchDraftRequest,
  ForgeMatchDraftResponse,
  ForgeMatchListSessionsParams,
  ForgeMatchListSessionsResponse,
  ForgeMatchMapping,
  ForgeMatchPatchRequest,
  ForgeMatchReviewAction,
  ForgeMatchReviewStatus,
  ForgeMatchSharedPipelineSnapshot,
  ForgeMatchSharedPipelineTraceNode,
  ForgeMatchRunStatus,
  ForgeMatchSessionRecord,
  ForgeMatchSessionListRow,
  ForgeMatchSessionListStatus,
  ForgeMatchSessionResponse,
  ForgeMatchSourcePreview,
  ForgeMatchSourceRecord,
  ForgeMatchSummary,
  ForgeMatchUploadResponse,
} from "@/shared/services/forgeMatch";

export type {
  ForgeMatchAnalyzeRequest,
  ForgeMatchAnalyzeHistoryResponse,
  ForgeMatchAnalyzeHistoryRow,
  ForgeMatchAnalyzeStartResponse,
  ForgeMatchAnalyzeStatusResponse,
  ForgeMatchDraftRequest,
  ForgeMatchDraftResponse,
  ForgeMatchListSessionsParams,
  ForgeMatchListSessionsResponse,
  ForgeMatchMapping,
  ForgeMatchPatchRequest,
  ForgeMatchReviewAction,
  ForgeMatchReviewStatus,
  ForgeMatchSharedPipelineSnapshot,
  ForgeMatchSharedPipelineTraceNode,
  ForgeMatchRunStatus,
  ForgeMatchSessionRecord,
  ForgeMatchSessionListRow,
  ForgeMatchSessionListStatus,
  ForgeMatchSessionResponse,
  ForgeMatchSourcePreview,
  ForgeMatchSourceRecord,
  ForgeMatchSummary,
  ForgeMatchUploadResponse,
};

export type ForgeMatchWorkflowState = {
  session: ForgeMatchSessionRecord | null;
  sourceRecords: ForgeMatchSourceRecord[];
  mappings: ForgeMatchMapping[];
  summary: ForgeMatchSummary | null;
  uploadPreview: ForgeMatchSourcePreview[];
  isUploading: boolean;
  isAnalyzing: boolean;
  isSaving: boolean;
  error: string | null;
};
