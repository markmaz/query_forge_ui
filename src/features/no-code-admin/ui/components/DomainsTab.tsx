import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Domain, ModelTableRow } from "../../../../shared/api/noCodeAdminApi";
import {
  createDomain,
  fetchDomains,
  fetchDomainSummaries,
  fetchModelTables,
} from "../../../../shared/api/noCodeAdminApi";

import { DomainDrawer } from "./DomainDrawer";
import "../style/domainsTab.css";

export const DomainsTab: React.FC = () => {
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Domain | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [description, setDescription] = useState("");
  const [modelTableId, setModelTableId] = useState<number | null>(null);
  const [columnNamePolicy, setColumnNamePolicy] = useState<"DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED">(
    "DEDUP_PRIMARY_FIRST"
  );

  const domainsQ = useQuery({ queryKey: ["domains"], queryFn: fetchDomains });
  const domains = domainsQ.data?.rows ?? [];

  const sorted = useMemo(
    () => domains.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [domains]
  );

  // ✅ Fetch models for BOTH:
  //  - create modal dropdown
  //  - listing model name column
  // Keep it lightweight, but big enough to cover your models list.
  const modelsQ = useQuery({
    queryKey: ["modelTables", { q: "" }],
    queryFn: () => fetchModelTables({ limit: 5000, offset: 0 }),
  });

  const modelTables: ModelTableRow[] = modelsQ.data?.rows ?? [];

  const modelNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of modelTables) m.set(r.id, r.name);
    return m;
  }, [modelTables]);

  const createM = useMutation({
    mutationFn: () =>
      createDomain({
        name: name.trim(),
        kind: kind.trim() ? kind.trim() : null,
        description: description.trim() ? description.trim() : null,
        model_table_id: modelTableId,
        column_name_policy: columnNamePolicy,
      } as any),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });

      setCreateOpen(false);
      setName("");
      setKind("");
      setDescription("");
      setModelTableId(null);
      setColumnNamePolicy("DEDUP_PRIMARY_FIRST");
    },
  });

  function openDrawer(d: Domain) {
    setSelected(d);
    setDrawerOpen(true);
  }

  const summariesQ = useQuery({
    queryKey: ["domainSummaries"],
    queryFn: () => fetchDomainSummaries({ sample_size: 2 }),
  });

  const summaryById = useMemo(() => {
    const m = new Map<number, { table_count: number; table_sample: string[] }>();
    (summariesQ.data?.rows ?? []).forEach((r: any) =>
      m.set(r.id, { table_count: r.table_count, table_sample: r.table_sample })
    );
    return m;
  }, [summariesQ.data]);

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="fw-semibold">Domains</div>
          <div className="text-muted small">
            Organize tables and user access for the AI-assisted query builder.
          </div>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
          <i className="fa fa-plus me-2" />
          Add Domain
        </button>
      </div>

      {domainsQ.isError ? (
        <div className="alert alert-danger py-2">{(domainsQ.error as Error).message}</div>
      ) : null}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover table-sm mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 240 }}>Name</th>
                <th style={{ width: 220 }}>Model</th>
                <th style={{ width: 160 }}>Kind</th>
                <th>Description</th>
                <th style={{ width: 360 }}>Tables</th>
                <th style={{ width: 120 }} className="text-end">
                  Access
                </th>
              </tr>
            </thead>

            <tbody>
              {domainsQ.isLoading ? (
                <tr>
                  <td colSpan={6} className="p-3 text-muted">
                    Loading…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-muted">
                    No domains yet.
                  </td>
                </tr>
              ) : (
                sorted.map((d: Domain & any) => {
                  const canEdit = d.can_edit === true || d.can_edit === 1;
                  const modelName =
                    d.model_table_id != null ? modelNameById.get(d.model_table_id) ?? `#${d.model_table_id}` : "—";

                  return (
                    <tr key={d.id} className="domains-clickable" onClick={() => openDrawer(d)}>
                      <td className="fw-semibold">{d.name}</td>

                      <td className="text-muted">
                        {modelsQ.isLoading ? "…" : modelName}
                      </td>

                      <td className="text-muted">{d.kind ?? "—"}</td>
                      <td className="text-muted">{d.description ?? "—"}</td>

                      <td>
                        {(() => {
                          const s = summaryById.get(d.id);
                          const count = s?.table_count ?? 0;
                          const sample = s?.table_sample ?? [];
                          const show = sample.slice(0, 2);
                          const remaining = Math.max(0, count - show.length);

                          return (
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <span className={`badge ${count ? "bg-info" : "bg-secondary"}`}>{count}</span>

                              {show.map((t) => (
                                <span key={t} className="badge text-bg-light border">
                                  {t}
                                </span>
                              ))}

                              {remaining > 0 ? <span className="text-muted small">+{remaining} more</span> : null}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="text-end">
                        <span className={`badge ${canEdit ? "bg-primary" : "bg-secondary"}`}>
                          {canEdit ? "Editor" : "Reader"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Domain */}
      {createOpen ? (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <div className="modal-title fw-semibold">Add Domain</div>
                  <button className="btn-close" onClick={() => setCreateOpen(false)} />
                </div>

                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Name *</label>
                    <input className="form-control form-control-sm" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Model Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={modelTableId == null ? "" : String(modelTableId)}
                      onChange={(e) => setModelTableId(e.target.value ? Number(e.target.value) : null)}
                      disabled={modelsQ.isLoading || createM.isPending}
                    >
                      <option value="">{modelsQ.isLoading ? "Loading model tables…" : "None"}</option>
                      {modelTables
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>

                    {modelsQ.isError ? (
                      <div className="form-text text-danger small">
                        {(modelsQ.error as Error)?.message || "Failed to load model tables."}
                      </div>
                    ) : (
                      <div className="form-text small text-muted">Optional, but recommended.</div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Kind</label>
                    <input className="form-control form-control-sm" value={kind} onChange={(e) => setKind(e.target.value)} />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Column name policy</label>
                    <select
                      className="form-select form-select-sm"
                      value={columnNamePolicy}
                      onChange={(e) =>
                        setColumnNamePolicy(e.target.value as "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED")
                      }
                      disabled={createM.isPending}
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
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {createM.isError ? (
                    <div className="alert alert-danger py-2 mt-3 mb-0">{(createM.error as Error).message}</div>
                  ) : null}
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setCreateOpen(false)} disabled={createM.isPending}>
                    Close
                  </button>
                  <button className="btn btn-primary btn-sm" disabled={!name.trim() || createM.isPending} onClick={() => createM.mutate()}>
                    {createM.isPending ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-backdrop fade show" onClick={() => setCreateOpen(false)} />
        </>
      ) : null}

      <DomainDrawer open={drawerOpen} domain={selected} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};
