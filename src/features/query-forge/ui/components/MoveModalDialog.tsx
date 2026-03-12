import React, { useEffect, useMemo, useState } from "react";
import type { TreeNode, TreeResponse } from "../../../../shared/domain-state/savedQueries";

type MoveTarget = {
  type: "folder" | "query";
  id: string;
  name: string;
  currentFolderId: string | null;
};

type FolderPick = { folderId: string | null; pathNames: string[] };

function isFolder(n: TreeNode): n is Extract<TreeNode, { nodeType: "folder" }> {
  return n.nodeType === "folder";
}

function normalizeFolderNodes(nodes: TreeNode[]): Extract<TreeNode, { nodeType: "folder" }>[] {
  return nodes
    .filter(isFolder)
    .map((n) => ({ ...n, children: normalizeFolderNodes(n.children ?? []) }));
}

function buildFolderIndex(rootNodes: TreeNode[]) {
  const byId = new Map<string, Extract<TreeNode, { nodeType: "folder" }>>();
  const parentById = new Map<string, string | null>();

  parentById.set("__ROOT__", null);

  const walk = (nodes: TreeNode[], parentId: string | null) => {
    for (const n of nodes) {
      if (!isFolder(n)) continue;
      byId.set(n.id, n);
      parentById.set(n.id, parentId);
      walk(n.children ?? [], n.id);
    }
  };

  walk(rootNodes, null);
  return { byId, parentById };
}

function computePath(
  folderId: string | null,
  myLabel: string,
  parentById: Map<string, string | null>,
  byId: Map<string, any>
) {
  if (!folderId) return [myLabel];

  const names: string[] = [];
  let cur: string | null = folderId;

  while (cur) {
    const node = byId.get(cur);
    if (node) names.push(node.name);
    cur = parentById.get(cur) ?? null;
  }

  return [myLabel, ...names.reverse()];
}

function collectDescendants(
  root: Extract<TreeNode, { nodeType: "folder" }> | undefined,
  out: Set<string>
) {
  if (!root) return;
  for (const child of root.children ?? []) {
    if (!isFolder(child)) continue;
    out.add(child.id);
    collectDescendants(child, out);
  }
}

function filterFolders(
  nodes: Extract<TreeNode, { nodeType: "folder" }>[],
  term: string
): Extract<TreeNode, { nodeType: "folder" }>[] {
  if (!term) return nodes;
  const t = term.toLowerCase();
  const next: Extract<TreeNode, { nodeType: "folder" }>[] = [];
  for (const n of nodes) {
    const kids = filterFolders(normalizeFolderNodes(n.children ?? []), term);
    const hit = n.name.toLowerCase().includes(t);
    if (hit || kids.length > 0) next.push({ ...n, children: kids });
  }
  return next;
}

function FolderTree(props: {
  myTree: TreeResponse;
  myLabel: string;
  selectedFolderId: string | null;
  blockedIds: Set<string>;
  searchTerm: string;
  newFolderParentId: string | null | undefined;
  newFolderName: string;
  onNewFolderNameChange: (next: string) => void;
  onCommitNewFolder: () => void;
  onCancelNewFolder: () => void;
  onPick: (pick: FolderPick) => void;
}) {
  const {
    myTree,
    myLabel,
    selectedFolderId,
    blockedIds,
    searchTerm,
    newFolderParentId,
    newFolderName,
    onNewFolderNameChange,
    onCommitNewFolder,
    onCancelNewFolder,
    onPick,
  } = props;

  const myRoot =
    myTree.rootNodes.length === 1 && myTree.rootNodes[0].nodeType === "folder" && (myTree.rootNodes[0] as any).isRoot
      ? (myTree.rootNodes[0] as any)
      : null;

  const baseNodes = normalizeFolderNodes(myRoot ? (myRoot.children ?? []) : myTree.rootNodes);
  const folderNodes = useMemo(() => filterFolders(baseNodes, searchTerm), [baseNodes, searchTerm]);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => (searchTerm ? true : openFolders[id] ?? true);
  const toggle = (id: string) => setOpenFolders((p) => ({ ...p, [id]: !p[id] }));

  const { byId, parentById } = useMemo(() => buildFolderIndex(baseNodes), [baseNodes]);

  const pickFolder = (folderId: string | null) => {
    const path = computePath(folderId, myLabel, parentById, byId);
    onPick({ folderId, pathNames: path });
  };

  const NewFolderRow = (p: { depth: number }) => (
    <div style={{ paddingLeft: p.depth * 14 }}>
      <input
        className="form-control form-control-sm"
        placeholder="New folder name"
        value={newFolderName}
        autoFocus
        onChange={(e) => onNewFolderNameChange(e.target.value)}
        onBlur={onCommitNewFolder}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommitNewFolder();
          if (e.key === "Escape") onCancelNewFolder();
        }}
      />
    </div>
  );

  const Row = (p: { node: Extract<TreeNode, { nodeType: "folder" }>; depth: number }) => {
    const { node, depth } = p;
    const kids = normalizeFolderNodes(node.children ?? []);
    const hasKids = kids.length > 0;
    const open = isOpen(node.id);
    const active = selectedFolderId === node.id;
    const disabled = blockedIds.has(node.id);

    return (
      <div>
        <button
          type="button"
          className="btn btn-sm w-100 text-start"
          disabled={disabled}
          style={{
            border: active ? "1px solid rgba(13,110,253,0.35)" : "1px solid rgba(0,0,0,0.08)",
            background: active ? "rgba(13,110,253,0.08)" : "transparent",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 6,
            opacity: disabled ? 0.55 : 1,
          }}
          onClick={() => pickFolder(node.id)}
        >
          <div className="d-flex align-items-center" style={{ paddingLeft: depth * 14 }}>
            <span style={{ width: 16, display: "inline-flex", justifyContent: "center" }}>
              {hasKids ? (
                <i
                  className={"fa " + (open ? "fa-chevron-down" : "fa-chevron-right")}
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(node.id);
                  }}
                  style={{ color: "rgba(0,0,0,0.55)" }}
                  title={open ? "Collapse" : "Expand"}
                />
              ) : (
                <span />
              )}
            </span>

            <i className={"fa " + (active ? "fa-folder-open" : "fa-folder")} aria-hidden="true" style={{ opacity: 0.75, marginRight: 8 }} />
            <span className="text-truncate" style={{ maxWidth: 360 }}>
              {node.name}
            </span>
          </div>
        </button>

        {newFolderParentId === node.id ? (
          <div style={{ margin: "4px 0 8px 0" }}>
            <NewFolderRow depth={depth + 1} />
          </div>
        ) : null}

        {hasKids && open ? (
          <div>
            {kids.map((c) => (
              <Row key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <button
        type="button"
        className="btn btn-sm w-100 text-start"
        style={{
          border: selectedFolderId === null ? "1px solid rgba(13,110,253,0.35)" : "1px solid rgba(0,0,0,0.08)",
          background: selectedFolderId === null ? "rgba(13,110,253,0.08)" : "transparent",
          borderRadius: 8,
          padding: "6px 10px",
          marginBottom: 8,
        }}
        onClick={() => pickFolder(null)}
      >
        <i className="fa fa-folder" aria-hidden="true" style={{ opacity: 0.75, marginRight: 8 }} />
        <span className="fw-semibold">{myLabel}</span>
        <span className="text-muted ms-2" style={{ fontSize: 12 }}>
          (top)
        </span>
      </button>

      {newFolderParentId === null ? (
        <div style={{ margin: "4px 0 8px 0" }}>
          <NewFolderRow depth={0} />
        </div>
      ) : null}

      <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 6 }}>
        {folderNodes.map((n) => (
          <Row key={n.id} node={n} depth={0} />
        ))}
        {folderNodes.length === 0 ? <div className="text-muted small">No folders found.</div> : null}
      </div>
    </div>
  );
}

export function MoveModalDialog(props: {
  open: boolean;
  target: MoveTarget | null;
  myTree: TreeResponse;
  myLabel: string;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null, name: string) => void | Promise<void>;
}) {
  const { open, target, myTree, myLabel, onClose, onMove, onCreateFolder } = props;

  const [folderId, setFolderId] = useState<string | null>(null);
  const [pathNames, setPathNames] = useState<string[]>([myLabel]);
  const [search, setSearch] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");

  const blockedIds = useMemo(() => {
    if (!target || target.type !== "folder") return new Set<string>();

    const myRoot =
      myTree.rootNodes.length === 1 &&
      myTree.rootNodes[0].nodeType === "folder" &&
      (myTree.rootNodes[0] as any).isRoot
        ? (myTree.rootNodes[0] as any)
        : null;

    const baseNodes = normalizeFolderNodes(myRoot ? (myRoot.children ?? []) : myTree.rootNodes);
    const { byId } = buildFolderIndex(baseNodes);

    const blocked = new Set<string>();
    blocked.add(target.id);
    const node = byId.get(target.id);
    if (node) collectDescendants(node, blocked);
    return blocked;
  }, [myTree, target]);

  useEffect(() => {
    if (!open || !target) return;

    setFolderId(target.currentFolderId ?? null);
    setSearch("");
    setNewFolderParentId(undefined);
    setNewFolderName("");

    const myRoot =
      myTree.rootNodes.length === 1 && myTree.rootNodes[0].nodeType === "folder" && (myTree.rootNodes[0] as any).isRoot
        ? (myTree.rootNodes[0] as any)
        : null;
    const baseNodes = normalizeFolderNodes(myRoot ? (myRoot.children ?? []) : myTree.rootNodes);
    const { byId, parentById } = buildFolderIndex(baseNodes);
    setPathNames(computePath(target.currentFolderId ?? null, myLabel, parentById, byId));
  }, [open, target, myTree, myLabel]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !target) return null;

  const header = `Move ${target.name} To...`;

  const submit = () => {
    if (target.type === "folder" && blockedIds.has(folderId ?? "")) return;
    onMove(folderId ?? null);
  };

  const createFolderAt = () => {
    setSearch("");
    setNewFolderParentId(folderId ?? null);
    setNewFolderName("");
  };

  const commitNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setNewFolderParentId(undefined);
      setNewFolderName("");
      return;
    }
    const parentId = newFolderParentId ?? null;
    setNewFolderParentId(undefined);
    setNewFolderName("");
    await onCreateFolder(parentId, name);
  };

  const cancelNewFolder = () => {
    setNewFolderParentId(undefined);
    setNewFolderName("");
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 2000,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "14%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 640,
          zIndex: 2001,
        }}
      >
        <div className="bg-white border rounded shadow">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div className="fw-semibold">{header}</div>
            <button type="button" className="btn btn-sm" onClick={onClose} style={{ border: "none" }}>
              <i className="fa fa-xmark" />
            </button>
          </div>

          <div className="p-3">
            <div className="mb-3">
              <input
                type="search"
                className="form-control"
                placeholder="Search folders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mb-2">
              <div className="text-muted small mb-1">Current path</div>
              <div
                className="border rounded px-2 py-2"
                style={{ background: "rgba(0,0,0,0.02)", fontSize: 13 }}
                title={pathNames.join(" / ")}
              >
                <i className="fa fa-folder-open me-2" aria-hidden="true" style={{ opacity: 0.65 }} />
                <span className="text-truncate" style={{ display: "inline-block", maxWidth: 560, verticalAlign: "bottom" }}>
                  {pathNames.join(" / ")}
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="text-muted small">Choose destination</div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={createFolderAt}>
                New folder...
              </button>
            </div>

            <FolderTree
              myTree={myTree}
              myLabel={myLabel}
              selectedFolderId={folderId}
              blockedIds={blockedIds}
              searchTerm={search}
              newFolderParentId={newFolderParentId}
              newFolderName={newFolderName}
              onNewFolderNameChange={setNewFolderName}
              onCommitNewFolder={commitNewFolder}
              onCancelNewFolder={cancelNewFolder}
              onPick={(p) => {
                setFolderId(p.folderId);
                setPathNames(p.pathNames);
              }}
            />
          </div>

          <div className="p-3 border-top d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={target.type === "folder" && blockedIds.has(folderId ?? "")}
            >
              Move
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
