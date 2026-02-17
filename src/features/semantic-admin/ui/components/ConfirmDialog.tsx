import React from "react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  busy,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="semantic-admin-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="semantic-admin-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="semantic-admin-dialog-header">{title}</div>
        <div className="semantic-admin-dialog-body">{message}</div>
        <div className="semantic-admin-dialog-footer">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Working..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

