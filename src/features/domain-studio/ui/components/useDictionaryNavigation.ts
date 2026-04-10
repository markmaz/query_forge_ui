// src/features/domain-studio/ui/components/useDictionaryNavigation.ts
import { useEffect, useRef, useState } from "react";
import type { Table } from "@tanstack/react-table";
import type { WorkspaceDictionaryColumn } from "../../../../shared/services/queryStudioAdminApi";
import { toColumnLookupKey } from "./dictionaryTabUtils";

export interface UseDictionaryNavigationInput {
  selectedTable: { id: number; name: string } | null;
  rows: WorkspaceDictionaryColumn[];
  isGlobalSearchMode: boolean;
  tableFilter: string;
  filteredTableNames: Array<{ id: number; name: string }>;
  pagination: { pageIndex: number; pageSize: number };
  tableInst: Table<WorkspaceDictionaryColumn>;
}

export function useDictionaryNavigation({
  selectedTable,
  rows,
  isGlobalSearchMode,
  tableFilter,
  filteredTableNames,
  pagination,
  tableInst,
}: UseDictionaryNavigationInput) {
  const rowRefMap = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const tableButtonRefMap = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pulseTimerRef = useRef<number | null>(null);
  const [pulsedColumnKey, setPulsedColumnKey] = useState<string | null>(null);
  const [jumpToColumn, setJumpToColumn] = useState<{
    tableName: string;
    columnName: string;
  } | null>(null);

  // Cleanup pulse timer on unmount
  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null)
        window.clearTimeout(pulseTimerRef.current);
    };
  }, []);

  // Jump-to-column: scroll to page, then scroll row into view and pulse
  useEffect(() => {
    if (!jumpToColumn || !selectedTable) return;

    const selectedLower = selectedTable.name.toLowerCase();
    const targetTableLower = jumpToColumn.tableName.toLowerCase();
    if (selectedLower !== targetTableLower) return;

    const targetIndex = rows.findIndex(
      (row) =>
        row.column_name.toLowerCase() === jumpToColumn.columnName.toLowerCase(),
    );
    if (targetIndex < 0) return;

    const nextPage = Math.floor(targetIndex / pagination.pageSize);
    if (pagination.pageIndex !== nextPage) {
      tableInst.setPageIndex(nextPage);
      return;
    }

    const key = toColumnLookupKey(selectedTable.name, jumpToColumn.columnName);
    const rowEl = rowRefMap.current.get(key);
    if (!rowEl) return;

    if (typeof rowEl.scrollIntoView === "function") {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setPulsedColumnKey(key);
    if (pulseTimerRef.current !== null)
      window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => {
      setPulsedColumnKey((current) => (current === key ? null : current));
    }, 2000);
    setJumpToColumn(null);
  }, [
    jumpToColumn,
    selectedTable,
    rows,
    pagination.pageIndex,
    pagination.pageSize,
    tableInst,
  ]);

  // Scroll the selected table button into view in the sidebar
  useEffect(() => {
    if (!selectedTable || isGlobalSearchMode) return;

    if (
      tableFilter &&
      !filteredTableNames.some((t) => t.id === selectedTable.id)
    ) {
      return;
    }

    const btn = tableButtonRefMap.current.get(selectedTable.name);
    if (!btn) return;
    window.requestAnimationFrame(() => {
      if (typeof btn.scrollIntoView === "function") {
        btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }, [selectedTable, isGlobalSearchMode, tableFilter, filteredTableNames]);

  return {
    rowRefMap,
    tableButtonRefMap,
    jumpToColumn,
    setJumpToColumn,
    pulsedColumnKey,
  };
}
