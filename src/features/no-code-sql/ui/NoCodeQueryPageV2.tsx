// src/features/nocode-query/ui/NoCodeQueryPageV2.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import { AppHeaderBar } from "./components/AppHeaderBar";
import { SaveQueryModal } from "./components/SaveQueryModal";
import { MoveModalDialog } from "./components/MoveModalDialog";
import { NamePromptDialog } from "../../../shared/ui/NamePromptDialog";

import { PromptSection } from "./components/PromptSection";
import { SuggestedColumnsSection, SuggestedColumn } from "./components/SuggestedColumnsSection";
import { DomainSection } from "./components/DomainSection";
import { ColumnsSection } from "./components/ColumnsSection";
import { DataPrepSection } from "./components/DataPrepSection";
import { FiltersSection } from "./components/FiltersSection";
import { AggregationsSection } from "./components/AggregationsSection";
import { PreviewCard } from "./components/PreviewSection";
import { SortingSection } from "./components/SortingSection";

import { SavedQueriesPanel } from "../../../shared/ui/saved-queries/SavedQueriesPanel";
import { ShareSavedQueryModal } from "../../../shared/ui/saved-queries/ShareSavedQueryModal";
import { BuilderToolRailV2, ToolKeyV2 } from "./v2/BuilderToolRailV2";
import { BuilderDrawerV2 } from "./v2/BuilderDrawerV2";
import { BuilderSummaryCardV2 } from "./v2/BuilderSummaryCardV2";
import { useAppSelector } from "../../../shared/lib/hooks";

import type {
  SavedQueriesAction,
  SavedQueriesData,
  SavedQueryGroupKey,
  SavedQueryItem,
  TreeNode,
  TreeResponse,
} from "../../../shared/model/savedQueries";

import "../ui/styles/no-code.css";
import "./v2/v2.css";
import {
  createFolder,
  deleteFolder,
  deleteSavedQuery,
  hydrateQueryTree,
  moveFolder,
  moveSavedQuery,
  purgeFolder,
  createSavedQuery,
  updateSavedQuery,
  renameFolder,
  restoreFolder,
  restoreSavedQuery,
  trashFolder,
  fetchSavedQuery,
} from "../../../shared/api/queryTreeApi";

import type { BuilderColumnRow, Domain } from "../../../shared/api/noCodeAdminApi";
import { fetchDomains, fetchDomainSummaries, fetchDomainColumns } from "../../../shared/api/noCodeAdminApi";

import type { DomainColumnRef } from "../model/domainCatalog";
import { toDomainColumnRef } from "../model/mappers/domainColumns";

import type {
  SqlQueryJson,
  SqlColumnKey,
  SqlColumnRef,
  SqlSort,
  SqlAggregationsJson,
  SqlDataPrepJson,
  SqlFilterNode,
  CrosswalkAttachment,
  CohortAttachment,
} from "../model/sqlJson";
import { colKey, labelFor } from "../model/sqlJson";
import { normalizeColumns, removeSelectedColumn, upsertSelectedColumn } from "../model/columnsUtil";

// Debug: log sqlJson as it changes while building

// -----------------------------
// Types
// -----------------------------
type SectionKey =
  | "prompt"
  | "suggested"
  | "domain"
  | "columns"
  | "dataprep"
  | "filters"
  | "aggs"
  | "sorting"
  | "preview";

const SECTION_ORDER: SectionKey[] = [
  "prompt",
  "suggested",
  "domain",
  "columns",
  "dataprep",
  "filters",
  "aggs",
  "sorting",
  "preview",
];

type QueryPathStep = {
  key: SectionKey;
  label: string;
  status: "todo" | "active" | "done";
};

const PAGE_SIZE = 15;

const ANIM_MS_HIDE = 320;
const ANIM_MS_SHOW = 380;
const PULSE_MS = 900;

// NEW: stagger fade-in for “unlock” sequence after domain select
const UNLOCK_STAGGER_MS = 70;

// -----------------------------
// New flow defaults
// -----------------------------
const INITIAL_VISIBLE_SECTIONS: Record<SectionKey, boolean> = {
  domain: true,
  prompt: false,
  suggested: false,
  columns: false,
  dataprep: false,
  filters: false,
  aggs: false,
  sorting: false,
  preview: false,
};

const INITIAL_SECTIONS_COLLAPSED: Record<SectionKey, boolean> = {
  domain: false, // ✅ Domain expanded
  prompt: true,
  suggested: true,
  columns: true,
  dataprep: true,
  filters: true,
  aggs: true,
  sorting: true,
  preview: true,
};

const nowIso = () => new Date().toISOString();

// -----------------------------
// Helpers
// -----------------------------
function colsSig(cols: SqlColumnRef[]) {
  return cols
    .map((c) =>
      [
        colKey(c),
        c.modelTableId ?? "",
        c.modelTableName ?? "",
        c.fullName ?? "",
        c.dataType ?? "",
        c.nullable ?? "",
        c.alias ?? "",
      ].join("|")
    )
    .join("~~");
}

function slugify(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildAttachmentColumnRows(sqlJson: SqlQueryJson): DomainColumnRef[] {
  const rows: DomainColumnRef[] = [];

  const addRow = (exprId: string, columnName: string, description: string, modelTableName: string) => {
    rows.push({
      modelColumnId: null,
      identityKey: `expr:${exprId}`,
      columnName,
      modelTableName,
      fullName: columnName,
      tableAlias: null,
      columnLabel: null,
      dataType: "STRING",
      nullable: true,
      description,
      workspaceTableId: 0,
      modelTableId: 0,
      baseTableName: "",
      schemaName: "",
      catalogName: "",
      domainId: sqlJson.domainId ?? 0,
      domainName: "Attachments",
      variantCode: null,
      isQe: false,
      existsInDbx: undefined,
      lastSeenAt: null,
    });
  };

  const crosswalks = (sqlJson.crosswalkAttachments ?? []) as CrosswalkAttachment[];
  crosswalks.forEach((cw) => {
    if (cw.mode !== "join") return;
    (cw.projectFields ?? []).forEach((field) => {
      const fieldKey = field.toLowerCase();
      const columnName =
        fieldKey === "region"
          ? "cw_region"
          : fieldKey === "subregion"
            ? "cw_subregion"
            : `cw_${field}`;
      const exprId = `cw:${cw.id}:cw:${field}`;
      addRow(exprId, columnName, `Crosswalk projected field (${field})`, "crosswalk");
    });
  });

  const cohort = sqlJson.cohortAttachment as CohortAttachment | null | undefined;
  if (cohort && cohort.mode === "join") {
    (cohort.projectFields ?? []).forEach((field) => {
      const columnName = `cohort_${field}`;
      const exprId = `cohort:${cohort.id}:cohort:${field}`;
      addRow(exprId, columnName, `Cohort projected field (${field})`, "cohort");
    });
  }

  return rows;
}

const emptySqlJson = (): SqlQueryJson => ({
  version: 1,
  domainId: null,
  columns: [],
  prompt: "",
  dataPrep: null,
  filters: null,
  aggs: { enabled: false, metrics: [], groupBy: [] },
  sorting: [],
  distinct: true,
  crosswalks: { a: null, b: null, c: null },
  crosswalkAttachments: [],
  cohortAttachment: null,
  meta: { createdAt: nowIso(), updatedAt: nowIso(), prompt: "", tool: "query_builder" },
});

// -----------------------------
// Component
// -----------------------------
export const NoCodeQueryPageV2: React.FC = () => {
  const workspaceId = typeof window !== "undefined" ? localStorage.getItem("workspaceId") : null;
  // ✅ Single source of truth
  const [sqlJson, setSqlJson] = useState<SqlQueryJson>(() => emptySqlJson());
  const ensureToolMeta = (next: SqlQueryJson): SqlQueryJson => ({
    ...next,
    meta: { ...(next.meta ?? {}), tool: next.meta?.tool ?? "query_builder" },
  });

  const updateSqlJson = (updater: (cur: SqlQueryJson) => SqlQueryJson) => {
    setSqlJson((cur) => {
      const next = updater(cur);
      if (next === cur) return cur;

      // mark dirty here (one place)
      setOpenQuery((p) => ({ ...p, isDirty: true }));

      return ensureToolMeta({
        ...next,
        meta: {
          ...(next.meta ?? {}),
          updatedAt: nowIso(),
          createdAt: next.meta?.createdAt ?? cur.meta?.createdAt ?? nowIso(),
        },
      });
    });
  };

  // -----------------------------
  // UI state (layout only)
  // -----------------------------
  const [activeSection, setActiveSection] = useState<SectionKey>("domain");
  const [visibleSections, setVisibleSections] =
    useState<Record<SectionKey, boolean>>(INITIAL_VISIBLE_SECTIONS);
  const [sectionAnim, setSectionAnim] =
    useState<Partial<Record<SectionKey, "hiding" | "showing">>>({});
  const [, setRailPulse] = useState<Partial<Record<SectionKey, boolean>>>({});
  const [openTool, setOpenTool] = useState<ToolKeyV2 | null>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [sectionsCollapsed, setSectionsCollapsed] =
    useState<Record<SectionKey, boolean>>(INITIAL_SECTIONS_COLLAPSED);

  type OpenQueryState = {
    id: string | null;
    name: string;
    description?: string | null;
    scope?: string;
    isDirty: boolean;
    folderId?: string | null;
  };

  const [openQuery, setOpenQuery] = useState<OpenQueryState>({
    id: null,
    name: "New Query",
    scope: undefined,
    isDirty: false,
    description: null,
  });
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const persistTimerRef = useRef<number | null>(null);
  const workingHydratedRef = useRef(false);

  // ✅ Focus mode
  const [fullscreenKey, setFullscreenKey] = useState<SectionKey | null>(null);
  const inFocusMode = fullscreenKey !== null;

  const shouldRenderSection = (k: SectionKey) => {
    if (!visibleSections[k]) return false;
    if (!inFocusMode) return true;
    return fullscreenKey === k;
  };

  const effectiveCollapsed = (k: SectionKey) => {
    if (fullscreenKey === k) return false;
    return sectionsCollapsed[k];
  };

  // Query path state for AppHeaderBar
  const [queryPath, setQueryPath] = useState<QueryPathStep[]>([
    { key: "domain", label: "Domain", status: "active" },
    { key: "prompt", label: "Prompt", status: "todo" },
    { key: "suggested", label: "Suggestions", status: "todo" },
    { key: "columns", label: "Columns", status: "todo" },
    { key: "dataprep", label: "Data Prep", status: "todo" },
    { key: "filters", label: "Filters", status: "todo" },
    { key: "aggs", label: "Aggregations", status: "todo" },
    { key: "sorting", label: "Sorting", status: "todo" },
    { key: "preview", label: "Preview", status: "todo" },
  ]);

  const setPathActive = (active: SectionKey) => {
    setQueryPath((prev) => {
      const idx = prev.findIndex((s) => s.key === active);
      if (idx < 0) return prev;
      return prev.map((s, i) => {
        if (i < idx) return { ...s, status: "done" };
        if (i === idx) return { ...s, status: "active" };
        return { ...s, status: "todo" };
      });
    });
  };

  const setColumnsInJson = (nextCols: SqlColumnRef[]) => {
    updateSqlJson((cur) => {
      const curCols = (cur.columns ?? []) as SqlColumnRef[];

      // ✅ hard stop on infinite loops
      if (colsSig(curCols) === colsSig(nextCols)) return cur;

      const deduped = normalizeColumns(nextCols);
      const keep = new Set(deduped.map((c) => colKey(c)));

      return {
        ...cur,
        columns: deduped,
        sorting: (cur.sorting ?? []).filter((s) => keep.has(colKey(s.col))),
        aggs: cur.aggs
          ? {
              ...cur.aggs,
              groupBy: (cur.aggs.groupBy ?? []).filter((g) => keep.has(colKey(g))),
              metrics: (cur.aggs.metrics ?? []).map((m) =>
                m.field && !keep.has(colKey(m.field)) ? { ...m, field: null } : m
              ),
              enabled:
                (cur.aggs.metrics ?? []).some((m) => m.field != null) ||
                (cur.aggs.groupBy ?? []).length > 0,
            }
          : cur.aggs,
      };
    });
  };

  useEffect(() => {
    console.log("sqlJson", sqlJson);
  }, [sqlJson]);

  const toggleFullscreen = (k: SectionKey) => {
    setFullscreenKey((cur) => {
      const next = cur === k ? null : k;

      if (next === k) {
        setVisibleSections((p) => ({ ...p, [k]: true }));
        setSectionsCollapsed((p) => ({ ...p, [k]: false }));
        setActiveSection(k);
        setPathActive(k);
      }

      return next;
    });
  };

  const focusPreview = () => {
    setFullscreenKey("preview");
    setVisibleSections((p) => ({ ...p, preview: true }));
    setSectionsCollapsed((p) => ({ ...p, preview: false }));
    setActiveSection("preview");
    setPathActive("preview");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  // -----------------------------
  // Saved queries rail/panel state (layout only)
  // -----------------------------
  const [activeTool, setActiveTool] = useState<"savedQueries" | null>(null);
  const savedQueriesOpen = activeTool === "savedQueries";
  const [selectedSavedQueryId, setSelectedSavedQueryId] = useState<string | undefined>(undefined);
  const [savedQueriesSearch, setSavedQueriesSearch] = useState("");
  const [savedQueriesGroups, setSavedQueriesGroups] = useState<Record<SavedQueryGroupKey, boolean>>({
    shared: true,
    mine: true,
    recent: true,
  });

  const userProfile = useAppSelector((state) => state.user.user);
  const authEmail = useAppSelector((state) => state.auth.email);
  const currentUserName =
    [
      userProfile?.display_name,
      [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(" "),
      userProfile?.user_name,
      authEmail,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find((value) => value.length > 0) || "Mine";

  const toggleSavedQueries = () =>
    setActiveTool((prev) => (prev === "savedQueries" ? null : "savedQueries"));
  const onToggleSavedQueriesGroup = (k: SavedQueryGroupKey) =>
    setSavedQueriesGroups((prev) => ({ ...prev, [k]: !prev[k] }));

  const EMPTY_TREES: { library: TreeResponse; shared: TreeResponse; my: TreeResponse; trash: TreeResponse } = {
    library: { view: "library", rootNodes: [] },
    shared: { view: "shared", rootNodes: [] },
    my: { view: "my", rootNodes: [] },
    trash: { view: "trash", rootNodes: [] },
  };

  const queryTreeQuery = useQuery({
    queryKey: ["query-tree", "all"],
    queryFn: hydrateQueryTree,
    staleTime: 30_000,
  });

  const trees = queryTreeQuery.data?.trees ?? EMPTY_TREES;
  const recentQueries = queryTreeQuery.data?.recent ?? [];

  const flattenQueries = (nodes: TreeNode[]): SavedQueryItem[] => {
    const out: SavedQueryItem[] = [];
    for (const n of nodes) {
      if (n.nodeType === "query") {
        out.push({ id: n.id, title: n.name, updatedAt: n.updatedAt ?? undefined });
      } else {
        out.push(...flattenQueries(n.children || []));
      }
    }
    return out;
  };

  const savedQueryLists: SavedQueriesData = {
    shared: flattenQueries(trees.shared.rootNodes),
    mine: flattenQueries(trees.my.rootNodes),
    recent: recentQueries.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt })),
  };

  const refetchTree = async () => {
    await queryTreeQuery.refetch();
  };

  const findNodeById = (nodes: TreeNode[], id: string): TreeNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.nodeType === "folder") {
        const hit = findNodeById(n.children ?? [], id);
        if (hit) return hit;
      }
    }
    return null;
  };

  const findNodeAcrossTrees = (id: string): TreeNode | null => {
    return (
      findNodeById(trees.library.rootNodes, id) ||
      findNodeById(trees.shared.rootNodes, id) ||
      findNodeById(trees.my.rootNodes, id) ||
      findNodeById(trees.trash.rootNodes, id)
    );
  };

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{
    type: "folder" | "query";
    id: string;
    name: string;
    currentFolderId: string | null;
  } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareQueryId, setShareQueryId] = useState<string | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameDialogTitle, setNameDialogTitle] = useState("");
  const [nameDialogLabel, setNameDialogLabel] = useState("Name");
  const [nameDialogValue, setNameDialogValue] = useState("");
  const [nameDialogConfirmLabel, setNameDialogConfirmLabel] = useState("Save");
  const nameDialogConfirmRef = useRef<(value: string) => void | Promise<void>>(() => undefined);

  const openNameDialog = (opts: {
    title: string;
    label?: string;
    initialValue?: string;
    confirmLabel?: string;
    onConfirm: (value: string) => void | Promise<void>;
  }) => {
    setNameDialogTitle(opts.title);
    setNameDialogLabel(opts.label ?? "Name");
    setNameDialogValue(opts.initialValue ?? "");
    setNameDialogConfirmLabel(opts.confirmLabel ?? "Save");
    nameDialogConfirmRef.current = opts.onConfirm;
    setNameDialogOpen(true);
  };

  const submitNameDialog = async () => {
    const name = nameDialogValue.trim();
    if (!name) return;
    setNameDialogOpen(false);
    await nameDialogConfirmRef.current?.(name);
  };

  const openSavedQuery = async (id: string) => {
    const q = await fetchSavedQuery(id);

    // reset search/paging UI
    setColumnsSearchTerm("");
    setCurrentPage(1);

    // load query
    setSqlJson(q.sqlJson);
    setSelectedSavedQueryId(q.queryId);
    setOpenQuery({ id: q.queryId, name: q.name ?? "Untitled", scope: q.scope, isDirty: false });
  };

  const handleNewQuery = () => {
    if (typeof window !== "undefined") {
      const ids = new Set<string>();
      ids.add("draft");
      const lastId = localStorage.getItem("query_builder_working:last");
      if (lastId) ids.add(lastId);
      if (openQuery.id) ids.add(openQuery.id);
      ids.forEach((id) => localStorage.removeItem(`query_builder_working:${id}`));
      localStorage.removeItem("query_builder_working:last");
    }

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
    setFullscreenKey(null);
    setVisibleSections(INITIAL_VISIBLE_SECTIONS);
    setSectionsCollapsed(INITIAL_SECTIONS_COLLAPSED);
    setActiveSection("domain");
    setPathActive("domain");
    setSectionAnim({});
    setRailPulse({});
  };

  const handleSavedQueriesAction = async (action: SavedQueriesAction) => {
    try {
      switch (action.type) {
        case "CREATE_FOLDER": {
          openNameDialog({
            title: "New folder",
            label: "Folder name",
            confirmLabel: "Create",
            onConfirm: async (name) => {
              await createFolder({ name, parentId: action.parentId, sortIndex: action.sortIndex });
              await refetchTree();
            },
          });
          return;
        }
        case "OPEN_QUERY":
          await openSavedQuery(action.queryId);
          return;
        case "RENAME_FOLDER": {
          const node = findNodeAcrossTrees(action.folderId);
          openNameDialog({
            title: "Rename folder",
            label: "Folder name",
            initialValue: node?.nodeType === "folder" ? node.name : "",
            confirmLabel: "Rename",
            onConfirm: async (name) => {
              await renameFolder(action.folderId, name);
              await refetchTree();
            },
          });
          return;
        }
        case "MOVE_FOLDER": {
          const node = findNodeAcrossTrees(action.folderId);
          setMoveTarget({
            type: "folder",
            id: action.folderId,
            name: node?.nodeType === "folder" ? node.name : "Folder",
            currentFolderId: node?.nodeType === "folder" ? node.parentId ?? null : null,
          });
          setMoveModalOpen(true);
          return;
        }
        case "DELETE_FOLDER":
          await deleteFolder(action.folderId);
          break;
        case "TRASH_FOLDER":
          await trashFolder(action.folderId);
          break;
        case "RESTORE_FOLDER":
          await restoreFolder(action.folderId);
          break;
        case "PURGE_FOLDER":
          await purgeFolder(action.folderId);
          break;

        case "MOVE_QUERY": {
          const node = findNodeAcrossTrees(action.queryId);
          setMoveTarget({
            type: "query",
            id: action.queryId,
            name: node?.nodeType === "query" ? node.name : "Query",
            currentFolderId: node?.nodeType === "query" ? node.folderId ?? null : null,
          });
          setMoveModalOpen(true);
          return;
        }
        case "DELETE_QUERY":
          await deleteSavedQuery(action.queryId);
          break;
        case "RESTORE_QUERY":
          await restoreSavedQuery(action.queryId);
          break;
        case "RENAME_QUERY": {
          const node = findNodeAcrossTrees(action.queryId);
          openNameDialog({
            title: "Rename query",
            label: "Query name",
            initialValue: node?.nodeType === "query" ? node.name : "",
            confirmLabel: "Rename",
            onConfirm: async (name) => {
              const q = await fetchSavedQuery(action.queryId);
              await updateSavedQuery(action.queryId, {
                name,
                description: q.description ?? null,
                folderId: q.folderId ?? null,
                sqlJson: ensureToolMeta(q.sqlJson),
              });
              await refetchTree();
            },
          });
          return;
        }
        case "COPY_QUERY": {
          const node = findNodeAcrossTrees(action.queryId);
          const fallback = node?.nodeType === "query" ? `${node.name} (copy)` : "Copy of query";
          openNameDialog({
            title: "Copy query",
            label: "New query name",
            initialValue: fallback,
            confirmLabel: "Create copy",
            onConfirm: async (name) => {
              const q = await fetchSavedQuery(action.queryId);
              await createSavedQuery({
                name,
                description: q.description ?? null,
                folderId: q.folderId ?? (node?.nodeType === "query" ? node.folderId ?? null : null),
                sqlJson: ensureToolMeta(q.sqlJson),
              });
              await refetchTree();
            },
          });
          return;
        }
        case "SHARE_QUERY": {
          setShareQueryId(action.queryId);
          setShareModalOpen(true);
          return;
        }
        case "PURGE_QUERY":
          console.warn(`${action.type} not implemented (no API route)`);
          break;

        default:
          console.warn(`${action.type} not implemented (no API route)`);
          return;
      }

      await refetchTree();
    } catch (err) {
      console.error("Saved query action failed", err);
    }
  };

  // -----------------------------
  // Hide / Show (animated)
  // -----------------------------
  const pulseRail = (key: SectionKey) => {
    setRailPulse((p) => ({ ...p, [key]: true }));
    window.setTimeout(() => {
      setRailPulse((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }, PULSE_MS);
  };

  const hideSection = (key: SectionKey) => {
    if (!visibleSections[key] || sectionAnim[key] === "hiding") return;
    if (fullscreenKey === key) setFullscreenKey(null);

    setSectionAnim((p) => ({ ...p, [key]: "hiding" }));

    window.setTimeout(() => {
      setVisibleSections((p) => ({ ...p, [key]: false }));
      setSectionAnim((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });

      pulseRail(key);

      if (activeSection === key) {
        const nextActive = SECTION_ORDER.find((k) => k !== key && visibleSections[k]) ?? "domain";
        setActiveSection(nextActive);
        setPathActive(nextActive);
      }
    }, ANIM_MS_HIDE);
  };

  // IMPORTANT: showSection always animates (used by unlock)
  const showSection = (key: SectionKey) => {
    if (visibleSections[key]) return;

    setVisibleSections((p) => ({ ...p, [key]: true }));
    // leave collapsed state as-is here (unlock will set collapsed explicitly)

    requestAnimationFrame(() => {
      setSectionAnim((p) => ({ ...p, [key]: "showing" }));
      window.setTimeout(() => {
        setSectionAnim((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }, ANIM_MS_SHOW);
    });
  };

  const toggleToolV2 = (key: ToolKeyV2) => {
    setOpenTool((prev) => (prev === key ? null : key));
    if (!visibleSections[key]) showSection(key);
    setActiveSection(key);
    setPathActive(key);
  };

  const openToolV2 = (key: ToolKeyV2) => {
    setOpenTool(key);
    if (!visibleSections[key]) showSection(key);
    setActiveSection(key);
    setPathActive(key);
  };

  const goToDrawerStep = (key: ToolKeyV2) => () => openToolV2(key);
  const goToPreviewFromDrawer = () => {
    setOpenTool(null);
    focusPreview();
  };
  const closeDrawer = () => setOpenTool(null);

  // -----------------------------
  // NEW: Domain-gated “unlock” flow
  // -----------------------------
  const unlockRanForDomainRef = useRef<number | null>(null);

  const runUnlockFlow = (mode: "domainSelect" | "rehydrate") => {
    // Reveal everything after domain (staggered fade-in)
    const toReveal: SectionKey[] = ["prompt", "suggested", "columns", "dataprep", "filters", "aggs", "sorting", "preview"];

    // Make sure we’re not in focus mode
    setFullscreenKey(null);

    // Show sections (stagger animation)
    toReveal.forEach((k, idx) => {
      window.setTimeout(() => showSection(k), idx * UNLOCK_STAGGER_MS);
    });

    // Collapse defaults after unlock: Prompt + Columns expanded, others collapsed
    setSectionsCollapsed((p) => ({
      ...p,
      domain: false,
      prompt: false,
      suggested: true,
      columns: false,
      dataprep: true,
      filters: true,
      aggs: true,
      sorting: true,
      preview: true,
    }));

    // Active section: prompt
    setActiveSection("prompt");
    setPathActive("prompt");

    // If this was a fresh domain select (not rehydrate), clear suggestions UI
    if (mode === "domainSelect") {
      setSuggestions([]);
      setColumnsSearchTerm("");
      setCurrentPage(1);
    }
  };

  // Detect domain transitions to trigger unlock exactly once per domain value
  const domainId = sqlJson.domainId;

  useEffect(() => {
    if (domainId == null) {
      // lock state: only domain visible/expanded
      unlockRanForDomainRef.current = null;

      setFullscreenKey(null);
      setVisibleSections(INITIAL_VISIBLE_SECTIONS);
      setSectionsCollapsed(INITIAL_SECTIONS_COLLAPSED);

      setActiveSection("domain");
      setPathActive("domain");

      setSectionAnim({});
      setRailPulse({});
      return;
    }

    // domain selected/rehydrated
    if (unlockRanForDomainRef.current === domainId) return;
    unlockRanForDomainRef.current = domainId;

    // If we already have some sqlJson content (rehydrate), still unlock, but don’t wipe anything
    const isRehydrate = (sqlJson.columns?.length ?? 0) > 0 || Boolean(sqlJson.filters) || Boolean(sqlJson.dataPrep) || (sqlJson.sorting?.length ?? 0) > 0;
    runUnlockFlow(isRehydrate ? "rehydrate" : "domainSelect");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId]);

  // -----------------------------
  // Collapse behavior
  // -----------------------------
  const focusSection = (key: SectionKey) => {
    setActiveSection(key);
    setPathActive(key);

    if (key !== "domain") {
      setSectionsCollapsed((p) => ({ ...p, domain: true }));
    }
  };

  const toggleSection = (key: SectionKey) => {
    if (fullscreenKey === key) return;

    setSectionsCollapsed((prev) => {
      const nextCollapsed = !prev[key];

      if (nextCollapsed === false) {
        focusSection(key);
      } else {
        if (activeSection === key) {
          const nextActive = SECTION_ORDER.find((k) => k !== key && prev[k] === false) ?? "domain";
          focusSection(nextActive);
        }
      }

      return { ...prev, [key]: nextCollapsed };
    });
  };

  const sectionWrapStyle = (key: SectionKey): React.CSSProperties => {
    const isActive = key === activeSection;
    const isFull = fullscreenKey === key;
    const anim = sectionAnim[key];

    const base: React.CSSProperties = {
      width: "100%",
      minWidth: 0,
      ...(isFull ? { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" } : null),
    };

    if (anim === "hiding") {
      return {
        ...base,
        opacity: 0,
        transform: "translateX(-90px) scale(0.92)",
        transformOrigin: "left center",
        transition: `opacity ${ANIM_MS_HIDE}ms ease, transform ${ANIM_MS_HIDE}ms ease`,
        pointerEvents: "none",
      };
    }

    if (anim === "showing") {
      return {
        ...base,
        opacity: 1,
        transform: "translateX(0) scale(1)",
        transformOrigin: "left center",
        animation: `ncq-show ${ANIM_MS_SHOW}ms ease`,
      };
    }

    return {
      ...base,
      opacity: isActive ? 1 : 0.9,
      filter: isActive ? "none" : "grayscale(0.12)",
      transform: isActive ? "none" : "scale(0.998)",
      transition: "opacity 140ms ease, filter 140ms ease, transform 140ms ease",
    };
  };

  const persistWorkingQuery = (payload: {
    id: string;
    name: string;
    description?: string | null;
    folderId: string | null;
    isDirty: boolean;
    sqlJson: SqlQueryJson;
  }) => {
    if (typeof window === "undefined") return;
    const saved = {
      id: payload.id,
      name: payload.name,
      description: payload.description ?? null,
      folderId: payload.folderId,
      isDirty: payload.isDirty,
      sqlJson: payload.sqlJson,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`query_builder_working:${payload.id}`, JSON.stringify(saved));
      localStorage.setItem("query_builder_working:last", payload.id);
    } catch (err) {
      console.warn("Failed to persist working query locally", err);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (workingHydratedRef.current) return;
    if (selectedSavedQueryId) return;

    const lastId = localStorage.getItem("query_builder_working:last") || "draft";
    const raw = localStorage.getItem(`query_builder_working:${lastId}`);
    if (!raw) {
      workingHydratedRef.current = true;
      return;
    }

    try {
      const saved = JSON.parse(raw);
      const savedSql = saved?.sqlJson ? ensureToolMeta(saved.sqlJson) : null;
      if (savedSql) setSqlJson(savedSql);
      setOpenQuery((prev) => ({
        ...prev,
        id: lastId !== "draft" ? lastId : null,
        name: saved?.name ?? prev.name,
        description: saved?.description ?? null,
        folderId: saved?.folderId ?? null,
        isDirty: saved?.isDirty ?? true,
      }));
      if (lastId !== "draft") setSelectedSavedQueryId(lastId);
    } catch (err) {
      console.warn("Failed to restore working query", err);
    } finally {
      workingHydratedRef.current = true;
    }
  }, [selectedSavedQueryId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);

    persistTimerRef.current = window.setTimeout(() => {
      const workingId = openQuery.id ?? "draft";
      persistWorkingQuery({
        id: workingId,
        name: openQuery.name ?? "New Query",
        description: openQuery.description ?? null,
        folderId: openQuery.folderId ?? null,
        isDirty: openQuery.isDirty,
        sqlJson: ensureToolMeta(sqlJson),
      });
    }, 400);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [openQuery, sqlJson]);

  const persistQuery = (payload: {
    id: string;
    name: string;
    description?: string | null;
    folderId: string | null;
    sqlJson: SqlQueryJson;
  }) => {
    if (typeof window === "undefined") return;
    const saved = {
      id: payload.id,
      name: payload.name,
      description: payload.description ?? null,
      folderId: payload.folderId,
      sqlJson: payload.sqlJson,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`query_builder_saved:${payload.id}`, JSON.stringify(saved));
    } catch (err) {
      console.warn("Failed to persist query locally", err);
    }
  };

  // -----------------------------
  // Business state (derived from sqlJson)
  // -----------------------------
  const prompt = sqlJson.prompt ?? sqlJson.meta?.prompt ?? "";

  const crosswalkA = sqlJson.crosswalks?.a ?? "";
  const crosswalkB = sqlJson.crosswalks?.b ?? "";
  const crosswalkC = sqlJson.crosswalks?.c ?? "";

  const attachmentRows = useMemo(() => buildAttachmentColumnRows(sqlJson), [sqlJson]);
  const attachmentKeys = useMemo<SqlColumnKey[]>(() => {
    return attachmentRows.map((r) => ({
      modelColumnId: null,
      columnName: r.columnName,
      workspaceTableId: typeof r.workspaceTableId === "number" ? r.workspaceTableId : null,
      exprId: r.identityKey.startsWith("expr:") ? r.identityKey.slice(5) : null,
    }));
  }, [attachmentRows]);

  const derivedColumnKeys: SqlColumnKey[] = useMemo(() => {
    const rules = sqlJson.dataPrep?.rules ?? [];
    const out: SqlColumnKey[] = [];

    for (const r of rules) {
      if (!r || r.enabled === false) continue;
      const k = r.output;
      if (!k?.columnName) continue;

      out.push({
        modelColumnId: null,
        columnName: k.columnName,
        workspaceTableId: null,
        exprId: k.exprId ?? r.id,
        alias: (k as any).alias ?? k.columnName,
      });
    }

    const seenOut = new Set<string>();
    const uniq: SqlColumnKey[] = [];
    for (const k of out) {
      const ck = colKey(k);
      if (seenOut.has(ck)) continue;
      seenOut.add(ck);
      uniq.push(k);
    }

    uniq.sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
    const merged = [...uniq, ...attachmentKeys];
    const seenMerged = new Set<string>();
    const outMerged: SqlColumnKey[] = [];
    for (const k of merged) {
      const ck = colKey(k);
      if (seenMerged.has(ck)) continue;
      seenMerged.add(ck);
      outMerged.push(k);
    }
    outMerged.sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
    return outMerged;
  }, [sqlJson.dataPrep, attachmentKeys]);

  const availableColumnKeys: SqlColumnKey[] = useMemo(() => {
    const base: SqlColumnKey[] = sqlJson.columns.map((c) => ({
      modelColumnId: c.modelColumnId ?? null,
      columnName: c.columnName,
      workspaceTableId: (c as any).workspaceTableId ?? null,
      exprId: c.exprId ?? null,
      alias: c.alias ?? null,
    }));

    const all = [...base, ...derivedColumnKeys];

    const seen = new Set<string>();
    const uniq: SqlColumnKey[] = [];
    for (const k of all) {
      const ck = colKey(k);
      if (seen.has(ck)) continue;
      seen.add(ck);
      uniq.push(k);
    }
    return uniq;
  }, [sqlJson.columns, derivedColumnKeys]);

  const selectedColumns: SqlColumnKey[] = useMemo(() => {
    return (sqlJson.columns ?? []).map((c) => ({
      modelColumnId: c.modelColumnId ?? null,
      columnName: c.columnName,
      workspaceTableId: (c as any).workspaceTableId ?? null,
      exprId: c.exprId ?? null,
      alias: c.alias ?? null,
    }));
  }, [sqlJson.columns]);

  const aliasByKey = useMemo(() => {
    const m = new Map<string, string>();
    (sqlJson.columns ?? []).forEach((c) => {
      const alias = (c.alias ?? "").trim();
      if (!alias) return;
      const key: SqlColumnKey = {
        modelColumnId: c.modelColumnId ?? null,
        columnName: c.columnName,
        workspaceTableId: (c as any).workspaceTableId ?? null,
        exprId: c.exprId ?? null,
      };
      m.set(colKey(key), alias);
    });
    return m;
  }, [sqlJson.columns]);

  const setPrompt = (v: string) => {
    updateSqlJson((cur) => ({
      ...cur,
      prompt: v,
      meta: { ...(cur.meta ?? {}), prompt: v },
    }));
  };

  const setDomainIdInJson = (next: number | null) => {
    updateSqlJson((cur) => {
      const same = next === cur.domainId;
      if (same) return cur;

      return {
        ...cur,
        domainId: next,
        columns: [],
        sorting: [],
        aggs: { enabled: false, metrics: [], groupBy: [] },
        filters: null,
        dataPrep: null,
        distinct: true,
        crosswalkAttachments: [],
        cohortAttachment: null,
      };
    });
  };

  const setCrosswalk = (k: "a" | "b" | "c", v: string) => {
    updateSqlJson((cur) => ({
      ...cur,
      crosswalks: { ...(cur.crosswalks ?? {}), [k]: v || null },
    }));
  };

  const setCrosswalkAttachments = (next: CrosswalkAttachment[]) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.crosswalkAttachments ?? []);
      const nextSig = JSON.stringify(next ?? []);
      if (curSig === nextSig) return cur;
      return { ...cur, crosswalkAttachments: next ?? [] };
    });
  };

  const setCohortAttachment = (next: CohortAttachment | null) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.cohortAttachment ?? null);
      const nextSig = JSON.stringify(next ?? null);
      if (curSig === nextSig) return cur;
      return { ...cur, cohortAttachment: next ?? null };
    });
  };

  const setSortingInJson = (next: SqlSort[]) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.sorting ?? []);
      const nextSig = JSON.stringify(next ?? []);
      if (curSig === nextSig) return cur;
      return { ...cur, sorting: next ?? [] };
    });
  };

  const setDataPrepInJson = (next: SqlDataPrepJson | null) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.dataPrep ?? null);
      const nextSig = JSON.stringify(next ?? null);
      if (curSig === nextSig) return cur;
      const collectExprIds = (rules?: SqlDataPrepJson["rules"]) => {
        const ids: string[] = [];
        for (const r of rules ?? []) {
          const out = (r as any).output as SqlColumnKey | undefined;
          const exprId = (out as any)?.exprId ?? (r as any).id ?? null;
          if (exprId) ids.push(String(exprId));
        }
        return ids;
      };

      const derivedExprIds = new Set([
        ...collectExprIds(cur.dataPrep?.rules ?? []),
        ...collectExprIds(next?.rules ?? []),
      ]);

      const filteredColumns = (cur.columns ?? []).filter((c) => {
        const exprId = (c as any).exprId ?? null;
        if (!exprId) return true;
        return !derivedExprIds.has(String(exprId));
      });

      return { ...cur, dataPrep: next ?? null, columns: normalizeColumns(filteredColumns) };
    });
  };

  const setAggsInJson = (next: SqlAggregationsJson | null) => {
    updateSqlJson((cur) => {
      const normalized: SqlAggregationsJson | null =
        !next
          ? null
          : {
              enabled: (next.metrics?.length ?? 0) > 0 || (next.groupBy?.length ?? 0) > 0,
              metrics: next.metrics ?? [],
              groupBy: next.groupBy ?? [],
            };

      const curSig = JSON.stringify(cur.aggs ?? null);
      const nextSig = JSON.stringify(normalized);
      if (curSig === nextSig) return cur;
      return { ...cur, aggs: normalized };
    });
  };

  const setFiltersInJson = (next: SqlFilterNode | null) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.filters ?? null);
      const nextSig = JSON.stringify(next ?? null);
      if (curSig === nextSig) return cur;
      return { ...cur, filters: next ?? null };
    });
  };

  const toggleColumn = (k: SqlColumnKey) => {
    updateSqlJson((cur) => {
      const exists = cur.columns.some((c) => colKey(c) === colKey(k));
      const nextCols = exists
        ? removeSelectedColumn(cur.columns, k)
        : upsertSelectedColumn(cur.columns, {
            modelColumnId: k.modelColumnId ?? null,
            columnName: k.columnName,
            workspaceTableId: k.workspaceTableId ?? null,
            exprId: k.exprId ?? null,
            modelTableId: null,
            modelTableName: null,
            fullName: null,
            dataType: null,
            nullable: null,
            alias: null,
          } as SqlColumnRef);

      const cols = normalizeColumns(nextCols);
      const keep = new Set(cols.map(colKey));

      return {
        ...cur,
        columns: cols,
        sorting: (cur.sorting ?? []).filter((s) => keep.has(colKey(s.col))),
        aggs: cur.aggs
          ? {
              ...cur.aggs,
              groupBy: (cur.aggs.groupBy ?? []).filter((g) => keep.has(colKey(g))),
              metrics: (cur.aggs.metrics ?? []).map((m) =>
                m.field && !keep.has(colKey(m.field)) ? { ...m, field: null } : m
              ),
            }
          : cur.aggs,
      };
    });
  };

  const removeSelected = (k: SqlColumnKey) => {
    updateSqlJson((cur) => {
      const cols = removeSelectedColumn(cur.columns, k);
      const keep = new Set(cols.map(colKey));

      return {
        ...cur,
        columns: cols,
        sorting: (cur.sorting ?? []).filter((s) => keep.has(colKey(s.col))),
        aggs: cur.aggs
          ? {
              ...cur.aggs,
              groupBy: (cur.aggs.groupBy ?? []).filter((g) => keep.has(colKey(g))),
              metrics: (cur.aggs.metrics ?? []).map((m) =>
                m.field && !keep.has(colKey(m.field)) ? { ...m, field: null } : m
              ),
            }
          : cur.aggs,
      };
    });
  };

  const clearAllSelected = () => {
    updateSqlJson((cur) => ({
      ...cur,
      columns: [],
      sorting: [],
      aggs: { enabled: false, metrics: [], groupBy: [] },
      filters: null,
      dataPrep: null,
    }));
  };

  // -----------------------------
  // Data fetching state (NOT part of sqlJson)
  // -----------------------------
  const [suggestions, setSuggestions] = useState<SuggestedColumn[]>([]);
  const [columnsSearchTerm, setColumnsSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Domains + summaries
  const domainsQ = useQuery({ queryKey: ["domains"], queryFn: fetchDomains });

  const summariesQ = useQuery({
    queryKey: ["domainSummaries", { sample_size: 2 }],
    queryFn: () => fetchDomainSummaries({ sample_size: 2 }),
  });

  const domains: Domain[] = domainsQ.data?.rows ?? [];
  const summariesById = useMemo(() => {
    const m = new Map<number, { table_count: number; table_sample: string[] }>();
    (summariesQ.data?.rows ?? []).forEach((r) =>
      m.set(r.id, { table_count: r.table_count, table_sample: r.table_sample })
    );
    return m;
  }, [summariesQ.data]);

const domainOptions = useMemo(() => {
  return domains.map((d) => {
    const s = summariesById.get(d.id);
    return {
      id: String(d.id),
      name: d.name,
      description: d.description ?? null,
      kind: d.kind ?? null,              
      tables: s?.table_sample ?? [],
      table_count: s?.table_count ?? 0,

      // optional: if DomainSection uses these
      modelTableId: d.modelTableId ?? null,
      modelTableName: d.modelTableName ?? null,
    };
  });
}, [domains, summariesById]);

  // Builder columns feed
  const offset = (currentPage - 1) * PAGE_SIZE;

  const renameOpenQuery = (nextName: string) => {
    setOpenQuery((p) => ({ ...p, name: nextName, isDirty: true }));
  };

  const columnsQ = useQuery({
    queryKey: ["builderColumns", { domainId, columnsSearchTerm, offset, limit: PAGE_SIZE }],
    enabled: domainId != null,
    queryFn: () =>
      fetchDomainColumns({
        domain_id: domainId!,
        column_q: columnsSearchTerm.trim() ? columnsSearchTerm.trim() : undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const allColumns = useQuery({
    queryKey: ["allBuilderColumns", { domainId }],
    enabled: domainId != null,
    queryFn: () =>
      fetchDomainColumns({
        domain_id: domainId!,
        column_q: undefined,
        limit: 2000,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const allRows: DomainColumnRef[] = useMemo(() => {
    const rowsA: BuilderColumnRow[] = allColumns.data?.rows ?? [];
    const base = rowsA.map(toDomainColumnRef);
    const all = [...base, ...attachmentRows];
    const seen = new Set<string>();
    const uniq: DomainColumnRef[] = [];
    for (const r of all) {
      if (seen.has(r.identityKey)) continue;
      seen.add(r.identityKey);
      uniq.push(r);
    }
    return uniq;
  }, [allColumns.data, attachmentRows]);

  const pageRows: DomainColumnRef[] = useMemo(() => {
    const rows: BuilderColumnRow[] = columnsQ.data?.rows ?? [];
    const base = rows.map(toDomainColumnRef);
    const all = [...base, ...attachmentRows];
    const seen = new Set<string>();
    const uniq: DomainColumnRef[] = [];
    for (const r of all) {
      if (seen.has(r.identityKey)) continue;
      seen.add(r.identityKey);
      uniq.push(r);
    }
    return uniq;
  }, [columnsQ.data, attachmentRows]);

  const totalColumns = columnsQ.data?.total ?? 0;

  const columnKeyByIdentity = useMemo(() => {
    const m = new Map<string, SqlColumnKey>();
    for (const r of allRows) {
      if (!r.identityKey) continue;
      if (m.has(r.identityKey)) continue;
      if (r.identityKey.startsWith("expr:")) {
        m.set(r.identityKey, {
          modelColumnId: null,
          columnName: r.columnName,
          workspaceTableId: null,
          exprId: r.identityKey.slice(5),
        });
        continue;
      }
      m.set(r.identityKey, {
        modelColumnId: r.modelColumnId ?? null,
        columnName: r.columnName,
        workspaceTableId: r.workspaceTableId ?? null,
        exprId: null,
      });
    }
    return m;
  }, [allRows]);

  const columnKeyByName = useMemo(() => {
    const m = new Map<string, SqlColumnKey>();
    for (const r of allRows) {
      if (!r.columnName) continue;
      if (m.has(r.columnName)) continue;
      if (r.identityKey.startsWith("expr:")) {
        m.set(r.columnName, {
          modelColumnId: null,
          columnName: r.columnName,
          workspaceTableId: null,
          exprId: r.identityKey.slice(5),
        });
        continue;
      }
      m.set(r.columnName, {
        modelColumnId: r.modelColumnId ?? null,
        columnName: r.columnName,
        workspaceTableId: r.workspaceTableId ?? null,
        exprId: null,
      });
    }
    return m;
  }, [allRows]);

  const identityKeyByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of allRows) {
      if (!r.columnName) continue;
      if (m.has(r.columnName)) continue;
      m.set(r.columnName, r.identityKey);
    }
    return m;
  }, [allRows]);

  const allColumnKeysForFilters = useMemo(() => {
    const base: SqlColumnKey[] = allRows.map((r: any) => {
      const exprId = r.identityKey?.startsWith("expr:") ? r.identityKey.slice(5) : null;
      const key: SqlColumnKey = {
        modelColumnId: r.modelColumnId ?? null,
        columnName: r.columnName,
        workspaceTableId: r.workspaceTableId ?? null,
        exprId,
      };
      (key as any).dataType = r.dataType ?? r.data_type ?? null;
      const alias = aliasByKey.get(colKey(key)) ?? null;
      return { ...key, alias };
    });

    const withDerived = [...base, ...derivedColumnKeys];
    const seen = new Set<string>();
    const uniq: SqlColumnKey[] = [];
    for (const k of withDerived) {
      const ck = colKey(k);
      if (seen.has(ck)) continue;
      seen.add(ck);
      uniq.push(k);
    }
    return uniq;
  }, [allRows, derivedColumnKeys, aliasByKey]);

  const selectedColumnKeysForUi = useMemo(() => {
    return selectedColumns.map((c) => {
      // ✅ derived / virtual columns must key by expr
      if (c.exprId) return `expr:${c.exprId}`;
      if (typeof c.workspaceTableId === "number") return `${c.workspaceTableId}:${c.columnName}`;
      return identityKeyByName.get(c.columnName) ?? c.columnName;
    });
  }, [selectedColumns, identityKeyByName]);

  const keyForColumnIdentityKey = (key: string): SqlColumnKey => {
    // 1) Exact hit from catalog map (includes expr identityKey)
    const hit = columnKeyByIdentity.get(key);
    if (hit) return hit;

    // 2) expr:<exprId>
    if (key.startsWith("expr:")) {
      const exprId = key.slice(5);
      return {
        modelColumnId: null,
        columnName: exprId, // best-effort
        workspaceTableId: null,
        exprId,
      };
    }

    // 3) colKey() format: wt:<id>|name:<col>
    if (key.startsWith("wt:")) {
      const m = key.match(/^wt:(\d+)\|name:(.+)$/);
      if (m) {
        return {
          modelColumnId: null,
          columnName: m[2],
          workspaceTableId: Number(m[1]),
          exprId: null,
        };
      }
    }

    // 4) id:<modelColumnId>
    if (key.startsWith("id:")) {
      const id = Number(key.slice(3));
      if (!Number.isNaN(id)) {
        const row = allRows.find((r) => r.modelColumnId === id);
        return {
          modelColumnId: id,
          columnName: row?.columnName ?? key,
          workspaceTableId: row?.workspaceTableId ?? null,
          exprId: null,
        };
      }
    }

    // 5) name:<col>
    if (key.startsWith("name:")) {
      return keyForColumnName(key.slice(5));
    }

    // 6) legacy "<wtId>:<col>"
    const idx = key.indexOf(":");
    if (idx > 0 && /^[0-9]+:/.test(key)) {
      const wtId = Number(key.slice(0, idx));
      const name = key.slice(idx + 1);
      if (!Number.isNaN(wtId) && name) {
        return {
          modelColumnId: null,
          columnName: name,
          workspaceTableId: wtId,
          exprId: null,
        };
      }
    }

    // 7) fallback: treat as a name
    return keyForColumnName(key);
  };

  const keyForColumnName = (name: string): SqlColumnKey => {
    return (
      columnKeyByName.get(name) ?? {
        modelColumnId: null,
        columnName: name,
        workspaceTableId: null,
        exprId: null,
      }
    );
  };

  // hydrate missing IDs/table/fullName onto selected columns when they appear in pageRows
  useEffect(() => {
    if (!pageRows.length) return;

    updateSqlJson((cur) => {
      if (!cur.columns.length) return cur;

      const byKey = new Map(pageRows.map((r: any) => [r.identityKey, r]));
      const byName = new Map<string, any>();
      pageRows.forEach((r: any) => {
        if (!byName.has(r.columnName)) byName.set(r.columnName, r);
      });
      let changed = false;

      const nextCols = cur.columns.map((c) => {
        const wtId = (c as any).workspaceTableId;
        const key =
          typeof wtId === "number"
            ? `${wtId}:${c.columnName}`
            : identityKeyByName.get(c.columnName) ?? c.columnName;
        const hit: any = byKey.get(key) ?? byName.get(c.columnName);
        if (!hit) return c;

        const next: SqlColumnRef = {
          ...c,
          modelColumnId: c.modelColumnId ?? hit.modelColumnId ?? null,
          workspaceTableId: (c as any).workspaceTableId ?? hit.workspaceTableId ?? null,
          modelTableName: c.modelTableName ?? hit.modelTableName ?? hit.table_name ?? null,
          fullName: c.fullName ?? hit.full_name ?? hit.fullName ?? null,
          dataType: c.dataType ?? hit.dataType ?? hit.data_type ?? null,
        };

        if (
          next.modelColumnId !== c.modelColumnId ||
          (next as any).workspaceTableId !== (c as any).workspaceTableId ||
          next.modelTableName !== c.modelTableName ||
          next.fullName !== c.fullName ||
          next.dataType !== c.dataType
        ) {
          changed = true;
        }
        return next;
      });

      return changed ? { ...cur, columns: nextCols } : cur;
    });
  }, [pageRows.map((r: any) => r.identityKey).join("|"), identityKeyByName]);

  // Build AggColumnMeta-ish list for DataPrep/Agg sections (best-effort from pageRows)
  const columnsMeta = useMemo(() => {
    const aliasByModelId = new Map<number, string>();
    const aliasByKey = new Map<string, string>();
    for (const c of sqlJson.columns ?? []) {
      const alias = (c.alias ?? "").trim();
      if (!alias) continue;
      if (typeof c.modelColumnId === "number") aliasByModelId.set(c.modelColumnId, alias);
      if (typeof (c as any).workspaceTableId === "number") {
        aliasByKey.set(`${(c as any).workspaceTableId}:${c.columnName}`, alias);
      }
    }

    return pageRows.map((r: any) => {
      const modelId = r.modelColumnId ?? null;
      const wtId = r.workspaceTableId ?? r.workspace_table_id ?? null;
      const alias =
        (typeof modelId === "number" ? aliasByModelId.get(modelId) : undefined) ??
        (typeof wtId === "number" ? aliasByKey.get(`${wtId}:${r.columnName}`) : undefined) ??
        null;
      return {
        name: r.name,
        table: r.table_name ?? r.modelTableName ?? null,
        data_type: r.data_type ?? r.dataType ?? null,
        modelColumnId: modelId,
        alias,
      };
    });
  }, [pageRows, sqlJson.columns]);

  // Mock prompt -> suggestions
  const onRunPrompt = () => {
    const mock: SuggestedColumn[] = [
      {
        table_name: "claims_header",
        column_name: "provider_npi",
        data_type: "string",
        description: "Rendering provider NPI",
        confidence: "high",
      },
      {
        table_name: "claims_header",
        column_name: "paid_amount",
        data_type: "number",
        description: "Amount paid on the claim",
        confidence: "high",
      },
      {
        table_name: "claims_header",
        column_name: "service_from_date",
        data_type: "date",
        description: "Start date of service",
        confidence: "medium",
      },
    ];

    setSuggestions(mock);

    // ensure Suggested is visible + expanded
    if (!visibleSections.suggested) showSection("suggested");
    setSectionsCollapsed((p) => ({ ...p, suggested: false }));
    focusSection("suggested");
  };

  const acceptAllSuggestions = () => {
    updateSqlJson((cur) => {
      const next = new Map<string, SqlColumnRef>();
      for (const c of cur.columns) next.set(colKey(c), c);

      for (const s of suggestions) {
        const k: SqlColumnKey = keyForColumnName(s.column_name);
        const kk = colKey(k);
        if (!next.has(kk)) {
          next.set(kk, {
            modelColumnId: k.modelColumnId ?? null,
            columnName: k.columnName,
            workspaceTableId: k.workspaceTableId ?? null,
            exprId: k.exprId ?? null,
            modelTableName: s.table_name ?? null,
            fullName: null,
            dataType: s.data_type ?? null,
            alias: null,
          } as SqlColumnRef);
        }
      }

      return { ...cur, columns: Array.from(next.values()) };
    });

    // guide to Columns
    if (!visibleSections.columns) showSection("columns");
    setSectionsCollapsed((p) => ({ ...p, columns: false }));
    focusSection("columns");
  };

  return (
    <div className="ncqv2-root">
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
            onSave={() => setSaveModalOpen(true)}
            onToggleSavedQueries={toggleSavedQueries}
            savedQueriesOpen={savedQueriesOpen}
          />

          <SavedQueriesPanel
            open={savedQueriesOpen}
            width={360}
            railNudgePx={0}
            search={savedQueriesSearch}
            onChangeSearch={setSavedQueriesSearch}
            openGroups={savedQueriesGroups}
            onToggleGroup={onToggleSavedQueriesGroup}
            data={savedQueryLists}
            selectedQueryId={selectedSavedQueryId}
            onSelectQuery={(id) => setSelectedSavedQueryId(id)}
            onNew={() => console.info("New saved query")}
            onImport={() => console.info("Import saved query")}
            onClose={() => setActiveTool(null)}
            treeLibrary={trees.library}
            treeShared={trees.shared}
            treeMy={trees.my}
            treeTrash={trees.trash}
            recent={recentQueries}
            currentUserName={currentUserName}
            onAction={handleSavedQueriesAction}
          />
        </div>

        <div className="ncqv2-canvas">
          <AppHeaderBar
            queryPath={[]}
            queryName={openQuery.name}
            queryNameDirty={openQuery.isDirty}
            queryIsSaved={Boolean(openQuery.id)}
            onRenameQuery={renameOpenQuery}
            onNewQuery={handleNewQuery}
            onNameBlurSave={() => setSaveModalOpen(true)}
          />

          <div className="mt-3">
            <BuilderSummaryCardV2
              sqlJson={sqlJson}
              domainOptions={domainOptions as { id: string; name: string }[]}
              onOpenTool={openToolV2}
              collapsed={summaryCollapsed}
              onToggleCollapsed={() => setSummaryCollapsed((prev) => !prev)}
            />
          </div>

          <div className="ncqv2-preview">
            <PreviewCard
              sqlJson={sqlJson}
              persistKey={openQuery.id ?? "draft"}
              exportBaseName={openQuery.name ?? "query_export"}
              collapsed={previewCollapsed}
              onToggleCollapsed={() => setPreviewCollapsed((prev) => !prev)}
              onHide={() => {}}
            />
          </div>
        </div>
      </div>

      <BuilderDrawerV2
        openTool={openTool}
        onClose={() => setOpenTool(null)}
        childrenByTool={{
          domain: (
            <DomainSection
              domains={domainOptions as any}
              selectedDomainId={domainId == null ? null : String(domainId)}
              onChangeDomain={(idOrNull: any) => setDomainIdInJson(idOrNull ? Number(idOrNull) : null)}
              workspaceId={workspaceId}
              domainColumns={allRows}
              crosswalkAttachments={sqlJson.crosswalkAttachments ?? []}
              cohortAttachment={sqlJson.cohortAttachment ?? null}
              onChangeCrosswalkAttachments={setCrosswalkAttachments}
              onChangeCohortAttachment={setCohortAttachment}
              distinct={sqlJson.distinct !== false}
              onChangeDistinct={(v) =>
                updateSqlJson((cur) => ({
                  ...cur,
                  distinct: v,
                }))
              }
              loading={domainsQ.isLoading}
              error={domainsQ.isError ? (domainsQ.error as Error)?.message : undefined}
              collapsed={effectiveCollapsed("domain")}
              onToggleCollapsed={() => toggleSection("domain")}
              collapsible={false}
              onHide={() => {
                hideSection("domain");
                setOpenTool(null);
              }}
              onNext={goToDrawerStep("columns")}
              onSubmit={closeDrawer}
            />
          ),
          columns: (
            <ColumnsSection
              collapsed={effectiveCollapsed("columns")}
              onToggleCollapsed={() => toggleSection("columns")}
              collapsible={false}
              onHide={() => {
                hideSection("columns");
                setOpenTool(null);
              }}
              rows={pageRows}
              total={totalColumns}
              searchTerm={columnsSearchTerm}
              domainId={domainId}
              onChangeSearch={(v) => {
                setColumnsSearchTerm(v);
                setCurrentPage(1);
              }}
              selectedColumnKeys={selectedColumnKeysForUi}
              onToggleColumn={(key: string) => toggleColumn(keyForColumnIdentityKey(key))}
              onRemoveSelected={(key: string) => removeSelected(keyForColumnIdentityKey(key))}
              pageSize={PAGE_SIZE}
              currentPage={currentPage}
              onChangePage={setCurrentPage}
              loading={columnsQ.isLoading}
              error={columnsQ.isError ? (columnsQ.error as Error)?.message : undefined}
              columnsJson={sqlJson.columns}
              onColumnsJsonChange={setColumnsInJson}
              onNext={goToDrawerStep("dataprep")}
              onSubmit={closeDrawer}
            />
          ),
          dataprep: (
            <DataPrepSection
              selectedColumns={selectedColumns}
              columnsMeta={allRows as any}
              value={sqlJson.dataPrep ?? null}
              onChange={setDataPrepInJson}
              collapsed={effectiveCollapsed("dataprep")}
              onToggleCollapsed={() => toggleSection("dataprep")}
              collapsible={false}
              onHide={() => {
                hideSection("dataprep");
                setOpenTool(null);
              }}
              onNext={goToDrawerStep("filters")}
              onSubmit={closeDrawer}
            />
          ),
          filters: (
            <FiltersSection
              collapsed={effectiveCollapsed("filters")}
              onToggleCollapsed={() => toggleSection("filters")}
              collapsible={false}
              onHide={() => {
                hideSection("filters");
                setOpenTool(null);
              }}
              selectedColumns={availableColumnKeys}
              allColumns={allColumnKeysForFilters}
              value={sqlJson.filters ?? null}
              onChange={setFiltersInJson}
              sqlJson={sqlJson}
              onNext={goToDrawerStep("aggs")}
              onSubmit={closeDrawer}
            />
          ),
          aggs: (
            <AggregationsSection
              selectedColumns={selectedColumns}
              allColumns={allColumnKeysForFilters}
              columnsMeta={columnsMeta as any}
              value={sqlJson.aggs ?? { enabled: false, metrics: [], groupBy: [] }}
              onChange={(next: SqlAggregationsJson | null) => setAggsInJson(next)}
              collapsed={effectiveCollapsed("aggs")}
              onToggleCollapsed={() => toggleSection("aggs")}
              collapsible={false}
              onHide={() => {
                hideSection("aggs");
                setOpenTool(null);
              }}
              onNext={goToDrawerStep("sorting")}
              onSubmit={closeDrawer}
            />
          ),
          sorting: (
            <SortingSection
              selectedColumns={selectedColumns}
              allColumns={allColumnKeysForFilters}
              value={sqlJson.sorting ?? []}
              onChange={setSortingInJson}
              onFocusColumn={() => {
                if (!visibleSections.columns) showSection("columns");
                setSectionsCollapsed((p) => ({ ...p, columns: false }));
                focusSection("columns");
              }}
              collapsed={effectiveCollapsed("sorting")}
              onToggleCollapsed={() => toggleSection("sorting")}
              collapsible={false}
              onHide={() => {
                hideSection("sorting");
                setOpenTool(null);
              }}
              onNext={goToPreviewFromDrawer}
              onSubmit={closeDrawer}
            />
          ),
        }}
      />

      <SaveQueryModal
        open={saveModalOpen}
        myTree={trees.my}
        myLabel={currentUserName}
        initialName={openQuery.name}
        initialDescription={openQuery.description}
        initialFolderId={openQuery.folderId ?? null}
        onClose={() => setSaveModalOpen(false)}
        onSave={async ({ name, description, folderId }) => {
          setSaveModalOpen(false);

          setOpenQuery((p) => ({
            ...p,
            name,
            description,
            folderId,
            isDirty: true,
          }));

          const saved = openQuery.id
            ? await updateSavedQuery(openQuery.id, { name, description, folderId, sqlJson: ensureToolMeta(sqlJson) })
            : await createSavedQuery({ name, description, folderId, sqlJson: ensureToolMeta(sqlJson) });

          const savedId = saved?.queryId ?? saved?.query_id ?? saved?.id ?? openQuery.id ?? null;

          if (savedId) setSelectedSavedQueryId(String(savedId));

          setOpenQuery((p) => ({
            ...p,
            id: savedId ? String(savedId) : p.id,
            name: saved?.name ?? name,
            description: saved?.description ?? description ?? null,
            folderId: saved?.folderId ?? folderId ?? null,
            scope: saved?.scope ?? p.scope,
            isDirty: false,
          }));

          if (savedId) {
            persistQuery({
              id: String(savedId),
              name: saved?.name ?? name,
              description: saved?.description ?? description ?? null,
              folderId: saved?.folderId ?? folderId ?? null,
              sqlJson: ensureToolMeta(sqlJson),
            });
          }

          await refetchTree();
        }}
      />

      <NamePromptDialog
        open={nameDialogOpen}
        title={nameDialogTitle}
        label={nameDialogLabel}
        value={nameDialogValue}
        onChange={setNameDialogValue}
        confirmLabel={nameDialogConfirmLabel}
        onConfirm={submitNameDialog}
        onClose={() => setNameDialogOpen(false)}
      />

      <MoveModalDialog
        open={moveModalOpen}
        target={moveTarget}
        myTree={trees.my}
        myLabel={currentUserName}
        onClose={() => {
          setMoveModalOpen(false);
          setMoveTarget(null);
        }}
        onCreateFolder={async (parentId, name) => {
          await createFolder({ name, parentId });
          await refetchTree();
        }}
        onMove={async (folderId) => {
          if (!moveTarget) return;
          if (moveTarget.type === "folder") {
            await moveFolder(moveTarget.id, { parentId: folderId });
          } else {
            await moveSavedQuery(moveTarget.id, folderId);
          }
          setMoveModalOpen(false);
          setMoveTarget(null);
          await refetchTree();
        }}
      />

      <ShareSavedQueryModal
        open={shareModalOpen}
        queryId={shareQueryId}
        queryName={shareQueryId ? findNodeAcrossTrees(shareQueryId)?.name ?? "Query" : null}
        onClose={() => {
          setShareModalOpen(false);
          setShareQueryId(null);
        }}
        onRefetchTree={refetchTree}
      />
    </div>
  );
};

export default NoCodeQueryPageV2;
