import { useEffect, useMemo, useState } from "react";

import type { ForgeMatchMapping } from "../types";

type Props = {
  open: boolean;
  row: ForgeMatchMapping | null;
  onClose: () => void;
  onConfirm: (input: { mappingId: string; columnId: number; notes?: string }) => Promise<void>;
};

type ColumnOption = {
  column_id: number;
  table_name: string;
  column_name: string;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export default function ForgeMatchManualRemapModal({ open, row, onClose, onConfirm }: Props) {
  const [query, setQuery] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !row) return;
    setQuery("");
    setSelectedColumnId(null);
    setNotes(row.review_notes ?? "");
  }, [open, row]);

  const options = useMemo<ColumnOption[]>(() => {
    if (!row) return [];
    const pool = [row.best_match, ...row.alternates, ...row.retrieved_candidates].filter(Boolean);
    const deduped = new Map<number, ColumnOption>();

    pool.forEach((candidate) => {
      const id = Number((candidate as any).column_id ?? 0);
      if (!Number.isFinite(id) || id <= 0) return;
      const table = String((candidate as any).table_name ?? "").trim();
      const column = String((candidate as any).column_name ?? "").trim();
      if (!deduped.has(id)) {
        deduped.set(id, {
          column_id: id,
          table_name: table,
          column_name: column,
        });
      }
    });

    return [...deduped.values()].sort((a, b) => `${a.table_name}.${a.column_name}`.localeCompare(`${b.table_name}.${b.column_name}`));
  }, [row]);

  const filteredOptions = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return options;
    return options.filter((option) => normalizeText(`${option.table_name} ${option.column_name}`).includes(q));
  }, [options, query]);

  if (!open || !row) return null;

  return (
    <div className="fm-drawer-overlay" role="presentation" onClick={onClose}>
      <div className="fm-modal" role="dialog" aria-label={`Manual remap for ${row.source_field_name ?? row.mapping_id}`} onClick={(e) => e.stopPropagation()}>
        <div className="fm-modal-header">
          <h3 className="mb-0">Manual Remap</h3>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
        </div>

        <p className="small text-muted">
          Select a valid workspace column candidate and save with action <code>remap</code>.
        </p>

        <div className="mb-3">
          <label htmlFor="forge-match-remap-search" className="form-label">Search candidate columns</label>
          <input
            id="forge-match-remap-search"
            className="form-control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search table or column"
          />
        </div>

        <div className="fm-remap-search-results mb-3">
          {filteredOptions.length === 0 ? (
            <div className="small text-muted p-2">No columns found in candidate set.</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.column_id}
                type="button"
                className={`list-group-item list-group-item-action ${selectedColumnId === option.column_id ? "active" : ""}`}
                onClick={() => setSelectedColumnId(option.column_id)}
              >
                <div className="fw-semibold">{option.table_name}.{option.column_name}</div>
                <div className="small text-muted">Workspace Column ID {option.column_id}</div>
              </button>
            ))
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="forge-match-remap-notes" className="form-label">Review notes (optional)</label>
          <textarea
            id="forge-match-remap-notes"
            className="form-control"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add context for the manual remap"
          />
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedColumnId}
            onClick={() => {
              if (!selectedColumnId) return;
              void onConfirm({ mappingId: row.mapping_id, columnId: selectedColumnId, notes });
            }}
          >
            Save Manual Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
