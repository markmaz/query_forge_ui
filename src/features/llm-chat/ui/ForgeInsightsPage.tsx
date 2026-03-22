import React, { useEffect, useMemo, useRef, useState } from "react";

import { useAppSelector } from "../../../shared/runtime/hooks";
import {
  type ForgeInsightsProject,
  type ForgeInsightsThread,
} from "../../../shared/services/forgeInsightsApi";
import type { ExecutionResultsResponse } from "../../../shared/services/executionsApi";
import { ForgeInsightsStateProvider, useForgeInsightsState } from "../model/ForgeInsightsStateContext";
import {
  type ForgeInsightsResponseEvent,
  useForgeInsightsChatThread,
} from "../model/useForgeInsightsChatThread";
import { useForgeInsightsProjects } from "../model/useForgeInsightsProjects";
import { useForgeInsightsThreads } from "../model/useForgeInsightsThreads";
import AdmPivotTable from "./AdmPivotTable";
import MarkdownMessage from "./MarkdownMessage";
import { isAdmResult } from "./admPivot";
import "./ForgeInsightsPage.css";

function formatConversationPreview(preview: string | null): string {
  const normalized = preview?.trim();
  return normalized && normalized.length > 0 ? normalized : "No preview yet";
}

function formatConversationTimestamp(timestamp: string | null): { label: string; ariaLabel: string } | null {
  if (!timestamp) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = Date.now();
  const deltaMs = Math.max(0, now - parsed.getTime());
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  const label =
    deltaMs < hourMs
      ? `${Math.max(1, Math.floor(deltaMs / minuteMs))}m`
      : deltaMs < dayMs
        ? `${Math.floor(deltaMs / hourMs)}h`
        : deltaMs < weekMs
          ? `${Math.floor(deltaMs / dayMs)}d`
          : deltaMs < monthMs
            ? `${Math.floor(deltaMs / weekMs)}w`
            : deltaMs < yearMs
              ? `${Math.floor(deltaMs / monthMs)}mo`
              : `${Math.floor(deltaMs / yearMs)}y`;

  return {
    label,
    ariaLabel: parsed.toLocaleString(),
  };
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="qf-chat-skeleton-list">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={`sk-${idx}`} className="qf-chat-skeleton-item placeholder-glow">
          <span className="placeholder col-10" />
        </div>
      ))}
    </div>
  );
}

function toResultColumns(event: ForgeInsightsResponseEvent): string[] {
  const results = event.executionResults;
  if (!results) return [];

  if (Array.isArray(results.columns) && results.columns.length > 0) {
    const fromColumns = results.columns
      .map((column) => {
        if (typeof column === "string") return column;
        if (column && typeof column === "object") {
          const record = column as Record<string, unknown>;
          const nameCandidate =
            record.name ?? record.columnName ?? record.column_name ?? record.key ?? record.id;
          if (typeof nameCandidate === "string" && nameCandidate.trim()) return nameCandidate;
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry));
    if (fromColumns.length > 0) return fromColumns;
  }

  if (Array.isArray(results.rows) && results.rows.length > 0) {
    const firstRow = results.rows[0];
    if (firstRow && typeof firstRow === "object" && !Array.isArray(firstRow)) {
      return Object.keys(firstRow as Record<string, unknown>);
    }
  }

  return [];
}

function toResultsRows(event: ForgeInsightsResponseEvent): Array<Record<string, unknown>> {
  const rows = event.executionResults?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row))
  );
}

function toResultsColumnsMeta(event: ForgeInsightsResponseEvent): ExecutionResultsResponse["columns"] {
  const columns = event.executionResults?.columns;
  return Array.isArray(columns) ? columns : [];
}

function renderRawResultTable(options: {
  rows: Array<Record<string, unknown>>;
  columns: string[];
  keyPrefix: string;
  emptyLabel: string;
}) {
  const { rows, columns, keyPrefix, emptyLabel } = options;
  if (rows.length === 0 || columns.length === 0) {
    return <div className="text-muted small">{emptyLabel}</div>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0 qf-chat-results-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={`col-${keyPrefix}-${column}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, rowIdx) => (
            <tr key={`row-${keyPrefix}-${rowIdx}`}>
              {columns.map((column) => (
                <td key={`cell-${keyPrefix}-${rowIdx}-${column}`}>{String(row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectBucketHeader({
  project,
  isCollapsed,
  isBusy,
  onToggle,
  onNewConversation,
  onRename,
  onArchive,
  onDelete,
}: {
  project: ForgeInsightsProject;
  isCollapsed: boolean;
  isBusy: boolean;
  onToggle: () => void;
  onNewConversation: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

  return (
    <div className="qf-chat-thread-bucket-header">
      <button
        type="button"
        className="qf-chat-thread-bucket-toggle"
        onClick={onToggle}
        aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${project.name}`}
      >
        <i className={`fa ${isCollapsed ? "fa-caret-right" : "fa-caret-down"}`} aria-hidden="true" />
        <span>{project.name}</span>
      </button>
      <div className={`qf-chat-project-overflow ${menuOpen ? "is-open" : ""}`} ref={menuRef}>
        <button
          type="button"
          className="qf-chat-overflow-trigger"
          onClick={() => setMenuOpen((prev) => !prev)}
          disabled={isBusy}
          title={`${project.name} actions`}
          aria-label={`${project.name} actions`}
        >
          <i className="fa fa-ellipsis-h" aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div className="qf-chat-overflow-menu" role="menu" aria-label={`${project.name} actions menu`}>
            <button
              type="button"
              className="qf-chat-overflow-item"
              onClick={() => {
                onNewConversation();
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <i className="fa fa-plus" aria-hidden="true" />
              <span>New conversation</span>
            </button>
            <button
              type="button"
              className="qf-chat-overflow-item"
              onClick={() => {
                onRename();
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <i className="fa fa-pencil" aria-hidden="true" />
              <span>Rename project</span>
            </button>
            <button
              type="button"
              className="qf-chat-overflow-item"
              onClick={() => {
                onArchive();
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <i className="fa fa-archive" aria-hidden="true" />
              <span>Archive project</span>
            </button>
            <button
              type="button"
              className="qf-chat-overflow-item is-danger"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <i className="fa fa-trash" aria-hidden="true" />
              <span>Delete permanently</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  isActive,
  isBusy,
  projects,
  onOpen,
  onRename,
  onTogglePinned,
  onMove,
  onArchive,
  onDelete,
}: {
  thread: ForgeInsightsThread;
  isActive: boolean;
  isBusy: boolean;
  projects: Array<{ id: string; name: string }>;
  onOpen: () => void;
  onRename: () => void;
  onTogglePinned: () => void;
  onMove: (projectId: string | null) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const timestamp = formatConversationTimestamp(thread.last_message_at ?? thread.updated_at);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

  return (
    <div className={`qf-chat-sidebar-item ${isActive ? "is-active" : ""} ${menuOpen ? "is-menu-open" : ""}`}>
      <div className="qf-chat-sidebar-item-content">
        <button
          type="button"
          className={`qf-chat-thread-pin ${thread.is_pinned ? "is-pinned" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePinned();
          }}
          disabled={isBusy}
          aria-label={thread.is_pinned ? "Unpin conversation" : "Pin conversation"}
          title={thread.is_pinned ? "Unpin conversation" : "Pin conversation"}
        >
          <i className="fa fa-thumb-tack" aria-hidden="true" />
        </button>
        <button type="button" className="qf-chat-sidebar-item-main" onClick={onOpen} disabled={isBusy}>
          <div className="qf-chat-sidebar-item-header">
            <div className="qf-chat-sidebar-item-title">{thread.title?.trim() || "Untitled conversation"}</div>
            {timestamp ? (
              <div className="qf-chat-sidebar-item-time" aria-label={`Updated ${timestamp.ariaLabel}`}>
                {timestamp.label}
              </div>
            ) : null}
          </div>
          <div className="qf-chat-sidebar-item-meta">{formatConversationPreview(thread.preview_text)}</div>
        </button>
      </div>
      <div className={`qf-chat-overflow ${menuOpen ? "is-open" : ""}`} ref={menuRef}>
        <button
          type="button"
          className="qf-chat-overflow-trigger"
          onClick={() => setMenuOpen((prev) => !prev)}
          disabled={isBusy}
          title="Thread actions"
          aria-label="Thread actions"
        >
          <i className="fa fa-ellipsis-h" aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div className="qf-chat-overflow-menu" role="menu" aria-label="Thread actions menu">
            <button
              type="button"
              className="qf-chat-overflow-item"
              onClick={() => {
                onRename();
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <i className="fa fa-pencil" aria-hidden="true" />
              <span>Rename conversation</span>
            </button>
            <button
              type="button"
              className={`qf-chat-overflow-item ${thread.is_pinned ? "is-on" : ""}`}
              onClick={() => {
                onTogglePinned();
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <i className="fa fa-thumb-tack" aria-hidden="true" />
              <span>{thread.is_pinned ? "Unpin thread" : "Pin thread"}</span>
            </button>
            <div className="qf-chat-overflow-group-label">Move to</div>
            <button
              type="button"
              className={`qf-chat-overflow-item ${!thread.project_id ? "is-on" : ""}`}
              onClick={() => {
                onMove(null);
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <span>Unassigned</span>
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={`qf-chat-overflow-item ${thread.project_id === project.id ? "is-on" : ""}`}
                onClick={() => {
                  onMove(project.id);
                  setMenuOpen(false);
                }}
                disabled={isBusy}
              >
                <span>{project.name}</span>
              </button>
            ))}
            <button
              type="button"
              className="qf-chat-overflow-item"
              onClick={() => {
                onArchive();
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <i className="fa fa-archive" aria-hidden="true" />
              <span>Archive thread</span>
            </button>
            <button
              type="button"
              className="qf-chat-overflow-item is-danger"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
              disabled={isBusy}
            >
              <i className="fa fa-trash" aria-hidden="true" />
              <span>Delete permanently</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ForgeInsightsPageInner({ workspaceId }: { workspaceId: string | null }) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState("");
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [conversationNameDraft, setConversationNameDraft] = useState("");
  const [conversationProjectIdDraft, setConversationProjectIdDraft] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");
  const [collapsedProjectBuckets, setCollapsedProjectBuckets] = useState<Record<string, boolean>>({});
  const [collapsedUnassignedBucket, setCollapsedUnassignedBucket] = useState(false);
  const [isRenameConversationModalOpen, setIsRenameConversationModalOpen] = useState(false);
  const [renameConversationThreadId, setRenameConversationThreadId] = useState<string | null>(null);
  const [renameConversationDraft, setRenameConversationDraft] = useState("");
  const [isRenameProjectModalOpen, setIsRenameProjectModalOpen] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameProjectDraft, setRenameProjectDraft] = useState("");
  const {
    activeThreadId,
    activeConversationId,
    setActiveThread,
  } = useForgeInsightsState();
  const {
    projects,
    isLoading: isProjectsLoading,
    error: projectsError,
    createProject,
    updateProject,
    archiveProject,
    deleteProject,
  } = useForgeInsightsProjects(workspaceId);
  const {
    threads,
    unassignedThreads,
    isLoading: isThreadsLoading,
    error: threadsError,
    createThread,
    updateThread,
    moveThread,
    archiveThread,
    deleteThread,
    togglePinned,
    loadThreadDetail,
  } = useForgeInsightsThreads(workspaceId, null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const {
    messages,
    responseEvents,
    isLoading: isChatLoading,
    isSkeletonLoading: isChatSkeletonLoading,
    error: chatError,
    sessionNotice,
    sendMessage,
    retryExecution,
    cancelMessageRequest,
    resetThreadMessages,
    reloadThreadMessages,
  } = useForgeInsightsChatThread({
    workspaceId,
    activeThread,
    activeConversationId,
    onThreadUpdate: updateThread,
    onSetActiveThread: setActiveThread,
  });

  const projectBuckets = useMemo(() => {
    const buckets = projects.map((project) => ({
      project,
      threads: threads.filter((thread) => thread.project_id === project.id),
    }));
    return buckets;
  }, [projects, threads]);

  const canSend = draft.trim().length > 0;
  const hasMessages = messages.length > 0;
  const isBusy = isChatLoading || isChatSkeletonLoading;
  const [expandedExecutionCards, setExpandedExecutionCards] = useState<Record<string, boolean>>({});
  const [resultViewModeByMessageId, setResultViewModeByMessageId] = useState<Record<string, "raw" | "pivot">>({});
  const [showRowTotalsByMessageId, setShowRowTotalsByMessageId] = useState<Record<string, boolean>>({});
  const [showGrandTotalsByMessageId, setShowGrandTotalsByMessageId] = useState<Record<string, boolean>>({});
  const responseEventByMessageId = useMemo(() => {
    const map = new Map<string, ForgeInsightsResponseEvent>();
    responseEvents.forEach((event) => {
      map.set(event.assistantMessageId, event);
      if (event.resultAssistantMessageId) {
        map.set(event.resultAssistantMessageId, event);
      }
      if (event.failureAssistantMessageId) {
        map.set(event.failureAssistantMessageId, event);
      }
    });
    return map;
  }, [responseEvents]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, responseEvents, isChatLoading, chatError, sessionNotice]);

  useEffect(() => {
    setExpandedExecutionCards({});
    setResultViewModeByMessageId({});
    setShowRowTotalsByMessageId({});
    setShowGrandTotalsByMessageId({});
  }, [activeThreadId]);

  function openConversationModal(defaultProjectId?: string | null) {
    setConversationNameDraft("");
    setConversationProjectIdDraft(defaultProjectId !== undefined ? defaultProjectId : null);
    setIsConversationModalOpen(true);
  }

  function toggleProjectBucket(projectId: string) {
    setCollapsedProjectBuckets((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  }

  function openProjectModal() {
    setProjectNameDraft("");
    setProjectDescriptionDraft("");
    setIsProjectModalOpen(true);
  }

  async function handleNewConversation() {
    const created = await createThread({
      projectId: conversationProjectIdDraft ?? null,
      title: conversationNameDraft.trim() || null,
    });
    if (created) {
      setActiveThread(created.id, created.conversation_id);
      resetThreadMessages();
      setIsConversationModalOpen(false);
      setConversationNameDraft("");
    }
  }

  async function handleNewProject() {
    const created = await createProject(projectNameDraft, projectDescriptionDraft || null);
    if (!created) return;
    setCollapsedProjectBuckets((prev) => ({
      ...prev,
      [created.id]: false,
    }));
    setIsProjectModalOpen(false);
    setProjectNameDraft("");
    setProjectDescriptionDraft("");
  }

  function openRenameConversationModal(thread: ForgeInsightsThread) {
    setRenameConversationThreadId(thread.id);
    setRenameConversationDraft(thread.title?.trim() || "");
    setIsRenameConversationModalOpen(true);
  }

  async function handleRenameConversation() {
    if (!renameConversationThreadId) return;
    const updated = await updateThread(renameConversationThreadId, {
      title: renameConversationDraft.trim() || null,
    });
    if (updated) {
      setIsRenameConversationModalOpen(false);
      setRenameConversationThreadId(null);
      setRenameConversationDraft("");
    }
  }

  function openRenameProjectModal(project: ForgeInsightsProject) {
    setRenameProjectId(project.id);
    setRenameProjectDraft(project.name);
    setIsRenameProjectModalOpen(true);
  }

  async function handleRenameProject() {
    if (!renameProjectId) return;
    const updated = await updateProject(renameProjectId, {
      name: renameProjectDraft.trim(),
    });
    if (!updated) return;
    setIsRenameProjectModalOpen(false);
    setRenameProjectId(null);
    setRenameProjectDraft("");
  }

  async function moveProjectThreadsToUnassigned(projectId: string) {
    const projectThreads = threads.filter((thread) => thread.project_id === projectId);
    await Promise.allSettled(projectThreads.map((thread) => moveThread(thread.id, null)));
  }

  async function handleArchiveProject(projectId: string) {
    await moveProjectThreadsToUnassigned(projectId);
    await archiveProject(projectId);
  }

  async function handleDeleteProject(projectId: string) {
    await moveProjectThreadsToUnassigned(projectId);
    await deleteProject(projectId);
  }

  async function handleOpenThread(threadId: string) {
    const selected = threads.find((thread) => thread.id === threadId);
    if (!selected) return;
    const isSameThread = selected.id === activeThreadId;
    setActiveThread(selected.id, selected.conversation_id);
    await loadThreadDetail(threadId);
    if (isSameThread) {
      reloadThreadMessages();
    }
  }

  async function handleSendPrompt() {
    const prompt = draft.trim();
    if (!prompt) return;

    let threadForSend = activeThread;
    if (!threadForSend) {
      const created = await createThread({
        projectId: null,
        title: null,
      });
      if (!created) return;
      setActiveThread(created.id, created.conversation_id);
      threadForSend = created;
    }

    const didSend = await sendMessage(prompt, { threadOverride: threadForSend });
    if (didSend) {
      setDraft("");
    }
  }

  function handleCancelPrompt() {
    cancelMessageRequest();
  }

  function handlePromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isChatLoading) {
        handleCancelPrompt();
        return;
      }
      void handleSendPrompt();
    }
  }

  async function copyMessage(content: string) {
    if (!content.trim()) return;
    try {
      await navigator.clipboard?.writeText(content);
    } catch {
      // no-op
    }
  }

  return (
    <div className="qf-chat-page py-3 px-3 w-100">
      <section className="qf-chat-panel">
        <div className="qf-chat-header">
          <div className="qf-chat-brand">
            <h2 className="qf-chat-title">
              <span className="qf-chat-title-query">Query</span>
              <span className="qf-chat-title-forge">Forge</span>{" "}
              <span className="qf-chat-title-ai">Insights</span>
            </h2>
            <div className="qf-chat-context">Conversations</div>
          </div>
        </div>

        <div className="qf-chat-body">
          <aside className="qf-chat-sidebar" aria-label="Conversation and thread navigation">
            <button
              type="button"
              className="qf-chat-sidebar-new-thread-btn"
              onClick={() => {
                openConversationModal();
              }}
              disabled={isBusy}
              aria-label="Start a new conversation"
              title="Start a new conversation"
            >
              <span className="qf-chat-sidebar-new-thread-icon" aria-hidden="true">
                <i className="fa fa-pen-to-square" />
              </span>
              <span>New Conversation</span>
            </button>
            <button
              type="button"
              className="qf-chat-sidebar-new-project-btn"
              onClick={openProjectModal}
              disabled={isBusy}
              aria-label="Create a new project"
              title="Create a new project"
            >
              <span className="qf-chat-sidebar-new-project-icon" aria-hidden="true">
                <i className="fa fa-folder-plus qf-fa-folder-plus" />
              </span>
              <span>New Project</span>
            </button>

            <div className="qf-chat-sidebar-header">
              <h3 className="qf-chat-sidebar-title">Conversations</h3>
            </div>

            {(isThreadsLoading || isProjectsLoading) && threads.length === 0 ? <SkeletonRows count={6} /> : null}

            {!isThreadsLoading && (
              <div className="qf-chat-sidebar-list">
                {projectBuckets.map(({ project, threads: projectThreads }) => {
                  const isCollapsed = Boolean(collapsedProjectBuckets[project.id]);
                  return (
                    <div className="qf-chat-thread-bucket" key={project.id}>
                      <ProjectBucketHeader
                        project={project}
                        isCollapsed={isCollapsed}
                        isBusy={isBusy}
                        onToggle={() => toggleProjectBucket(project.id)}
                        onNewConversation={() => openConversationModal(project.id)}
                        onRename={() => openRenameProjectModal(project)}
                        onArchive={() => {
                          void handleArchiveProject(project.id);
                        }}
                        onDelete={() => {
                          void handleDeleteProject(project.id);
                        }}
                      />
                      {!isCollapsed ? (
                        <div className="qf-chat-thread-bucket-threads">
                          {projectThreads.map((thread) => (
                            <ThreadRow
                              key={thread.id}
                              thread={thread}
                              projects={projects}
                              isActive={thread.id === activeThreadId}
                              isBusy={isBusy}
                              onOpen={() => {
                                void handleOpenThread(thread.id);
                              }}
                              onRename={() => openRenameConversationModal(thread)}
                              onTogglePinned={() => {
                                void togglePinned(thread.id);
                              }}
                              onMove={(projectId) => {
                                void moveThread(thread.id, projectId);
                              }}
                              onArchive={() => {
                                void archiveThread(thread.id);
                              }}
                              onDelete={() => {
                                void deleteThread(thread.id);
                              }}
                            />
                          ))}
                          {projectThreads.length === 0 ? (
                            <div className="text-muted small px-2 py-1">No conversations in this project.</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <div className="qf-chat-thread-bucket">
                  <button
                    type="button"
                    className="qf-chat-thread-bucket-toggle"
                    onClick={() => setCollapsedUnassignedBucket((prev) => !prev)}
                    aria-label={`${collapsedUnassignedBucket ? "Expand" : "Collapse"} unassigned conversations`}
                  >
                    <i className={`fa ${collapsedUnassignedBucket ? "fa-caret-right" : "fa-caret-down"}`} aria-hidden="true" />
                    <span>Unassigned</span>
                    <span className="qf-chat-thread-bucket-count">{unassignedThreads.length}</span>
                  </button>
                  {!collapsedUnassignedBucket ? (
                    <div className="qf-chat-thread-bucket-threads">
                      {unassignedThreads.map((thread) => (
                        <ThreadRow
                          key={thread.id}
                          thread={thread}
                          projects={projects}
                          isActive={thread.id === activeThreadId}
                          isBusy={isBusy}
                          onOpen={() => {
                            void handleOpenThread(thread.id);
                          }}
                          onRename={() => openRenameConversationModal(thread)}
                          onTogglePinned={() => {
                            void togglePinned(thread.id);
                          }}
                          onMove={(projectId) => {
                            void moveThread(thread.id, projectId);
                          }}
                          onArchive={() => {
                            void archiveThread(thread.id);
                          }}
                          onDelete={() => {
                            void deleteThread(thread.id);
                          }}
                        />
                      ))}
                      {unassignedThreads.length === 0 ? (
                        <div className="text-muted small px-2 py-1">No unassigned threads.</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {projectsError || threadsError ? (
              <div className="alert alert-warning py-2 px-2 mb-0 mt-2 small" role="alert">
                {projectsError || threadsError}
              </div>
            ) : null}
          </aside>

          <div className="qf-chat-main">
            <div className="qf-chat-thread" aria-label="Chat messages" ref={threadRef}>
              {isChatSkeletonLoading ? (
                <div className="qf-chat-conversation-skeleton">
                  <SkeletonRows count={4} />
                </div>
              ) : null}

              {!isChatSkeletonLoading && !hasMessages ? (
                <div className="text-muted small">No messages yet. Start a new conversation and send a prompt.</div>
              ) : null}

              {!isChatSkeletonLoading && hasMessages ? (
                <div className="d-flex flex-column gap-2">
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    const responseEvent = isUser ? null : responseEventByMessageId.get(message.id) ?? null;
                    const isPipelineStarterMessage = Boolean(
                      !isUser &&
                        responseEvent?.mode === "education_pipeline" &&
                        responseEvent.assistantMessageId === message.id
                    );
                    const isExecutionResultMessage = Boolean(
                      !isUser &&
                        responseEvent?.mode === "education_pipeline" &&
                        responseEvent.resultAssistantMessageId === message.id &&
                        responseEvent.executionResultKind === "execution_result"
                    );
                    const resultColumns = responseEvent ? toResultColumns(responseEvent) : [];
                    const resultRows = responseEvent ? toResultsRows(responseEvent) : [];
                    const resultColumnsMeta = responseEvent ? toResultsColumnsMeta(responseEvent) : [];
                    const hasResultsRows =
                      responseEvent?.executionResults && resultRows.length > 0;
                    const hasAdmShape = responseEvent ? isAdmResult(resultColumnsMeta, resultRows) : false;
                    const currentResultsViewMode = responseEvent
                      ? (resultViewModeByMessageId[message.id] ?? (hasAdmShape ? "pivot" : "raw"))
                      : "raw";
                    const showRowTotals = showRowTotalsByMessageId[message.id] ?? true;
                    const showGrandTotals = showGrandTotalsByMessageId[message.id] ?? true;
                    const showResultsCard = Boolean(responseEvent && expandedExecutionCards[message.id]);
                    const hideStarterAfterExecutionResult = Boolean(
                      isPipelineStarterMessage &&
                        responseEvent?.resultAssistantMessageId &&
                        responseEvent.resultAssistantMessageId !== message.id
                    );
                    const showRouteBadge = Boolean(!isUser && responseEvent && !isExecutionResultMessage);
                    const rowsReturned =
                      responseEvent?.rowsReturned ??
                      (Array.isArray(responseEvent?.executionResults?.rows)
                        ? responseEvent?.executionResults?.rows.length
                        : null);

                    if (hideStarterAfterExecutionResult) {
                      return null;
                    }
                    return (
                      <article
                        key={message.id}
                        className={`qf-chat-turn ${isUser ? "qf-chat-turn-user" : "qf-chat-turn-assistant"}`}
                      >
                        <div className={`qf-chat-bubble ${isUser ? "qf-chat-bubble-user" : "qf-chat-bubble-assistant"}`}>
                          <div className="qf-chat-bubble-label">
                            <span>{isUser ? "You" : "Forge Insights"}</span>
                            {showRouteBadge ? (
                              <span
                                className={`qf-chat-route-badge ${
                                  responseEvent?.mode === "education_pipeline"
                                    ? "qf-chat-route-badge-education"
                                    : "qf-chat-route-badge-chat"
                                }`}
                              >
                                {responseEvent?.routeLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="qf-chat-bubble-text">
                            {isUser ? message.content : <MarkdownMessage content={message.content} />}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`btn btn-sm qf-chat-copy-btn ${isUser ? "qf-chat-copy-btn-user" : "qf-chat-copy-btn-assistant"}`}
                          onClick={() => {
                            void copyMessage(message.content);
                          }}
                          aria-label={isUser ? "Copy prompt" : "Copy response"}
                          title={isUser ? "Copy prompt" : "Copy response"}
                        >
                          <i className="fa fa-copy" aria-hidden="true" />
                        </button>
                        {isPipelineStarterMessage && !isExecutionResultMessage ? (
                          <section className="qf-chat-pipeline-card">
                            <div className="qf-chat-pipeline-card-title">Query started</div>
                            {responseEvent?.execution ? (
                              <div className="qf-chat-pipeline-meta-grid">
                                <div>
                                  <span className="qf-chat-pipeline-meta-label">jobId</span>
                                  <code>{responseEvent.execution?.jobId}</code>
                                </div>
                                <div>
                                  <span className="qf-chat-pipeline-meta-label">statementId</span>
                                  <code>{responseEvent.execution?.statementId}</code>
                                </div>
                                <div>
                                  <span className="qf-chat-pipeline-meta-label">trace_id</span>
                                  <code>{responseEvent?.traceId ?? "n/a"}</code>
                                </div>
                              </div>
                            ) : null}
                            {responseEvent?.validationMessage ? (
                              <div className="alert alert-warning py-1 px-2 mt-2 mb-2 small" role="status">
                                {responseEvent.validationMessage}
                              </div>
                            ) : null}
                            {responseEvent?.executionState === "running" ? (
                              <div className="qf-chat-exec-status qf-chat-exec-status-running">
                                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                                <span>
                                  Running{responseEvent?.executionStatusText ? ` (${responseEvent.executionStatusText})` : "..."}
                                </span>
                              </div>
                            ) : null}
                            {responseEvent?.executionState === "failed" ? (
                              <div className="qf-chat-exec-status qf-chat-exec-status-failed">
                                <span>{responseEvent?.executionError ?? "Execution failed."}</span>
                                {responseEvent?.execution?.jobId ? (
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm p-0"
                                    onClick={() => {
                                      if (responseEvent?.id) {
                                        void retryExecution(responseEvent.id);
                                      }
                                    }}
                                  >
                                    Retry
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            {responseEvent?.executionState === "timeout" ? (
                              <div className="qf-chat-exec-status qf-chat-exec-status-failed">
                                <span>{responseEvent?.executionError ?? "Execution is still running. Try retrying."}</span>
                                {responseEvent?.execution?.jobId ? (
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm p-0"
                                    onClick={() => {
                                      if (responseEvent?.id) {
                                        void retryExecution(responseEvent.id);
                                      }
                                    }}
                                  >
                                    Retry
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            {responseEvent?.executionState === "success" ? (
                              <div className="qf-chat-exec-status qf-chat-exec-status-succeeded">
                                Succeeded
                                {responseEvent?.executionStatusText
                                  ? ` (${responseEvent.executionStatusText})`
                                  : ""}
                              </div>
                            ) : null}
                            {responseEvent?.resultAssistantMessageId ? null : (
                              <div className="qf-chat-pipeline-actions">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() =>
                                    setExpandedExecutionCards((prev) => ({
                                      ...prev,
                                      [message.id]: !prev[message.id],
                                    }))
                                  }
                                >
                                  View results
                                </button>
                              </div>
                            )}
                            {showResultsCard && !responseEvent?.resultAssistantMessageId ? (
                              <div className="qf-chat-pipeline-results">
                                {hasResultsRows ? (
                                  <>
                                    {hasAdmShape ? (
                                      <div className="qf-chat-results-toolbar">
                                        <div className="btn-group btn-group-sm qf-chat-results-view-toggle" role="group" aria-label="Results view">
                                          <button
                                            type="button"
                                            className={`btn btn-outline-secondary ${currentResultsViewMode === "pivot" ? "active" : ""}`}
                                            onClick={() =>
                                              setResultViewModeByMessageId((prev) => ({
                                                ...prev,
                                                [message.id]: "pivot",
                                              }))
                                            }
                                          >
                                            Pivot view
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-outline-secondary ${currentResultsViewMode === "raw" ? "active" : ""}`}
                                            onClick={() =>
                                              setResultViewModeByMessageId((prev) => ({
                                                ...prev,
                                                [message.id]: "raw",
                                              }))
                                            }
                                          >
                                            Raw rows
                                          </button>
                                        </div>
                                        {currentResultsViewMode === "pivot" ? (
                                          <div className="qf-chat-results-toggles">
                                            <label className="qf-chat-results-toggle-item">
                                              <input
                                                type="checkbox"
                                                checked={showRowTotals}
                                                onChange={(event) =>
                                                  setShowRowTotalsByMessageId((prev) => ({
                                                    ...prev,
                                                    [message.id]: event.target.checked,
                                                  }))
                                                }
                                              />
                                              <span>Row total</span>
                                            </label>
                                            <label className="qf-chat-results-toggle-item">
                                              <input
                                                type="checkbox"
                                                checked={showGrandTotals}
                                                onChange={(event) =>
                                                  setShowGrandTotalsByMessageId((prev) => ({
                                                    ...prev,
                                                    [message.id]: event.target.checked,
                                                  }))
                                                }
                                              />
                                              <span>Grand total</span>
                                            </label>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {hasAdmShape && currentResultsViewMode === "pivot" ? (
                                      <AdmPivotTable
                                        rows={resultRows}
                                        columns={resultColumnsMeta}
                                        showRowTotal={showRowTotals}
                                        showGrandTotal={showGrandTotals}
                                      />
                                    ) : (
                                      renderRawResultTable({
                                        rows: resultRows,
                                        columns: resultColumns,
                                        keyPrefix: `${responseEvent.id}-starter`,
                                        emptyLabel: "No results available yet.",
                                      })
                                    )}
                                  </>
                                ) : (
                                  <div className="text-muted small">No results available yet.</div>
                                )}
                              </div>
                            ) : null}
                          </section>
                        ) : null}
                        {isExecutionResultMessage ? (
                          <section className="qf-chat-pipeline-card">
                            <div className="qf-chat-pipeline-card-title d-flex align-items-center gap-2">
                              <span>Execution results</span>
                              {typeof rowsReturned === "number" ? (
                                <span className="badge text-bg-secondary">{rowsReturned} rows returned</span>
                              ) : null}
                            </div>
                            <div className="qf-chat-pipeline-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() =>
                                  setExpandedExecutionCards((prev) => ({
                                    ...prev,
                                    [message.id]: !prev[message.id],
                                  }))
                                }
                              >
                                {showResultsCard ? "Hide table" : "Show table"}
                              </button>
                            </div>
                            {showResultsCard ? (
                              <div className="qf-chat-pipeline-results">
                                {hasResultsRows ? (
                                  <>
                                    {hasAdmShape ? (
                                      <div className="qf-chat-results-toolbar">
                                        <div className="btn-group btn-group-sm qf-chat-results-view-toggle" role="group" aria-label="Results view">
                                          <button
                                            type="button"
                                            className={`btn btn-outline-secondary ${currentResultsViewMode === "pivot" ? "active" : ""}`}
                                            onClick={() =>
                                              setResultViewModeByMessageId((prev) => ({
                                                ...prev,
                                                [message.id]: "pivot",
                                              }))
                                            }
                                          >
                                            Pivot view
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-outline-secondary ${currentResultsViewMode === "raw" ? "active" : ""}`}
                                            onClick={() =>
                                              setResultViewModeByMessageId((prev) => ({
                                                ...prev,
                                                [message.id]: "raw",
                                              }))
                                            }
                                          >
                                            Raw rows
                                          </button>
                                        </div>
                                        {currentResultsViewMode === "pivot" ? (
                                          <div className="qf-chat-results-toggles">
                                            <label className="qf-chat-results-toggle-item">
                                              <input
                                                type="checkbox"
                                                checked={showRowTotals}
                                                onChange={(event) =>
                                                  setShowRowTotalsByMessageId((prev) => ({
                                                    ...prev,
                                                    [message.id]: event.target.checked,
                                                  }))
                                                }
                                              />
                                              <span>Row total</span>
                                            </label>
                                            <label className="qf-chat-results-toggle-item">
                                              <input
                                                type="checkbox"
                                                checked={showGrandTotals}
                                                onChange={(event) =>
                                                  setShowGrandTotalsByMessageId((prev) => ({
                                                    ...prev,
                                                    [message.id]: event.target.checked,
                                                  }))
                                                }
                                              />
                                              <span>Grand total</span>
                                            </label>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {hasAdmShape && currentResultsViewMode === "pivot" ? (
                                      <AdmPivotTable
                                        rows={resultRows}
                                        columns={resultColumnsMeta}
                                        showRowTotal={showRowTotals}
                                        showGrandTotal={showGrandTotals}
                                      />
                                    ) : (
                                      renderRawResultTable({
                                        rows: resultRows,
                                        columns: resultColumns,
                                        keyPrefix: `${message.id}-result`,
                                        emptyLabel: "No rows available for this execution.",
                                      })
                                    )}
                                  </>
                                ) : (
                                  <div className="text-muted small">No rows available for this execution.</div>
                                )}
                              </div>
                            ) : null}
                          </section>
                        ) : null}
                        {!isUser &&
                        responseEvent &&
                        responseEvent.assistantMessageId === message.id &&
                        responseEvent.debugRequested &&
                        (responseEvent.debugPayload ||
                          responseEvent.routeDecision ||
                          responseEvent.traceId ||
                          responseEvent.execution) ? (
                          <details className="qf-chat-debug-panel">
                            <summary>Debug details</summary>
                            <pre>
                              {JSON.stringify(
                                {
                                  route_decision: responseEvent.routeDecision,
                                  trace_id: responseEvent.traceId,
                                  execution: responseEvent.execution,
                                  execution_status_code: responseEvent.executionStatusCode,
                                  debug: responseEvent.debugPayload ?? null,
                                },
                                null,
                                2
                              )}
                            </pre>
                          </details>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}

              {isChatLoading ? (
                <article className="qf-chat-turn mt-2">
                  <div
                    className="qf-chat-bubble qf-chat-bubble-assistant qf-chat-thinking qf-chat-thinking-bubble"
                    aria-live="polite"
                    aria-label="Thinking"
                  >
                    <span className="qf-chat-thinking-word">
                      {"Thinking".split("").map((char, idx) => (
                        <span
                          key={`qf-chat-thinking-${idx}`}
                          className="qf-chat-thinking-char"
                          style={{ animationDelay: `${idx * 80}ms` }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                    <span className="qf-chat-thinking-dots">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  </div>
                </article>
              ) : null}

              {sessionNotice ? (
                <div className="alert alert-info py-2 px-3 mt-2 mb-0 small" role="status">
                  {sessionNotice}
                </div>
              ) : null}

              {chatError ? (
                <div className="alert alert-danger py-2 px-3 mt-2 mb-0" role="alert">
                  <div>{chatError}</div>
                  {draft.trim().length > 0 ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => {
                          void handleSendPrompt();
                        }}
                        disabled={isChatLoading}
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (isChatLoading) {
                  handleCancelPrompt();
                  return;
                }
                void handleSendPrompt();
              }}
              className="qf-chat-composer"
            >
              <label htmlFor="forge-insights-input" className="visually-hidden">
                Message
              </label>
              <div className="qf-chat-goal-box">
                <textarea
                  id="forge-insights-input"
                  className="form-control qf-chat-goal-input"
                  rows={3}
                  placeholder="Ask Forge Insights anything..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  disabled={isChatSkeletonLoading}
                />
                <button
                  type="submit"
                  className={`qf-chat-send-btn ${isChatLoading ? "is-cancel" : ""}`}
                  aria-label={isChatLoading ? "Cancel" : "Send"}
                  title={isChatLoading ? "Cancel" : "Send"}
                  disabled={!isChatLoading && !canSend}
                >
                  <i className={`fa ${isChatLoading ? "fa-stop" : "fa-arrow-up"}`} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {isConversationModalOpen ? (
        <div className="qf-chat-modal-backdrop" role="presentation">
          <div className="qf-chat-modal" role="dialog" aria-modal="true" aria-label="Create conversation">
            <div className="qf-chat-modal-header">
              <h3>New Conversation</h3>
            </div>
            <div className="qf-chat-modal-body">
              <label htmlFor="forge-insights-conversation-name" className="form-label">
                Conversation name (optional)
              </label>
              <input
                id="forge-insights-conversation-name"
                className="form-control"
                value={conversationNameDraft}
                onChange={(event) => setConversationNameDraft(event.target.value)}
                placeholder="e.g. Attendance trend investigation"
                autoFocus
              />
              <label htmlFor="forge-insights-conversation-project" className="form-label mt-2">
                Project
              </label>
              <select
                id="forge-insights-conversation-project"
                className="form-select"
                value={conversationProjectIdDraft ?? ""}
                onChange={(event) => setConversationProjectIdDraft(event.target.value || null)}
              >
                <option value="">Unassigned</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="qf-chat-modal-footer">
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => setIsConversationModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  void handleNewConversation();
                }}
              >
                Create Conversation
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isProjectModalOpen ? (
        <div className="qf-chat-modal-backdrop" role="presentation">
          <div className="qf-chat-modal" role="dialog" aria-modal="true" aria-label="Create project">
            <div className="qf-chat-modal-header">
              <h3>New Project</h3>
            </div>
            <div className="qf-chat-modal-body">
              <label htmlFor="forge-insights-project-name" className="form-label">
                Project name
              </label>
              <input
                id="forge-insights-project-name"
                className="form-control"
                value={projectNameDraft}
                onChange={(event) => setProjectNameDraft(event.target.value)}
                placeholder="e.g. Attendance Analysis"
                autoFocus
              />
              <label htmlFor="forge-insights-project-description" className="form-label mt-2">
                Description (optional)
              </label>
              <textarea
                id="forge-insights-project-description"
                className="form-control"
                rows={3}
                value={projectDescriptionDraft}
                onChange={(event) => setProjectDescriptionDraft(event.target.value)}
                placeholder="Optional notes for this project"
              />
            </div>
            <div className="qf-chat-modal-footer">
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => setIsProjectModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  void handleNewProject();
                }}
                disabled={projectNameDraft.trim().length === 0}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRenameConversationModalOpen ? (
        <div className="qf-chat-modal-backdrop" role="presentation">
          <div className="qf-chat-modal" role="dialog" aria-modal="true" aria-label="Rename conversation">
            <div className="qf-chat-modal-header">
              <h3>Rename Conversation</h3>
            </div>
            <div className="qf-chat-modal-body">
              <label htmlFor="forge-insights-rename-conversation" className="form-label">
                Conversation name
              </label>
              <input
                id="forge-insights-rename-conversation"
                className="form-control"
                value={renameConversationDraft}
                onChange={(event) => setRenameConversationDraft(event.target.value)}
                placeholder="e.g. Student attendance anomalies"
                autoFocus
              />
            </div>
            <div className="qf-chat-modal-footer">
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => {
                  setIsRenameConversationModalOpen(false);
                  setRenameConversationThreadId(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  void handleRenameConversation();
                }}
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRenameProjectModalOpen ? (
        <div className="qf-chat-modal-backdrop" role="presentation">
          <div className="qf-chat-modal" role="dialog" aria-modal="true" aria-label="Rename project">
            <div className="qf-chat-modal-header">
              <h3>Rename Project</h3>
            </div>
            <div className="qf-chat-modal-body">
              <label htmlFor="forge-insights-rename-project" className="form-label">
                Project name
              </label>
              <input
                id="forge-insights-rename-project"
                className="form-control"
                value={renameProjectDraft}
                onChange={(event) => setRenameProjectDraft(event.target.value)}
                autoFocus
              />
            </div>
            <div className="qf-chat-modal-footer">
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => {
                  setIsRenameProjectModalOpen(false);
                  setRenameProjectId(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  void handleRenameProject();
                }}
                disabled={renameProjectDraft.trim().length === 0}
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ForgeInsightsPage() {
  const workspaceId = useAppSelector((state) => state.userWorkspaces.selectedWorkspaceId ?? null);
  return (
    <ForgeInsightsStateProvider workspaceId={workspaceId}>
      <ForgeInsightsPageInner workspaceId={workspaceId} />
    </ForgeInsightsStateProvider>
  );
}
