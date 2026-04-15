// src/features/domain-studio/ui/components/DictionaryTablePanel.tsx
import React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { WorkspaceDictionaryColumn } from "../../../../shared/services/queryStudioAdminApi";
import {
  buildDescriptionSnippet,
  renderHighlightedText,
} from "./dictionaryTabUtils";

export interface DictionaryTablePanelProps {
  // table list
  allTableNames: Array<{ id: number; name: string }>;
  filteredTableNames: Array<{ id: number; name: string }>;
  tableFilter: string;
  onTableFilterChange: (v: string) => void;
  selectedTable: { id: number; name: string } | null;
  onSelectTable: (t: { id: number; name: string } | null) => void;
  tableButtonRefMap: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  tableNamesQ: UseQueryResult;
  // global search
  globalSearchDraft: string;
  onGlobalSearchChange: (v: string) => void;
  debouncedGlobalSearchTerm: string;
  isGlobalSearchMode: boolean;
  showGlobalSearching: boolean;
  globalSearchQ: UseQueryResult;
  globalTableResults: Array<{
    id: number;
    tableName: string;
    matchCount: number;
  }>;
  globalColumnResults: WorkspaceDictionaryColumn[];
  onJumpToColumn: (t: { tableName: string; columnName: string }) => void;
  // shared
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  onSetEditing: (v: null) => void;
  onClearQDraft: () => void;
  isSwitching: boolean;
  startTransition: React.TransitionStartFunction;
}

export const DictionaryTablePanel: React.FC<DictionaryTablePanelProps> = ({
  allTableNames,
  filteredTableNames,
  tableFilter,
  onTableFilterChange,
  selectedTable,
  onSelectTable,
  tableButtonRefMap,
  tableNamesQ,
  globalSearchDraft,
  onGlobalSearchChange,
  debouncedGlobalSearchTerm,
  isGlobalSearchMode,
  showGlobalSearching,
  globalSearchQ,
  globalTableResults,
  globalColumnResults,
  onJumpToColumn,
  activeOnly,
  onActiveOnlyChange,
  onSetEditing,
  onClearQDraft,
  isSwitching,
  startTransition,
}) => {
  return (
    <div className="card">
      <div className="card-header py-2 d-flex justify-content-between align-items-center">
        <div className="fw-semibold">Tables</div>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => {
            onSetEditing(null);
            startTransition(() => onSelectTable(null));
          }}
          disabled={!selectedTable}
          title="Clear selection"
        >
          All
        </button>
      </div>

      <div className="card-body p-2">
        <div className="input-group input-group-sm mb-1">
          <span className="input-group-text bg-white">
            <i className="fa fa-search text-muted" aria-hidden="true" />
          </span>
          <input
            className="form-control"
            value={globalSearchDraft}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder="Search tables & columns..."
            aria-label="Global dictionary search"
          />
        </div>
        <div className="text-muted small mb-2">
          Search across table names, columns, and descriptions.
        </div>

        <input
          className="form-control form-control-sm mb-2"
          value={tableFilter}
          onChange={(e) => onTableFilterChange(e.target.value)}
          placeholder="Filter tables…"
        />

        <div className="form-check mb-2">
          <input
            className="form-check-input"
            id="activeOnly"
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => onActiveOnlyChange(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="activeOnly">
            Active only
          </label>
        </div>

        {tableNamesQ.isError ? (
          <div className="alert alert-danger py-2 mb-0">
            {(tableNamesQ.error as Error).message}
          </div>
        ) : null}

        {isGlobalSearchMode ? (
          <div className="dict-global-results">
            {showGlobalSearching ? (
              <div className="text-muted small p-2">Searching…</div>
            ) : globalSearchQ.isError ? (
              <div className="alert alert-danger py-2 mb-0">
                {(globalSearchQ.error as Error).message}
              </div>
            ) : globalTableResults.length === 0 &&
              globalColumnResults.length === 0 ? (
              <div className="dict-global-empty">
                <div className="fw-semibold">
                  No matches for "{debouncedGlobalSearchTerm}"
                </div>
                <div className="text-muted small">
                  Try a different term, or search by a partial column name.
                </div>
              </div>
            ) : (
              <>
                <div className="dict-global-group">
                  <div className="dict-global-group-title">Tables</div>
                  {globalTableResults.length === 0 ? (
                    <div className="text-muted small p-2">
                      No table matches.
                    </div>
                  ) : (
                    <div className="list-group">
                      {globalTableResults.map((result) => (
                        <button
                          key={`tbl-${result.id}`}
                          type="button"
                          className="list-group-item list-group-item-action dict-global-item"
                          onClick={() => {
                            onSetEditing(null);
                            onGlobalSearchChange("");
                            startTransition(() =>
                              onSelectTable({
                                id: result.id,
                                name: result.tableName,
                              }),
                            );
                          }}
                          title={result.tableName}
                        >
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <span className="text-truncate">
                              {renderHighlightedText(
                                result.tableName,
                                debouncedGlobalSearchTerm,
                              )}
                            </span>
                            <span className="badge text-bg-light border">
                              {result.matchCount}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="dict-global-group mt-2">
                  <div className="dict-global-group-title">Columns</div>
                  {globalColumnResults.length === 0 ? (
                    <div className="text-muted small p-2">
                      No column matches.
                    </div>
                  ) : (
                    <div className="list-group">
                      {globalColumnResults.map((result) => {
                        const label = `${result.table_name ?? ""}.${result.column_name}`;
                        const snippet = buildDescriptionSnippet(
                          result.description,
                          debouncedGlobalSearchTerm,
                        );
                        return (
                          <button
                            key={`col-${(result.table_name ?? "").toLowerCase()}::${result.column_name.toLowerCase()}`}
                            type="button"
                            className="list-group-item list-group-item-action dict-global-item"
                            onClick={() => {
                              onSetEditing(null);
                              onClearQDraft();
                              onGlobalSearchChange("");
                              onJumpToColumn({
                                tableName: result.table_name ?? "",
                                columnName: result.column_name,
                              });
                              startTransition(() =>
                                onSelectTable({
                                  id: result.workspace_table_id,
                                  name: result.table_name ?? "",
                                }),
                              );
                            }}
                            title={label}
                          >
                            <div className="fw-semibold text-truncate">
                              {renderHighlightedText(
                                label,
                                debouncedGlobalSearchTerm,
                              )}
                            </div>
                            {snippet ? (
                              <div className="dict-global-desc">
                                {renderHighlightedText(
                                  snippet,
                                  debouncedGlobalSearchTerm,
                                )}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div
              className="list-group"
              style={{ maxHeight: 520, overflowY: "auto" }}
            >
              {tableNamesQ.isLoading ? (
                <div className="text-muted small p-2">Loading tables…</div>
              ) : filteredTableNames.length === 0 ? (
                <div className="text-muted small p-2">No matching tables.</div>
              ) : (
                filteredTableNames.map((t) => {
                  const active = selectedTable?.id === t.id;
                  return (
                    <button
                      key={`tbl-${t.id}`}
                      ref={(el) => {
                        if (el) tableButtonRefMap.current.set(t.name, el);
                        else tableButtonRefMap.current.delete(t.name);
                      }}
                      type="button"
                      className={`list-group-item list-group-item-action${active ? " active" : ""}`}
                      onClick={() => {
                        onSetEditing(null);
                        onClearQDraft();
                        startTransition(() => onSelectTable(t));
                      }}
                      title={t.name}
                    >
                      <span className="text-truncate">{t.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="text-muted small mt-2">
              Showing {filteredTableNames.length} / {allTableNames.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
