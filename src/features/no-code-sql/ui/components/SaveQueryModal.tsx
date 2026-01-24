// src/features/nocode-query/ui/components/SaveQueryModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TreeNode, TreeResponse } from "../../../../shared/model/savedQueries"

type FolderPick = { folderId: string | null; pathNames: string[] };

function isFolder(n: TreeNode): n is Extract<TreeNode, { nodeType: "folder" }> {
  return n.nodeType === "folder";
}

function buildFolderIndex(rootNodes: TreeNode[]) {
  const byId = new Map<string, Extract<TreeNode, { nodeType: "folder" }>>();
  const parentById = new Map<string, string | null>();

  // root (null) is “top node”
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

function computePath(folderId: string | null, myLabel: string, parentById: Map<string, string | null>, byId: Map<string, any>) {
  // folderId null => top node
  if (!folderId) return [myLabel];

  const names: string[] = [];
  let cur: string | null = folderId;

  while (cur) {
    const node = byId.get(cur);
    if (node) names.push(node.name);
    cur = parentById.get(cur) ?? null;
  }

  // names currently bottom-up; prepend myLabel
  return [myLabel, ...names.reverse()];
}

function FolderTreePicker(props: {
  myTree: TreeResponse;
  myLabel: string;

  selectedFolderId: string | null;
  onPick: (pick: FolderPick) => void;
}) {
  const { myTree, myLabel, selectedFolderId, onPick } = props;

  // If API wraps My under a root folder (isRoot), unwrap it so user sees folders underneath.
  const myRoot =
    myTree.rootNodes.length === 1 && myTree.rootNodes[0].nodeType === "folder" && (myTree.rootNodes[0] as any).isRoot
      ? (myTree.rootNodes[0] as any)
      : null;

  const folderNodes: TreeNode[] = myRoot ? (myRoot.children ?? []) : myTree.rootNodes;

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  // default expand all folders
  const isOpen = (id: string) => openFolders[id] ?? true;
  const toggle = (id: string) => setOpenFolders((p) => ({ ...p, [id]: !p[id] }));

  const { byId, parentById } = useMemo(() => buildFolderIndex(folderNodes), [folderNodes]);

  const pickFolder = (folderId: string | null) => {
    const path = computePath(folderId, myLabel, parentById, byId);
    onPick({ folderId, pathNames: path });
  };

  const Row = (p: { node: TreeNode; depth: number }) => {
    const { node, depth } = p;
    if (!isFolder(node)) return null;

    const kids = useMemo(
      () => (node.children ?? []).filter(isFolder) as Extract<TreeNode, { nodeType: "folder" }>[],
      [node.children]
    );
    const hasKids = kids.length > 0;
    const open = isOpen(node.id);

    const active = selectedFolderId === node.id;
    const childRows = useMemo(() => kids.map((c) => <Row key={c.id} node={c} depth={depth + 1} />), [kids, depth]);

    return (
      <div>
        <button
          type="button"
          className={"btn btn-sm w-100 text-start"}
          style={{
            border: active ? "1px solid rgba(13,110,253,0.35)" : "1px solid rgba(0,0,0,0.08)",
            background: active ? "rgba(13,110,253,0.08)" : "transparent",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 6,
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

        {hasKids && open ? <div>{childRows}</div> : null}
      </div>
    );
  };

  return (
    <div>
      {/* Top node choice */}
      <button
        type="button"
        className={"btn btn-sm w-100 text-start"}
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

      <div style={{ maxHeight: 220, overflowY: "auto", paddingRight: 6 }}>
        {folderNodes.filter(isFolder).map((n) => (
          <Row key={n.id} node={n} depth={0} />
        ))}
        {folderNodes.filter(isFolder).length === 0 ? (
          <div className="text-muted small">No folders yet.</div>
        ) : null}
      </div>
    </div>
  );
}

export function SaveQueryModal(props: {
  open: boolean;

  // Required: only "my" tree is used for path selection
  myTree: TreeResponse;
  myLabel: string;

  initialName: string;
  initialDescription?: string | null;

  // initial folder (null = top node)
  initialFolderId?: string | null;

  titleText?: string;
  nameLabel?: string;
  submitLabel?: string;

  onClose: () => void;
  onSave: (payload: { name: string; description?: string | null; folderId: string | null }) => void;
}) {
  const {
    open,
    myTree,
    myLabel,
    initialName,
    initialDescription,
    initialFolderId,
    titleText = "Save query",
    nameLabel = "Query name",
    submitLabel = "Save",
    onClose,
    onSave,
  } = props;

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [folderId, setFolderId] = useState<string | null>(initialFolderId ?? null);
  const [pathNames, setPathNames] = useState<string[]>([myLabel]);

  const nameRef = useRef<HTMLInputElement | null>(null);

  // build path on open (and when initialFolderId changes)
  useEffect(() => {
    if (!open) return;

    setName((initialName || "").trim() ? initialName : "New Query");
    setDescription(initialDescription ?? "");
    setFolderId(initialFolderId ?? null);

    // compute initial path for display
    const myRoot =
      myTree.rootNodes.length === 1 && myTree.rootNodes[0].nodeType === "folder" && (myTree.rootNodes[0] as any).isRoot
        ? (myTree.rootNodes[0] as any)
        : null;
    const folderNodes: TreeNode[] = myRoot ? (myRoot.children ?? []) : myTree.rootNodes;

    const { byId, parentById } = buildFolderIndex(folderNodes.filter((n) => n.nodeType === "folder"));
    const p = computePath(initialFolderId ?? null, myLabel, parentById, byId);
    setPathNames(p);

    window.setTimeout(() => nameRef.current?.focus(), 0);
    window.setTimeout(() => nameRef.current?.select(), 0);
  }, [open, initialName, initialDescription, initialFolderId, myTree, myLabel]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const canSave = Boolean(name.trim());

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      description: description.trim() ? description.trim() : null,
      folderId,
    });
  };

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 2000,
        }}
      />

      {/* modal */}
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
            <div className="fw-semibold">{titleText}</div>
            <button type="button" className="btn btn-sm" onClick={onClose} style={{ border: "none" }}>
              <i className="fa fa-xmark" />
            </button>
          </div>

          <div className="p-3">
            {/* Location (breadcrumb) */}
            <div className="mb-2">
              <div className="text-muted small mb-1">Location</div>
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

            {/* Folder picker (Mine only) */}
            <div className="mb-3">
              <div className="text-muted small mb-2">Choose folder</div>
              <FolderTreePicker
                myTree={myTree}
                myLabel={myLabel}
                selectedFolderId={folderId}
                onPick={(p) => {
                  setFolderId(p.folderId);
                  setPathNames(p.pathNames);
                }}
              />
            </div>

            {/* Name (required) */}
            <div className="mb-3">
              <label className="form-label small text-muted mb-1">
                {nameLabel} <span className="text-danger">*</span>
              </label>
              <input
                ref={nameRef}
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              {!name.trim() ? <div className="text-danger small mt-1">Name is required.</div> : null}
            </div>

            {/* Description */}
            <div>
              <label className="form-label small text-muted mb-1">Description (optional)</label>
              <textarea className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="p-3 border-top d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={!canSave}>
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
