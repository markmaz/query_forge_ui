import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/features/domain-studio/ui/components/Modal";
import {
  fetchSavedQueryShares,
  shareSavedQueryToWorkspace,
  unshareSavedQueryFromWorkspace,
  type SavedQueryShareRow,
} from "@/shared/services/savedQueryShareApi";

export function ShareSavedQueryModal(props: {
  open: boolean;
  queryId: string | null;
  queryName?: string | null;
  onClose: () => void;
  onRefetchTree?: () => void | Promise<void>;
}) {
  const { open, queryId, queryName, onClose, onRefetchTree } = props;
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shares, setShares] = useState<SavedQueryShareRow[]>([]);
  const [workspaceCanEdit, setWorkspaceCanEdit] = useState(false);

  const workspaceShare = useMemo(
    () => shares.find((s) => s.principalType === "WORKSPACE") ?? null,
    [shares]
  );
  const workspaceShared = Boolean(workspaceShare);
  const errorMessage = (e: any, fallback: string) =>
    e?.response?.data?.message ?? e?.message ?? fallback;

  const loadShares = async () => {
    if (!queryId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSavedQueryShares(queryId);
      setShares(res.shares ?? []);
    } catch (e: any) {
      setError(errorMessage(e, "Failed to load shares."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !queryId) return;
    loadShares();
  }, [open, queryId]);

  useEffect(() => {
    if (!workspaceShare) {
      setWorkspaceCanEdit(false);
      return;
    }
    setWorkspaceCanEdit(Boolean(workspaceShare.canEdit));
  }, [workspaceShare]);

  const refetchTree = async () => {
    try {
      await onRefetchTree?.();
    } catch (e) {
      console.warn("Failed to refetch tree", e);
    }
  };

  const onToggleWorkspace = async () => {
    if (!queryId || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (workspaceShared) {
        await unshareSavedQueryFromWorkspace(queryId);
      } else {
        await shareSavedQueryToWorkspace(queryId, workspaceCanEdit);
      }
      await loadShares();
      await refetchTree();
    } catch (e: any) {
      setError(errorMessage(e, "Failed to update workspace share."));
    } finally {
      setBusy(false);
    }
  };

  const onWorkspaceCanEditChange = async (next: boolean) => {
    setWorkspaceCanEdit(next);
    if (!queryId || !workspaceShared || busy) return;
    setBusy(true);
    setError(null);
    try {
      await shareSavedQueryToWorkspace(queryId, next);
      await loadShares();
      await refetchTree();
    } catch (e: any) {
      setError(errorMessage(e, "Failed to update workspace share."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Share Query"
      onClose={onClose}
      width={560}
      footer={
        <div className="d-flex justify-content-end">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="mb-3">
        <div className="fw-semibold">{queryName?.trim() || "Query"}</div>
        {queryId ? <div className="text-muted small">{queryId}</div> : null}
      </div>

      {loading ? <div className="text-muted small mb-2">Loading shares…</div> : null}
      {error ? <div className="text-danger small mb-2">{error}</div> : null}

      <div className="border rounded p-2 mb-3">
        <div className="form-check form-switch">
          <input
            id="share-workspace-toggle"
            className="form-check-input"
            type="checkbox"
            checked={workspaceShared}
            onChange={onToggleWorkspace}
            disabled={busy || loading || !queryId}
          />
          <label className="form-check-label" htmlFor="share-workspace-toggle">
            Share with workspace
          </label>
        </div>

        <div className="form-check mt-2">
          <input
            id="share-workspace-edit"
            className="form-check-input"
            type="checkbox"
            checked={workspaceCanEdit}
            onChange={(e) => onWorkspaceCanEditChange(e.target.checked)}
            disabled={!workspaceShared || busy || loading || !queryId}
          />
          <label className="form-check-label" htmlFor="share-workspace-edit">
            Allow editing
          </label>
        </div>
      </div>

    </Modal>
  );
}
