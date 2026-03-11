import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "./Modal";
import type { Domain, WorkspaceTableRow } from "../../../../shared/services/queryStudioAdminApi";
import {
  fetchDomainTables,
  fetchWorkspaceTables,
  updateDomainTables,
} from "../../../../shared/services/queryStudioAdminApi";
import { getApiWorkspaceId } from "../../../../shared/services/api";

import "../style/domainsTab.css";

type Props = {
  open: boolean;
  domain: Domain | null;
  onClose: () => void;
};

export const DomainTablesModal: React.FC<Props> = ({ open, domain, onClose }) => {
  const qc = useQueryClient();
  const workspaceId = getApiWorkspaceId() ?? "";
  const domainId = domain?.id;

  const [q, setQ] = useState("");
  const [selectedAll, setSelectedAll] = useState<Record<number, boolean>>({});
  const [selectedAssigned, setSelectedAssigned] = useState<Record<number, boolean>>({});

  // reset when opening / switching domains
  useEffect(() => {
    if (!open || !domain) return;
    setQ("");
    setSelectedAll({});
    setSelectedAssigned({});
  }, [open, domain?.id]);

  const allQ = useQuery({
    queryKey: ["workspaceTables", { workspaceId, q }],
    enabled: open,
    queryFn: () =>
      fetchWorkspaceTables({
        workspaceId,
        q: q.trim() ? q.trim() : undefined,
        limit: 2000,
        offset: 0,
      }),
  });

  const assignedQ = useQuery({
    queryKey: ["domainTables", { domainId, workspaceId }],
    enabled: open && !!domainId,
    queryFn: () => fetchDomainTables(domainId!, workspaceId),
  });

  const allRows: WorkspaceTableRow[] = (allQ.data?.rows ?? []) as any;
  const assignedRowsRaw: WorkspaceTableRow[] = (assignedQ.data?.rows ?? []) as any;

  // ✅ key is workspace_table_id now
  const assignedIds = useMemo(
    () => new Set(assignedRowsRaw.map((r) => r.workspace_table_id)),
    [assignedRowsRaw]
  );

  const assignedRows = assignedRowsRaw;

  // Available list = allRows minus assignedIds
  const availableRows = useMemo(() => {
    return allRows.filter((r) => !assignedIds.has(r.workspace_table_id));
  }, [allRows, assignedIds]);

  const addIds = useMemo(
    () => Object.entries(selectedAll).filter(([, v]) => v).map(([k]) => Number(k)),
    [selectedAll]
  );

  const removeIds = useMemo(
    () => Object.entries(selectedAssigned).filter(([, v]) => v).map(([k]) => Number(k)),
    [selectedAssigned]
  );

  const saveM = useMutation({
    mutationFn: () => updateDomainTables(domainId!, { add: addIds, remove: removeIds }, workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domainTables"] });
      qc.invalidateQueries({ queryKey: ["workspaceTables"] });
      qc.invalidateQueries({ queryKey: ["domainTables", { domainId, workspaceId }] });
      qc.invalidateQueries({ queryKey: ["workspaceTables", { workspaceId }] });
      setSelectedAll({});
      setSelectedAssigned({});
      onClose();
    },
  });

  if (!open || !domain) return null;

  return (
    <Modal
      open={open}
      title={`Manage Tables — ${domain.name}`}
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-between w-100">
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={saveM.isPending}>
            Close
          </button>

          <button
            className="btn btn-primary btn-sm"
            disabled={saveM.isPending || (addIds.length === 0 && removeIds.length === 0)}
            onClick={() => saveM.mutate()}
          >
            {saveM.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      }
    >
      <div className="vstack gap-3">
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {/* Search */}
          <div className="input-group input-group-sm" style={{ maxWidth: 420 }}>
            <span className="input-group-text bg-white">
              <i className="fa fa-search text-muted" aria-hidden="true" />
            </span>
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search workspace tables…"
            />
          </div>

          <div className="text-muted small ms-auto">
            {assignedRows.length.toLocaleString()} assigned • {availableRows.length.toLocaleString()} available
          </div>
        </div>

        {(allQ.isError || assignedQ.isError || saveM.isError) ? (
          <div className="alert alert-danger py-2 mb-0">
            {((allQ.error || assignedQ.error || saveM.error) as Error)?.message}
          </div>
        ) : null}

        <div className="row g-3">
          {/* Available */}
          <div className="col-12 col-lg-6">
            <div className="card domains-card">
              <div className="card-header py-2 d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Available Tables</div>
                <div className="text-muted small">{addIds.length} selected</div>
              </div>

              <div className="card-body p-0">
                <div className="domains-list">
                  {allQ.isLoading ? (
                    <div className="p-3 text-muted small">Loading…</div>
                  ) : availableRows.length === 0 ? (
                    <div className="p-3 text-muted small">No available tables.</div>
                  ) : (
                    availableRows
                      .slice()
                      .sort((a, b) => a.full_name.localeCompare(b.full_name))
                      .map((r) => {
                        const id = r.workspace_table_id;
                        return (
                          <label key={id} className="domains-row">
                            <input
                              className="form-check-input me-2"
                              type="checkbox"
                              checked={!!selectedAll[id]}
                              onChange={(e) => setSelectedAll((prev) => ({ ...prev, [id]: e.target.checked }))}
                            />
                            <div className="domains-row-main">
                              <div className="domains-row-title">{r.full_name}</div>
                              <div className="domains-row-sub text-muted">
                                model: {r.model_table_name ?? "—"}
                                {r.variant_code ? ` • variant: ${r.variant_code}` : ""}
                                {r.is_qe ? " • QE" : ""}
                              </div>
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Assigned */}
          <div className="col-12 col-lg-6">
            <div className="card domains-card">
              <div className="card-header py-2 d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Assigned to Domain</div>
                <div className="text-muted small">{removeIds.length} selected</div>
              </div>

              <div className="card-body p-0">
                <div className="domains-list">
                  {assignedQ.isLoading ? (
                    <div className="p-3 text-muted small">Loading…</div>
                  ) : assignedRows.length === 0 ? (
                    <div className="p-3 text-muted small">No tables assigned yet.</div>
                  ) : (
                    assignedRows
                      .slice()
                      .sort((a, b) => a.full_name.localeCompare(b.full_name))
                      .map((r) => {
                        const id = r.workspace_table_id;
                        return (
                          <label key={id} className="domains-row">
                            <input
                              className="form-check-input me-2"
                              type="checkbox"
                              checked={!!selectedAssigned[id]}
                              onChange={(e) =>
                                setSelectedAssigned((prev) => ({ ...prev, [id]: e.target.checked }))
                              }
                            />
                            <div className="domains-row-main">
                              <div className="domains-row-title">{r.full_name}</div>
                              <div className="domains-row-sub text-muted">
                                model: {r.model_table_name ?? "—"}
                                {r.variant_code ? ` • variant: ${r.variant_code}` : ""}
                                {r.is_qe ? " • QE" : ""}
                              </div>
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-muted small">Tip: search by table name to quickly find and map tables.</div>
      </div>
    </Modal>
  );
};
