import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import type { Domain } from "../../../../shared/services/queryStudioAdminApi";
import {
  applyDomainRecommendations,
  createDomain,
  fetchDomains,
  fetchDomainSummaries,
  generateDomainRecommendations,
} from "../../../../shared/services/queryStudioAdminApi";
import { getApiWorkspaceId } from "../../../../shared/services/api";
import { routes } from "../../../../app/navigation/routes";

import { DomainDrawer } from "./DomainDrawer";
import { DomainRecommendationDrawer } from "./DomainRecommendationDrawer";
import { refreshDomainProfilesForDomains } from "../domainProfileRefresh";
import "../style/domainsTab.css";

export const DomainsTab: React.FC = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const workspaceId = getApiWorkspaceId() ?? "";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Domain | null>(null);
  const [recommendationOpen, setRecommendationOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [description, setDescription] = useState("");
  const [columnNamePolicy, setColumnNamePolicy] = useState<"DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED">(
    "DEDUP_PRIMARY_FIRST"
  );

  const domainsQ = useQuery({ queryKey: ["domains", workspaceId], queryFn: fetchDomains });
  const domains = domainsQ.data?.rows ?? [];

  const sorted = useMemo(
    () => domains.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [domains]
  );

  const createM = useMutation({
    mutationFn: () =>
      createDomain({
        name: name.trim(),
        kind: kind.trim() ? kind.trim() : null,
        description: description.trim() ? description.trim() : null,
        column_name_policy: columnNamePolicy,
      }),
    onSuccess: async (payload) => {
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      await qc.invalidateQueries({ queryKey: ["domains", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries", workspaceId] });
      try {
        await refreshDomainProfilesForDomains([payload.row.id], qc);
        toast.success("Domain created and profile refreshed.");
      } catch (error) {
        toast.warning((error as Error).message);
        toast.success("Domain created.");
      }

      setCreateOpen(false);
      setName("");
      setKind("");
      setDescription("");
      setColumnNamePolicy("DEDUP_PRIMARY_FIRST");
    },
  });

  const recommendationM = useMutation({
    mutationFn: () =>
      generateDomainRecommendations({
        max_domains: 10,
        max_tables: 200,
      }),
    onError: (error) => {
      toast.error((error as Error)?.message || "Unable to generate domain recommendations.");
    },
  });

  const applyRecommendationM = useMutation({
    mutationFn: applyDomainRecommendations,
    onSuccess: async (payload) => {
      await qc.invalidateQueries({ queryKey: ["domains"] });
      await qc.invalidateQueries({ queryKey: ["builderDomains"] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries"] });
      await qc.invalidateQueries({ queryKey: ["workspaceTables"] });
      await qc.invalidateQueries({ queryKey: ["domains", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["domainSummaries", workspaceId] });

      const created = payload.created_domains.length;
      const merged = payload.merged_domains.length;
      const summary =
        created > 0 && merged > 0
          ? `Created ${created} domain${created === 1 ? "" : "s"}, merged ${merged}, assigned ${payload.assigned_tables} table${payload.assigned_tables === 1 ? "" : "s"}.`
          : created > 0
            ? `Created ${created} domain${created === 1 ? "" : "s"} and assigned ${payload.assigned_tables} table${payload.assigned_tables === 1 ? "" : "s"}.`
            : `Applied recommendations and assigned ${payload.assigned_tables} table${payload.assigned_tables === 1 ? "" : "s"}.`;
      try {
        await refreshDomainProfilesForDomains(
          [
            ...payload.created_domains.map((row) => row.domain_id),
            ...payload.merged_domains.map((row) => row.domain_id),
          ],
          qc,
        );
        toast.success(`${summary} Profiles refreshed.`);
      } catch (error) {
        toast.warning((error as Error).message);
        toast.success(summary);
      }
      setRecommendationOpen(false);
    },
    onError: (error) => {
      toast.error((error as Error)?.message || "Unable to apply domain recommendations.");
    },
  });

  function openDrawer(d: Domain) {
    setSelected(d);
    setDrawerOpen(true);
  }

  function openRecommendations() {
    setRecommendationOpen(true);
    if (!recommendationM.isPending) {
      recommendationM.mutate();
    }
  }

  const summariesQ = useQuery({
    queryKey: ["domainSummaries", workspaceId],
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

        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary btn-sm" onClick={openRecommendations}>
            <i className="fa fa-wand-magic-sparkles me-2" />
            Suggest Domains
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            <i className="fa fa-plus me-2" />
            Add Domain
          </button>
        </div>
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
                <th style={{ width: 72 }} className="text-end">
                  Structure
                </th>
              </tr>
            </thead>

            <tbody>
              {domainsQ.isLoading ? (
                <tr>
                  <td colSpan={7} className="p-3 text-muted">
                    Loading…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-3 text-muted">
                    No domains yet.
                  </td>
                </tr>
              ) : (
                sorted.map((d: Domain & any) => {
                  const canEdit = d.can_edit === true || d.can_edit === 1;
                  const modelName = d.modelTableName ?? d.model_table_name ?? "—";

                  return (
                    <tr key={d.id} className="domains-clickable" onClick={() => openDrawer(d)}>
                      <td className="fw-semibold">{d.name}</td>

                      <td className="text-muted">
                        {modelName}
                      </td>

                      <td className="text-muted">{d.kind ?? "—"}</td>
                      <td className="text-muted">
                        <span
                          className="domains-description-singleline"
                          title={d.description ?? "—"}
                        >
                          {d.description ?? "—"}
                        </span>
                      </td>

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

                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          title="Edit graph"
                          aria-label={`Edit graph for ${d.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(
                              routes.NoCodeAdminDomainGraphEditor.replace(
                                ":domainId",
                                String(d.id)
                              )
                            );
                          }}
                        >
                          <i className="fa fa-sitemap" />
                        </button>
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
                    <div className="form-text small text-muted">
                      Domain mappings are workspace-table based.
                    </div>
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
      <DomainRecommendationDrawer
        open={recommendationOpen}
        onClose={() => setRecommendationOpen(false)}
        onGenerate={() => recommendationM.mutate()}
        onApply={(payload) => applyRecommendationM.mutate(payload)}
        isLoading={recommendationM.isPending}
        isApplying={applyRecommendationM.isPending}
        error={recommendationM.isError ? (recommendationM.error as Error)?.message || "Unable to generate recommendations." : null}
        data={recommendationM.data ?? null}
        existingDomainNames={domains.map((domain) => domain.name)}
      />
    </div>
  );
};
