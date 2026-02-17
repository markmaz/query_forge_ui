// ListManagementPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import ListSectionCard, { ListRow, SectionKey } from "./components/ListSectionCard";
import UploadWizardModal, { UploadResult } from "./components/UploadWizardModal";
import PreviewListDrawer, { PreviewContext } from "./components/PreviewListDrawer";

import {
  getTemplate,
  uploadListFile,
  fetchValueOverrideIndex,
  fetchValueOverridePreview,
  toListRow,
  deleteValueOverride,
  patchValueOverrideVisibility,
  ValueOverrideMutationError,
  normalizeValueOverrideMutationError,
} from "../../../shared/services/valueOverride";
import { getVisibleValueOverrides } from "../../../shared/services/noCodeAdminApi";
import { useAppSelector } from "../../../shared/lib/hooks";
import { toast } from "react-toastify";

import type { ValueOverrideType, ValueOverridePreviewResponse } from "../model/valueOverrideSchemas";

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: "regions", title: "Data Overrides" },
  { key: "serviceLines", title: "Custom Filters" },
];

const getFilenameFromContentDisposition = (cd?: string) => {
  if (!cd) return null;
  const match = cd.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
};

export const downloadTemplate = async (templateType: ValueOverrideType) => {
  const res = await getTemplate(templateType);

  const ct = (res.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
    const text = await res.data.text();
    throw new Error(`Unexpected content-type: ${ct}. Body: ${text}`);
  }

  const filename =
    getFilenameFromContentDisposition(res.headers["content-disposition"]) ??
    `${templateType}_template.xlsx`;

  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export default function ListManagementPage() {
  const currentUserId = useAppSelector((state) => state.user.user?.user_id ?? null);
  const [data, setData] = useState<Record<SectionKey, ListRow[]>>({
    regions: [],
    npiCategories: [],
    serviceLines: [],
  });

  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    regions: false,
    npiCategories: false,
    serviceLines: false,
  });

  const expandAll = () => setCollapsed({ regions: false, npiCategories: false, serviceLines: false });
  const collapseAll = () => setCollapsed({ regions: true, npiCategories: true, serviceLines: true });
  const toggleSection = (section: SectionKey) => setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));

  // Preview drawer
  const [previewCtx, setPreviewCtx] = useState<PreviewContext | null>(null);

  // If your PreviewListDrawer needs the preview payload, store it here:
  const [previewData, setPreviewData] = useState<ValueOverridePreviewResponse | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Upload wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialFile, setWizardInitialFile] = useState<File | null>(null);
  const [wizardSection, setWizardSection] = useState<SectionKey>("regions");

  //Delete Open
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ section: SectionKey; row: ListRow } | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Page loading
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const sectionTitleByKey = useMemo(() => {
    const m = new Map<SectionKey, string>();
    SECTIONS.forEach(s => m.set(s.key, s.title));
    return m;
  }, []);

  const openWizard = (section: SectionKey, file?: File) => {
    setWizardSection(section);
    setWizardInitialFile(file ?? null);
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardInitialFile(null);
    setWizardSection("regions");
  };

  const onGenerateTemplate = (section: SectionKey) => {
    // SectionKey == ValueOverrideType string union; cast keeps it strict
    void downloadTemplate(section as ValueOverrideType);
  };

  const refreshIndex = async () => {
    setLoading(true);
    setPageError(null);

    try {
      const index = await fetchValueOverrideIndex(false);

      const next: Record<SectionKey, ListRow[]> = {
        regions: [],
        npiCategories: [],
        serviceLines: [],
      };

      (Object.keys(next) as SectionKey[]).forEach((k) => {
        const prevById = new Map(data[k].map((row) => [row.id, row]));
        const rows = (index as any)[k] ?? [];
        next[k] = rows.map((meta: any) => {
          const mapped = toListRow(meta, k);
          const prev = prevById.get(mapped.id);
          return prev ? { ...mapped, isShared: mapped.isShared ?? prev.isShared } : mapped;
        });
      });

      // sort by updated desc (optional)
      (Object.keys(next) as SectionKey[]).forEach(k => {
        next[k].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      });

      setData(next);
    } catch (e: any) {
      setPageError(e?.message ?? "Failed to load lists.");
    } finally {
      setLoading(false);
    }
  };

  const refreshVisibility = async () => {
    try {
      await getVisibleValueOverrides(true);
    } catch {
      // ignore visibility refresh errors here
    }
  };

  const updateRowShared = (section: SectionKey, listId: string, isShared: boolean) => {
    setData((prev) => ({
      ...prev,
      [section]: prev[section].map((row) =>
        row.id === listId ? { ...row, isShared } : row
      ),
    }));
  };

  useEffect(() => {
    void refreshIndex();
  }, []);

  // ✅ Preview click: fetch preview + open drawer
  const onPreview = async (section: SectionKey, row: ListRow) => {
    setPreviewError(null);
    setPreviewData(null);
    setPreviewBusy(true);

    // open drawer immediately with context, show spinner inside drawer
    setPreviewCtx({
      section,
      sectionTitle: sectionTitleByKey.get(section) ?? section,
      row,
    });

    try {
      const preview = await fetchValueOverridePreview(section as ValueOverrideType, row.id, {
        limit: 100,
        offset: 0,
        includeExpired: false,
      });
      setPreviewData(preview);
    } catch (e: any) {
      setPreviewError(e?.message ?? "Failed to load preview.");
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleValueOverrideMutationError = async (error: unknown) => {
    const parsed = normalizeValueOverrideMutationError(error);
    if (parsed.code === "permission_denied") {
      toast.error("You do not have permission to modify this list.");
    } else if (parsed.code === "not_found") {
      toast.error("List no longer exists.");
    } else {
      toast.error(parsed.message || "List mutation failed.");
    }
    await refreshIndex();
  };

  // Wizard success handler: refresh index (source of truth)
  const onWizardSuccess = async (r: UploadResult) => {
    if (r.status !== "SUCCESS") return;

    // You *can* do optimistic add, but refresh is safer (matches DB)
    await refreshIndex();

    // Ensure the inferred section is expanded
    setCollapsed(prev => ({ ...prev, [r.inferredType]: false }));
  };

  const openDelete = (section: SectionKey, row: ListRow) => {
    setDeleteTarget({ section, row });
    setDeleteText("");
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeleteTarget(null);
    setDeleteText("");
    setDeleteError(null);
    setDeleteBusy(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteText !== "Delete") return;
    if (!currentUserId || deleteTarget.row.userId !== currentUserId) {
      await handleValueOverrideMutationError(
        new ValueOverrideMutationError("permission_denied", "You do not have permission to modify this list.", 403)
      );
      closeDelete();
      return;
    }

    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await deleteValueOverride(deleteTarget.section as ValueOverrideType, deleteTarget.row.id);
      await refreshIndex();
      closeDelete();
    } catch (e) {
      await handleValueOverrideMutationError(e);
      closeDelete();
    }
  };

  return (
    <div className="container-fluid py-3">
      {/* Expand/Collapse all */}
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <div>
          {pageError && (
            <div className="alert alert-danger py-2 mb-0">
              <div className="small">{pageError}</div>
            </div>
          )}
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={expandAll}
            title="Expand all sections"
            disabled={loading}
          >
            <i className="fa fa-expand me-1" aria-hidden="true" />
            Expand All
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={collapseAll}
            title="Collapse all sections"
            disabled={loading}
          >
            <i className="fa fa-compress me-1" aria-hidden="true" />
            Collapse All
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => void refreshIndex()}
            title="Refresh"
            disabled={loading}
          >
            <i className={"fa fa-rotate-right me-1" + (loading ? " fa-spin" : "")} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="row g-3">
        {SECTIONS.map(s => (
          <div className="col-12" key={s.key}>
            <ListSectionCard
              section={s.key}
              title={s.title}
              rows={data[s.key]}
              collapsed={collapsed[s.key]}
              onToggle={() => toggleSection(s.key)}
              onGenerateTemplate={() => onGenerateTemplate(s.key)}
              onUploadClick={(file?: File) => openWizard(s.key, file)}
              onPreview={row => void onPreview(s.key, row)}
              loading={loading}
              currentUserId={currentUserId}
              onDelete={(row) => {
                if (!currentUserId || row.userId !== currentUserId) return;
                openDelete(s.key, row);
              }}
            />
          </div>
        ))}
      </div>

      {/* Upload Wizard */}
      <UploadWizardModal
        open={wizardOpen}
        section={wizardSection}
        initialFile={wizardInitialFile}
        onClose={closeWizard}
        onSuccess={onWizardSuccess}
        uploadAndValidate={(file, listName, isShared) =>
          uploadListFile(wizardSection as ValueOverrideType, file, listName, isShared)
        }
      />

      {/* Preview Drawer */}
      <PreviewListDrawer
        context={previewCtx}
        onClose={() => {
          setPreviewCtx(null);
          setPreviewData(null);
          setPreviewError(null);
          setPreviewBusy(false);
        }}
        onSharedUpdated={(section, listId, isShared) => {
          updateRowShared(section, listId, isShared);
          void refreshIndex();
          void refreshVisibility();
        }}
        onSharedToggle={async (section, listId, isShared) => {
          if (!currentUserId) return;
          const row = data[section].find((entry) => entry.id === listId);
          if (!row || row.userId !== currentUserId) {
            await handleValueOverrideMutationError(
              new ValueOverrideMutationError("permission_denied", "You do not have permission to modify this list.", 403)
            );
            throw new Error("Not permitted");
          }
          try {
            await patchValueOverrideVisibility(section as ValueOverrideType, listId, isShared);
          } catch (error) {
            await handleValueOverrideMutationError(error);
            throw error;
          }
        }}
        currentUserId={currentUserId}
        // If your drawer supports these props, wire them in:
        data={previewData}
        loading={previewBusy}
        error={previewError}
        offset={0}
      />
          {/* ✅ Delete Confirm Modal */}
      {deleteOpen && deleteTarget && (
        <>
          <div className="modal fade show" style={{ display: "block" }} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title mb-0">Delete list</h5>
                    <div className="text-muted small">
                      {(sectionTitleByKey.get(deleteTarget.section) ?? deleteTarget.section)} • {deleteTarget.row.name}
                    </div>
                  </div>
                  <button type="button" className="btn-close" onClick={closeDelete} disabled={deleteBusy} />
                </div>

                <div className="modal-body">
                  <div className="alert alert-warning">
                    <div className="fw-semibold">
                      This will permanently delete this list.
                    </div>
                    <div className="small mb-0">
                      Type <span className="fw-semibold">Delete</span> to confirm.
                    </div>
                  </div>

                  <input
                    className="form-control"
                    value={deleteText}
                    onChange={e => setDeleteText(e.target.value)}
                    placeholder='Type "Delete"'
                    disabled={deleteBusy}
                    autoFocus
                  />

                  {deleteError && (
                    <div className="alert alert-danger mt-3 mb-0 py-2">
                      <div className="small">{deleteError}</div>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeDelete} disabled={deleteBusy}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void confirmDelete()}
                    disabled={deleteBusy || deleteText !== "Delete"}
                    title={deleteText !== "Delete" ? 'Type "Delete" to enable' : "Delete list"}
                  >
                    <i className={"fa fa-trash me-1" + (deleteBusy ? " fa-spin" : "")} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-backdrop fade show" onClick={deleteBusy ? undefined : closeDelete} />
        </>
      )}  
    </div>
  );
}
