import type { DeleteDialogState } from "../types";

type PlannerPoliciesDeleteDialogProps = {
  deleteDialog: Exclude<DeleteDialogState, null>;
  deleteBusy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

function getDeleteTitle(kind: DeleteDialogState extends null ? never : NonNullable<DeleteDialogState>["kind"]): string {
  if (kind === "capability") return "Capability";
  if (kind === "policy") return "Policy";
  if (kind === "projection_policy") return "Projection Policy";
  if (kind === "signal_policy") return "Signal Policy";
  if (kind === "prompt_intent_policy") return "Prompt Intent Policy";
  if (kind === "retrieval_policy") return "Retrieval Policy";
  if (kind === "domain_selection_policy") return "Domain Selection Policy";
  return "Candidate";
}

export function PlannerPoliciesDeleteDialog({
  deleteDialog,
  deleteBusy,
  onClose,
  onConfirm,
}: PlannerPoliciesDeleteDialogProps) {
  return (
    <div className="sa-dialog-backdrop" onClick={deleteBusy ? undefined : onClose}>
      <div
        className="sa-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${deleteDialog.kind}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sa-dialog-header">
          <span>Delete {getDeleteTitle(deleteDialog.kind)}</span>
          <button
            type="button"
            className="btn btn-sm btn-light"
            aria-label="Close delete dialog"
            onClick={onClose}
            disabled={deleteBusy}
          >
            <i className="fa fa-times" />
          </button>
        </div>
        <div className="sa-dialog-body">
          Delete <strong>{deleteDialog.label}</strong>? This action cannot be undone.
        </div>
        <div className="sa-dialog-footer">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onClose}
            disabled={deleteBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => void onConfirm()}
            disabled={deleteBusy}
          >
            {deleteBusy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
