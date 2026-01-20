import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ListRow, SectionKey } from "./ListSectionCard";
import type { CrosswalkPreviewResponse } from "../../model/crosswalkSchemas";
import { patchCrosswalkVisibility } from "../../../../shared/api/crosswalk";
import { toast } from "react-toastify";

export type PreviewContext = {
  section: SectionKey;
  sectionTitle: string;
  row: ListRow;
};

export default function PreviewListDrawer({
  context,
  onClose,
  data,
  loading,
  error,
  offset = 0,
  onSharedUpdated,
}: {
  context: PreviewContext | null;
  onClose: () => void;
  data?: CrosswalkPreviewResponse | null;
  loading?: boolean;
  error?: string | null;
  offset?: number;
  onSharedUpdated?: (section: SectionKey, listId: string, isShared: boolean) => void;
}) {
  const open = Boolean(context);
  const [shared, setShared] = useState(false);
  const [sharedBusy, setSharedBusy] = useState(false);

  // ✅ Hooks must ALWAYS run (no early return before them)
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

  useEffect(() => {
    if (!context) return;
    setShared(Boolean(context.row.isShared));
  }, [context]);

  const summaryText = useMemo(() => {
    if (!data) return null;

    const shown = data.rows.length;
    const total = data.totalRows ?? shown;

    return `Showing ${shown} of ${Math.max(total, shown)} rows`;
  }, [data, offset]);

  // ✅ Early return AFTER hooks
  if (!open || !context) return null;

  const { sectionTitle, row } = context;

  const onToggleShared = async () => {
    if (sharedBusy) return;
    if (!context) return;

    const section = context.section;
    const listId = context.row.id;

    const prevShared = shared;
    const nextShared = !prevShared;

    setShared(nextShared);
    setSharedBusy(true);

    try {
      await patchCrosswalkVisibility(section as any, listId, nextShared);
      onSharedUpdated?.(section, listId, nextShared);
    } catch (e: any) {
      setShared(prevShared);
      toast.error(String(e?.message ?? e ?? "Failed to update shared status."));
      // optional: console for debugging
      console.error("patchCrosswalkVisibility failed:", e);
    } finally {
      setSharedBusy(false);
    }
  };

  return createPortal(
    <>
      <div className="offcanvas-backdrop fade show" onClick={onClose} />

      <div
        className="offcanvas offcanvas-end show list-preview-offcanvas"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{ position: "fixed", width: 640 }}
      >
        <div className="offcanvas-header border-bottom">
          <div>
            <h5 className="offcanvas-title mb-0">Preview</h5>
            <div className="text-muted small">
              {sectionTitle} • {row.name}
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>

        <div className="offcanvas-body">
          <div className="row g-3 mb-3">
            <div className="col-6">
              <div className="small text-muted">Owner</div>
              <div className="fw-medium">{row.owner}</div>
            </div>
            <div className="col-6">
              <div className="small text-muted">Created</div>
              <div className="fw-medium">{row.createdAt}</div>
            </div>
            <div className="col-12">
              <div className="small text-muted">Last Updated</div>
              <div className="fw-medium">{row.updatedAt}</div>
            </div>
            <div className="col-12">
              <label className="form-check form-switch m-0 d-flex align-items-center gap-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={shared}
                  onChange={onToggleShared}
                  disabled={sharedBusy}
                />
                <span className="form-check-label">Shared with workspace</span>
                {sharedBusy ? <span className="spinner-border spinner-border-sm" /> : null}
              </label>
            </div>
          </div>

          <hr />

          {loading && (
            <div className="d-flex align-items-center gap-2 text-muted">
              <div className="spinner-border spinner-border-sm" />
              Loading preview…
            </div>
          )}

          {error && (
            <div className="alert alert-danger py-2">
              <div className="small">{error}</div>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {summaryText && <div className="small text-muted mb-2">{summaryText}</div>}

              {(data.rows?.length ?? 0) === 0 ? (
                <div className="text-muted">No rows to preview.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        {data.columns.map(col => (
                          <th key={col.name}>{col.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, idx) => (
                        <tr key={idx}>
                          {data.columns.map(col => (
                            <td key={col.name}>{String((r as any)[col.name] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-top p-3 d-flex justify-content-end">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
