import type { ReactNode } from "react";

import type { DomainColumnRef } from "../../model/domainCatalog";
import type {
  CohortAttachment,
  SqlAggregationsJson,
  SqlColumnKey,
  SqlColumnRef,
  SqlQueryJson,
  ValueOverrideAttachment,
} from "../../model/sqlJson";
import type { ToolKeyV2 } from "../v2/BuilderToolRailV2";
import { PAGE_SIZE } from "../queryForgePageUtils";
import { BuilderDrawerV2 } from "../v2/BuilderDrawerV2";
import { DomainSection } from "./DomainSection";
import { ColumnsSection } from "./ColumnsSection";
import { DataPrepSection } from "./DataPrepSection";
import { FiltersSection } from "./FiltersSection";
import { AggregationsSection } from "./AggregationsSection";
import { SortingSection } from "./SortingSection";

type QueryForgeBuilderDrawerProps = {
  openTool: ToolKeyV2 | null;
  onClose: () => void;
  offsetForAi: boolean;
  onFocusSection: (section: ToolKeyV2) => void;
  onHideSection: (section: ToolKeyV2) => void;
  collapsedFor: (section: ToolKeyV2) => boolean;
  toggleSection: (section: ToolKeyV2) => void;
  onChangeDistinct: (value: boolean) => void;
  helpActionForSection: (
    section: ToolKeyV2,
    title: string,
  ) => {
    label: string;
    ariaLabel: string;
    iconClass: string;
    onClick: () => void;
  } | undefined;
  goToDrawerStep: (key: ToolKeyV2) => () => void;
  goToPreviewFromDrawer: () => void;
  closeDrawer: () => void;
  visibleSections: Record<ToolKeyV2 | "domain" | "preview" | "prompt" | "suggested", boolean>;
  showSection: (section: ToolKeyV2) => void;
  expandSection: (section: ToolKeyV2) => void;
  domainOptions: Array<{
    id: string;
    name: string;
    description: string | null;
    kind: string | null;
    tables: string[];
    table_count: number;
    modelTableId: number | null;
    modelTableName: string | null;
  }>;
  domainId: number | null;
  setDomainIdInJson: (next: number | null) => void;
  workspaceId: string | null;
  allRows: DomainColumnRef[];
  sqlJson: SqlQueryJson;
  setValueOverrideAttachments: (next: ValueOverrideAttachment[]) => void;
  setCohortAttachment: (next: CohortAttachment | null) => void;
  aggsActive: boolean;
  excludeErrorRows: boolean;
  onChangeExcludeErrorRows: (value: boolean) => void;
  domainsLoading: boolean;
  domainsError?: string;
  onRetryDomains: () => void;
  pageRows: DomainColumnRef[];
  totalColumns: number;
  columnsSearchTerm: string;
  setColumnsSearchTerm: (value: string) => void;
  setCurrentPage: (value: number) => void;
  selectedColumnKeysForUi: string[];
  keyForColumnIdentityKey: (key: string) => SqlColumnKey;
  toggleColumn: (key: SqlColumnKey) => void;
  removeSelected: (key: SqlColumnKey) => void;
  currentPage: number;
  columnsLoading: boolean;
  columnsError?: string;
  setColumnsInJson: (next: SqlColumnRef[]) => void;
  selectedColumns: SqlColumnKey[];
  setDataPrepInJson: (next: any) => void;
  availableColumnKeys: SqlColumnKey[];
  allColumnKeysForFilters: SqlColumnKey[];
  setFiltersInJson: (next: any) => void;
  columnsMeta: any[];
  setAggsInJson: (next: SqlAggregationsJson | null) => void;
  setSortingInJson: (next: any[]) => void;
};

const sectionFocusHandlers = (
  section: ToolKeyV2,
  onFocusSection: (section: ToolKeyV2) => void,
) => ({
  onFocusCapture: () => onFocusSection(section),
  onMouseDownCapture: () => onFocusSection(section),
});

export function QueryForgeBuilderDrawer({
  openTool,
  onClose,
  offsetForAi,
  onFocusSection,
  onHideSection,
  collapsedFor,
  toggleSection,
  helpActionForSection,
  goToDrawerStep,
  goToPreviewFromDrawer,
  closeDrawer,
  visibleSections,
  showSection,
  expandSection,
  onChangeDistinct,
  domainOptions,
  domainId,
  setDomainIdInJson,
  workspaceId,
  allRows,
  sqlJson,
  setValueOverrideAttachments,
  setCohortAttachment,
  aggsActive,
  excludeErrorRows,
  onChangeExcludeErrorRows,
  domainsLoading,
  domainsError,
  onRetryDomains,
  pageRows,
  totalColumns,
  columnsSearchTerm,
  setColumnsSearchTerm,
  setCurrentPage,
  selectedColumnKeysForUi,
  keyForColumnIdentityKey,
  toggleColumn,
  removeSelected,
  currentPage,
  columnsLoading,
  columnsError,
  setColumnsInJson,
  selectedColumns,
  setDataPrepInJson,
  availableColumnKeys,
  allColumnKeysForFilters,
  setFiltersInJson,
  columnsMeta,
  setAggsInJson,
  setSortingInJson,
}: QueryForgeBuilderDrawerProps) {
  const wrap = (section: ToolKeyV2, child: ReactNode) => (
    <div {...sectionFocusHandlers(section, onFocusSection)}>{child}</div>
  );

  return (
    <BuilderDrawerV2
      openTool={openTool}
      onClose={onClose}
      offsetForAi={offsetForAi}
      childrenByTool={{
        domain: wrap(
          "domain",
          <DomainSection
            domains={domainOptions}
            selectedDomainId={domainId == null ? null : String(domainId)}
            onChangeDomain={(idOrNull) =>
              setDomainIdInJson(idOrNull ? Number(idOrNull) : null)
            }
            workspaceId={workspaceId}
            domainColumns={allRows}
            valueOverrideAttachments={sqlJson.value_overrideAttachments ?? []}
            cohortAttachment={sqlJson.cohortAttachment ?? null}
            onChangeValueOverrideAttachments={setValueOverrideAttachments}
            onChangeCohortAttachment={setCohortAttachment}
            distinct={sqlJson.distinct !== false}
            onChangeDistinct={onChangeDistinct}
            disableDistinct={aggsActive}
            excludeErrorRows={excludeErrorRows}
            onChangeExcludeErrorRows={onChangeExcludeErrorRows}
            loading={domainsLoading}
            error={domainsError}
            onRetry={onRetryDomains}
            collapsed={collapsedFor("domain")}
            onToggleCollapsed={() => toggleSection("domain")}
            collapsible={false}
            onHide={() => onHideSection("domain")}
            onNext={goToDrawerStep("columns")}
            onSubmit={closeDrawer}
            helpAction={helpActionForSection("domain", "Domain")}
          />,
        ),
        columns: wrap(
          "columns",
          <ColumnsSection
            collapsed={collapsedFor("columns")}
            onToggleCollapsed={() => toggleSection("columns")}
            collapsible={false}
            onHide={() => onHideSection("columns")}
            rows={pageRows}
            total={totalColumns}
            searchTerm={columnsSearchTerm}
            domainId={domainId}
            onChangeSearch={(value) => {
              setColumnsSearchTerm(value);
              setCurrentPage(1);
            }}
            selectedColumnKeys={selectedColumnKeysForUi}
            onToggleColumn={(key: string) => toggleColumn(keyForColumnIdentityKey(key))}
            onRemoveSelected={(key: string) => removeSelected(keyForColumnIdentityKey(key))}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            onChangePage={setCurrentPage}
            loading={columnsLoading}
            error={columnsError}
            columnsJson={sqlJson.columns}
            onColumnsJsonChange={setColumnsInJson}
            onNext={goToDrawerStep("dataprep")}
            onSubmit={closeDrawer}
            helpAction={helpActionForSection("columns", "Columns")}
          />,
        ),
        dataprep: wrap(
          "dataprep",
          <DataPrepSection
            selectedColumns={selectedColumns}
            columnsMeta={allRows as any}
            value={sqlJson.dataPrep ?? null}
            onChange={setDataPrepInJson}
            collapsed={collapsedFor("dataprep")}
            onToggleCollapsed={() => toggleSection("dataprep")}
            collapsible={false}
            onHide={() => onHideSection("dataprep")}
            onNext={goToDrawerStep("filters")}
            onSubmit={closeDrawer}
            helpAction={helpActionForSection("dataprep", "Data Prep")}
          />,
        ),
        filters: wrap(
          "filters",
          <FiltersSection
            collapsed={collapsedFor("filters")}
            onToggleCollapsed={() => toggleSection("filters")}
            collapsible={false}
            onHide={() => onHideSection("filters")}
            selectedColumns={availableColumnKeys}
            allColumns={allColumnKeysForFilters}
            value={sqlJson.filters ?? null}
            onChange={setFiltersInJson}
            sqlJson={sqlJson}
            onNext={goToDrawerStep("aggs")}
            onSubmit={closeDrawer}
            helpAction={helpActionForSection("filters", "Filters")}
          />,
        ),
        aggs: wrap(
          "aggs",
          <AggregationsSection
            selectedColumns={selectedColumns}
            allColumns={allColumnKeysForFilters}
            columnsMeta={columnsMeta as any}
            value={
              sqlJson.aggs ?? {
                enabled: false,
                metrics: [],
                groupBy: [],
                derivedMetrics: [],
              }
            }
            onChange={setAggsInJson}
            collapsed={collapsedFor("aggs")}
            onToggleCollapsed={() => toggleSection("aggs")}
            collapsible={false}
            onHide={() => onHideSection("aggs")}
            onNext={goToDrawerStep("sorting")}
            onSubmit={closeDrawer}
            helpAction={helpActionForSection("aggs", "Aggregations")}
          />,
        ),
        sorting: wrap(
          "sorting",
          <SortingSection
            selectedColumns={selectedColumns}
            allColumns={allColumnKeysForFilters}
            value={sqlJson.sorting ?? []}
            onChange={setSortingInJson}
            onFocusColumn={() => {
              if (!visibleSections.columns) showSection("columns");
              expandSection("columns");
            }}
            collapsed={collapsedFor("sorting")}
            onToggleCollapsed={() => toggleSection("sorting")}
            collapsible={false}
            onHide={() => onHideSection("sorting")}
            onNext={goToPreviewFromDrawer}
            onSubmit={closeDrawer}
            helpAction={helpActionForSection("sorting", "Sorting")}
          />,
        ),
      }}
    />
  );
}
