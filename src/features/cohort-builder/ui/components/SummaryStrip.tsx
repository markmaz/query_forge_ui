// src/features/cohort-builder/ui/components/SummaryStrip.tsx
import React from 'react';
import type { SummaryStats } from '../../model/types';
import type { FilterKind } from '../../model/filters';

interface Props {
  stats: SummaryStats | null;
  filterCountsByKind: Array<{ kind: FilterKind; label: string; count: number }>;
  selectedKind: FilterKind | null;
  onSelectKind: (k: FilterKind) => void;
  onShowAll: () => void;

  /**
   * Optional: per-filter-kind loading flags.
   * e.g. { condition: true, drug: false, ... }
   * If you don't pass this, the UI behaves as before.
   */
  loadingByKind?: Partial<Record<FilterKind, boolean>>;

  /**
   * Optional: overall “building filters” flag (e.g. loadingDraft).
   * Lets you show a subtle skeleton/placeholder in the stats area.
   */
  overallLoading?: boolean;
}

export const SummaryStrip: React.FC<Props> = ({
  stats,
  filterCountsByKind,
  selectedKind,
  onSelectKind,
  onShowAll,
  loadingByKind,
  overallLoading,
}) => {
  return (
    <div className="card shadow-sm">
      <div className="card-body">

        {/* ---------- SUMMARY METRICS ---------- */}
        {!stats ? (
          <div className="text-muted mb-3">
            {overallLoading ? (
              // very light “skeleton-ish” placeholders
              <>
                <div className="placeholder-glow mb-2">
                  <span className="placeholder col-7" />
                </div>
                <div className="placeholder-glow mb-2">
                  <span className="placeholder col-5" />
                </div>
                <div className="placeholder-glow mb-2">
                  <span className="placeholder col-4" />
                </div>
              </>
            ) : (
              <>Filter Summary</>
            )}
          </div>
        ) : (
          <>
            <div className="mb-2">
              <small className="text-muted">Population</small>
              <div className="h5 m-0">
                {stats.population.toLocaleString()}
              </div>
            </div>
            <div className="mb-2">
              <small className="text-muted">Estimated Patients</small>
              <div className="h5 m-0">
                {stats.estPatients.toLocaleString()}
              </div>
            </div>
            <div className="mb-2">
              <small className="text-muted">Filters</small>
              <div className="h5 m-0">{stats.filtersCount}</div>
            </div>
            {stats.timeSpanLabel && (
              <div className="mb-3">
                <small className="text-muted">Time Span</small>
                <div>{stats.timeSpanLabel}</div>
              </div>
            )}
          </>
        )}

        {/* ---------- FILTER TYPES LIST WITH “PROGRESS” ---------- */}
        {/* ---------- FILTER TYPES LIST WITH “PROGRESS” ---------- */}
        <div className="small text-muted mb-1">Filter Types</div>
        <div className="d-grid gap-2 w-100">
          {filterCountsByKind.map(({ kind, label, count }) => {
            const isSelected = selectedKind === kind;
            const isLoading = loadingByKind?.[kind] ?? false;

            return (
              <div key={kind} className="w-100">
                <button
                  type="button"
                  disabled={count === 0 && !isLoading}
                  className={
                    'btn btn-sm w-100 text-start d-flex justify-content-between align-items-center ' +
                    (isSelected ? 'btn-primary text-white' : 'btn-outline-secondary')
                  }
                  onClick={() => onSelectKind(kind)}
                >
                  <span>
                    {label}
                    {isLoading && (
                      <span className="ms-2 small">
                        <i className="fa fa-spinner fa-spin me-1" />
                        building…
                      </span>
                    )}
                  </span>
                  <span className="badge bg-light text-dark ms-2">
                    {count}
                  </span>
                </button>

                {isLoading && (
                  <div className="mt-1">
                    <div className="progress" style={{ height: '4px' }}>
                      <div
                        className="progress-bar progress-bar-striped progress-bar-animated"
                        style={{ width: '75%' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedKind && (
          <button
            type="button"
            className="btn btn-link btn-sm mt-2 p-0"
            onClick={onShowAll}
          >
            Show all filters
          </button>
        )}
      </div>
    </div>
  );
};
