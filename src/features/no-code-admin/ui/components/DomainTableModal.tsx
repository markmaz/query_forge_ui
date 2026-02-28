import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "./Modal";
import type { Domain, WorkspaceTableRow } from "../../../../shared/services/noCodeAdminApi";
import {
  fetchDomainTables,
  fetchWorkspaceTables,
  updateDomainTables,
  fetchModelTables,
} from "../../../../shared/services/noCodeAdminApi";

import "../style/domainsTab.css";

type Props = {
  open: boolean;
  domain: Domain | null;
  onClose: () => void;
};

type ModelTable = { id: number; name: string };

export const DomainTablesModal: React.FC<Props> = ({ open, domain, onClose }) => {
  const qc = useQueryClient();
  const domainId = domain?.id;

  const [q, setQ] = useState("");
  const [selectedAll, setSelectedAll] = useState<Record<number, boolean>>({});
  const [selectedAssigned, setSelectedAssigned] = useState<Record<number, boolean>>({});

  // NEW: model filter (defaults to domain.model_table_id)
  const [modelFilterId, setModelFilterId] = useState<number | "ALL">("ALL");

  // hydrate filter when opening / switching domains
  useEffect(() => {
    if (!open || !domain) return;
    setQ("");
    setSelectedAll({});
    setSelectedAssigned({});
    setModelFilterId(domain.modelTableId ?? "ALL");
  }, [open, domain?.id]);

  const modelsQ = useQuery({
    queryKey: ["modelTables", { open }],
    enabled: open,
    queryFn: () => fetchModelTables({ limit: 5000, offset: 0 }),
  });

  const modelTables: ModelTable[] = (modelsQ.data?.rows ?? []) as any;

  const allQ = useQuery({
    queryKey: ["workspaceTables", { q }],
    enabled: open,
    queryFn: () =>
      fetchWorkspaceTables({
        q: q.trim() ? q.trim() : undefined,
        limit: 2000,
        offset: 0,
      }),
  });

  const assignedQ = useQuery({
    queryKey: ["domainTables", { domainId }],
    enabled: open && !!domainId,
    queryFn: () => fetchDomainTables(domainId!),
  });

  const allRows: WorkspaceTableRow[] = (allQ.data?.rows ?? []) as any;
  const assignedRowsRaw: WorkspaceTableRow[] = (assignedQ.data?.rows ?? []) as any;

  // ✅ key is workspace_table_id now
  const assignedIds = useMemo(
    () => new Set(assignedRowsRaw.map((r) => r.workspace_table_id)),
    [assignedRowsRaw]
  );

  // Filter helper
  const modelPasses = (r: WorkspaceTableRow) => {
    if (modelFilterId === "ALL") return true;
    // r.model_table_id may be null for unmapped workspace tables
    return Number(r.model_table_id) === Number(modelFilterId);
  };

  // Assigned list (filtered)
  const assignedRows = useMemo(
    () => assignedRowsRaw.filter(modelPasses),
    [assignedRowsRaw, modelFilterId]
  );

  // Available list = allRows minus assignedIds, then filtered
  const availableRows = useMemo(() => {
    return allRows
      .filter((r) => !assignedIds.has(r.workspace_table_id))
      .filter(modelPasses);
  }, [allRows, assignedIds, modelFilterId]);

  const addIds = useMemo(
    () => Object.entries(selectedAll).filter(([, v]) => v).map(([k]) => Number(k)),
    [selectedAll]
  );

  const removeIds = useMemo(
    () => Object.entries(selectedAssigned).filter(([, v]) => v).map(([k]) => Number(k)),
    [selectedAssigned]
  );

  const saveM = useMutation({
    mutationFn: () => updateDomainTables(domainId!, { add: addIds, remove: removeIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domainTables"] });
      qc.invalidateQueries({ queryKey: ["workspaceTables"] });
      setSelectedAll({});
      setSelectedAssigned({});
      onClose();
    },
  });

  if (!open || !domain) return null;

  const domainModelName =
    domain.modelTableId != null
      ? modelTables.find((m) => m.id === domain.modelTableId)?.name
      : null;

  return (
    <Modal
      open={open}
      title={`Manage Tables — ${domain.name}${domainModelName ? ` (${domainModelName})` : ""}`}
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

          {/* NEW: Model dropdown */}
          <div className="ms-0 ms-md-2" style={{ minWidth: 260 }}>
            <select
              className="form-select form-select-sm"
              value={modelFilterId === "ALL" ? "" : String(modelFilterId)}
              onChange={(e) => setModelFilterId(e.target.value ? Number(e.target.value) : "ALL")}
              disabled={modelsQ.isLoading}
              title="Filter by model type"
            >
              <option value="">
                {modelsQ.isLoading ? "Loading model types…" : "All model types"}
              </option>

              {modelTables
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="text-muted small ms-auto">
            {assignedRows.length.toLocaleString()} assigned • {availableRows.length.toLocaleString()} available
          </div>
        </div>

        {(allQ.isError || assignedQ.isError || saveM.isError || modelsQ.isError) ? (
          <div className="alert alert-danger py-2 mb-0">
            {((allQ.error || assignedQ.error || saveM.error || modelsQ.error) as Error)?.message}
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

        <div className="text-muted small">
          Tip: filter by <b>Model Type</b> to quickly find the right tables, then click <b>Save Changes</b>.
        </div>
      </div>
    </Modal>
  );
};