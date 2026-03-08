import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import {
  useDomainProfileList,
  useCreateDomainProfile,
  useUpdateDomainProfile,
  useDeleteDomainProfile,
} from "@/features/system-admin/hooks";
import { reindexDomainVectors } from "@/features/system-admin/api";
import type {
  DomainProfile,
  DomainProfileCreateRequest,
  DomainProfileUpdateRequest,
} from "@/features/system-admin/types";
import DomainProfileForm from "./DomainProfileForm";
import "../systemAdmin.css";

type SortKey =
  | "domain_name"
  | "domain_id"
  | "summary"
  | "keywords"
  | "entities"
  | "metrics"
  | "updated_at";

type SortDir = "asc" | "desc";

export default function DomainProfileList() {
  const { data, isLoading, isError, error } = useDomainProfileList();
  const createMut = useCreateDomainProfile();
  const updateMut = useUpdateDomainProfile();
  const deleteMut = useDeleteDomainProfile();

  const [drawerProfile, setDrawerProfile] = useState<DomainProfile | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<DomainProfile | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("domain_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const profiles = data?.profiles ?? [];

  const sorted = useMemo(() => {
    const list = [...profiles];
    list.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "domain_name":
          av = a.domain_name ?? "";
          bv = b.domain_name ?? "";
          break;
        case "domain_id":
          av = a.domain_id;
          bv = b.domain_id;
          break;
        case "summary":
          av = a.summary ?? "";
          bv = b.summary ?? "";
          break;
        case "keywords":
          av = a.keywords?.length ?? 0;
          bv = b.keywords?.length ?? 0;
          break;
        case "entities":
          av = a.entities?.length ?? 0;
          bv = b.entities?.length ?? 0;
          break;
        case "metrics":
          av = a.metrics?.length ?? 0;
          bv = b.metrics?.length ?? 0;
          break;
        case "updated_at":
          av = a.updated_at ?? "";
          bv = b.updated_at ?? "";
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [profiles, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return "fa-sort";
    return sortDir === "asc" ? "fa-sort-up" : "fa-sort-down";
  }

  function promptRebuild() {
    const rebuild = window.confirm("Rebuild domain vectors now?");
    if (rebuild) {
      reindexDomainVectors({ vertical_norm: "education" }).then(
        () => toast.success("Domain vector reindex started"),
        () => toast.error("Failed to start vector reindex"),
      );
    }
  }

  function handleSave(formData: DomainProfileCreateRequest | DomainProfileUpdateRequest) {
    if (drawerProfile === "new") {
      createMut.mutate(formData as DomainProfileCreateRequest, {
        onSuccess: () => {
          toast.success("Domain profile created");
          setDrawerProfile(null);
          promptRebuild();
        },
        onError: (err) => toast.error(`Create failed: ${err.message}`),
      });
    } else if (drawerProfile) {
      updateMut.mutate(
        { domainId: drawerProfile.domain_id, body: formData as DomainProfileUpdateRequest },
        {
          onSuccess: () => {
            toast.success("Domain profile updated");
            setDrawerProfile(null);
            promptRebuild();
          },
          onError: (err) => toast.error(`Update failed: ${err.message}`),
        },
      );
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.domain_id, {
      onSuccess: () => {
        toast.success("Domain profile deleted");
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(`Delete failed: ${err.message}`),
    });
  }

  if (isLoading) {
    return (
      <div className="sa-loading">
        <span className="sa-spinner lg" />
        Loading domain profiles…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sa-loading">
        <i className="fa fa-exclamation-triangle" style={{ color: "#ef4444", fontSize: "1.4rem" }} />
        Failed to load domain profiles
        {error instanceof Error && `: ${error.message}`}
      </div>
    );
  }

  const MAX_TAGS = 5;

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Domain Profiles</h1>
          <p className="sa-page-subtitle">
            {profiles.length} profile{profiles.length !== 1 && "s"}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setDrawerProfile("new")}>
          <i className="fa fa-plus" /> Create Profile
        </button>
      </div>

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("domain_name")}>
                Domain Name <i className={`fa ${sortIcon("domain_name")}`} />
              </th>
              <th onClick={() => toggleSort("domain_id")}>
                Domain ID <i className={`fa ${sortIcon("domain_id")}`} />
              </th>
              <th onClick={() => toggleSort("summary")}>
                Summary <i className={`fa ${sortIcon("summary")}`} />
              </th>
              <th onClick={() => toggleSort("keywords")}>
                Keywords <i className={`fa ${sortIcon("keywords")}`} />
              </th>
              <th onClick={() => toggleSort("entities")}>
                Entities <i className={`fa ${sortIcon("entities")}`} />
              </th>
              <th onClick={() => toggleSort("metrics")}>
                Metrics <i className={`fa ${sortIcon("metrics")}`} />
              </th>
              <th onClick={() => toggleSort("updated_at")}>
                Last Updated <i className={`fa ${sortIcon("updated_at")}`} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="expandable" onClick={() => setDrawerProfile(p)}>
                <td>{p.domain_name ?? "—"}</td>
                <td>{p.domain_id}</td>
                <td>
                  <span className="sa-truncate" title={p.summary ?? ""}>
                    {p.summary ?? "—"}
                  </span>
                </td>
                <td>
                  <div className="sa-tags">
                    {(p.keywords ?? []).slice(0, MAX_TAGS).map((kw) => (
                      <span key={kw} className="sa-tag">{kw}</span>
                    ))}
                    {(p.keywords?.length ?? 0) > MAX_TAGS && (
                      <span className="sa-tag sa-tag-more">
                        +{(p.keywords!.length - MAX_TAGS)} more
                      </span>
                    )}
                  </div>
                </td>
                <td>{p.entities?.length ?? 0}</td>
                <td>{p.metrics?.length ?? 0}</td>
                <td>{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}</td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    title={`Delete ${p.domain_name ?? `Domain ${p.domain_id}`}`}
                    aria-label={`Delete ${p.domain_name ?? `Domain ${p.domain_id}`}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(p);
                    }}
                  >
                    <i className="fa fa-trash" />
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
                  No domain profiles found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawerProfile !== null && (
        <DomainProfileForm
          profile={drawerProfile === "new" ? null : drawerProfile}
          onSave={handleSave}
          onCancel={() => setDrawerProfile(null)}
          busy={createMut.isPending || updateMut.isPending}
        />
      )}

      {deleteTarget && (
        <div className="sa-dialog-backdrop">
          <div className="sa-dialog">
            <div className="sa-dialog-header">
              <span>Confirm Delete</span>
              <button className="btn btn-sm btn-light" onClick={() => setDeleteTarget(null)}>
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="sa-dialog-body">
              Delete the domain profile for{" "}
              <strong>{deleteTarget.domain_name ?? `Domain ${deleteTarget.domain_id}`}</strong>?
              This action cannot be undone.
            </div>
            <div className="sa-dialog-footer">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMut.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={confirmDelete}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending && <span className="sa-spinner" style={{ marginRight: 6 }} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
