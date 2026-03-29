import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelForgeMatchAnalyzeSession,
  createForgeMatchDraft,
  exportForgeMatchSession,
  fetchForgeMatchAnalyzeStatus,
  fetchForgeMatchSession,
  startForgeMatchAnalyzeSession,
  updateForgeMatchMappings,
  uploadForgeMatchDocument,
} from "../api";
import type {
  ForgeMatchAnalyzeRequest,
  ForgeMatchAnalyzeStartResponse,
  ForgeMatchAnalyzeStatusResponse,
  ForgeMatchDraftResponse,
  ForgeMatchMapping,
  ForgeMatchPatchRequest,
  ForgeMatchReviewAction,
  ForgeMatchReviewStatus,
  ForgeMatchUploadResponse,
  ForgeMatchWorkflowState,
} from "../types";

function isRunActive(status: ForgeMatchAnalyzeStatusResponse["status"] | null | undefined): boolean {
  return status === "queued" || status === "analyzing";
}

function isRunTerminal(status: ForgeMatchAnalyzeStatusResponse["status"] | null | undefined): boolean {
  return status === "analyzed" || status === "failed" || status === "canceled";
}

export function useForgeMatchWorkflow() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [sourceOffset] = useState(0);
  const [mappingOffset] = useState(0);
  const handledTerminalMarkerRef = useRef<string | null>(null);

  const [uploadPreview, setUploadPreview] = useState<ForgeMatchWorkflowState["uploadPreview"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draftResponse, setDraftResponse] = useState<ForgeMatchDraftResponse | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const sessionSelectionVersionRef = useRef(0);

  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  const invalidateActiveSession = async (targetSessionId: string | null) => {
    if (!targetSessionId) return;
    await queryClient.invalidateQueries({ queryKey: ["forge-match-session", targetSessionId] });
  };

  const sessionQ = useQuery({
    queryKey: ["forge-match-session", sessionId],
    enabled: Boolean(sessionId),
    staleTime: 10_000,
    queryFn: async () => fetchForgeMatchSession(String(sessionId), { source_offset: sourceOffset, mapping_offset: mappingOffset }),
  });

  const runStatusQ = useQuery({
    queryKey: ["forge-match-run", activeJobId],
    enabled: Boolean(activeJobId),
    staleTime: 0,
    queryFn: async () => fetchForgeMatchAnalyzeStatus(String(activeJobId)),
    refetchInterval: (query) => {
      const status = (query.state.data as ForgeMatchAnalyzeStatusResponse | undefined)?.status;
      if (!status) return 1_500;
      return isRunActive(status) ? 1_500 : false;
    },
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const status = runStatusQ.data?.status;
    if (!activeJobId || !status || !isRunTerminal(status)) return;

    const marker = `${activeJobId}:${status}`;
    if (handledTerminalMarkerRef.current === marker) return;
    handledTerminalMarkerRef.current = marker;

    if (status === "analyzed") {
      const targetSessionId = runStatusQ.data?.session_id ?? sessionId;
      setError(null);
      void invalidateActiveSession(targetSessionId);
      void queryClient.invalidateQueries({ queryKey: ["forge-match-sessions"] });
      return;
    }

    if (status === "failed") {
      const reason = String(runStatusQ.data?.analysis_error ?? "").trim();
      setError(reason || "Analyze run failed.");
      return;
    }

    setError("Analyze run was canceled.");
  }, [activeJobId, queryClient, runStatusQ.data, sessionId]);

  const uploadM = useMutation({
    mutationFn: uploadForgeMatchDocument,
    onSuccess: (response) => {
      setSessionId(response.session_id);
      setActiveJobId(null);
      setUploadPreview(response.source_preview);
      setError(null);
      setDraftResponse(null);
      void invalidateActiveSession(response.session_id);
      void queryClient.invalidateQueries({ queryKey: ["forge-match-sessions"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Upload failed.");
    },
  });

  const analyzeStartM = useMutation({
    mutationFn: async (payload: {
      request: ForgeMatchAnalyzeRequest;
      requestedSessionId: string;
      selectionVersion: number;
    }) => {
      return {
        response: await startForgeMatchAnalyzeSession(payload.requestedSessionId, payload.request),
        requestedSessionId: payload.requestedSessionId,
        selectionVersion: payload.selectionVersion,
      };
    },
    onSuccess: async ({ response, requestedSessionId, selectionVersion }) => {
      if (
        currentSessionIdRef.current !== requestedSessionId
        || sessionSelectionVersionRef.current !== selectionVersion
      ) {
        return;
      }
      setActiveJobId(response.job_id);
      handledTerminalMarkerRef.current = null;
      setError(null);
      queryClient.setQueryData(["forge-match-run", response.job_id], {
        job_id: response.job_id,
        session_id: response.session_id,
        workspace_id: response.workspace_id,
        status: response.status,
        current_phase: "queued",
        source_total: response.source_total,
        source_done: 0,
        source_skipped: 0,
        source_failed: 0,
        progress_pct: 0,
        analysis_error: null,
      } satisfies ForgeMatchAnalyzeStatusResponse);
      void queryClient.fetchQuery({
        queryKey: ["forge-match-run", response.job_id],
        queryFn: () => fetchForgeMatchAnalyzeStatus(response.job_id),
        staleTime: 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["forge-match-sessions"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Analyze failed.");
    },
  });

  const cancelAnalyzeM = useMutation({
    mutationFn: async () => {
      if (!activeJobId) throw new Error("No active analyze job.");
      return cancelForgeMatchAnalyzeSession(activeJobId);
    },
    onSuccess: (response) => {
      if (activeJobId) {
        queryClient.setQueryData(["forge-match-run", activeJobId], response);
      }
      setError(null);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to cancel analyze run.");
    },
  });

  const patchM = useMutation({
    mutationFn: async (updates: ForgeMatchPatchRequest["updates"]) => {
      if (!sessionId) throw new Error("Session is required.");
      return updateForgeMatchMappings(sessionId, updates);
    },
    onSuccess: async () => {
      setError(null);
      await invalidateActiveSession(sessionId);
      await queryClient.invalidateQueries({ queryKey: ["forge-match-sessions"] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save review updates.");
    },
  });

  const upload = async (file: File): Promise<ForgeMatchUploadResponse> => {
    return uploadM.mutateAsync(file);
  };

  const analyze = async (request: ForgeMatchAnalyzeRequest): Promise<ForgeMatchAnalyzeStartResponse> => {
    const requestedSessionId = currentSessionIdRef.current;
    if (!requestedSessionId) throw new Error("Upload a file first.");
    const result = await analyzeStartM.mutateAsync({
      request,
      requestedSessionId,
      selectionVersion: sessionSelectionVersionRef.current,
    });
    return result.response;
  };

  const cancelAnalyze = async (): Promise<void> => {
    await cancelAnalyzeM.mutateAsync();
  };

  const applyAction = async (
    mapping: ForgeMatchMapping,
    action: ForgeMatchReviewAction,
    extras: Partial<ForgeMatchPatchRequest["updates"][number]> = {}
  ): Promise<void> => {
    await patchM.mutateAsync([
      {
        mapping_id: mapping.mapping_id,
        action,
        ...extras,
      },
    ]);
  };

  const setStatus = async (
    mapping: ForgeMatchMapping,
    status: ForgeMatchReviewStatus,
    extras: Partial<ForgeMatchPatchRequest["updates"][number]> = {}
  ): Promise<void> => {
    await patchM.mutateAsync([
      {
        mapping_id: mapping.mapping_id,
        status,
        ...extras,
      },
    ]);
  };

  const exportFile = async (format: "csv" | "xlsx") => {
    if (!sessionId) throw new Error("No active session.");
    return exportForgeMatchSession(sessionId, format);
  };

  const createDraft = async (
    kind: "view_draft" | "domain_draft",
    request: { name?: string; include_notes?: boolean } = {}
  ): Promise<ForgeMatchDraftResponse> => {
    if (!sessionId) throw new Error("No active session.");
    const response = await createForgeMatchDraft(sessionId, kind, request);
    setDraftResponse(response);
    await invalidateActiveSession(sessionId);
    await queryClient.invalidateQueries({ queryKey: ["forge-match-sessions"] });
    return response;
  };

  const selectSession = useCallback((nextSessionId: string | null) => {
    const normalized = String(nextSessionId ?? "").trim();
    sessionSelectionVersionRef.current += 1;
    setSessionId(normalized || null);
    setActiveJobId(null);
    handledTerminalMarkerRef.current = null;
    setDraftResponse(null);
    setError(null);
  }, []);

  const selectJob = useCallback((nextJobId: string | null) => {
    const normalized = String(nextJobId ?? "").trim();
    setActiveJobId(normalized || null);
    handledTerminalMarkerRef.current = null;
    if (normalized) {
      setError(null);
    }
  }, []);

  const state: ForgeMatchWorkflowState = useMemo(() => {
    const runStatus = runStatusQ.data?.status ?? null;
    const hasActiveJob = Boolean(activeJobId);
    const isTerminal = isRunTerminal(runStatus);
    const runStatusError =
      hasActiveJob && runStatusQ.error instanceof Error ? runStatusQ.error.message : null;
    const selectedSession = sessionQ.data?.session ?? null;
    const sessionMatchesSelection = selectedSession?.id === sessionId;

    return {
      session: sessionMatchesSelection ? selectedSession : null,
      sourceRecords: sessionMatchesSelection ? sessionQ.data?.source_records ?? [] : [],
      mappings: sessionMatchesSelection ? sessionQ.data?.mappings ?? [] : [],
      summary: sessionMatchesSelection ? sessionQ.data?.summary ?? null : null,
      uploadPreview,
      isUploading: uploadM.isPending,
      isAnalyzing: analyzeStartM.isPending || (hasActiveJob && !isTerminal),
      isSaving: patchM.isPending,
      error: error ?? runStatusError ?? (sessionQ.error instanceof Error ? sessionQ.error.message : null),
    };
  }, [
    activeJobId,
    analyzeStartM.isPending,
    error,
    patchM.isPending,
    runStatusQ.data?.status,
    runStatusQ.error,
    sessionQ.data,
    sessionQ.error,
    uploadM.isPending,
    uploadPreview,
  ]);

  return {
    sessionId,
    activeJobId,
    runStatus: runStatusQ.data ?? null,
    state,
    draftResponse,
    upload,
    analyze,
    cancelAnalyze,
    applyAction,
    setStatus,
    exportFile,
    createDraft,
    selectSession,
    selectJob,
    clearError: useCallback(() => setError(null), []),
    isSessionLoading: sessionQ.isLoading,
    isSessionError: sessionQ.isError,
    sessionError: sessionQ.error,
    runStatusUpdatedAt: runStatusQ.dataUpdatedAt || null,
    isRunStatusLoading: runStatusQ.isLoading || runStatusQ.isFetching,
    isRunStatusPolling: runStatusQ.isFetching,
    isCancelingAnalyze: cancelAnalyzeM.isPending,
  };
}
