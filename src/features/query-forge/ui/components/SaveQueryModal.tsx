import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TreeNode, TreeResponse } from "../../../../shared/domain-state/savedQueries";

type FolderPick = {
  folderId: string | null;
  pathNames: string[];
};

type FolderNode = Extract<TreeNode, { nodeType: "folder" }>;

type FolderIndex = {
  byId: Map<string, FolderNode>;
  parentById: Map<string, string | null>;
};

function isFolderNode(node: TreeNode): node is FolderNode {
  return node.nodeType === "folder";
}

function unwrapUserRootNodes(tree: TreeResponse): TreeNode[] {
  if (
    tree.rootNodes.length === 1 &&
    tree.rootNodes[0].nodeType === "folder" &&
    Boolean((tree.rootNodes[0] as { isRoot?: boolean }).isRoot)
  ) {
    return (tree.rootNodes[0] as FolderNode).children ?? [];
  }

  return tree.rootNodes;
}

function createFolderIndex(rootNodes: TreeNode[]): FolderIndex {
  const byId = new Map<string, FolderNode>();
  const parentById = new Map<string, string | null>();

  const walk = (nodes: TreeNode[], parentId: string | null) => {
    nodes.forEach((node) => {
      if (!isFolderNode(node)) return;
      byId.set(node.id, node);
      parentById.set(node.id, parentId);
      walk(node.children ?? [], node.id);
    });
  };

  walk(rootNodes, null);
  return { byId, parentById };
}

function resolveFolderPath(
  folderId: string | null,
  rootLabel: string,
  index: FolderIndex
): string[] {
  if (!folderId) return [rootLabel];

  const names: string[] = [];
  let pointer: string | null = folderId;

  while (pointer) {
    const folder = index.byId.get(pointer);
    if (folder) names.push(folder.name);
    pointer = index.parentById.get(pointer) ?? null;
  }

  names.reverse();
  return [rootLabel, ...names];
}

function FolderTreeExplorer({
  rootNodes,
  rootLabel,
  selectedFolderId,
  onPick,
}: {
  rootNodes: TreeNode[];
  rootLabel: string;
  selectedFolderId: string | null;
  onPick: (pick: FolderPick) => void;
}) {
  const [openById, setOpenById] = useState<Record<string, boolean>>({});

  const onlyFolders = useMemo(
    () => rootNodes.filter(isFolderNode) as FolderNode[],
    [rootNodes]
  );

  const index = useMemo(() => createFolderIndex(onlyFolders), [onlyFolders]);

  const isOpen = (folderId: string) => openById[folderId] ?? true;

  const toggleOpen = (folderId: string) => {
    setOpenById((previous) => ({
      ...previous,
      [folderId]: !isOpen(folderId),
    }));
  };

  const selectFolder = (folderId: string | null) => {
    onPick({
      folderId,
      pathNames: resolveFolderPath(folderId, rootLabel, index),
    });
  };

  const renderFolder = (node: FolderNode, depth: number): React.ReactNode => {
    const childFolders = (node.children ?? []).filter(isFolderNode) as FolderNode[];
    const hasChildren = childFolders.length > 0;
    const folderOpen = isOpen(node.id);
    const isSelected = selectedFolderId === node.id;

    return (
      <div key={node.id}>
        <button
          type="button"
          className="btn btn-sm w-100 text-start"
          style={{
            border: isSelected
              ? "1px solid rgba(13,110,253,0.35)"
              : "1px solid rgba(0,0,0,0.08)",
            background: isSelected ? "rgba(13,110,253,0.08)" : "transparent",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 6,
          }}
          onClick={() => selectFolder(node.id)}
        >
          <div className="d-flex align-items-center" style={{ paddingLeft: depth * 14 }}>
            <span style={{ width: 16, display: "inline-flex", justifyContent: "center" }}>
              {hasChildren ? (
                <i
                  className={`fa ${folderOpen ? "fa-chevron-down" : "fa-chevron-right"}`}
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleOpen(node.id);
                  }}
                  style={{ color: "rgba(0,0,0,0.55)" }}
                  title={folderOpen ? "Collapse" : "Expand"}
                />
              ) : (
                <span />
              )}
            </span>

            <i
              className={`fa ${isSelected ? "fa-folder-open" : "fa-folder"}`}
              aria-hidden="true"
              style={{ opacity: 0.75, marginRight: 8 }}
            />
            <span className="text-truncate" style={{ maxWidth: 360 }}>
              {node.name}
            </span>
          </div>
        </button>

        {hasChildren && folderOpen ? (
          <div>{childFolders.map((child) => renderFolder(child, depth + 1))}</div>
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
          border:
            selectedFolderId === null
              ? "1px solid rgba(13,110,253,0.35)"
              : "1px solid rgba(0,0,0,0.08)",
          background:
            selectedFolderId === null ? "rgba(13,110,253,0.08)" : "transparent",
          borderRadius: 8,
          padding: "6px 10px",
          marginBottom: 8,
        }}
        onClick={() => selectFolder(null)}
      >
        <i className="fa fa-folder" aria-hidden="true" style={{ opacity: 0.75, marginRight: 8 }} />
        <span className="fw-semibold">{rootLabel}</span>
        <span className="text-muted ms-2" style={{ fontSize: 12 }}>
          (top)
        </span>
      </button>

      <div style={{ maxHeight: 220, overflowY: "auto", paddingRight: 6 }}>
        {onlyFolders.length === 0 ? (
          <div className="text-muted small">No folders yet.</div>
        ) : (
          onlyFolders.map((folder) => renderFolder(folder, 0))
        )}
      </div>
    </div>
  );
}

export function SaveQueryModal(props: {
  open: boolean;
  myTree: TreeResponse;
  myLabel: string;
  initialName: string;
  initialDescription?: string | null;
  initialFolderId?: string | null;
  titleText?: string;
  nameLabel?: string;
  submitLabel?: string;
  showAttachSkillOption?: boolean;
  initialAttachSkill?: boolean;
  attachSkillLabel?: string;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description?: string | null;
    folderId: string | null;
    attachSkill?: boolean;
  }) => void;
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
    showAttachSkillOption = false,
    initialAttachSkill = false,
    attachSkillLabel = "Create automation for this query",
    onClose,
    onSave,
  } = props;

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [folderId, setFolderId] = useState<string | null>(initialFolderId ?? null);
  const [pathNames, setPathNames] = useState<string[]>([myLabel]);
  const [attachSkill, setAttachSkill] = useState(initialAttachSkill);

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const folderRootNodes = useMemo(() => unwrapUserRootNodes(myTree), [myTree]);
  const folderIndex = useMemo(() => createFolderIndex(folderRootNodes), [folderRootNodes]);

  useEffect(() => {
    if (!open) return;

    setName(initialName?.trim() ? initialName : "New Query");
    setDescription(initialDescription ?? "");

    const nextFolderId = initialFolderId ?? null;
    setFolderId(nextFolderId);
    setPathNames(resolveFolderPath(nextFolderId, myLabel, folderIndex));
    setAttachSkill(initialAttachSkill);

    window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }, [
    open,
    initialName,
    initialDescription,
    initialFolderId,
    myLabel,
    folderIndex,
    initialAttachSkill,
  ]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const canSave = Boolean(name.trim());

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onSave({
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      folderId,
      attachSkill: showAttachSkillOption ? attachSkill : false,
    });
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
            <div className="fw-semibold">{titleText}</div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onClose}
              style={{ border: "none" }}
            >
              <i className="fa fa-xmark" />
            </button>
          </div>

          <div className="p-3">
            <div className="mb-2">
              <div className="text-muted small mb-1">Location</div>
              <div
                className="border rounded px-2 py-2"
                style={{ background: "rgba(0,0,0,0.02)", fontSize: 13 }}
                title={pathNames.join(" / ")}
              >
                <i
                  className="fa fa-folder-open me-2"
                  aria-hidden="true"
                  style={{ opacity: 0.65 }}
                />
                <span
                  className="text-truncate"
                  style={{
                    display: "inline-block",
                    maxWidth: 560,
                    verticalAlign: "bottom",
                  }}
                >
                  {pathNames.join(" / ")}
                </span>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-muted small mb-2">Choose folder</div>
              <FolderTreeExplorer
                rootNodes={folderRootNodes}
                rootLabel={myLabel}
                selectedFolderId={folderId}
                onPick={(pick) => {
                  setFolderId(pick.folderId);
                  setPathNames(pick.pathNames);
                }}
              />
            </div>

            <div className="mb-3">
              <label className="form-label small text-muted mb-1">
                {nameLabel} <span className="text-danger">*</span>
              </label>
              <input
                ref={nameInputRef}
                className="form-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
              />
              {!name.trim() ? (
                <div className="text-danger small mt-1">Name is required.</div>
              ) : null}
            </div>

            <div>
              <label className="form-label small text-muted mb-1">
                Description (optional)
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {showAttachSkillOption ? (
              <div className="mt-3 form-check">
                <input
                  id="save-query-attach-skill"
                  type="checkbox"
                  className="form-check-input"
                  checked={attachSkill}
                  onChange={(event) => setAttachSkill(event.target.checked)}
                />
                <label htmlFor="save-query-attach-skill" className="form-check-label">
                  {attachSkillLabel}
                </label>
              </div>
            ) : null}
          </div>

          <div className="p-3 border-top d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={!canSave}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
