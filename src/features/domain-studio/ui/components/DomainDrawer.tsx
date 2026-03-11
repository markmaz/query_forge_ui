import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import type { Domain } from "../../../../shared/services/queryStudioAdminApi";
import { deleteDomain, updateDomain } from "../../../../shared/services/queryStudioAdminApi";
import { getApiWorkspaceId } from "../../../../shared/services/api";

import DomainDrawerUsersTab from "./DomainDrawerUsersTab";

import "../style/domainDrawer.css";

type Props = {
  open: boolean;
  domain: Domain | null;
  onClose: () => void;
};

type TabKey = "overview" | "users";

export const DomainDrawer: React.FC<Props> = ({ open, domain, onClose }) => {
  const qc = useQueryClient();
  const workspaceId = getApiWorkspaceId() ?? "";
  const domainId = domain?.id ?? null;

  const [tab, setTab] = useState<TabKey>("overview");

  // Overview form state
  const [name, setName] = useState(domain?.name ?? "");
  const [kind, setKind] = useState(domain?.kind ?? "");
  const [description, setDescription] = useState(domain?.description ?? "");
  const [columnNamePolicy, setColumnNamePolicy] = useState<"DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED">(
    ((domain as any)?.column_name_policy as "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED") ??
      ((domain as any)?.columnNamePolicy as "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED") ??
      "DEDUP_PRIMARY_FIRST"
  );

  const canEdit = (domain as any)?.can_edit === true || (domain as any)?.can_edit === 1;

  // ✅ Always run hooks (no early return before them)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Hydrate/reset on open + domain change
  useEffect(() => {
    if (!open) return;

    setTab("overview");
    setName(domain?.name ?? "");
    setKind(domain?.kind ?? "");
    setDescription(domain?.description ?? "");
    setColumnNamePolicy(
      ((domain as any)?.column_name_policy as "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED") ??
        ((domain as any)?.columnNamePolicy as "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED") ??
        "DEDUP_PRIMARY_FIRST"
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, domainId]);

  const saveDomainM = useMutation({
    mutationFn: () =>
      updateDomain(domainId!, {
        name: name.trim(),
        kind: kind.trim() ? kind.trim() : null,
        description: description.trim() ? description.trim() : null,
        column_name_policy: columnNamePolicy,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["builderDomains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      await qc.invalidateQueries({ queryKey: ["domainTables"] });
      await qc.invalidateQueries({ queryKey: ["workspaceTables"] });
      await qc.invalidateQueries({ queryKey: ["domains", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries", workspaceId] });
      toast.success("Domain saved.");
      onClose();
    },
    onError: (err) => {
      const msg = (err as Error)?.message || "Domain save failed.";
      toast.error(msg);
    },
  });

  const deleteDomainM = useMutation({
    mutationFn: () => deleteDomain(domainId!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["builderDomains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      await qc.invalidateQueries({ queryKey: ["domains", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries", workspaceId] });
      onClose();
    },
  });

  // ✅ Early return AFTER hooks
  if (!open || !domain) return null;

  const selectedModelLabel = (domain as any)?.modelTableName ?? (domain as any)?.model_table_name ?? "None";

  return createPortal(
    <>
      <div className="offcanvas-backdrop fade show" onClick={onClose} />

      <div className="offcanvas offcanvas-end show domains-offcanvas" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="offcanvas-header border-bottom">
          <div>
            <h5 className="offcanvas-title mb-0">{domain.name}</h5>
            <div className="text-muted small">Domain management • Model: {selectedModelLabel}</div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>

        <div className="offcanvas-body">
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button className={`nav-link ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
                <i className="fa fa-info-circle me-2" /> Overview
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
                <i className="fa fa-users me-2" /> Users
              </button>
            </li>
          </ul>

          {/* ---------------- Overview ---------------- */}
          {tab === "overview" && (
            <div className="card">
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Name</label>
                  <input
                    className="form-control form-control-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canEdit || saveDomainM.isPending}
                  />
                </div>

                {/* ✅ NEW: Model Type dropdown */}
                <div className="mb-3">
                  <div className="form-text small text-muted">
                    Domain mapping uses workspace tables and workspace columns as source of truth.
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Kind</label>
                  <input
                    className="form-control form-control-sm"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    placeholder="pii / claims / clinical ..."
                    disabled={!canEdit || saveDomainM.isPending}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Column name policy</label>
                  <select
                    className="form-select form-select-sm"
                    value={columnNamePolicy}
                    onChange={(e) =>
                      setColumnNamePolicy(e.target.value as "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED")
                    }
                    disabled={!canEdit || saveDomainM.isPending}
                  >
                    <option value="DEDUP_PRIMARY_FIRST">Dedup (primary wins)</option>
                    <option value="SHOW_ALL_QUALIFIED">Show all (qualified)</option>
                  </select>
                  <div className="form-text small text-muted">
                    Choose whether duplicate column names are deduped or shown per table.
                  </div>
                </div>

                <div className="mb-0">
                  <label className="form-label fw-semibold">Description</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canEdit || saveDomainM.isPending}
                  />
                </div>

                {saveDomainM.isError || deleteDomainM.isError ? (
                  <div className="alert alert-danger py-2 mt-3 mb-0">
                    {((saveDomainM.error || deleteDomainM.error) as Error)?.message}
                  </div>
                ) : null}

              </div>

              <div className="card-footer bg-white d-flex justify-content-between align-items-center">
                <button
                  className="btn btn-outline-danger btn-sm"
                  disabled={!canEdit || deleteDomainM.isPending}
                  onClick={() => {
                    if (!window.confirm(`Delete domain "${domain.name}"? This removes mappings too.`)) return;
                    deleteDomainM.mutate();
                  }}
                >
                  <i className="fa fa-trash me-2" />
                  Delete
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canEdit || !name.trim() || saveDomainM.isPending}
                  onClick={() => saveDomainM.mutate()}
                >
                  {saveDomainM.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* ---------------- Users ---------------- */}
          {tab === "users" && (
            <DomainDrawerUsersTab
              open={open}
              domainId={domainId}
              canEdit={canEdit}
              onSaved={async () => {
                await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
              }}
            />
          )}
        </div>

        <div className="offcanvas-footer border-top p-3 d-flex justify-content-end">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};

export default DomainDrawer;
