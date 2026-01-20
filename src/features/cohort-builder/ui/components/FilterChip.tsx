// src/features/cohort-builder/ui/components/FilterChip.tsx
import React from 'react';
import type { FilterT, FilterKind } from '../../model/filters';
import { summarizeFilter } from '../../model/filterSummary';

const pillClassByKind: Record<FilterKind, string> = {
  procedure: 'bg-info text-white',
  drug: 'bg-success text-white',
  measurement: 'bg-warning text-dark',
  demographics: 'bg-primary text-white',
  condition: 'bg-secondary text-white',
};

interface Props {
  filter: FilterT;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export const FilterChip: React.FC<Props> = ({
  filter,
  isActive,
  onSelect,
  onRemove,
}) => {
  const label = summarizeFilter(filter);
  const kindClass = pillClassByKind[filter.kind];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        'd-inline-flex align-items-center rounded-pill px-2 py-1 me-2 mb-2 border ' +
        (isActive ? kindClass : 'bg-light text-dark')
      }
      style={{
        cursor: 'pointer',
        borderColor: isActive ? 'transparent' : '#ced4da',
        maxWidth: '100%',
      }}
      title={label}
    >
      <span className="small text-truncate" style={{ maxWidth: 220 }}>
        {label}
      </span>
      <button
        type="button"
        className="btn-close btn-close-white ms-2"
        aria-label="Remove filter"
        onClick={e => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          filter: isActive ? 'invert(0)' : 'invert(0.5)',
        }}
      ></button>
    </button>
  );
};
