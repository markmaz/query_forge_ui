import React, { useMemo, useState } from "react";
import { isSyntheticId } from "../../model/savedQueries";
import type { RecentItem, SavedQueriesAction, TreeNode, TreeResponse, TreeView } from "../../model/savedQueries";
type MenuItem = { label: string; onClick: () => void } | { divider: true };

export function SavedQueriesTreeSection(props: {
  search: string;
  trees: { library: TreeResponse; shared: TreeResponse; my: TreeResponse; trash: TreeResponse };
  recent: RecentItem[];
  currentUserName?: string;
  disabledQueryTypes?: string[];

  selectedQueryId?: string;
  onSelectQuery: (id: string) => void;

  onAction: (a: SavedQueriesAction) => void;
}) {
  const { search, trees, recent, selectedQueryId, onSelectQuery, onAction, disabledQueryTypes } = props;
  const disabledTypes = useMemo(
    () => new Set((disabledQueryTypes ?? []).map((t) => t.toLowerCase())),
    [disabledQueryTypes]
  );

  // Expand/collapse state per folder id
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<TreeView, boolean>>({
    library: true,
    shared: true,
    my: true,
    trash: true,
  });

  const term = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!term) return { trees, recent };

    const filterTree = (nodes: TreeNode[]): TreeNode[] => {
      const out: TreeNode[] = [];
      for (const n of nodes) {
        if (n.nodeType === "folder") {
          const kids = filterTree(n.children || []);
          const hit = n.name.toLowerCase().includes(term);
          if (hit || kids.length > 0) out.push({ ...n, children: kids });
        } else {
          if (n.name.toLowerCase().includes(term)) out.push(n);
        }
      }
      return out;
    };

    const filterRecent = recent.filter((r) => r.title.toLowerCase().includes(term));

    return {
      trees: {
        library: { ...trees.library, rootNodes: filterTree(trees.library.rootNodes) },
        shared: { ...trees.shared, rootNodes: filterTree(trees.shared.rootNodes) },
        my: { ...trees.my, rootNodes: filterTree(trees.my.rootNodes) },
        trash: { ...trees.trash, rootNodes: filterTree(trees.trash.rootNodes) },
      },
      recent: filterRecent,
    };
  }, [term, trees, recent]);

  const toggleFolder = (id: string) => setOpenFolders((p) => ({ ...p, [id]: !p[id] }));
  const toggleSection = (view: TreeView) => setOpenSections((p) => ({ ...p, [view]: !p[view] }));

  const myRoot =
    filtered.trees.my.rootNodes.length === 1 &&
    filtered.trees.my.rootNodes[0].nodeType === "folder" &&
    filtered.trees.my.rootNodes[0].isRoot
      ? filtered.trees.my.rootNodes[0]
      : null;
  const myChildren = myRoot ? myRoot.children : filtered.trees.my.rootNodes;
  const myLabel = (myRoot?.name?.trim()) || props.currentUserName?.trim() || "Mine";

  const trashRoot =
    filtered.trees.trash.rootNodes.length === 1 &&
    filtered.trees.trash.rootNodes[0].nodeType === "folder" &&
    filtered.trees.trash.rootNodes[0].isRoot
      ? filtered.trees.trash.rootNodes[0]
      : null;
  const trashChildren = trashRoot ? trashRoot.children : filtered.trees.trash.rootNodes;
  const trashLabel = (trashRoot?.name?.trim()) || "Trash";

  return (
    <div>
      <div className="mb-2">
        <div className="text-muted small mb-1">Folders</div>

        <TreeSectionHeader
          icon="fa-folder"
          title="Library"
          isOpen={openSections.library}
          onClick={() => toggleSection("library")}
        />
        {openSections.library ? (
          <div className="ps-2">
            {filtered.trees.library.rootNodes.map((n) => (
              <TreeNodeRow
                key={n.id}
                node={n}
                view="library"
                depth={0}
                openFolders={openFolders}
                onToggleFolder={toggleFolder}
                disabledTypes={disabledTypes}
                selectedQueryId={selectedQueryId}
                onSelectQuery={onSelectQuery}
                onAction={onAction}
              />
            ))}
          </div>
        ) : null}

        <TreeSectionHeader
          icon="fa-folder"
          title="Shared"
          isOpen={openSections.shared}
          onClick={() => toggleSection("shared")}
        />
        {openSections.shared ? (
          <div className="ps-2">
            {filtered.trees.shared.rootNodes.map((n) => (
              <TreeNodeRow
                key={n.id}
                node={n}
                view="shared"
                depth={0}
                openFolders={openFolders}
                onToggleFolder={toggleFolder}
                disabledTypes={disabledTypes}
                selectedQueryId={selectedQueryId}
                onSelectQuery={onSelectQuery}
                onAction={onAction}
              />
            ))}
          </div>
        ) : null}

        <TreeSectionHeader
          icon="fa-folder"
          title={myLabel}
          isOpen={openSections.my}
          onClick={() => toggleSection("my")}
          menuItems={[
            {
              label: "New folder…",
              onClick: () =>
                onAction({
                  type: "CREATE_FOLDER",
                  parentId: myRoot ? myRoot.id : null,
                  sortIndex: myChildren.length,
                }),
            },
          ]}
        />
        {openSections.my ? (
          <div className="ps-2">
            {myChildren.map((n) => (
              <TreeNodeRow
                key={n.id}
                node={n}
                view="my"
                depth={0}
                openFolders={openFolders}
                onToggleFolder={toggleFolder}
                disabledTypes={disabledTypes}
                selectedQueryId={selectedQueryId}
                onSelectQuery={onSelectQuery}
                onAction={onAction}
              />
            ))}
          </div>
        ) : null}

        <TreeSectionHeader
          icon="fa-trash"
          title={trashLabel}
          isOpen={openSections.trash}
          onClick={() => toggleSection("trash")}
          right={
            <button
              type="button"
              className="btn btn-sm btn-link text-decoration-none p-0"
              style={{ fontSize: "0.8rem" }}
              onClick={(e) => {
                // don't toggle section when clicking this
                e.preventDefault();
                e.stopPropagation();
                if (trashRoot && !isSyntheticId(trashRoot.id)) {
                  onAction({ type: "PURGE_FOLDER", folderId: trashRoot.id });
                  return;
                }

                const nodesToPurge = trashRoot ? trashRoot.children : trashChildren;
                for (const node of nodesToPurge) {
                  if (node.nodeType === "folder") {
                    onAction({ type: "PURGE_FOLDER", folderId: node.id });
                  } else {
                    onAction({ type: "PURGE_QUERY", queryId: node.id });
                  }
                }
              }}
            >
              Empty Trash
            </button>
          }
        />
        {openSections.trash ? (
          <div className="ps-2">
            {trashChildren.map((n) => (
              <TreeNodeRow
                key={n.id}
                node={n}
                view="trash"
                depth={0}
                openFolders={openFolders}
                onToggleFolder={toggleFolder}
                disabledTypes={disabledTypes}
                selectedQueryId={selectedQueryId}
                onSelectQuery={onSelectQuery}
                onAction={onAction}
              />
            ))}
          </div>
        ) : null}
      </div>

      <hr className="my-3" />

      <div>
        <div className="text-muted small mb-2">Most recent</div>
        {filtered.recent.length === 0 ? (
          <div className="text-muted small">No recent queries.</div>
        ) : (
          <div className="list-group list-group-flush border rounded">
            {filtered.recent.map((r) => {
              const active = selectedQueryId === r.id;

              const queryType = (r.queryType ?? "query_builder").toLowerCase();
              const disabled = disabledTypes.has(queryType);
              const iconClass = queryType === "cohort_builder" ? "fa-users" : "fa-code";
              const iconColor =
                queryType === "cohort_builder" ? "rgba(24, 117, 50, 0.9)" : "rgba(0, 82, 204, 0.85)";

              const open = () => {
                if (disabled) return;
                onAction({ type: "OPEN_QUERY", queryId: r.id });
              };

              return (
                // ✅ was <button> ... <button/> inside -> invalid HTML
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  className={"list-group-item list-group-item-action py-2 " + (active ? "active" : "")}
                  style={{
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.45 : 1,
                  }}
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open();
                    }
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="me-2 text-truncate" style={{ maxWidth: "85%" }}>
                      <div className="fw-semibold text-truncate">
                        <i
                          className={`fa ${iconClass} me-2`}
                          aria-hidden="true"
                          style={{ color: iconColor }}
                        />
                        {r.title}
                      </div>
                      {r.updatedAt ? (
                        <small className={active ? "text-white-50" : "text-muted"}>Updated {r.updatedAt}</small>
                      ) : null}
                    </div>

                    {/* ✅ keep menu clickable without triggering row click */}
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        // prevents focus/active quirks on the row
                        e.stopPropagation();
                      }}
                    >
                      <EllipsisMenu
                        disabled={false}
                        items={[
                          { label: "Open", onClick: () => onAction({ type: "OPEN_QUERY", queryId: r.id }) },
                          { divider: true },
                          { label: "Move…", onClick: () => onAction({ type: "MOVE_QUERY", queryId: r.id }) },
                          { label: "Copy", onClick: () => onAction({ type: "COPY_QUERY", queryId: r.id }) },
                          { label: "Share…", onClick: () => onAction({ type: "SHARE_QUERY", queryId: r.id }) },
                          { divider: true },
                          { label: "Delete", onClick: () => onAction({ type: "DELETE_QUERY", queryId: r.id }) },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeSectionHeader(props: {
  icon: string;
  title: string;
  right?: React.ReactNode;
  menuItems?: MenuItem[];
  isOpen?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={"d-flex align-items-center mt-2 nq-tree-section" + (props.onClick ? " nq-tree-root" : "")}
      role={props.onClick ? "button" : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (!props.onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick();
        }
      }}
      style={{ cursor: props.onClick ? "pointer" : "default", userSelect: "none" }}
    >
      <div className="d-flex align-items-center gap-2 nq-tree-section-left">
        {props.onClick !== undefined ? (
          <i
            className={"fa " + (props.isOpen ? "fa-chevron-down" : "fa-chevron-right")}
            aria-hidden="true"
            style={{ width: 12, color: "rgba(0,0,0,0.55)" }}
          />
        ) : null}
        <i className={"fa " + props.icon} aria-hidden="true" style={{ opacity: 0.75 }} />
        <span className="fw-semibold" style={{ fontSize: ".75rem" }}>
          {props.title}
        </span>
      </div>
      <div className="d-flex align-items-center nq-tree-section-right" style={{ gap: 6 }}>
        {props.right ? <div onClick={(e) => e.stopPropagation()}>{props.right}</div> : null}
        {props.menuItems ? (
          <div onClick={(e) => e.stopPropagation()}>
            <EllipsisMenu disabled={false} items={props.menuItems} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TreeNodeRow(props: {
  node: TreeNode;
  view: TreeView;
  depth: number;
  openFolders: Record<string, boolean>;
  onToggleFolder: (id: string) => void;
  disabledTypes: Set<string>;

  selectedQueryId?: string;
  onSelectQuery: (id: string) => void;

  onAction: (a: SavedQueriesAction) => void;
}) {
  const { node, view, depth, openFolders, onToggleFolder, disabledTypes, selectedQueryId, onSelectQuery, onAction } = props;

  const pad = 10 + depth * 14;

  if (node.nodeType === "folder") {
    const isOpen = openFolders[node.id] ?? true; // default expanded
    const hasChildren = (node.children?.length ?? 0) > 0;
    const showChevron = hasChildren;
    const canMenu = !(isSyntheticId(node.id) && !(view === "my" && node.isRoot)); // allow menu on "My" root even if synthetic

    const parentIdForNew = node.isRoot ? null : node.id;
    const folderMenu: MenuItem[] =
      view === "trash"
        ? [
            { label: "Restore", onClick: () => onAction({ type: "RESTORE_FOLDER", folderId: node.id }) },
            { label: "Purge", onClick: () => onAction({ type: "PURGE_FOLDER", folderId: node.id }) },
          ]
        : [
            {
              label: "New folder…",
              onClick: () =>
                onAction({ type: "CREATE_FOLDER", parentId: parentIdForNew, sortIndex: node.children?.length ?? 0 }),
            },
            { divider: true },
            { label: "Rename…", onClick: () => onAction({ type: "RENAME_FOLDER", folderId: node.id }) },
            { label: "Move…", onClick: () => onAction({ type: "MOVE_FOLDER", folderId: node.id }) },
            { divider: true },
            { label: "Delete (if empty)", onClick: () => onAction({ type: "DELETE_FOLDER", folderId: node.id }) },
            { label: "Move to Trash", onClick: () => onAction({ type: "TRASH_FOLDER", folderId: node.id }) },
          ];

    return (
      <div>
        <div
          className="d-flex align-items-center justify-content-between py-1 nq-tree-row"
          style={{ paddingLeft: pad }}
        >
          <button
            type="button"
            className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-2 text-dark"
            onClick={() => {
              if (!hasChildren) return;
              onToggleFolder(node.id);
            }}
            style={{ maxWidth: "85%" }}
          >
            {showChevron ? (
              <i
                className={"fa " + (isOpen ? "fa-chevron-down" : "fa-chevron-right")}
                aria-hidden="true"
                style={{ width: 12, color: "rgba(0,0,0,0.55)" }}
              />
            ) : (
              <span style={{ width: 12 }} />
            )}
            <i
              className={"fa " + (view === "trash" || isOpen ? "fa-folder-open" : "fa-folder")}
              aria-hidden="true"
              style={{ opacity: 0.75 }}
            />
            <span className="text-truncate">{node.name}</span>
          </button>

          {canMenu ? (
            <div onClick={(e) => e.stopPropagation()}>
              <EllipsisMenu disabled={false} items={folderMenu} />
            </div>
          ) : (
            <span style={{ width: 28 }} />
          )}
        </div>

        {isOpen && hasChildren ? (
          <div>
            {node.children.map((c) => (
              <TreeNodeRow
                key={c.id}
                node={c}
                view={view}
                depth={depth + 1}
                openFolders={openFolders}
                onToggleFolder={onToggleFolder}
                disabledTypes={disabledTypes}
                selectedQueryId={selectedQueryId}
                onSelectQuery={onSelectQuery}
                onAction={onAction}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // query
  const active = selectedQueryId === node.id;
  const queryType = (node.queryType ?? "query_builder").toLowerCase();
  const disabled = disabledTypes.has(queryType);
  const canMenu = view !== "library" && !disabled; // no options for library, or disabled queries
  const iconClass = queryType === "cohort_builder" ? "fa-users" : "fa-code";
  const iconColor =
    queryType === "cohort_builder" ? "rgba(24, 117, 50, 0.9)" : "rgba(0, 82, 204, 0.85)";

  const queryMenu: MenuItem[] =
    view === "trash"
      ? [
          { label: "Restore", onClick: () => onAction({ type: "RESTORE_QUERY", queryId: node.id }) },
          { label: "Purge", onClick: () => onAction({ type: "PURGE_QUERY", queryId: node.id }) },
        ]
      : view === "shared"
      ? [{ label: "Open", onClick: () => onAction({ type: "OPEN_QUERY", queryId: node.id }) }]
      : [
          { label: "Open", onClick: () => onAction({ type: "OPEN_QUERY", queryId: node.id }) },
          { divider: true },
          { label: "Rename…", onClick: () => onAction({ type: "RENAME_QUERY", queryId: node.id }) },
          { label: "Move…", onClick: () => onAction({ type: "MOVE_QUERY", queryId: node.id }) },
          { label: "Copy", onClick: () => onAction({ type: "COPY_QUERY", queryId: node.id }) },
          { label: "Share…", onClick: () => onAction({ type: "SHARE_QUERY", queryId: node.id }) },
          { divider: true },
          { label: "Delete", onClick: () => onAction({ type: "DELETE_QUERY", queryId: node.id }) },
        ];

  return (
    <div
      className={
        "d-flex align-items-center justify-content-between py-1 nq-tree-row " + (active ? "bg-light" : "")
      }
      style={{
        paddingLeft: 10 + depth * 14 + 18,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <button
        type="button"
        className="btn btn-sm btn-link p-0 text-decoration-none text-dark text-truncate"
        style={{ maxWidth: "85%", cursor: disabled ? "not-allowed" : "pointer" }}
        onClick={() => {
          if (disabled) return;
          onAction({ type: "OPEN_QUERY", queryId: node.id });
        }}
        title={node.name}
        aria-disabled={disabled}
      >
        <span
          className="d-inline-flex align-items-center text-truncate"
          style={{ opacity: disabled ? 0.45 : 1 }}
        >
          <i className={`fa ${iconClass} me-2`} aria-hidden="true" style={{ color: iconColor }} />
          {node.name}
        </span>
      </button>

      {canMenu ? (
        <div onClick={(e) => e.stopPropagation()}>
          <EllipsisMenu disabled={!canMenu} items={queryMenu} />
        </div>
      ) : (
        <span style={{ width: 28 }} />
      )}
    </div>
  );
}

function EllipsisMenu(props: { disabled: boolean; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-sm"
        disabled={props.disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          border: "none",
          background: open ? "rgba(0,0,0,0.06)" : "transparent",
          borderRadius: 6,
          color: "rgba(0,0,0,0.65)",
        }}
        title="Options"
      >
        <i className="fa fa-ellipsis-v" aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="shadow-sm border bg-white rounded"
          style={{
            position: "absolute",
            right: 0,
            top: 30,
            minWidth: 160,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {props.items.map((it, idx) => {
            if ("divider" in it) {
              return <div key={idx} style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "6px 0" }} />;
            }
            return (
              <button
                key={idx}
                type="button"
                className="btn btn-sm w-100 text-start"
                style={{ border: "none", borderRadius: 0, padding: "6px 10px" }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9998, background: "transparent" }}
        />
      ) : null}
    </div>
  );
}
