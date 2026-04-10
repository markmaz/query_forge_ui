import React, { useEffect } from "react";

import { SavedQueriesTreeSection } from "./SavedQueriesTreeSection";
import type {
  RecentItem,
  SavedQueriesAction,
  SavedQueriesData,
  SavedQueryGroupKey,
  SavedQueryItem,
  TreeResponse,
} from "../../domain-state/savedQueries";
export type {
  RecentItem,
  SavedQueriesAction,
  SavedQueriesData,
  SavedQueryGroupKey,
  SavedQueryItem,
  TreeResponse,
} from "../../domain-state/savedQueries";

export function SavedQueriesPanel(props: {
  open: boolean;
  width?: number; // default 360
  railNudgePx?: number;
  search: string;
  onChangeSearch: (v: string) => void;

  openGroups: Record<SavedQueryGroupKey, boolean>;
  onToggleGroup: (k: SavedQueryGroupKey) => void;

  data: SavedQueriesData;

  selectedQueryId?: string;
  onSelectQuery: (id: string) => void;

  onNew?: () => void;
  onImport?: () => void;
  onClose: () => void;
  className?: string;
  treeLibrary: TreeResponse;
  treeShared: TreeResponse;
  treeMy: TreeResponse;
  treeTrash: TreeResponse;
  recent: RecentItem[];
  currentUserName?: string;
  disabledQueryTypes?: string[];
  canSaveToLibrary?: boolean;
  canManageLibrary?: boolean;
  canDeleteLibraryQueries?: boolean;

  onAction: (a: SavedQueriesAction) => void;
}) {
  const {
    open,
    width = 360,
    search,
    onChangeSearch,
    selectedQueryId,
    onSelectQuery,
    className,
    treeLibrary,
    treeShared,
    treeMy,
    treeTrash,
    recent,
    currentUserName,
    disabledQueryTypes,
    canSaveToLibrary,
    canManageLibrary,
    canDeleteLibraryQueries,
  } = props;

  // ✅ Match the rail button nudge (ToolButton: translateX(-8px))
  // If you change the rail transform later, update this constant to match.
  const railNudgePx = props.railNudgePx ?? 8;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div
      className={"bg-white " + (className ?? "")}
      style={{
        width: open ? width : 0,
        minWidth: open ? width : 0,
        transition: "width 180ms ease",
        overflow: "hidden",
        flex: "0 0 auto",

        // ✅ only separate from the builder, not from the rail/menu
        borderRight: open ? "1px solid rgba(0,0,0,0.06)" : "none",

        // ✅ square so it visually connects to the rail
        borderRadius: 0,

        // ✅ pull panel left so open/close aligns with the nudged rail button
        marginLeft: open ? -railNudgePx - 9 : 0,
        marginTop: open ? -8 : 0,
      }}
      aria-hidden={!open}
    >
      {/* Inner wrapper keeps padding from collapsing weirdly while width animates */}
      <div style={{ width, height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div className="border-bottom p-3 position-relative" style={{ minHeight: 56 }}>
          <div>
            <div className="fw-semibold">Saved Queries</div>
            <div className="text-muted small">Shared, Mine, Recent</div>
          </div>

          {/* Close button */}
          <button
            type="button"
            aria-label="Close Saved Queries"
            title="Close"
            onClick={props.onClose}
            className="btn btn-sm"
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 28,
              height: 28,
              padding: 0,
              border: "none",
              background: "transparent",
              borderRadius: 6,
              color: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.06)";
              e.currentTarget.style.color = "rgba(0,0,0,0.85)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(0,0,0,0.55)";
            }}
          >
            <i className="fa fa-xmark" aria-hidden="true" style={{ fontSize: "0.95rem", lineHeight: 1 }} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 pb-2">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search saved queries…"
            value={search}
            onChange={(e) => onChangeSearch(e.target.value)}
          />
        </div>

        {/* Tree */}
        <div className="px-3 pb-3 flex-grow-1" style={{ overflowY: "auto" }}>
          <SavedQueriesTreeSection
            search={search}
            onSelectQuery={onSelectQuery}
            selectedQueryId={selectedQueryId}
            disabledQueryTypes={disabledQueryTypes}
            canSaveToLibrary={canSaveToLibrary}
            canManageLibrary={canManageLibrary}
            canDeleteLibraryQueries={canDeleteLibraryQueries}
            trees={{
              library: treeLibrary,
              shared: treeShared,
              my: treeMy,
              trash: treeTrash,
            }}
            recent={recent}
            currentUserName={currentUserName}
            onAction={props.onAction}
          />
        </div>
      </div>
    </div>
  );
}
