import { useEffect, useState } from "react";

type DraftKind = "view_draft" | "domain_draft";

type Props = {
  open: boolean;
  kind: DraftKind | null;
  isSaving?: boolean;
  onClose: () => void;
  onConfirm: (input: { kind: DraftKind; name?: string }) => Promise<void>;
};

function getTitle(kind: DraftKind | null): string {
  return kind === "domain_draft" ? "Create Domain Draft" : "Create View Draft";
}

function getHelper(kind: DraftKind | null): string {
  return kind === "domain_draft"
    ? "Optionally name the domain draft before creating it from the accepted mappings."
    : "Optionally name the view draft before creating it from the accepted mappings.";
}

export default function ForgeMatchDraftModal({
  open,
  kind,
  isSaving = false,
  onClose,
  onConfirm,
}: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
  }, [open, kind]);

  if (!open || !kind) return null;

  return (
    <div className="fm-drawer-overlay" role="presentation" onClick={onClose}>
      <div className="fm-modal" role="dialog" aria-label={getTitle(kind)} onClick={(event) => event.stopPropagation()}>
        <div className="fm-modal-header">
          <h3 className="mb-0">{getTitle(kind)}</h3>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose} disabled={isSaving}>
            Close
          </button>
        </div>

        <p className="small text-muted mb-3">{getHelper(kind)}</p>

        {isSaving ? (
          <div className="alert alert-info d-flex align-items-center gap-2" role="status" aria-live="polite">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <div>
              <div className="fw-semibold">Generating SQL draft...</div>
              <div className="small">Pulling accepted mappings and building the draft workarea.</div>
            </div>
          </div>
        ) : null}

        <div className="mb-3">
          <label htmlFor="forge-match-draft-name" className="form-label">Draft name (optional)</label>
          <input
            id="forge-match-draft-name"
            className="form-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === "domain_draft" ? "Spring domain draft" : "Student fields view draft"}
            disabled={isSaving}
          />
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isSaving}
            onClick={() => void onConfirm({ kind, name: name.trim() || undefined })}
          >
            {isSaving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                Creating...
              </>
            ) : getTitle(kind)}
          </button>
        </div>
      </div>
    </div>
  );
}
