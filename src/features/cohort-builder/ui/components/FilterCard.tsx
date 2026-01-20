// src/features/cohort-builder/ui/components/FilterCard.tsx
import React from 'react';
import type { FilterT, FilterKind } from '../../model/filters';

const headerClassByKind: Record<FilterKind, string> = {
  procedure: 'bg-info text-white',
  drug: 'bg-success text-white',
  measurement: 'bg-warning text-dark',
  demographics: 'bg-primary text-white',
  condition: 'bg-secondary text-white',
};

interface Props {
  filter: FilterT;
  onChange: (f: FilterT) => void;
  onRemove: () => void;
}

export const FilterCard: React.FC<Props> = ({ filter, onChange, onRemove }) => {
  const set = <K extends keyof FilterT>(key: K, value: FilterT[K]) =>
    onChange({ ...filter, [key]: value });

  const headerClass = headerClassByKind[filter.kind];

  return (
    // w-100 ensures it uses the full width of whatever container it's in
    <div className="border rounded shadow-sm w-100">
      {/* Colored header */}
      <div
        className={
          'd-flex justify-content-between align-items-center px-3 py-2 ' +
          headerClass
        }
      >
        <span className="fw-semibold text-truncate">
          {filter.title || filter.kind.toUpperCase()}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          onClick={onRemove}
        >
          <i className='fa fa-trash me-2'/>
          Remove
        </button>
      </div>

      {/* Body */}
      <div className="p-3 bg-white">
        {/* --- Condition --- */}
        {filter.kind === 'condition' && (
          <>
            <div className="mb-2">
              <label className="form-label">Code</label>
              <input
                className="form-control"
                value={filter.code ?? ''}
                onChange={e => set('code', e.target.value)}
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                value={filter.name ?? ''}
                onChange={e => set('name', e.target.value)}
              />
            </div>
          </>
        )}

        {/* --- Procedure --- */}
        {filter.kind === 'procedure' && (
          <>
            <div className="mb-2">
              <label className="form-label">Code</label>
              <input
                className="form-control"
                value={filter.code ?? ''}
                onChange={e => set('code', e.target.value)}
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                value={filter.name ?? ''}
                onChange={e => set('name', e.target.value)}
              />
            </div>
          </>
        )}

        {/* --- Drug --- */}
        {filter.kind === 'drug' && (
          <>
            <div className="mb-2">
              <label className="form-label">Drug name</label>
              <input
                className="form-control"
                value={filter.name ?? ''}
                onChange={e => set('name', e.target.value)}
              />
            </div>
            <div className="mb-2">
              <label className="form-label">NDC codes (comma-separated)</label>
              <input
                className="form-control"
                value={typeof filter.code === 'string' ? filter.code : ''}
                onChange={e => set('code', e.target.value)}
              />
            </div>
          </>
        )}

        {/* --- Measurement --- */}
        {filter.kind === 'measurement' && (
          <>
            <div className="mb-2">
              <label className="form-label">Measurement name</label>
              <input
                className="form-control"
                value={filter.name ?? ''}
                onChange={e => set('name', e.target.value)}
              />
            </div>

            <div className="mb-2">
              <label className="form-label">Units (label → code)</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder={`e.g.\nmg/dL: 8840\nmg/dL{adult}: 8954`}
                value={
                  filter.unit
                    ? Object.entries(filter.unit)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n')
                    : ''
                }
                onChange={e => {
                  const lines = e.target.value.split('\n');
                  const entries: Record<string, number> = {};
                  for (const line of lines) {
                    const [k, v] = line.split(':').map(s => s.trim());
                    if (!k || !v) continue;
                    const n = Number(v);
                    if (!Number.isNaN(n)) entries[k] = n;
                  }
                  set('unit', entries);
                }}
              />
            </div>

            <div className="d-flex gap-2">
              <div className="flex-fill">
                <label className="form-label">Value ≥</label>
                <input
                  type="number"
                  className="form-control"
                  value={filter.value?.lower_bound ?? ''}
                  onChange={e =>
                    set('value', {
                      lower_bound: e.target.value
                        ? Number(e.target.value)
                        : null,
                      upper_bound: filter.value?.upper_bound ?? null,
                    })
                  }
                />
              </div>
              <div className="flex-fill">
                <label className="form-label">Value ≤</label>
                <input
                  type="number"
                  className="form-control"
                  value={filter.value?.upper_bound ?? ''}
                  onChange={e =>
                    set('value', {
                      lower_bound: filter.value?.lower_bound ?? null,
                      upper_bound: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            </div>
          </>
        )}

        {/* --- Demographics --- */}
        {filter.kind === 'demographics' && (
          <>
            <div className="d-flex gap-2 mb-2">
              <div className="flex-fill">
                <label className="form-label">Age ≥</label>
                <input
                  type="number"
                  className="form-control"
                  value={filter.age?.lower_bound ?? ''}
                  onChange={e =>
                    set('age', {
                      lower_bound: e.target.value
                        ? Number(e.target.value)
                        : null,
                      upper_bound: filter.age?.upper_bound ?? null,
                    })
                  }
                />
              </div>
              <div className="flex-fill">
                <label className="form-label">Age ≤</label>
                <input
                  type="number"
                  className="form-control"
                  value={filter.age?.upper_bound ?? ''}
                  onChange={e =>
                    set('age', {
                      lower_bound: filter.age?.lower_bound ?? null,
                      upper_bound: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="d-flex gap-2 mb-2">
              <div className="flex-fill">
                <label className="form-label">Dx year from</label>
                <input
                  type="number"
                  className="form-control"
                  value={filter.dx_year?.lower_bound ?? ''}
                  onChange={e =>
                    set('dx_year', {
                      lower_bound: e.target.value
                        ? Number(e.target.value)
                        : null,
                      upper_bound: filter.dx_year?.upper_bound ?? null,
                    })
                  }
                />
              </div>
              <div className="flex-fill">
                <label className="form-label">Dx year to</label>
                <input
                  type="number"
                  className="form-control"
                  value={filter.dx_year?.upper_bound ?? ''}
                  onChange={e =>
                    set('dx_year', {
                      lower_bound: filter.dx_year?.lower_bound ?? null,
                      upper_bound: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="mb-2">
              <label className="form-label">Gender</label>
              <select
                multiple
                className="form-select"
                value={filter.gender ?? []}
                onChange={e => {
                  const opts = Array.from(
                    (e.target as HTMLSelectElement).selectedOptions
                  ).map(o => o.value);
                  set('gender', opts);
                }}
              >
                <option value="Male">Female</option>
                <option value="Female">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="mb-2">
              <label className="form-label">States</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Comma-separated: TN, KY, GA..."
                value={(filter.location ?? []).join(', ')}
                onChange={e =>
                  set(
                    'location',
                    e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
