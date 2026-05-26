import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  mode: "approve" | "reject";
  title: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
};

export function ReviewDecisionDialog({
  open,
  mode,
  title,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  const requiresReason = mode === "reject";
  const disabled = busy || (requiresReason && reason.trim() === "");

  return (
    <div className="sa-dialog-backdrop">
      <div className="sa-dialog" role="dialog" aria-label={title}>
        <div className="sa-dialog-header">
          <span>{title}</span>
        </div>
        <div className="sa-dialog-body">
          <p className="mb-3">
            {mode === "approve"
              ? "This will approve the selected feedback-learning candidate or candidates and persist runtime overrides where supported."
              : "A rejection reason is required and will be stored with the review metadata."}
          </p>
          {requiresReason ? (
            <label className="sa-field mb-0">
              <span>Reason</span>
              <textarea
                className="form-control"
                rows={4}
                aria-label="Review reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this candidate should be rejected."
              />
            </label>
          ) : null}
        </div>
        <div className="sa-dialog-footer">
          <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${mode === "approve" ? "btn-success" : "btn-danger"}`}
            disabled={disabled}
            onClick={() => onConfirm(requiresReason ? reason.trim() : undefined)}
          >
            {busy ? "Working…" : mode === "approve" ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
