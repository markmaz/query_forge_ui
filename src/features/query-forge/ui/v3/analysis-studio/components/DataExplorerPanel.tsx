import { useEffect, useMemo, useState } from "react";

import type {
  StudioDomainExplorer,
  StudioDomainSummary,
  StudioField,
} from "../model/analysisTypes";
import {
  getDomainOverviewStats,
  getFilteredDomainCategories,
  getRecentlyUsedFields,
} from "../model/analysisUtils";
import { DomainSelector } from "./DomainSelector";
import { DomainSummaryCard } from "./DomainSummaryCard";
import { FieldGroupList } from "./FieldGroupList";
import { FieldSearchInput } from "./FieldSearchInput";
import { RecentlyUsedFields } from "./RecentlyUsedFields";

type DataExplorerPanelProps = {
  domains: StudioDomainSummary[];
  domainsLoading?: boolean;
  domainsError?: string | null;
  selectedDomainId: number | null;
  explorer: StudioDomainExplorer | null;
  explorerLoading?: boolean;
  explorerError?: string | null;
  onSelectDomain: (domainId: number) => void;
  onRetryDomains?: () => void;
  onRetryExplorer?: () => void;
};

const RECENT_FIELDS_LIMIT = 8;

export function DataExplorerPanel(props: DataExplorerPanelProps) {
  const {
    domains,
    domainsLoading = false,
    domainsError = null,
    selectedDomainId,
    explorer,
    explorerLoading = false,
    explorerError = null,
    onSelectDomain,
    onRetryDomains,
    onRetryExplorer,
  } = props;

  const [searchValue, setSearchValue] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [recentFieldIds, setRecentFieldIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [domains, selectedDomainId],
  );

  useEffect(() => {
    setSearchValue("");
    setSelectedFieldId(null);
    setRecentFieldIds([]);
    setExpandedGroups({});
  }, [selectedDomainId]);

  const overviewStats = useMemo(
    () => getDomainOverviewStats(explorer, selectedDomain),
    [explorer, selectedDomain],
  );
  const filteredCategories = useMemo(
    () => getFilteredDomainCategories(explorer, searchValue),
    [explorer, searchValue],
  );
  const recentFields = useMemo(
    () => getRecentlyUsedFields(explorer, recentFieldIds, RECENT_FIELDS_LIMIT),
    [recentFieldIds, explorer],
  );

  const handleFieldClick = (field: StudioField) => {
    const normalizedFieldId = String(field.id);
    setSelectedFieldId(normalizedFieldId);
    setRecentFieldIds((previous) => {
      const deduped = previous.filter((item) => item !== normalizedFieldId);
      return [normalizedFieldId, ...deduped].slice(0, RECENT_FIELDS_LIMIT);
    });
  };

  const handleToggleGroup = (categoryId: string) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [categoryId]: !previous[categoryId],
    }));
  };

  return (
    <div className="analysisPanel">
      <div className="analysisPanel__header">
        <h2>Data Explorer</h2>
      </div>

      <DomainSelector
        domains={domains}
        selectedDomainId={selectedDomainId}
        loading={domainsLoading}
        error={domainsError}
        onSelectDomain={onSelectDomain}
      />

      {domainsError && onRetryDomains ? (
        <div className="analysisPanel__retryRow">
          <button type="button" className="analysisBtn analysisBtn--ghost" onClick={onRetryDomains}>
            Retry domains
          </button>
        </div>
      ) : null}

      {!selectedDomain ? (
        <div className="analysisPanel__empty">
          <h3>Start with a domain</h3>
          <p>Choose a trusted business domain to begin your analysis.</p>
        </div>
      ) : (
        <>
          <div className="analysisPanel__section">
            <h3>Overview</h3>
            <DomainSummaryCard domain={explorer?.domain ?? selectedDomain} stats={overviewStats} />
          </div>

          {explorer?.recommendedFields?.length ? (
            <div className="analysisPanel__section">
              <h3>Recommended Fields</h3>
              <RecentlyUsedFields
                fields={explorer.recommendedFields.slice(0, 8)}
                selectedFieldId={selectedFieldId}
                onFieldClick={handleFieldClick}
              />
            </div>
          ) : null}

          {recentFields.length > 0 ? (
            <div className="analysisPanel__section">
              <h3>Recently Used</h3>
              <RecentlyUsedFields fields={recentFields} selectedFieldId={selectedFieldId} onFieldClick={handleFieldClick} />
            </div>
          ) : null}

          <div className="analysisPanel__section analysisPanel__section--fields">
            <h3>Fields</h3>
            <FieldSearchInput value={searchValue} onChange={setSearchValue} />
            <p className="analysisHint analysisHint--compact">
              Click a field to pin it in Recently Used for quick recall while building steps.
            </p>

            {explorerLoading ? (
              <div className="analysisPanel__empty">
                <h3>Loading domain fields...</h3>
                <p>Fetching categories and business fields for this domain.</p>
              </div>
            ) : null}

            {explorerError ? (
              <div className="analysisPanel__empty">
                <h3>Unable to load explorer</h3>
                <p>{explorerError}</p>
                {onRetryExplorer ? (
                  <button type="button" className="analysisBtn analysisBtn--ghost" onClick={onRetryExplorer}>
                    Retry explorer
                  </button>
                ) : null}
              </div>
            ) : null}

            {!explorerLoading && !explorerError ? (
              <FieldGroupList
                categories={filteredCategories}
                searchValue={searchValue}
                expandedGroups={expandedGroups}
                selectedFieldId={selectedFieldId}
                onToggleGroup={handleToggleGroup}
                onFieldClick={handleFieldClick}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
