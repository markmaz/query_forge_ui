import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { fetchDomainUsers, fetchWorkspaceUsers, updateDomainUsers } from "../../../../shared/services/queryStudioAdminApi";
import { useAppSelector } from "../../../../shared/runtime/hooks";

type Props = {
  open: boolean;
  domainId: number | null;
  canEdit: boolean;
  onSaved?: () => void | Promise<void>;
};

/** ---------- Users types (UI-side) ---------- */
type WorkspaceUserRow = {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
};

type DomainUserRow = WorkspaceUserRow & {
  can_read?: boolean; // optional
  can_edit: boolean;
};

/** ---------- Drag payloads ---------- */
type DragPayloadUser = { source: "available" | "assigned"; user_id: string };
const DRAG_MIME_USER = "application/x-domain-user";

export const DomainDrawerUsersTab: React.FC<Props> = ({ open, domainId, canEdit, onSaved }) => {
  const qc = useQueryClient();
  const workspaceId = useAppSelector((state) => state.userWorkspaces.selectedWorkspaceId ?? null);

  // Users state
  const [uq, setUq] = useState("");
  const [activeAvailUserId, setActiveAvailUserId] = useState<string | null>(null);
  const [activeAssignedUserId, setActiveAssignedUserId] = useState<string | null>(null);

  // map user_id -> can_edit (assigned working state)
  const [assignedUsers, setAssignedUsers] = useState<Map<string, boolean>>(new Map());
  const initialAssignedUsersRef = useRef<Map<string, boolean>>(new Map());

  const [overLeftUsers, setOverLeftUsers] = useState(false);
  const [overRightUsers, setOverRightUsers] = useState(false);

  const [justSavedUsers, setJustSavedUsers] = useState(false);

  // Reset on open/domain change
  useEffect(() => {
    if (!open) return;

    setUq("");
    setActiveAvailUserId(null);
    setActiveAssignedUserId(null);
    setAssignedUsers(new Map());
    initialAssignedUsersRef.current = new Map();
    setOverLeftUsers(false);
    setOverRightUsers(false);
  }, [open, domainId]);

  /** -----------------------------
   * Users Queries
   * ----------------------------- */
  const domainUsersQ = useQuery({
    queryKey: ["domainUsers", { domainId }],
    enabled: open && !!domainId,
    queryFn: () => fetchDomainUsers(domainId!),
  });

  const workspaceUsersQ = useQuery({
    queryKey: ["workspaceUsers", { workspaceId, uq }],
    enabled: open && Boolean(workspaceId),
    queryFn: () =>
      fetchWorkspaceUsers(String(workspaceId), {
        q: uq.trim() ? uq.trim() : undefined,
        limit: 5000,
        offset: 0,
      }),
  });

  const domainUsers: DomainUserRow[] = (domainUsersQ.data?.rows ?? []) as any;
  const workspaceUsers: WorkspaceUserRow[] = (workspaceUsersQ.data?.rows ?? []) as any;

  // Initialize assignedUsers map when domainUsers load
  useEffect(() => {
    if (!open) return;
    if (!domainId) return;
    if (domainUsersQ.isLoading) return;

    const next = new Map<string, boolean>();
    domainUsers.forEach((u) => next.set(u.user_id, !!u.can_edit));

    setAssignedUsers(next);
    initialAssignedUsersRef.current = new Map(next);

    setActiveAvailUserId(null);
    setActiveAssignedUserId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, domainId, domainUsersQ.isLoading]);

  const userById = useMemo(() => {
    const m = new Map<string, WorkspaceUserRow>();
    [...workspaceUsers, ...domainUsers].forEach((u) => m.set(u.user_id, u));
    return m;
  }, [workspaceUsers, domainUsers]);

  const availableUsers = useMemo(() => {
    return workspaceUsers.filter((u) => !assignedUsers.has(u.user_id));
  }, [workspaceUsers, assignedUsers]);

  const assignedDisplayUsers = useMemo(() => {
    const ids = Array.from(assignedUsers.keys());
    const rows = ids
      .map((id) => {
        const base = userById.get(id) || { user_id: id };
        return {
          ...base,
          can_edit: assignedUsers.get(id) === true,
        } as DomainUserRow;
      })
      .filter(Boolean);
    return rows;
  }, [assignedUsers, userById]);

  // diff for save payload (users)
  const addUserObjs = useMemo(() => {
    const base = initialAssignedUsersRef.current; // Map<user_id, can_edit>
    const out: { user_id: string; can_edit?: boolean }[] = [];

    assignedUsers.forEach((can_edit, user_id) => {
      const baseRole = base.get(user_id);
      if (baseRole === undefined) {
        out.push({ user_id, can_edit });
        return;
      }
      if (baseRole !== can_edit) {
        // role changed -> upsert via add
        out.push({ user_id, can_edit });
      }
    });

    return out;
  }, [assignedUsers]);

  const removeUserIds = useMemo(() => {
    const base = initialAssignedUsersRef.current;
    const removed: string[] = [];
    base.forEach((_role, user_id) => {
      if (!assignedUsers.has(user_id)) removed.push(user_id);
    });
    return removed;
  }, [assignedUsers]);

  const moveOneUserToAssigned = (user_id: string | null) => {
    if (!user_id) return;
    setAssignedUsers((prev) => {
      const next = new Map(prev);
      if (!next.has(user_id)) next.set(user_id, false); // default Reader
      return next;
    });
    setActiveAvailUserId(null);
    setActiveAssignedUserId(user_id);
  };

  const moveOneUserToAvailable = (user_id: string | null) => {
    if (!user_id) return;
    setAssignedUsers((prev) => {
      const next = new Map(prev);
      next.delete(user_id);
      return next;
    });
    setActiveAssignedUserId(null);
    setActiveAvailUserId(user_id);
  };

  const moveAllUsersToAssigned = () => {
    const ids = availableUsers.map((u) => u.user_id);
    setAssignedUsers((prev) => {
      const next = new Map(prev);
      ids.forEach((id) => {
        if (!next.has(id)) next.set(id, false);
      });
      return next;
    });
    setActiveAvailUserId(null);
  };

  const moveAllUsersToAvailable = () => {
    setAssignedUsers(new Map());
    setActiveAssignedUserId(null);
  };

  const toggleAssignedUserRole = (user_id: string) => {
    setAssignedUsers((prev) => {
      const next = new Map(prev);
      const cur = next.get(user_id) === true;
      next.set(user_id, !cur);
      return next;
    });
  };

  // Drag helpers (users)
  const onDragStartUser = (source: DragPayloadUser["source"], user_id: string) => (e: React.DragEvent) => {
    const payload: DragPayloadUser = { source, user_id };
    e.dataTransfer.setData(DRAG_MIME_USER, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const readDragUser = (e: React.DragEvent): DragPayloadUser | null => {
    const raw = e.dataTransfer.getData(DRAG_MIME_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayloadUser;
    } catch {
      return null;
    }
  };

  const allowDrop = (setter: (v: boolean) => void) => (e: React.DragEvent) => {
    e.preventDefault();
    setter(true);
  };

  const leaveDrop = (setter: (v: boolean) => void) => () => setter(false);

  const dropUserToAssigned = (e: React.DragEvent) => {
    e.preventDefault();
    setOverRightUsers(false);
    const p = readDragUser(e);
    if (!p) return;
    if (p.source === "available") moveOneUserToAssigned(p.user_id);
  };

  const dropUserToAvailable = (e: React.DragEvent) => {
    e.preventDefault();
    setOverLeftUsers(false);
    const p = readDragUser(e);
    if (!p) return;
    if (p.source === "assigned") moveOneUserToAvailable(p.user_id);
  };

  const saveUsersM = useMutation({
    mutationFn: () => updateDomainUsers(domainId!, { add: addUserObjs, remove: removeUserIds }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domainUsers"] });
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });

      setActiveAvailUserId(null);
      setActiveAssignedUserId(null);

      // refresh baseline
      initialAssignedUsersRef.current = new Map(assignedUsers);

      setJustSavedUsers(true);
      window.setTimeout(() => setJustSavedUsers(false), 1500);

      toast.success("Saved user mappings.");
      await onSaved?.();
    },
  });

  return (
    <>
      <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
        <div className="input-group input-group-sm" style={{ maxWidth: 520 }}>
          <span className="input-group-text bg-white">
            <i className="fa fa-search text-muted" />
          </span>
          <input className="form-control" value={uq} onChange={(e) => setUq(e.target.value)} placeholder="Search users…" />
        </div>

        <div className="text-muted small ms-auto">
          {assignedDisplayUsers.length.toLocaleString()} assigned • {availableUsers.length.toLocaleString()} available
        </div>
      </div>

      {(workspaceUsersQ.isError || domainUsersQ.isError || saveUsersM.isError) ? (
        <div className="alert alert-danger py-2">
          {((workspaceUsersQ.error || domainUsersQ.error || saveUsersM.error) as Error)?.message}
        </div>
      ) : null}

      <div className="domains-dual">
        {/* LEFT: Available users */}
        <div
          className={`card domains-dual__panel domains-dual__dropzone ${overLeftUsers ? "is-over" : ""}`}
          onDragOver={allowDrop(setOverLeftUsers)}
          onDragEnter={allowDrop(setOverLeftUsers)}
          onDragLeave={leaveDrop(setOverLeftUsers)}
          onDrop={dropUserToAvailable}
        >
          <div className="card-header py-2 d-flex justify-content-between align-items-center">
            <div className="fw-semibold">Available Users</div>
            <div className="text-muted small">drag →</div>
          </div>

          <div className="card-body p-0 domains-dual__list">
            {workspaceUsersQ.isLoading ? (
              <div className="p-3 text-muted small">Loading…</div>
            ) : availableUsers.length === 0 ? (
              <div className="p-3 text-muted small">No available users.</div>
            ) : (
              availableUsers
                .slice()
                .sort((a, b) => (a.display_name || a.user_id).localeCompare(b.display_name || b.user_id))
                .map((u) => {
                  const active = activeAvailUserId === u.user_id;
                  const label = u.display_name || u.email || u.user_id;
                  const sub = u.email && u.display_name ? u.email : u.user_id;

                  return (
                    <div
                      key={u.user_id}
                      className={`domains-dual__row ${active ? "active" : ""}`}
                      draggable={canEdit}
                      onDragStart={onDragStartUser("available", u.user_id)}
                      onClick={() => {
                        setActiveAvailUserId(u.user_id);
                        setActiveAssignedUserId(null);
                      }}
                      onDoubleClick={() => canEdit && moveOneUserToAssigned(u.user_id)}
                      title={canEdit ? "Double-click to assign, or drag to the right." : ""}
                    >
                      <div style={{ flex: 1 }}>
                        <div className="domains-dual__row-title">{label}</div>
                        <div className="domains-dual__row-sub text-muted">{sub}</div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* MIDDLE controls */}
        <div className="domains-dual__controls">
          <button
            className="btn btn-outline-primary btn-sm"
            disabled={!canEdit || !activeAvailUserId}
            onClick={() => moveOneUserToAssigned(activeAvailUserId)}
            title="Assign selected"
          >
            <i className="fa fa-chevron-right" />
          </button>

          <button
            className="btn btn-outline-primary btn-sm"
            disabled={!canEdit || availableUsers.length === 0}
            onClick={moveAllUsersToAssigned}
            title="Assign all"
          >
            <i className="fa fa-angle-double-right" />
          </button>

          <div style={{ height: 10 }} />

          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!canEdit || !activeAssignedUserId}
            onClick={() => moveOneUserToAvailable(activeAssignedUserId)}
            title="Unassign selected"
          >
            <i className="fa fa-chevron-left" />
          </button>

          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!canEdit || assignedDisplayUsers.length === 0}
            onClick={moveAllUsersToAvailable}
            title="Unassign all"
          >
            <i className="fa fa-angle-double-left" />
          </button>
        </div>

        {/* RIGHT: Assigned users + role */}
        <div
          className={`card domains-dual__panel domains-dual__dropzone ${overRightUsers ? "is-over" : ""}`}
          onDragOver={allowDrop(setOverRightUsers)}
          onDragEnter={allowDrop(setOverRightUsers)}
          onDragLeave={leaveDrop(setOverRightUsers)}
          onDrop={dropUserToAssigned}
        >
          <div className="card-header py-2 d-flex justify-content-between align-items-center">
            <div className="fw-semibold">Assigned Users</div>
            <div className="text-muted small">← drag</div>
          </div>

          <div className="card-body p-0 domains-dual__list">
            {domainUsersQ.isLoading ? (
              <div className="p-3 text-muted small">Loading…</div>
            ) : assignedDisplayUsers.length === 0 ? (
              <div className="p-3 text-muted small">No users assigned yet.</div>
            ) : (
              assignedDisplayUsers
                .slice()
                .sort((a, b) => (a.display_name || a.user_id).localeCompare(b.display_name || b.user_id))
                .map((u) => {
                  const active = activeAssignedUserId === u.user_id;
                  const label = u.display_name || u.email || u.user_id;
                  const sub = u.email && u.display_name ? u.email : u.user_id;

                  return (
                    <div
                      key={u.user_id}
                      className={`domains-dual__row ${active ? "active" : ""}`}
                      draggable={canEdit}
                      onDragStart={onDragStartUser("assigned", u.user_id)}
                      onClick={() => {
                        setActiveAssignedUserId(u.user_id);
                        setActiveAvailUserId(null);
                      }}
                      onDoubleClick={() => canEdit && moveOneUserToAvailable(u.user_id)}
                      title={canEdit ? "Double-click to unassign, or drag to the left." : ""}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="domains-dual__row-title">{label}</div>
                        <div className="domains-dual__row-sub text-muted">{sub}</div>
                      </div>

                      {/* role toggle */}
                      <div className="ms-2" style={{ flex: "0 0 auto" }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${u.can_edit ? "btn-primary" : "btn-outline-secondary"}`}
                          disabled={!canEdit}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAssignedUserRole(u.user_id);
                          }}
                          title={u.can_edit ? "Editor (click to make Reader)" : "Reader (click to make Editor)"}
                        >
                          {u.can_edit ? "Editor" : "Reader"}
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="text-muted small">
          Changes: <b>{addUserObjs.length}</b> upsert • <b>{removeUserIds.length}</b> remove
        </div>

        <button
          className={`btn btn-sm ${justSavedUsers ? "btn-success" : "btn-primary"}`}
          disabled={!canEdit || saveUsersM.isPending || (addUserObjs.length === 0 && removeUserIds.length === 0)}
          onClick={() => saveUsersM.mutate()}
        >
          {saveUsersM.isPending ? "Saving…" : justSavedUsers ? "Saved ✓" : "Save Changes"}
        </button>
      </div>

      <div className="text-muted small mt-2">Tip: double-click moves one user. Toggle Reader/Editor on the right before saving.</div>
    </>
  );
};

export default DomainDrawerUsersTab;
