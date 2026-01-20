import React, { useEffect, useRef } from "react";

export function ExportExcelDialog(props: {
  open: boolean;
  title: string;
  fileName: string;
  onChangeFileName: (next: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { open, title, fileName, onChangeFileName, onConfirm, onClose } = props;

  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 2000,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "16%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 520,
          zIndex: 2001,
        }}
      >
        <div className="bg-white border rounded shadow">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div className="fw-semibold">{title}</div>
            <button type="button" className="btn btn-sm" onClick={onClose} style={{ border: "none" }}>
              <i className="fa fa-xmark" />
            </button>
          </div>

          <div className="p-3">
            <label className="form-label">File name</label>
            <input
              ref={nameRef}
              type="text"
              className="form-control"
              placeholder="query_export.xlsx"
              value={fileName}
              onChange={(e) => onChangeFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirm();
                if (e.key === "Escape") onClose();
              }}
            />

          </div>

          <div className="p-3 border-top d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={!fileName.trim()}>
              Export Excel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
