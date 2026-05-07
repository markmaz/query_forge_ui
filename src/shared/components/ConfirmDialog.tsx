import React, { useEffect, useRef } from "react";

type ConfirmTone = "danger" | "primary";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => cancelRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const confirmClass = tone === "danger" ? "btn btn-danger" : "btn btn-primary";

  return (
    <>
      <div
        onClick={busy ? undefined : onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.48)",
          zIndex: 2400,
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          top: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(520px, calc(100vw - 32px))",
          zIndex: 2401,
        }}
      >
        <div className="bg-white border rounded shadow">
          <header className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div className="fw-semibold">{title}</div>
            <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy} style={{ border: "none" }} aria-label="Close">
              <i className="fa fa-xmark" aria-hidden="true" />
            </button>
          </header>
          <div className="p-3 text-body">{message}</div>
          <footer className="p-3 border-top d-flex justify-content-end gap-2">
            <button ref={cancelRef} type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
            <button type="button" className={confirmClass} onClick={onConfirm} disabled={busy}>
              {busy ? "Working..." : confirmLabel}
            </button>
          </footer>
        </div>
      </section>
    </>
  );
}
