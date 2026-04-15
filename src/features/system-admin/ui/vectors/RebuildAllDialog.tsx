import { useState } from "react";

interface RebuildAllDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (force: boolean) => void;
  busy: boolean;
}

export default function RebuildAllDialog({
  open,
  onClose,
  onConfirm,
  busy,
}: RebuildAllDialogProps) {
  const [force, setForce] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(force);
  };

  return (
    <div className="sa-dialog-backdrop" onClick={busy ? undefined : onClose}>
      <div className="sa-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sa-dialog-header">
          <span>Rebuild All Indexes</span>
          <button
            className="btn btn-sm btn-link"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <i className="fa fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="sa-dialog-body">
            <div className="sa-field">
              <label className="d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  disabled={busy}
                />
                Force rebuild (ignore cache)
              </label>
            </div>
          </div>

          <div className="sa-dialog-footer">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="sa-spinner" /> Rebuilding…
                </>
              ) : (
                "Confirm Rebuild"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
