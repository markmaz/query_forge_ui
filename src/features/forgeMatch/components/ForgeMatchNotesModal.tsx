import { useEffect, useState } from "react";

import type { ForgeMatchMapping } from "../types";

type Props = {
  open: boolean;
  row: ForgeMatchMapping | null;
  onClose: () => void;
  onSave: (input: { mappingId: string; notes: string }) => Promise<void>;
};

export default function ForgeMatchNotesModal({ open, row, onClose, onSave }: Props) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !row) return;
    setNotes(row.review_notes ?? "");
  }, [open, row]);

  if (!open || !row) return null;

  return (
    <div className="fm-drawer-overlay" role="presentation" onClick={onClose}>
      <div className="fm-modal" role="dialog" aria-label={`Edit notes for ${row.source_field_name ?? row.mapping_id}`} onClick={(e) => e.stopPropagation()}>
        <div className="fm-modal-header">
          <h3 className="mb-0">Edit Review Notes</h3>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
        </div>

        <p className="small text-muted mb-2">Update reviewer notes with action <code>edit_notes</code>.</p>

        <textarea
          className="form-control"
          rows={5}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-label="Review notes"
        />

        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSave({ mappingId: row.mapping_id, notes })}
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}
