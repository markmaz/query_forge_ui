// src/features/cohort-builder/ui/CohortBuilderPage.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import "./styles/cohortBuilder.css";
import { useAppDispatch, useAppSelector } from "../../../shared/lib/hooks";
import { TopBar } from "./components/TopBar";
import { PromptBar } from "./components/PromptBar";
import { FiltersPanel } from "./components/FilterPanel";
import { WhyIncludedDrawer } from "./components/WhyIncludedDrawer";
import { buildFiltersFromPrompt } from "../model/thunks";
import {
  setPrompt,
  addFilter,
  updateFilter,
  removeFilter,
  setFilters,
  setLogic,
} from "../model/cohortBuilderSlice";
import { SectionShell } from "../../../shared/ui/SectionShell";
import {
  WorkspaceToolRail,
  type SectionKey as WorkspaceSectionKey,
} from "../../no-code-sql/ui/components/WorkspaceToolRail";
import { MoveModalDialog } from "../../no-code-sql/ui/components/MoveModalDialog";
import { SaveQueryModal } from "../../no-code-sql/ui/components/SaveQueryModal";
import { Modal } from "../../no-code-admin/ui/components/Modal";
import { ShareSavedQueryModal } from "../../../shared/ui/saved-queries/ShareSavedQueryModal";
import { NamePromptDialog } from "../../../shared/ui/NamePromptDialog";
import { FiltersSectionBody } from "../../no-code-sql/ui/components/FiltersSection";
import { PreviewCard } from "../../no-code-sql/ui/components/PreviewSection";
import {
  SavedQueriesPanel,
  type SavedQueriesAction,
  type SavedQueriesData,
  type SavedQueryGroupKey,
  type SavedQueryItem,
  type TreeResponse,
} from "../../../shared/ui/saved-queries";

import {
  createFolder,
  createSavedQuery,
  deleteFolder,
  deleteSavedQuery,
  fetchSavedQuery,
  hydrateQueryTree,
  moveFolder,
  moveSavedQuery,
  purgeFolder,
  renameFolder,
  restoreFolder,
  restoreSavedQuery,
  trashFolder,
  updateSavedQuery,
} from "../../../shared/api/queryTreeApi";
import { fetchDomainColumns } from "../../../shared/api/noCodeAdminApi";
import { fetchCohortDomain } from "../../../shared/api/ai";
import type { SqlColumnKey, SqlColumnRef, SqlFilterNode, SqlQueryJson } from "../../no-code-sql/model/sqlJson";

type TreeNode = {
  id: string;
  name: string;
  nodeType: "query" | "folder";
  children?: TreeNode[];
  updatedAt?: string | number | null;
  parentId?: string | null;
  folderId?: string | null;
};

const SUGGESTION_PROMPTS = [
  "Identify patients between the ages 35 and 75 who were diagnosed with type-2 DM or obesity from 2022 to 2024, prescribed Ozempic or Wegovy, and had gastric bypass or sleeve gastrectomy. Find only women in the south and east of US. Limit to those with blood glucose above 126 mg/dL or HbA1c more than 6.5%.",
  "Identify patients between ages 40 and 80 who were diagnosed with hypertension or hyperlipidemia from 2021 to 2024, prescribed Lisinopril or Atorvastatin, and underwent coronary angioplasty or stent placement. Include only men in the Midwest or Northeast. Limit to LDL cholesterol above 160 mg/dL or systolic BP above 150 mmHg.",
  "Identify patients ages 18 and 55 diagnosed with asthma or chronic bronchitis from 2020 to 2023, prescribed Albuterol or Symbicort, and who completed pulmonary function testing. Include only non-smokers in western US states. Limit to FEV1/FVC ratio below 70% or peak flow reduction ≥20%.",
  "Identify patients ages 50 to 90 with chronic kidney disease (stage 3–5) or anemia diagnosed between 2019 and 2024, prescribed Epoetin alfa or Darbepoetin, and who received a renal ultrasound or dialysis catheter placement. Include only patients in the Pacific or Mountain regions. Limit to eGFR below 45 or hemoglobin below 10 g/dL.",
  "Identify patients ages 25 to 60 diagnosed with major depression or generalized anxiety disorder between 2021 and 2024, prescribed Sertraline or Escitalopram, and who attended psychotherapy or behavioral health evaluations. Include only adults living in urban Mid-Atlantic ZIP codes. Limit to PHQ-9 ≥10 or GAD-7 ≥10.",
  "Identify patients ages 30 to 65 diagnosed with rheumatoid arthritis or psoriatic arthritis from 2022 to 2024, prescribed Humira or Enbrel, and who had joint aspiration or joint MRI. Include only women in the Southwest or central US. Limit to CRP above 10 mg/L or ESR above 40 mm/hr.",
];

const EMPTY_TREES: Record<"library" | "shared" | "my" | "trash", TreeResponse> = {
  library: { view: "library", rootNodes: [] },
  shared: { view: "shared", rootNodes: [] },
  my: { view: "my", rootNodes: [] },
  trash: { view: "trash", rootNodes: [] },
};

// UI guardrails
const FILTER_LIMIT = 255; // number of filter CONDITIONS supported
const MAX_MANUAL_IN = 150; // max values in manual IN list

const EMPTY_SQL_COLUMNS: SqlColumnKey[] = [];

// ---------- helpers (fixed typing + better warning logic) ----------

const removeFilterNodeById = (node: SqlFilterNode | null, id: string): SqlFilterNode | null => {
  if (!node) return null;
  if (node.type === "condition") return node.id === id ? null : node;

  const children = node.children
    .map((child) => removeFilterNodeById(child, id))
    .filter((child): child is SqlFilterNode => !!child);

  if (!children.length) return null;
  return { ...node, children };
};

// Find the largest IN-list size (manual or parsed JSON-array string)
const maxManualInListSize = (node: SqlFilterNode | null): number => {
  if (!node) return 0;

  if (node.type === "group") {
    return node.children.reduce((max, child) => Math.max(max, maxManualInListSize(child)), 0);
  }

  if (node.op !== "in") return 0;

  const v = node.value as unknown;

  // mode: manual
  if (v && typeof v === "object" && (v as any).mode === "manual") {
    const values = Array.isArray((v as any).values) ? (v as any).values : [];
    return values.length;
  }

  // array
  if (Array.isArray(v)) return v.length;

  // string that might be JSON array
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.length;
      } catch {
        return 0;
      }
    }
  }

  return 0;
};

// Remove a single IN value by conditionId (used by your front-panel chip delete)
const removeInValue = (node: SqlFilterNode | null, conditionId: string, valueToRemove: string): SqlFilterNode | null => {
  if (!node) return null;

  if (node.type === "group") {
    const children = node.children
      .map((child) => removeInValue(child, conditionId, valueToRemove))
      .filter((child): child is SqlFilterNode => !!child);

    if (!children.length) return null;
    return { ...node, children };
  }

  if (node.id !== conditionId || node.op !== "in") return node;

  const raw = node.value as unknown;

  let values: string[] = [];

  // mode: manual
  if (raw && typeof raw === "object" && (raw as any).mode === "manual") {
    const arr = Array.isArray((raw as any).values) ? (raw as any).values : [];
    values = arr.map((v: unknown) => String(v));
  }
  // array
  else if (Array.isArray(raw)) {
    values = raw.map((v: unknown) => String(v));
  }
  // string (maybe JSON array or CSV)
  else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) values = parsed.map((v: unknown) => String(v));
      } catch {
        values = [];
      }
    } else if (trimmed.includes(",")) {
      values = trimmed
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    } else if (trimmed) {
      values = [trimmed];
    }
  }

  const nextValues = values.filter((v) => v !== valueToRemove);

  // delete the whole condition if it becomes empty
  if (!nextValues.length) return null;

  if (raw && typeof raw === "object" && (raw as any).mode === "manual") {
    return { ...node, value: { ...(raw as any), values: nextValues } };
  }

  return { ...node, value: nextValues };
};

// ---------- section visibility ----------

const VISIBLE_SECTIONS: Record<WorkspaceSectionKey, boolean> = {
  prompt: true,
  suggested: true,
  domain: true,
  columns: true,
  filters: true,
  aggs: true,
  preview: true,
  sorting: true,
};

const BUILDER_SECTIONS = ["prompt", "filters", "preview"] as const;
type BuilderSectionKey = (typeof BUILDER_SECTIONS)[number];

const SECTION_ORDER: BuilderSectionKey[] = ["prompt", "filters", "preview"];
const ANIM_MS_HIDE = 220;
const ANIM_MS_SHOW = 260;

const CohortBuilderPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    prompt,
    filters,
    logic,
    loadingDraft,
    loadingByKind,
  } = useAppSelector((s) => s.cohortBuilder);

  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [activeTool, setActiveTool] = useState<"savedQueries" | null>(null);
  const savedQueriesOpen = activeTool === "savedQueries";

  const [visibleSections, setVisibleSections] = useState(VISIBLE_SECTIONS);
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<BuilderSectionKey, boolean>>({
    prompt: false,
    filters: false,
    preview: false,
  });
  const [activeSection, setActiveSection] = useState<BuilderSectionKey>("prompt");
  const [fullscreenKey, setFullscreenKey] = useState<BuilderSectionKey | null>(null);
  const [sectionAnim, setSectionAnim] = useState<Partial<Record<BuilderSectionKey, "showing" | "hiding">>>({});
  const inFocusMode = fullscreenKey !== null;

  const shouldRenderSection = (key: BuilderSectionKey) => {
    if (!visibleSections[key]) return false;
    if (!inFocusMode) return true;
    return fullscreenKey === key;
  };

  const effectiveCollapsed = (key: BuilderSectionKey) => {
    if (fullscreenKey === key) return false;
    return sectionsCollapsed[key];
  };

  const [savedQueriesSearch, setSavedQueriesSearch] = useState("");
  const [savedQueriesGroups, setSavedQueriesGroups] = useState<Record<SavedQueryGroupKey, boolean>>({
    shared: true,
    mine: true,
    recent: true,
  });
  const [selectedSavedQueryId, setSelectedSavedQueryId] = useState<string | undefined>(undefined);
  const lastLoadedQueryIdRef = useRef<string | null>(null);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [promptWarnOpen, setPromptWarnOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [pendingPromptAfterSave, setPendingPromptAfterSave] = useState<string | null>(null);

  const [cohortId, setCohortId] = useState<string | null>(null);
  const [cohortName, setCohortName] = useState("New Cohort");
  const [cohortDescription, setCohortDescription] = useState<string>("");
  const [cohortFolderId, setCohortFolderId] = useState<string | null>(null);
  const [cohortDirty, setCohortDirty] = useState(false);

  const [sqlJson, setSqlJson] = useState<SqlQueryJson>({
    version: 1,
    domainId: null,
    columns: [],
    prompt: "",
    meta: { tool: "cohort_builder" },
  });

  const ensureToolMeta = (next: SqlQueryJson): SqlQueryJson => ({
    ...next,
    meta: { ...(next.meta ?? {}), tool: next.meta?.tool ?? "cohort_builder" },
  });

  const buildCohortSqlJson = (base: SqlQueryJson): SqlQueryJson =>
    ensureToolMeta({
      ...base,
      prompt,
      meta: {
        ...(base.meta ?? {}),
        tool: "cohort_builder",
        cohortBuilder: {
          prompt,
          filters,
          logic,
        },
      },
    });

  useEffect(() => {
    if (filters.length > 0) setHasGeneratedOnce(true);
  }, [filters.length]);

  useEffect(() => {
    setSqlJson((cur) => ensureToolMeta({ ...cur, prompt }));
  }, [prompt]);

  useEffect(() => {
    console.log("[CohortBuilder] sqlJson updated", sqlJson);
  }, [sqlJson]);

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{
    type: "folder" | "query";
    id: string;
    name: string;
    currentFolderId: string | null;
  } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareQueryId, setShareQueryId] = useState<string | null>(null);

  const [filtersFlipped, setFiltersFlipped] = useState(false);
  const filtersFrontRef = useRef<HTMLDivElement | null>(null);
  const filtersBackRef = useRef<HTMLDivElement | null>(null);
  const [filtersMinHeight, setFiltersMinHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const front = filtersFrontRef.current;
    const back = filtersBackRef.current;
    if (!front || !back) return;

    const update = () => {
      const next = Math.max(front.offsetHeight, back.offsetHeight);
      setFiltersMinHeight((prev) => (prev === next ? prev : next));
    };

    update();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(front);
    ro.observe(back);
    return () => ro.disconnect();
  }, [filtersFlipped, fullscreenKey]);

  const filtersLimitExceeded = filters.length > FILTER_LIMIT;

  const maxManualInCount = useMemo(() => maxManualInListSize(sqlJson.filters ?? null), [sqlJson.filters]);
  const manualInLimitExceeded = maxManualInCount > MAX_MANUAL_IN;

  const selectedSqlColumns: SqlColumnKey[] = useMemo(() => {
    if (!sqlJson.columns?.length) return EMPTY_SQL_COLUMNS;
    return sqlJson.columns.map((c) => ({
      modelColumnId: c.modelColumnId ?? null,
      columnName: c.columnName,
      workspaceTableId: (c as any).workspaceTableId ?? null,
      exprId: c.exprId ?? null,
      alias: c.alias ?? null,
    }));
  }, [sqlJson.columns]);

  const onDraft = async () => {
    setHasGeneratedOnce(true);

    try {
      const result = await dispatch(buildFiltersFromPrompt(prompt)).unwrap();
      if (result) {
        setSqlJson((cur) =>
          ensureToolMeta({
            ...cur,
            ...result,
            prompt,
          })
        );
      }
    } catch (err) {
      console.error("Failed to build sqlJson from prompt", err);
    }
  };

  const clearGeneratedData = (nextPrompt?: string) => {
    dispatch(setFilters([]));
    setFiltersFlipped(false);
    setHasGeneratedOnce(false);
    setSqlJson((cur) =>
      ensureToolMeta({
        ...cur,
        filters: null,
        prompt: nextPrompt ?? cur.prompt,
      })
    );
  };

  const handleRemoveFilter = (id: string) => {
    dispatch(removeFilter(id));
    setSqlJson((cur) => {
      if (!cur.filters) return cur;
      const nextFilters = removeFilterNodeById(cur.filters, id);
      if (nextFilters === cur.filters) return cur;
      return ensureToolMeta({ ...cur, filters: nextFilters });
    });
  };

  // ✅ Deleting a code chip in the front panel updates sqlJson.filters (and the warning decrements)
  const handleRemoveInValue = (conditionId: string, value: string) => {
    setSqlJson((cur) => {
      const nextFilters = removeInValue(cur.filters ?? null, conditionId, value);
      if (nextFilters === cur.filters) return cur;
      return ensureToolMeta({ ...cur, filters: nextFilters });
    });
  };

  const handlePromptChange = (next: string) => {
    const hasGenerated = hasGeneratedOnce && (filters.length > 0 || !!sqlJson.filters);
    if (!hasGenerated) {
      dispatch(setPrompt(next));
      return;
    }
    if (next === prompt) return;
    setPendingPrompt(next);
    setPromptWarnOpen(true);
  };

  const confirmPromptChange = (shouldSave: boolean) => {
    const next = pendingPrompt ?? "";
    setPromptWarnOpen(false);
    if (!next) return;

    if (shouldSave && cohortDirty) {
      setPendingPromptAfterSave(next);
      setSaveModalOpen(true);
      return;
    }

    clearGeneratedData(next);
    dispatch(setPrompt(next));
    setPendingPrompt(null);
  };

  const onSuggestion = () => {
    const random = SUGGESTION_PROMPTS[Math.floor(Math.random() * SUGGESTION_PROMPTS.length)];
    handlePromptChange(random);
  };

  const onToggleSavedQueriesGroup = (k: SavedQueryGroupKey) => setSavedQueriesGroups((prev) => ({ ...prev, [k]: !prev[k] }));

  const toggleSavedQueries = () => setActiveTool((prev) => (prev === "savedQueries" ? null : "savedQueries"));

  const isBuilderSection = (key: WorkspaceSectionKey): key is BuilderSectionKey =>
    (BUILDER_SECTIONS as readonly string[]).includes(key);

  const focusSection = (key: BuilderSectionKey) => setActiveSection(key);

  const toggleSection = (key: BuilderSectionKey) => {
    if (fullscreenKey === key) return;

    setSectionsCollapsed((prev) => {
      const nextCollapsed = !prev[key];
      if (!nextCollapsed) {
        focusSection(key);
      } else if (activeSection === key) {
        const nextActive = SECTION_ORDER.find((k) => k !== key && prev[k] === false) ?? "prompt";
        focusSection(nextActive);
      }
      return { ...prev, [key]: nextCollapsed };
    });
  };

  const hideSection = (key: BuilderSectionKey) => {
    if (fullscreenKey === key) setFullscreenKey(null);
    setSectionAnim((p) => ({ ...p, [key]: "hiding" }));
    window.setTimeout(() => {
      setVisibleSections((prev) => {
        const next = { ...prev, [key]: false };
        if (activeSection === key) {
          const nextActive = SECTION_ORDER.find((k) => k !== key && next[k]) ?? "prompt";
          setActiveSection(nextActive);
        }
        return next;
      });
      setSectionAnim((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }, ANIM_MS_HIDE);
  };

  const showSection = (key: WorkspaceSectionKey) => {
    if (!isBuilderSection(key)) return;
    if (visibleSections[key]) return;
    setVisibleSections((prev) => ({ ...prev, [key]: true }));
    setSectionsCollapsed((prev) => ({ ...prev, [key]: false }));
    focusSection(key);
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

  const toggleFullscreen = (key: BuilderSectionKey) => {
    setFullscreenKey((prev) => (prev === key ? null : key));
    setSectionsCollapsed((prev) => ({ ...prev, [key]: false }));
    focusSection(key);
  };

  const focusPreview = () => {
    setFullscreenKey("preview");
    setSectionsCollapsed((prev) => ({ ...prev, preview: false }));
    focusSection("preview");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  const cohortSnapshotRef = useRef<{
    signature: string;
    name: string;
    description: string;
    folderId: string | null;
    id: string | null;
  } | null>(null);

  const queryTreeQuery = useQuery({
    queryKey: ["query-tree", "all"],
    queryFn: hydrateQueryTree,
    staleTime: 30_000,
  });

  const trees = queryTreeQuery.data?.trees ?? EMPTY_TREES;
  const recentQueries = queryTreeQuery.data?.recent ?? [];

  const currentUserName =
    (typeof window !== "undefined" &&
      (localStorage.getItem("user_display_name") || localStorage.getItem("userDisplayName"))) ||
    "Mine";

  const flattenQueries = (nodes: TreeNode[]): SavedQueryItem[] => {
    const out: SavedQueryItem[] = [];
    for (const n of nodes) {
      if (n.nodeType === "query") {
        out.push({ id: n.id, title: n.name, updatedAt: n.updatedAt == null ? undefined : String(n.updatedAt) });
      } else {
        out.push(...flattenQueries(n.children || []));
      }
    }
    return out;
  };

  const savedQueryLists: SavedQueriesData = {
    shared: flattenQueries(trees.shared.rootNodes),
    mine: flattenQueries(trees.my.rootNodes),
    recent: recentQueries.map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updatedAt == null ? undefined : String(r.updatedAt),
    })),
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

  const loadDomainAndColumns = async () => {
    const { domainId } = await fetchCohortDomain();
    if (domainId == null) return;

    const res = await fetchDomainColumns({ domain_id: domainId, limit: 5000, offset: 0 });

    const nextColumns: SqlColumnRef[] = res.rows.map((row) => ({
      modelColumnId: row.modelColumnId ?? null,
      columnName: row.columnName,
      workspaceTableId: row.workspaceTableId ?? null,
      modelTableId: row.modelTableId ?? null,
      modelTableName: row.modelTableName ?? null,
      fullName: row.fullName ?? null,
      dataType: row.dataType ?? null,
      nullable: typeof row.nullable === "boolean" ? row.nullable : Boolean(row.nullable),
      alias: null,
    }));

    setSqlJson((cur) =>
      ensureToolMeta({
        ...cur,
        domainId,
        columns: nextColumns,
      })
    );
  };

  useEffect(() => {
    loadDomainAndColumns().catch((err) => console.error("Failed to load cohort domain", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sqlJson.domainId == null && prompt.trim()) {
      loadDomainAndColumns().catch((err) => console.error("Failed to load cohort domain", err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, sqlJson.domainId]);

  useEffect(() => {
    if (!selectedSavedQueryId) return;
    if (lastLoadedQueryIdRef.current === selectedSavedQueryId) return;

    const run = async () => {
      try {
        const q = await fetchSavedQuery(selectedSavedQueryId);
        lastLoadedQueryIdRef.current = selectedSavedQueryId;

        const nextSqlJson = ensureToolMeta(q.sqlJson);
        setSqlJson(nextSqlJson);

        const meta = nextSqlJson.meta ?? {};
        const cohortMeta = (meta as any).cohortBuilder ?? (meta as any).cohort_builder ?? null;
        const nextPrompt =
          (cohortMeta && typeof cohortMeta.prompt === "string" ? cohortMeta.prompt : undefined) ??
          nextSqlJson.prompt ??
          "";

        const nextFilters = Array.isArray(cohortMeta?.filters) ? cohortMeta.filters : [];
        const nextLogic = cohortMeta?.logic === "any" ? "any" : "all";

        dispatch(setPrompt(nextPrompt));
        dispatch(setFilters(nextFilters));
        dispatch(setLogic(nextLogic));

        setCohortId(q.queryId ?? q.query_id ?? selectedSavedQueryId);
        setCohortName(q.name ?? q.title ?? "Cohort");
        setCohortDescription(q.description ?? "");
        setCohortFolderId(q.folderId ?? null);

        cohortSnapshotRef.current = {
          signature: JSON.stringify({ prompt: nextPrompt, filters: nextFilters, logic: nextLogic, sqlJson: nextSqlJson }),
          name: q.name ?? q.title ?? "Cohort",
          description: q.description ?? "",
          folderId: q.folderId ?? null,
          id: String(q.queryId ?? q.query_id ?? selectedSavedQueryId),
        };
        setCohortDirty(false);
      } catch (err) {
        console.error("Failed to load saved cohort", err);
      }
    };

    void run();
  }, [selectedSavedQueryId, dispatch]);

  const currentSignature = JSON.stringify({ prompt, filters, logic, sqlJson });

  useEffect(() => {
    const saved = cohortSnapshotRef.current;
    const dirty =
      !saved ||
      saved.signature !== currentSignature ||
      saved.name !== cohortName ||
      saved.description !== cohortDescription ||
      saved.folderId !== cohortFolderId ||
      saved.id !== cohortId;
    setCohortDirty(dirty);
  }, [currentSignature, cohortDescription, cohortFolderId, cohortId, cohortName]);

  const sectionWrapStyle = (key: BuilderSectionKey): React.CSSProperties => {
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
        animation: `cb-show ${ANIM_MS_SHOW}ms ease`,
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

  const handleSavedQueriesAction = (action: SavedQueriesAction) => {
    const run = async () => {
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
            setSelectedSavedQueryId(action.queryId);
            lastLoadedQueryIdRef.current = null;
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
          default:
            console.warn(`${action.type} not implemented (no API route)`);
            return;
        }

        await refetchTree();
      } catch (err) {
        console.error("Saved query action failed", err);
      }
    };

    void run();
  };

  const hasPrompt = prompt.trim().length > 0;
  const canSave = hasPrompt;
  const canRun = hasPrompt && !manualInLimitExceeded && !filtersLimitExceeded;
  const runDisabledTitle = !hasPrompt
    ? "Enter a prompt to run a preview"
    : filtersLimitExceeded
      ? `Too many filter conditions (${filters.length}). Limit is ${FILTER_LIMIT}.`
      : manualInLimitExceeded
        ? `Manual code lists are limited to ${MAX_MANUAL_IN}.`
        : undefined;

  const persistCohort = (payload: { id: string; name: string; description?: string | null; folderId: string | null }) => {
    if (typeof window === "undefined") return;
    const saved = {
      id: payload.id,
      name: payload.name,
      description: payload.description ?? null,
      folderId: payload.folderId,
      prompt,
      filters,
      logic,
      sqlJson,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`cohort_builder_saved:${payload.id}`, JSON.stringify(saved));
    } catch (err) {
      console.warn("Failed to persist cohort locally", err);
    }
  };

  return (
    <div className="cb-page container-fluid p-0">
      <style>{`
        @keyframes cb-show {
          0% { opacity: 0; transform: translateX(-90px) scale(0.92); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>

      <div className="py-2 px-0" style={{ minHeight: "calc(100vh - 0px)" }}>
        <div className="d-flex align-items-stretch" style={{ gap: 0, minHeight: "100%" }}>
          <div className="d-flex align-items-stretch" style={{ gap: 0 }}>
            <WorkspaceToolRail
              activeTool={activeTool}
              onToggleSavedQueries={toggleSavedQueries}
              visibleSections={visibleSections}
              onShowSection={showSection}
            />

            <SavedQueriesPanel
              open={savedQueriesOpen}
              width={360}
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
              className="shadow-sm"
              disabledQueryTypes={["query_builder"]}
              treeLibrary={trees.library}
              treeShared={trees.shared}
              treeMy={trees.my}
              treeTrash={trees.trash}
              recent={recentQueries}
              currentUserName={currentUserName}
              onAction={handleSavedQueriesAction}
            />
          </div>

          <div
            className="flex-grow-1 d-flex flex-column w-100"
            style={{ minHeight: 0, minWidth: 0, paddingLeft: 16, paddingRight: 16 }}
          >
            <TopBar
              name={cohortName}
              nameDirty={cohortDirty}
              onRename={(next) => setCohortName(next)}
              onSave={() => setSaveModalOpen(true)}
              canSave={canSave}
            />

            <div
              className="d-flex flex-column w-100 align-items-stretch"
              style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0 }}
            >
              {shouldRenderSection("prompt") ? (
                <div className="w-100" style={sectionWrapStyle("prompt")}>
                  <SectionShell
                    id="cohort-prompt"
                    title="Prompt"
                    subtitle="Describe the cohort you want to build."
                    collapsed={effectiveCollapsed("prompt")}
                    onToggleCollapsed={() => toggleSection("prompt")}
                    iconClass="fa-lightbulb"
                    onHide={() => hideSection("prompt")}
                    isFullscreen={fullscreenKey === "prompt"}
                    onToggleFullscreen={() => toggleFullscreen("prompt")}
                  >
                    {/* Fix TS “implicit any” by typing v */}
                    <PromptBar
                      value={prompt}
                      loading={loadingDraft}
                      onChange={(v: string) => handlePromptChange(v)}
                      onDraft={onDraft}
                      getSuggestion={onSuggestion}
                    />
                  </SectionShell>
                </div>
              ) : null}

              {shouldRenderSection("filters") ? (
                <div className="w-100" style={sectionWrapStyle("filters")}>
                  <SectionShell
                    id="cohort-filters"
                    title="Filters"
                    subtitle="Review and refine the filters generated from your prompt."
                    collapsed={effectiveCollapsed("filters")}
                    onToggleCollapsed={() => toggleSection("filters")}
                    iconClass="fa-filter"
                    count={filters.length}
                    right={
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setFiltersFlipped((prev) => !prev)}
                        title={filtersFlipped ? "Return to filters" : "Edit filters"}
                        disabled={!hasGeneratedOnce || loadingDraft}
                      >
                        <i className={`fa ${filtersFlipped ? "fa-rotate-left" : "fa-pen"} me-1`} />
                        {filtersFlipped ? "Back" : "Edit Filters"}
                      </button>
                    }
                    onHide={() => hideSection("filters")}
                    isFullscreen={fullscreenKey === "filters"}
                    onToggleFullscreen={() => toggleFullscreen("filters")}
                  >
                    {filtersLimitExceeded ? (
                      <div className="alert alert-warning py-2 mb-3" role="alert">
                        Your query has <b>{filters.length}</b> filter conditions. The maximum supported is{" "}
                        <b>{FILTER_LIMIT}</b>. Remove <b>{filters.length - FILTER_LIMIT}</b> condition(s) to continue.
                      </div>
                    ) : null}

                    {manualInLimitExceeded ? (
                      <div className="alert alert-warning py-2 mb-3" role="alert">
                        A filter contains <b>{maxManualInCount}</b> values. Manual code lists are limited to{" "}
                        <b>{MAX_MANUAL_IN}</b>. Please upload/use a Crosswalk list for larger sets.
                      </div>
                    ) : null}

                    <div
                      style={{
                        position: "relative",
                        minHeight: filtersMinHeight ? `${filtersMinHeight}px` : undefined,
                      }}
                    >
                      <div
                        ref={filtersFrontRef}
                        style={{
                          opacity: filtersFlipped ? 0 : 1,
                          transition: "opacity 320ms ease",
                          pointerEvents: filtersFlipped ? "none" : "auto",
                        }}
                      >
                        <FiltersPanel
                          filters={filters}
                          onAdd={(f) => dispatch(addFilter(f))}
                          onUpdate={(f) => dispatch(updateFilter(f))}
                          onRemove={handleRemoveFilter}
                          onRemoveInValue={handleRemoveInValue}
                          loadingByKind={loadingByKind}
                          hasGeneratedOnce={hasGeneratedOnce}
                          isGenerating={loadingDraft}
                          maxHeightPx={fullscreenKey === "filters" ? undefined : 540}
                        />
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          opacity: filtersFlipped ? 1 : 0,
                          transition: "opacity 320ms ease",
                          pointerEvents: filtersFlipped ? "auto" : "none",
                        }}
                      >
                        <div
                          ref={filtersBackRef}
                          style={{
                            maxHeight: fullscreenKey === "filters" ? undefined : 540,
                            overflowY: fullscreenKey === "filters" ? undefined : "auto",
                          }}
                        >
                          <FiltersSectionBody
                            selectedColumns={selectedSqlColumns}
                            value={sqlJson.filters ?? null}
                            onChange={(next) => setSqlJson((cur) => ensureToolMeta({ ...cur, filters: next }))}
                            sqlJson={sqlJson}
                          />
                        </div>
                      </div>
                    </div>
                  </SectionShell>
                </div>
              ) : null}

              {shouldRenderSection("preview") ? (
                <div className="w-100" style={sectionWrapStyle("preview")}>
                  <PreviewCard
                    sqlJson={buildCohortSqlJson(sqlJson)}
                    persistKey={cohortId ?? "draft"}
                    persistKeyPrefix="cohort_builder_preview"
                    exportBaseName={cohortName || "cohort_export"}
                    collapsed={effectiveCollapsed("preview")}
                    onToggleCollapsed={() => toggleSection("preview")}
                    onHide={() => hideSection("preview")}
                    isFullscreen={fullscreenKey === "preview"}
                    onToggleFullscreen={() => toggleFullscreen("preview")}
                    title="Preview"
                    subtitle="See the patient sample returned by your filters."
                    canRunOverride={canRun}
                    runDisabledTitle={runDisabledTitle}
                    onRunPreview={focusPreview}
                  />
                </div>
              ) : null}
            </div>

            <WhyIncludedDrawer />
          </div>
        </div>
      </div>

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

      <SaveQueryModal
        open={saveModalOpen}
        myTree={trees.my}
        myLabel={currentUserName}
        initialName={cohortName}
        initialDescription={cohortDescription}
        initialFolderId={cohortFolderId}
        titleText="Save cohort"
        nameLabel="Cohort name"
        submitLabel="Save cohort"
        onClose={() => {
          setSaveModalOpen(false);
          if (pendingPromptAfterSave) setPendingPromptAfterSave(null);
          if (pendingPrompt) setPendingPrompt(null);
        }}
        onSave={async ({ name, description, folderId }) => {
          setSaveModalOpen(false);

          const savePayload = {
            name,
            description: description ?? null,
            folderId,
            sqlJson: buildCohortSqlJson(sqlJson),
          };

          const saved = cohortId ? await updateSavedQuery(cohortId, savePayload) : await createSavedQuery(savePayload);

          const savedId = saved?.queryId ?? saved?.query_id ?? saved?.id ?? cohortId ?? null;
          const nextId = savedId ? String(savedId) : cohortId ?? null;
          const nextName = saved?.name ?? name;
          const nextDescription = saved?.description ?? description ?? "";
          const nextFolderId = saved?.folderId ?? folderId ?? null;

          if (nextId) setSelectedSavedQueryId(String(nextId));

          setCohortId(nextId);
          setCohortName(nextName);
          setCohortDescription(nextDescription);
          setCohortFolderId(nextFolderId);

          cohortSnapshotRef.current = {
            signature: currentSignature,
            name: nextName,
            description: nextDescription ?? "",
            folderId: nextFolderId ?? null,
            id: nextId,
          };
          setCohortDirty(false);
          persistCohort({ id: nextId ?? "", name: nextName, description: nextDescription, folderId: nextFolderId });
          await refetchTree();

          if (pendingPromptAfterSave) {
            const nextPrompt = pendingPromptAfterSave;
            setPendingPromptAfterSave(null);
            clearGeneratedData(nextPrompt);
            dispatch(setPrompt(nextPrompt));
            setPendingPrompt(null);
          }
        }}
      />

      <Modal
        open={promptWarnOpen}
        title="Change prompt?"
        onClose={() => {
          setPromptWarnOpen(false);
          setPendingPrompt(null);
        }}
        width={560}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setPromptWarnOpen(false);
                setPendingPrompt(null);
              }}
            >
              Cancel
            </button>

            {cohortDirty ? (
              <>
                <button className="btn btn-outline-primary btn-sm" onClick={() => confirmPromptChange(true)}>
                  Save & Clear
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => confirmPromptChange(false)}>
                  Clear Without Saving
                </button>
              </>
            ) : (
              <button className="btn btn-danger btn-sm" onClick={() => confirmPromptChange(false)}>
                Clear and Continue
              </button>
            )}
          </div>
        }
      >
        <div className="text-muted small">Changing the prompt will clear your generated filters and preview results.</div>
        {cohortDirty ? (
          <div className="mt-2">
            <div className="fw-semibold">You have unsaved changes.</div>
            <div className="text-muted small">Save before clearing, or continue without saving.</div>
          </div>
        ) : null}
      </Modal>

      <MoveModalDialog
        open={moveModalOpen}
        target={moveTarget}
        myTree={trees.my}
        myLabel={currentUserName}
        onClose={() => setMoveModalOpen(false)}
        onMove={async (folderId) => {
          if (!moveTarget) return;
          if (moveTarget.type === "folder") {
            await moveFolder(moveTarget.id, { parentId: folderId, sortIndex: null });
          } else {
            await moveSavedQuery(moveTarget.id, folderId);
          }
          setMoveModalOpen(false);
          await refetchTree();
        }}
        onCreateFolder={async (parentId, name) => {
          await createFolder({ name, parentId });
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

export default CohortBuilderPage;
