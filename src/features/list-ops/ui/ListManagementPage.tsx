// ListManagementPage.tsx
import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ListSectionCard, {
  ListRow,
  SectionKey,
} from "./components/ListSectionCard";
import UploadWizardModal, {
  UploadResult,
} from "./components/UploadWizardModal";
import PreviewListDrawer, {
  PreviewContext,
} from "./components/PreviewListDrawer";

import {
  uploadListFile,
  fetchValueOverrideIndex,
  fetchValueOverridePreview,
  toListRow,
  deleteValueOverride,
  patchValueOverrideVisibility,
  ValueOverrideMutationError,
  normalizeValueOverrideMutationError,
} from "../../../shared/services/valueOverride";
import { getVisibleValueOverrides } from "../../../shared/services/queryStudioAdminApi";
import { useAppSelector } from "../../../shared/runtime/hooks";
import { toast } from "react-toastify";
import "../../query-forge/ui/styles/queryForgeHero.css";

import type {
  ValueOverrideType,
  ValueOverridePreviewResponse,
} from "../model/valueOverrideSchemas";

const VALUE_OVERRIDE_INDEX_KEY = ["value-override-index"] as const;

const DEFAULT_DATA: Record<SectionKey, ListRow[]> = {
  regions: [],
  npiCategories: [],
  serviceLines: [],
};

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: "regions", title: "Data Overrides" },
  { key: "serviceLines", title: "Custom Filters" },
];

export default function ListManagementPage() {
  const currentUserId = useAppSelector(
    (state) => state.user.user?.user_id ?? null,
  );
  const queryClient = useQueryClient();

  const {
    data = DEFAULT_DATA,
    isLoading: loading,
    error: queryError,
  } = useQuery<Record<SectionKey, ListRow[]>>({
    queryKey: VALUE_OVERRIDE_INDEX_KEY,
    queryFn: async () => {
      const index = await fetchValueOverrideIndex(false);
      const next: Record<SectionKey, ListRow[]> = {
        regions: [],
        npiCategories: [],
        serviceLines: [],
      };
      (Object.keys(next) as SectionKey[]).forEach((k) => {
        const rows = (index as any)[k] ?? [];
        next[k] = rows.map((meta: any) => toListRow(meta, k));
      });
      (Object.keys(next) as SectionKey[]).forEach((k) => {
        next[k].sort((a, b) =>
          String(b.updatedAt).localeCompare(String(a.updatedAt)),
        );
      });
      return next;
    },
  });

  const pageError = queryError
    ? ((queryError as Error).message ?? "Failed to load lists.")
    : null;

  const refreshIndex = () =>
    queryClient.invalidateQueries({ queryKey: VALUE_OVERRIDE_INDEX_KEY });

  const updateRowShared = (
    section: SectionKey,
    listId: string,
    isShared: boolean,
  ) => {
    queryClient.setQueryData<Record<SectionKey, ListRow[]>>(
      VALUE_OVERRIDE_INDEX_KEY,
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [section]: prev[section].map((row) =>
            row.id === listId ? { ...row, isShared } : row,
          ),
        };
      },
    );
  };

  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    regions: false,
    npiCategories: false,
    serviceLines: false,
  });

  const expandAll = () =>
    setCollapsed({ regions: false, npiCategories: false, serviceLines: false });
  const collapseAll = () =>
    setCollapsed({ regions: true, npiCategories: true, serviceLines: true });
  const toggleSection = (section: SectionKey) =>
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));

  // Preview drawer
  const [previewCtx, setPreviewCtx] = useState<PreviewContext | null>(null);

  // If your PreviewListDrawer needs the preview payload, store it here:
  const [previewData, setPreviewData] =
    useState<ValueOverridePreviewResponse | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Upload wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialFile, setWizardInitialFile] = useState<File | null>(null);
  const [wizardSection, setWizardSection] = useState<SectionKey>("regions");

  //Delete Open
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    section: SectionKey;
    row: ListRow;
  } | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sectionTitleByKey = useMemo(() => {
    const m = new Map<SectionKey, string>();
    SECTIONS.forEach((s) => m.set(s.key, s.title));
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

  const refreshVisibility = async () => {
    try {
      await getVisibleValueOverrides(true);
    } catch {
      // ignore visibility refresh errors here
    }
  };

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
      const preview = await fetchValueOverridePreview(
        section as ValueOverrideType,
        row.id,
        {
          limit: 100,
          offset: 0,
          includeExpired: false,
        },
      );
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
    setCollapsed((prev) => ({ ...prev, [r.inferredType]: false }));
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
        new ValueOverrideMutationError(
          "permission_denied",
          "You do not have permission to modify this list.",
          403,
        ),
      );
      closeDelete();
      return;
    }

    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await deleteValueOverride(
        deleteTarget.section as ValueOverrideType,
        deleteTarget.row.id,
      );
      await refreshIndex();
      closeDelete();
    } catch (e) {
      await handleValueOverrideMutationError(e);
      closeDelete();
    }
  };

  return (
    <div className="container-fluid py-3">
      <header className="qf-hero mb-3">
        <div className="qf-hero-main">
          <h1 className="qf-hero-title">Data Mappings</h1>
          <p className="qf-hero-subtitle mb-0">
            Manage reusable mapping lists and custom filters used across Query
            Forge workflows.
          </p>
        </div>
        <div className="qf-hero-actions">
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
            <i
              className={
                "fa fa-rotate-right me-1" + (loading ? " fa-spin" : "")
              }
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </header>

      {pageError && (
        <div className="alert alert-danger py-2 mb-3">
          <div className="small">{pageError}</div>
        </div>
      )}

      <div className="row g-3">
        {SECTIONS.map((s) => (
          <div className="col-12" key={s.key}>
            <ListSectionCard
              section={s.key}
              title={s.title}
              rows={data[s.key]}
              collapsed={collapsed[s.key]}
              onToggle={() => toggleSection(s.key)}
              onUploadClick={(file?: File) => openWizard(s.key, file)}
              onPreview={(row) => void onPreview(s.key, row)}
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
          uploadListFile(
            wizardSection as ValueOverrideType,
            file,
            listName,
            isShared,
          )
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
              new ValueOverrideMutationError(
                "permission_denied",
                "You do not have permission to modify this list.",
                403,
              ),
            );
            throw new Error("Not permitted");
          }
          try {
            await patchValueOverrideVisibility(
              section as ValueOverrideType,
              listId,
              isShared,
            );
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
          <div
            className="modal fade show"
            style={{ display: "block" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title mb-0">Delete list</h5>
                    <div className="text-muted small">
                      {sectionTitleByKey.get(deleteTarget.section) ??
                        deleteTarget.section}{" "}
                      • {deleteTarget.row.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeDelete}
                    disabled={deleteBusy}
                  />
                </div>

                <div className="modal-body">
                  <div className="alert alert-warning">
                    <div className="fw-semibold">
                      This will permanently delete this list.
                    </div>
                    <div className="small mb-0">
                      Type <span className="fw-semibold">Delete</span> to
                      confirm.
                    </div>
                  </div>

                  <input
                    className="form-control"
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
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
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={closeDelete}
                    disabled={deleteBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void confirmDelete()}
                    disabled={deleteBusy || deleteText !== "Delete"}
                    title={
                      deleteText !== "Delete"
                        ? 'Type "Delete" to enable'
                        : "Delete list"
                    }
                  >
                    <i
                      className={
                        "fa fa-trash me-1" + (deleteBusy ? " fa-spin" : "")
                      }
                      aria-hidden="true"
                    />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            className="modal-backdrop fade show"
            onClick={deleteBusy ? undefined : closeDelete}
          />
        </>
      )}
    </div>
  );
}
