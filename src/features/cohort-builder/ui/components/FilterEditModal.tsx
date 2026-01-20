// src/features/cohort-builder/ui/components/FilterEditModal.tsx
import React, { useEffect, useState } from 'react';
import type { FilterT } from '../../model/filters';
import { FilterCard } from './FilterCard';

interface FilterEditModalProps {
  show: boolean;
  filter: FilterT | null;
  onClose: () => void;
  onSave: (f: FilterT) => void;
}

export const FilterEditModal: React.FC<FilterEditModalProps> = ({
  show,
  filter,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<FilterT | null>(filter);

  // Reset local draft whenever we open on a new filter
  useEffect(() => {
    if (show && filter) {
      setDraft(filter);
    }
  }, [show, filter]);

  if (!show || !filter || !draft) {
    return null;
  }

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-lg modal-dialog-centered"
        onClick={e => e.stopPropagation()} // prevent click-through closing
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Edit {draft.title || draft.kind.toUpperCase()}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          <div className="modal-body">
            <FilterCard
              filter={draft}
              onChange={f => setDraft(f)}
              onRemove={() => {}}
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
            >
              Save Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
