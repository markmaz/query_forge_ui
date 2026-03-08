import React, { useEffect, useRef } from "react";

export function NamePromptDialog(props: {
  open: boolean;
  title: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const {
    open,
    title,
    label,
    value,
    onChange,
    placeholder,
    confirmLabel = "Save",
    onConfirm,
    onClose,
  } = props;

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onConfirm();
    if (e.key === "Escape") onClose();
  };

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
            <label className="form-label">{label}</label>
            <input
              ref={inputRef}
              type="text"
              className="form-control"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="p-3 border-top d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={!value.trim()}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
