// src/features/nocode-query/ui/QueryForgePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { AppHeaderBar } from "./components/AppHeaderBar";
import { PreviewCard } from "./components/PreviewSection";
import { QueryForgeBuilderDrawer } from "./components/QueryForgeBuilderDrawer";
import { QueryForgeAiPanel } from "./components/QueryForgeAiPanel";
import { QueryForgePageDialogs } from "./components/QueryForgePageDialogs";

import { SavedQueriesPanel } from "../../../shared/components/saved-queries/SavedQueriesPanel";
import { BuilderToolRailV2, ToolKeyV2 } from "./v2/BuilderToolRailV2";
import { BuilderSummaryCardV2 } from "./v2/BuilderSummaryCardV2";
import { useAppSelector } from "../../../shared/runtime/hooks";
import type { AiSuggestion, BuilderAction } from "./ai/types";
import { requestQueryStudioSuggestions } from "./ai/aiCopilotApi";
import {
  applyBuilderActionsToSqlJson,
  resolveSuggestionSqlJson,
} from "./ai/aiSuggestionHandler";

import "../ui/styles/no-code.css";
import "./v2/v2.css";
import {
  createFolder,
  moveFolder,
  moveSavedQuery,
} from "../../../shared/services/queryTreeApi";

import type { SqlColumnKey, SqlQueryJson } from "../model/sqlJson";
import { colKey } from "../model/sqlJson";
import {
  type SectionKey,
  applyExcludeErrorRowsMetaPreference,
  buildAttachmentColumnRows,
  emptySqlJson,
  hasNonEmptySqlJson,
  normalizeSqlJsonPayload,
  normalizeSqlMetaPayload,
  nowIso,
} from "./queryForgePageUtils";
import type { OpenQueryState } from "./queryForgePageTypes";
import { useQueryForgeBuilderState } from "./useQueryForgeBuilderState";
import { useQueryForgeCatalogData } from "./useQueryForgeCatalogData";
import { useQueryForgeSectionState } from "./useQueryForgeSectionState";
import { useQueryForgeWorkingQueryPersistence } from "./useQueryForgeWorkingQueryPersistence";
import { useQueryForgeSavedQueries } from "./useQueryForgeSavedQueries";
import { useQueryForgeSkillWorkflows } from "./useQueryForgeSkillWorkflows";

export const QueryForgePage: React.FC = () => {
  const location = useLocation();
  const workspaceId = useAppSelector(
    (state) => state.userWorkspaces.selectedWorkspaceId ?? null,
  );
  const selectedDatasource = useAppSelector(
    (state) => state.datasource.selectedDatasource,
  );
  const userId = useAppSelector((state) => {
    const value = state.user?.user?.user_id;
    return typeof value === "string" && value.trim().length ? value : null;
  });
  // ✅ Single source of truth
  const [sqlJson, setSqlJson] = useState<SqlQueryJson>(() => emptySqlJson());
  // Assign during render so the ref is always current by the time any effect or
  // event handler runs, regardless of which setSqlJson call path was used.
  const latestSqlJsonRef = useRef<SqlQueryJson>(sqlJson);
  latestSqlJsonRef.current = sqlJson;
  const [aiResetNonce, setAiResetNonce] = useState(0);
  const hasActiveQuery = useMemo(() => hasNonEmptySqlJson(sqlJson), [sqlJson]);
  const ensureToolMeta = (next: SqlQueryJson): SqlQueryJson => {
    const normalizedMeta = normalizeSqlMetaPayload(next.meta);
    return {
      ...next,
      meta: {
        ...(normalizedMeta ?? {}),
        tool: normalizedMeta?.tool ?? "query_builder",
      },
    };
  };

  const updateSqlJson = (updater: (cur: SqlQueryJson) => SqlQueryJson) => {
    setSqlJson((cur) => {
      const next = updater(cur);
      if (next === cur) return cur;

      // mark dirty here (one place)
      setOpenQuery((p) => ({ ...p, isDirty: true }));

      const finalized = ensureToolMeta({
        ...next,
        meta: {
          ...(next.meta ?? {}),
          updatedAt: nowIso(),
          createdAt: next.meta?.createdAt ?? cur.meta?.createdAt ?? nowIso(),
        },
      });
      return finalized;
    });
  };

  // -----------------------------
  // UI state (layout only)
  // -----------------------------
  const [openTool, setOpenTool] = useState<ToolKeyV2 | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const launchContext = useMemo(() => parseWorkflowIntelligenceLaunch(location.search), [location.search]);
  const launchAppliedRef = useRef<string | null>(null);
  const launchAutoPlanRef = useRef<string | null>(null);

  const [openQuery, setOpenQuery] = useState<OpenQueryState>({
    id: null,
    name: "New Query",
    scope: undefined,
    isDirty: false,
    description: null,
  });
  const distinctBeforeAggsRef = useRef<boolean | null>(null);
  const aiPrefKey = useMemo(
    () =>
      `queryforge_ai_open:${workspaceId ?? "workspace"}:${userId ?? "user"}`,
    [workspaceId, userId],
  );
  const aiPrefLoadedForKeyRef = useRef<string | null>(null);

  const helpActionForSection = (section: SectionKey, title: string) => {
    if (aiOpen) return undefined;
    return {
      label: "Need Help",
      ariaLabel: `Need help with ${title}`,
      iconClass: "fa-wand-magic-sparkles",
      onClick: () => {
        markSectionInteraction(section);
        setAiOpen(true);
      },
    };
  };

  const clearWorkingQueryDrafts = () => {
    if (typeof window === "undefined") return;
    const ids = new Set<string>();
    ids.add("draft");
    const lastId = localStorage.getItem("query_builder_working:last");
    if (lastId) ids.add(lastId);
    if (openQuery.id) ids.add(openQuery.id);
    ids.forEach((id) => localStorage.removeItem(`query_builder_working:${id}`));
    localStorage.removeItem("query_builder_working:last");
  };

  const openAiStandalone = () => {
    setAiOpen(true);
  };

  const toggleAiDrawer = () => {
    if (aiOpen) {
      setAiOpen(false);
      return;
    }
    openAiStandalone();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (aiPrefLoadedForKeyRef.current === aiPrefKey) return;
    aiPrefLoadedForKeyRef.current = aiPrefKey;

    const persisted = window.localStorage.getItem(aiPrefKey);
    if (persisted == null) return;
    setAiOpen(persisted === "1");
  }, [aiPrefKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(aiPrefKey, aiOpen ? "1" : "0");
  }, [aiPrefKey, aiOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && aiOpen) {
        setAiOpen(false);
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key !== "k" && key !== "/") return;

      event.preventDefault();
      toggleAiDrawer();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aiOpen, toggleAiDrawer]);

  const focusPreview = () => {
    setFullscreenKey("preview");
    showSection("preview");
    expandSection("preview");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  const [columnsSearchTerm, setColumnsSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const domainId = sqlJson.domainId;
  const hasRehydrateContent =
    (sqlJson.columns?.length ?? 0) > 0 ||
    Boolean(sqlJson.filters) ||
    Boolean(sqlJson.dataPrep) ||
    (sqlJson.sorting?.length ?? 0) > 0;
  const {
    effectiveCollapsed,
    expandSection,
    hideSection,
    markSectionInteraction,
    queryPath,
    resetSectionState,
    setFullscreenKey,
    showSection,
    toggleSection,
    visibleSections,
  } = useQueryForgeSectionState({
    domainId,
    hasRehydrateContent,
    onDomainSelectReset: () => {
      setColumnsSearchTerm("");
      setCurrentPage(1);
    },
  });
  const {
    canDeleteLibraryQueries,
    canManageLibrary,
    canSaveToLibrary,
    closeMoveModal,
    closeNameDialog,
    closeShareModal,
    currentUserName,
    handleSavedQueriesAction,
    moveModalOpen,
    moveTarget,
    nameDialogConfirmLabel,
    nameDialogLabel,
    nameDialogOpen,
    nameDialogTitle,
    nameDialogValue,
    recentQueries,
    refetchTree,
    savedQueriesOpen,
    savedQueriesSearch,
    selectedSavedQueryId,
    setActiveTool,
    setNameDialogValue,
    setSavedQueriesSearch,
    setSelectedSavedQueryId,
    shareModalOpen,
    shareQueryId,
    skillQueryOptions,
    submitNameDialog,
    toggleSavedQueries,
    trees,
    findNodeAcrossTrees,
  } = useQueryForgeSavedQueries({
    setColumnsSearchTerm,
    setCurrentPage,
    setSqlJson,
    setOpenQuery,
    ensureToolMeta,
    normalizeSqlJsonPayload,
  });

  const resetQueryStudioState = (opts?: { keepAiOpen?: boolean }) => {
    setSelectedSavedQueryId(undefined);
    setColumnsSearchTerm("");
    setCurrentPage(1);
    setSqlJson(ensureToolMeta(emptySqlJson()));
    setOpenQuery({
      id: null,
      name: "New Query",
      scope: undefined,
      isDirty: false,
      description: null,
      folderId: null,
    });
    resetSectionState();
    setOpenTool(null);
    setAiResetNonce((prev) => prev + 1);
    setAiOpen(Boolean(opts?.keepAiOpen));
  };

  const handleNewQuery = () => {
    clearWorkingQueryDrafts();
    resetQueryStudioState();
  };

  useQueryForgeWorkingQueryPersistence({
    openQuery,
    selectedSavedQueryId,
    sqlJson,
    ensureToolMeta,
    normalizeSqlJsonPayload,
    setSqlJson,
    setOpenQuery,
    setSelectedSavedQueryId,
  });
  const {
    closeSaveModal,
    handleSaveQuery,
    openSaveModal,
    openSkillsFromQueryContext,
    saveModalOpen,
    skillDeleteDialogProps,
    skillDrawerProps,
  } = useQueryForgeSkillWorkflows({
    workspaceId,
    openQuery,
    setOpenQuery,
    sqlJson,
    ensureToolMeta,
    setSelectedSavedQueryId,
    refetchTree,
    skillQueryOptions,
  });

  const toggleToolV2 = (key: ToolKeyV2) => {
    setOpenTool((prev) => (prev === key ? null : key));
    if (!visibleSections[key]) showSection(key);
    markSectionInteraction(key);
  };

  const openToolV2 = (key: ToolKeyV2) => {
    setOpenTool(key);
    if (!visibleSections[key]) showSection(key);
    markSectionInteraction(key);
  };

  const goToDrawerStep = (key: ToolKeyV2) => () => openToolV2(key);
  const goToPreviewFromDrawer = () => {
    setOpenTool(null);
    focusPreview();
  };
  const closeDrawer = () => setOpenTool(null);

  // -----------------------------
  // Business state (derived from sqlJson)
  // -----------------------------
  const attachmentRows = useMemo(
    () => buildAttachmentColumnRows(sqlJson),
    [sqlJson],
  );

  const renameOpenQuery = (nextName: string) => {
    setOpenQuery((p) => ({ ...p, name: nextName, isDirty: true }));
  };
  const {
    aiCandidates,
    aiDomainContext,
    aiSqlJsonContext,
    allRows,
    columnsQ,
    domainOptions,
    domainsQ,
    pageRows,
    totalColumns,
  } = useQueryForgeCatalogData({
    domainId,
    currentPage,
    columnsSearchTerm,
    attachmentRows,
    openTool,
    sqlJson,
    hasActiveQuery,
  });

  const {
    aggsActive,
    allColumnKeysForFilters,
    availableColumnKeys,
    columnsMeta,
    excludeErrorRows,
    keyForColumnIdentityKey,
    keyForColumnName,
    prompt,
    removeSelected,
    selectedColumnKeysForUi,
    selectedColumns,
    setAggsInJson,
    setCohortAttachment,
    setColumnsInJson,
    setDataPrepInJson,
    setDomainIdInJson,
    setFiltersInJson,
    setPrompt,
    setSortingInJson,
    setValueOverrideAttachments,
    toggleColumn,
  } = useQueryForgeBuilderState({
    sqlJson,
    attachmentRows,
    allRows,
    pageRows,
    updateSqlJson,
    distinctBeforeAggsRef,
  });

  useEffect(() => {
    if (!launchContext) return;
    const signature = `${launchContext.domainKey}:${launchContext.domainId ?? ""}:${launchContext.readModel}:${launchContext.prompt ?? ""}`;
    if (launchAppliedRef.current === signature) return;
    launchAppliedRef.current = signature;

    setPrompt(launchContext.prompt ?? "");
    updateSqlJson((cur) => ({
      ...cur,
      domainId: launchContext.domainId ?? cur.domainId ?? null,
      prompt: launchContext.prompt ?? cur.prompt ?? "",
      meta: {
        ...(cur.meta ?? {}),
        source: "flowforge",
        workflowIntelligenceLaunch: {
          domainKey: launchContext.domainKey,
          readModel: launchContext.readModel,
          defaultFilters: launchContext.defaultFilters,
        },
      },
    }));
    setOpenQuery((prev) => ({
      ...prev,
      name: `Workflow Intelligence: ${launchContext.domainKey}`,
      description: `Workflow read model ${launchContext.readModel}`,
      isDirty: true,
    }));
    setAiOpen(true);
    showSection("prompt");
    expandSection("prompt");
  }, [expandSection, launchContext, setPrompt, showSection, updateSqlJson]);

  const applyAiBuilderActions = (actions: BuilderAction[]) => {
    if (!actions.length) return;
    updateSqlJson((cur) => applyBuilderActionsToSqlJson(cur, actions));
  };

  const applyAiSuggestion = (suggestion: AiSuggestion) => {
    updateSqlJson((cur) => {
      const resolved = resolveSuggestionSqlJson(
        cur,
        suggestion,
        normalizeSqlJsonPayload,
      );
      return resolved.changed ? ensureToolMeta(resolved.nextSqlJson) : cur;
    });
  };

  useEffect(() => {
    if (!launchContext?.prompt || !launchContext.domainId) return;
    const signature = `${workspaceId ?? "workspace"}:${launchContext.domainKey}:${launchContext.domainId}:${launchContext.prompt}`;
    if (launchAutoPlanRef.current === signature) return;
    launchAutoPlanRef.current = signature;

    const controller = new AbortController();
    requestQueryStudioSuggestions(
      {
        workspaceId: workspaceId ?? null,
        activeSection: "AI First",
        userPrompt: launchContext.prompt,
        baseDomainId: launchContext.domainId,
      },
      controller.signal
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        const suggestion =
          response.suggestions.find((item) => item.sqlJson) ??
          response.suggestions[0];
        if (suggestion) {
          applyAiSuggestion(suggestion);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          launchAutoPlanRef.current = null;
        }
      });

    return () => controller.abort();
  }, [launchContext, workspaceId]);

  return (
    <div className={`ncqv2-root ${aiOpen ? "ncqv2-ai-open" : ""}`}>
      <style>{`
        @keyframes ncq-show {
          0% { opacity: 0; transform: translateX(-90px) scale(0.92); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>

      <div className="ncqv2-layout">
        <div className="ncqv2-rails">
          <BuilderToolRailV2
            openTool={openTool}
            onToggle={toggleToolV2}
            onSave={openSaveModal}
            onToggleSavedQueries={toggleSavedQueries}
            savedQueriesOpen={savedQueriesOpen}
          />

          <SavedQueriesPanel
            open={savedQueriesOpen}
            width={360}
            railNudgePx={0}
            search={savedQueriesSearch}
            onChangeSearch={setSavedQueriesSearch}
            selectedQueryId={selectedSavedQueryId}
            onSelectQuery={(id) => setSelectedSavedQueryId(id)}
            onClose={() => setActiveTool(null)}
            treeLibrary={trees.library}
            treeShared={trees.shared}
            treeMy={trees.my}
            treeTrash={trees.trash}
            recent={recentQueries}
            currentUserName={currentUserName}
            canSaveToLibrary={canSaveToLibrary}
            canManageLibrary={canManageLibrary}
            canDeleteLibraryQueries={canDeleteLibraryQueries}
            onAction={handleSavedQueriesAction}
          />
        </div>

        <div className="ncqv2-canvas">
          <AppHeaderBar
            queryPath={queryPath}
            queryName={openQuery.name}
            queryNameDirty={openQuery.isDirty}
            queryIsSaved={Boolean(openQuery.id)}
            onRenameQuery={renameOpenQuery}
            onNewQuery={handleNewQuery}
            onNameBlurSave={openSaveModal}
            onOpenSkills={openSkillsFromQueryContext}
          />
          {launchContext ? (
            <div className="ncqv2-launch-context" role="status">
              <div>
                <span>Workflow Intelligence domain</span>
                <strong>{launchContext.domainKey}</strong>
              </div>
              <code>{launchContext.readModel}</code>
            </div>
          ) : null}

          <div className="mt-3">
            <BuilderSummaryCardV2
              sqlJson={sqlJson}
              domainOptions={domainOptions}
              onOpenTool={openToolV2}
              collapsed={summaryCollapsed}
              onToggleCollapsed={() => setSummaryCollapsed((prev) => !prev)}
            />
          </div>

          <div
            className="ncqv2-preview"
            onFocusCapture={() => markSectionInteraction("preview")}
            onMouseDownCapture={() => markSectionInteraction("preview")}
          >
            <PreviewCard
              sqlJson={sqlJson}
              getLatestSqlJson={() => latestSqlJsonRef.current}
              persistKey={openQuery.id ?? "draft"}
              exportBaseName={openQuery.name ?? "query_export"}
              queryId={openQuery.id ?? null}
              workspaceId={workspaceId}
              helpAction={helpActionForSection("preview", "Results")}
              extraActions={
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={openSkillsFromQueryContext}
                  title="Create automation skills"
                >
                  <i className="fa fa-bolt me-1" />
                  Skills
                </button>
              }
              collapsed={previewCollapsed}
              onToggleCollapsed={() => setPreviewCollapsed((prev) => !prev)}
              onHide={() => {}}
              datasource={selectedDatasource}
            />
          </div>
        </div>
      </div>

      <QueryForgeBuilderDrawer
        openTool={openTool}
        onClose={() => setOpenTool(null)}
        offsetForAi={aiOpen}
        onFocusSection={markSectionInteraction}
        onHideSection={(section) => {
          hideSection(section);
          setOpenTool(null);
        }}
        collapsedFor={effectiveCollapsed}
        toggleSection={toggleSection}
        onChangeDistinct={(value) =>
          updateSqlJson((cur) => ({
            ...cur,
            distinct: value,
          }))
        }
        helpActionForSection={helpActionForSection}
        goToDrawerStep={goToDrawerStep}
        goToPreviewFromDrawer={goToPreviewFromDrawer}
        closeDrawer={closeDrawer}
        visibleSections={visibleSections}
        showSection={showSection}
        expandSection={expandSection}
        domainOptions={domainOptions}
        domainId={domainId}
        setDomainIdInJson={setDomainIdInJson}
        workspaceId={workspaceId}
        allRows={allRows}
        sqlJson={sqlJson}
        setValueOverrideAttachments={setValueOverrideAttachments}
        setCohortAttachment={setCohortAttachment}
        aggsActive={aggsActive}
        excludeErrorRows={excludeErrorRows}
        onChangeExcludeErrorRows={(value) =>
          updateSqlJson((cur) => ({
            ...cur,
            meta: applyExcludeErrorRowsMetaPreference(
              cur.meta as Record<string, unknown> | null,
              value,
            ),
          }))
        }
        domainsLoading={domainsQ.isLoading}
        domainsError={
          domainsQ.isError ? (domainsQ.error as Error)?.message : undefined
        }
        onRetryDomains={() => {
          void domainsQ.refetch();
        }}
        pageRows={pageRows}
        totalColumns={totalColumns}
        columnsSearchTerm={columnsSearchTerm}
        setColumnsSearchTerm={setColumnsSearchTerm}
        setCurrentPage={setCurrentPage}
        selectedColumnKeysForUi={selectedColumnKeysForUi}
        keyForColumnIdentityKey={keyForColumnIdentityKey}
        toggleColumn={toggleColumn}
        removeSelected={removeSelected}
        currentPage={currentPage}
        columnsLoading={columnsQ.isLoading}
        columnsError={
          columnsQ.isError ? (columnsQ.error as Error)?.message : undefined
        }
        setColumnsInJson={setColumnsInJson}
        selectedColumns={selectedColumns}
        setDataPrepInJson={setDataPrepInJson}
        availableColumnKeys={availableColumnKeys}
        allColumnKeysForFilters={allColumnKeysForFilters}
        setFiltersInJson={setFiltersInJson}
        columnsMeta={columnsMeta}
        setAggsInJson={setAggsInJson}
        setSortingInJson={setSortingInJson}
      />

      <QueryForgeAiPanel
        aiOpen={aiOpen}
        aiResetNonce={aiResetNonce}
        workspaceId={workspaceId}
        userId={userId}
        sqlJson={aiSqlJsonContext}
        domainContext={aiDomainContext}
        candidates={aiCandidates}
        initialPrompt={launchContext?.prompt ?? null}
        setAiOpen={setAiOpen}
        onApplySuggestion={applyAiSuggestion}
        onToggle={toggleAiDrawer}
      />

      <QueryForgePageDialogs
        saveModalProps={{
          open: saveModalOpen,
          myTree: trees.my,
          myLabel: currentUserName,
          initialName: openQuery.name,
          initialDescription: openQuery.description,
          initialFolderId: openQuery.folderId ?? null,
          showAttachSkillOption: true,
          attachSkillLabel: "Attach Skill",
          onClose: closeSaveModal,
          onSave: handleSaveQuery,
        }}
        skillDrawerProps={skillDrawerProps}
        skillDeleteDialogProps={skillDeleteDialogProps}
        nameDialogProps={{
          open: nameDialogOpen,
          title: nameDialogTitle,
          label: nameDialogLabel,
          value: nameDialogValue,
          onChange: setNameDialogValue,
          confirmLabel: nameDialogConfirmLabel,
          onConfirm: submitNameDialog,
          onClose: closeNameDialog,
        }}
        moveModalProps={{
          open: moveModalOpen,
          target: moveTarget,
          tree: moveTarget?.view === "library" ? trees.library : trees.my,
          rootLabel:
            moveTarget?.view === "library" ? "Library" : currentUserName,
          onClose: closeMoveModal,
          onCreateFolder: async (parentId, name) => {
            await createFolder({
              name,
              parentId,
              scope: moveTarget?.view === "library" ? "library" : "my",
            });
            await refetchTree();
          },
          onMove: async (folderId) => {
            if (!moveTarget) return;
            if (moveTarget.type === "folder") {
              await moveFolder(moveTarget.id, { parentId: folderId });
            } else {
              await moveSavedQuery(moveTarget.id, folderId);
            }
            closeMoveModal();
            await refetchTree();
          },
        }}
        shareModalProps={{
          open: shareModalOpen,
          queryId: shareQueryId,
          queryName: shareQueryId
            ? (findNodeAcrossTrees(shareQueryId)?.name ?? "Query")
            : null,
          onClose: closeShareModal,
          onRefetchTree: refetchTree,
        }}
      />
    </div>
  );
};

type WorkflowIntelligenceLaunch = {
  domainKey: string;
  domainId: number | null;
  readModel: string;
  prompt: string | null;
  defaultFilters: unknown[];
};

function parseWorkflowIntelligenceLaunch(search: string): WorkflowIntelligenceLaunch | null {
  const params = new URLSearchParams(search);
  if (params.get("source") !== "flowforge") return null;
  const domainKey = params.get("domain_key")?.trim();
  const readModel = params.get("read_model")?.trim();
  if (!domainKey || !readModel) return null;
  return {
    domainKey,
    domainId: parsePositiveInt(params.get("domain_id")),
    readModel,
    prompt: params.get("prompt")?.trim() || null,
    defaultFilters: parseLaunchFilters(params.get("default_filters")),
  };
}

function parseLaunchFilters(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePositiveInt(raw: string | null): number | null {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default QueryForgePage;
