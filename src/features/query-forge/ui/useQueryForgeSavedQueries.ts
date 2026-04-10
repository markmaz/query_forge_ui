import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { useAppSelector } from "../../../shared/runtime/hooks";
import type {
  SavedQueriesAction,
  SavedQueriesData,
  SavedQueryGroupKey,
  SavedQueryItem,
  TreeNode,
  TreeResponse,
} from "../../../shared/domain-state/savedQueries";
import {
  createFolder,
  deleteFolder,
  deleteSavedQuery,
  fetchSavedQuery,
  hydrateQueryTree,
  purgeFolder,
  renameFolder,
  restoreFolder,
  restoreSavedQuery,
  saveSavedQueryToLibrary,
  trashFolder,
  updateSavedQuery,
  createSavedQuery,
} from "../../../shared/services/queryTreeApi";
import { getRolesFromToken } from "../../../shared/services/auth";
import { getAccessToken } from "../../../shared/runtime/accessTokenStore";

import type { SqlQueryJson } from "../model/sqlJson";
import {
  extractRoleNamesFromProfile,
  normalizeRoleName,
} from "./queryForgePageUtils";
import type { MoveTarget, OpenQueryState } from "./queryForgePageTypes";

type UseQueryForgeSavedQueriesParams = {
  setColumnsSearchTerm: (value: string) => void;
  setCurrentPage: (value: number) => void;
  setSqlJson: (value: SqlQueryJson) => void;
  setOpenQuery: Dispatch<SetStateAction<OpenQueryState>>;
  ensureToolMeta: (next: SqlQueryJson) => SqlQueryJson;
  normalizeSqlJsonPayload: (
    raw: Partial<SqlQueryJson> | null | undefined,
  ) => SqlQueryJson;
};

const EMPTY_TREES: {
  library: TreeResponse;
  shared: TreeResponse;
  my: TreeResponse;
  trash: TreeResponse;
} = {
  library: { view: "library", rootNodes: [] },
  shared: { view: "shared", rootNodes: [] },
  my: { view: "my", rootNodes: [] },
  trash: { view: "trash", rootNodes: [] },
};

export function useQueryForgeSavedQueries({
  setColumnsSearchTerm,
  setCurrentPage,
  setSqlJson,
  setOpenQuery,
  ensureToolMeta,
  normalizeSqlJsonPayload,
}: UseQueryForgeSavedQueriesParams) {
  const [activeTool, setActiveTool] = useState<"savedQueries" | null>(null);
  const savedQueriesOpen = activeTool === "savedQueries";
  const [selectedSavedQueryId, setSelectedSavedQueryId] = useState<
    string | undefined
  >(undefined);
  const [savedQueriesSearch, setSavedQueriesSearch] = useState("");
  const [savedQueriesGroups, setSavedQueriesGroups] = useState<
    Record<SavedQueryGroupKey, boolean>
  >({
    shared: true,
    mine: true,
    recent: true,
  });
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareQueryId, setShareQueryId] = useState<string | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameDialogTitle, setNameDialogTitle] = useState("");
  const [nameDialogLabel, setNameDialogLabel] = useState("Name");
  const [nameDialogValue, setNameDialogValue] = useState("");
  const [nameDialogConfirmLabel, setNameDialogConfirmLabel] = useState("Save");
  const nameDialogConfirmRef = useRef<(value: string) => void | Promise<void>>(
    () => undefined,
  );

  const userProfile = useAppSelector((state) => state.user.user);
  const tokenRoles = useMemo(
    () =>
      getRolesFromToken(getAccessToken()).map((role) => normalizeRoleName(role)),
    [userProfile],
  );
  const profileRoles = useMemo(
    () => extractRoleNamesFromProfile(userProfile),
    [userProfile],
  );
  const effectiveRoleNames = useMemo(
    () => new Set([...tokenRoles, ...profileRoles]),
    [profileRoles, tokenRoles],
  );
  const canSaveToLibrary =
    effectiveRoleNames.has("workspace_admin") ||
    effectiveRoleNames.has("library_admin") ||
    effectiveRoleNames.has("super_admin");
  const canDeleteLibraryQueries = canSaveToLibrary;
  const canManageLibrary = canSaveToLibrary;
  const currentUserName =
    [
      userProfile?.display_name,
      [userProfile?.first_name, userProfile?.last_name]
        .filter(Boolean)
        .join(" "),
      userProfile?.user_name,
      userProfile?.email,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find((value) => value.length > 0) || "Mine";

  const queryTreeQuery = useQuery({
    queryKey: ["query-tree", "all"],
    queryFn: hydrateQueryTree,
    staleTime: 30_000,
  });

  const trees = queryTreeQuery.data?.trees ?? EMPTY_TREES;
  const recentQueries = queryTreeQuery.data?.recent ?? [];

  const toggleSavedQueries = () =>
    setActiveTool((prev) => (prev === "savedQueries" ? null : "savedQueries"));
  const onToggleSavedQueriesGroup = (key: SavedQueryGroupKey) =>
    setSavedQueriesGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const flattenQueries = (nodes: TreeNode[]): SavedQueryItem[] => {
    const out: SavedQueryItem[] = [];
    for (const node of nodes) {
      if (node.nodeType === "query") {
        out.push({
          id: node.id,
          title: node.name,
          updatedAt: node.updatedAt ?? undefined,
        });
      } else {
        out.push(...flattenQueries(node.children || []));
      }
    }
    return out;
  };

  const savedQueryLists: SavedQueriesData = {
    shared: flattenQueries(trees.shared.rootNodes),
    mine: flattenQueries(trees.my.rootNodes),
    recent: recentQueries.map((query) => ({
      id: query.id,
      title: query.title,
      updatedAt: query.updatedAt,
    })),
  };

  const skillQueryOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    [
      ...savedQueryLists.mine,
      ...savedQueryLists.shared,
      ...savedQueryLists.recent,
    ].forEach((item) => {
      if (!item.id) return;
      map.set(item.id, { id: item.id, name: item.title });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [savedQueryLists.mine, savedQueryLists.shared, savedQueryLists.recent]);

  const refetchTree = async () => {
    await queryTreeQuery.refetch();
  };

  const findNodeById = (nodes: TreeNode[], id: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.nodeType === "folder") {
        const hit = findNodeById(node.children ?? [], id);
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

  const findNodeLocation = (
    id: string,
  ): { node: TreeNode; view: "library" | "shared" | "my" | "trash" } | null => {
    const views: Array<"library" | "shared" | "my" | "trash"> = [
      "library",
      "shared",
      "my",
      "trash",
    ];
    for (const view of views) {
      const node = findNodeById(trees[view].rootNodes, id);
      if (node) return { node, view };
    }
    return null;
  };

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
    const query = await fetchSavedQuery(id);

    setColumnsSearchTerm("");
    setCurrentPage(1);
    setSqlJson(ensureToolMeta(normalizeSqlJsonPayload(query.sqlJson)));
    setSelectedSavedQueryId(query.queryId);
    setOpenQuery({
      id: query.queryId,
      name: query.name ?? "Untitled",
      scope: query.scope,
      isDirty: false,
    });
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
              await createFolder({
                name,
                parentId: action.parentId,
                sortIndex: action.sortIndex,
                scope: action.scope,
              });
              await refetchTree();
            },
          });
          return;
        }
        case "OPEN_QUERY":
          await openSavedQuery(action.queryId);
          return;
        case "RENAME_FOLDER": {
          const location = findNodeLocation(action.folderId);
          const node = location?.node;
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
          const location = findNodeLocation(action.folderId);
          const node = location?.node;
          setMoveTarget({
            type: "folder",
            id: action.folderId,
            name: node?.nodeType === "folder" ? node.name : "Folder",
            currentFolderId:
              node?.nodeType === "folder" ? (node.parentId ?? null) : null,
            view:
              action.view === "library" || location?.view === "library"
                ? "library"
                : "my",
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
          const location = findNodeLocation(action.queryId);
          const node = location?.node;
          setMoveTarget({
            type: "query",
            id: action.queryId,
            name: node?.nodeType === "query" ? node.name : "Query",
            currentFolderId:
              node?.nodeType === "query" ? (node.folderId ?? null) : null,
            view:
              action.view === "library" || location?.view === "library"
                ? "library"
                : "my",
          });
          setMoveModalOpen(true);
          return;
        }
        case "DELETE_QUERY":
          await deleteSavedQuery(action.queryId);
          break;
        case "SAVE_TO_LIBRARY":
          await saveSavedQueryToLibrary(action.queryId);
          toast.success("Query saved to Library.");
          break;
        case "RESTORE_QUERY":
          await restoreSavedQuery(action.queryId);
          break;
        case "RENAME_QUERY": {
          const location = findNodeLocation(action.queryId);
          const node = location?.node;
          openNameDialog({
            title: "Rename query",
            label: "Query name",
            initialValue: node?.nodeType === "query" ? node.name : "",
            confirmLabel: "Rename",
            onConfirm: async (name) => {
              const query = await fetchSavedQuery(action.queryId);
              await updateSavedQuery(action.queryId, {
                name,
                description: query.description ?? null,
                folderId: query.folderId ?? null,
                sqlJson: ensureToolMeta(normalizeSqlJsonPayload(query.sqlJson)),
              });
              await refetchTree();
            },
          });
          return;
        }
        case "COPY_QUERY": {
          const node = findNodeAcrossTrees(action.queryId);
          const fallback =
            node?.nodeType === "query" ? `${node.name} (copy)` : "Copy of query";
          openNameDialog({
            title: "Copy query",
            label: "New query name",
            initialValue: fallback,
            confirmLabel: "Create copy",
            onConfirm: async (name) => {
              const query = await fetchSavedQuery(action.queryId);
              await createSavedQuery({
                name,
                description: query.description ?? null,
                folderId:
                  query.folderId ??
                  (node?.nodeType === "query" ? (node.folderId ?? null) : null),
                sqlJson: ensureToolMeta(normalizeSqlJsonPayload(query.sqlJson)),
              });
              await refetchTree();
            },
          });
          return;
        }
        case "SHARE_QUERY":
          setShareQueryId(action.queryId);
          setShareModalOpen(true);
          return;
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

  const closeNameDialog = () => setNameDialogOpen(false);
  const closeMoveModal = () => {
    setMoveModalOpen(false);
    setMoveTarget(null);
  };
  const closeShareModal = () => {
    setShareModalOpen(false);
    setShareQueryId(null);
  };

  return {
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
    onToggleSavedQueriesGroup,
    openSavedQuery,
    recentQueries,
    refetchTree,
    savedQueriesGroups,
    savedQueriesOpen,
    savedQueriesSearch,
    savedQueryLists,
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
  };
}
