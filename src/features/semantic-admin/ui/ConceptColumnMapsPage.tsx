import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactDOM from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";

import {
  conceptColumnMapMutationSchema,
  createConceptColumnMap,
  deleteConceptColumnMap,
  listConceptColumnMaps,
  listConcepts,
  updateConceptColumnMap,
  type ConceptColumnMap,
  type ConceptColumnMapListParams,
  type SemanticConcept,
  type ConceptColumnMapMutationPayload,
} from "../../../shared/services/semantic";
import {
  fetchWorkspaceTableColumns,
  fetchWorkspaceTables,
  type WorkspaceColumnRow,
  type WorkspaceTableRow,
} from "../../../shared/services/queryStudioAdminApi";
import { getApiWorkspaceId } from "../../../shared/services/api";
import useSemanticAdminPermissions from "../lib/useSemanticAdminPermissions";
import ApiErrorBanner from "./components/ApiErrorBanner";
import ConfirmDialog from "./components/ConfirmDialog";
import DataTable, { type DataTableColumn } from "./components/DataTable";
import Drawer from "./components/Drawer";
import FormField from "./components/FormField";
import PaginationControls from "./components/PaginationControls";
import SelectField from "./components/SelectField";
import SemanticAdminShell from "./components/SemanticAdminShell";
import SemanticToast from "./components/Toast";
import { RELATIONSHIP_KIND_OPTIONS } from "./constants";
import "./styles/semanticAdmin.css";

type DrawerMode = "create" | "edit" | "view";
const DEFAULT_PAGE_SIZE = 25;
const TYPEAHEAD_DEBOUNCE_MS = 300;
const LOOKUP_PAGE_SIZE = 100;
const SELECTED_ORANGE = "rgb(242, 74, 18)";

const sanitizeSearchInput = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();

const parsePositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

const defaultValues: ConceptColumnMapMutationPayload = {
  vertical_norm: "",
  semantic_concept_id: 0,
  workspace_column_id: 0,
  relationship_kind: "primary",
  weight: 1,
};

type SelectOption = {
  id: number;
  label: string;
  searchText: string;
  tableName?: string | null;
  columnName?: string | null;
  workspaceTableId?: number | null;
};

const formatConceptLabel = (concept: Pick<SemanticConcept, "concept_key" | "name">): string =>
  concept.name?.trim()
    ? `${concept.name.trim()} (${concept.concept_key})`
    : concept.concept_key;

const formatWorkspaceColumnLabel = (tableName: string | null | undefined, columnName: string): string =>
  tableName ? `${tableName}.${columnName}` : columnName;

type LookupDropdownProps = {
  value: SelectOption | null;
  options: SelectOption[];
  disabled?: boolean;
  loading?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  triggerAriaLabel: string;
  searchAriaLabel: string;
  searchValue: string;
  onSearchValueChange: (next: string) => void;
  onSelect: (option: SelectOption) => void;
  emptyText?: string;
  renderOption?: (option: SelectOption, selected: boolean) => ReactNode;
  renderValue?: (option: SelectOption) => ReactNode;
};

function LookupDropdown({
  value,
  options,
  disabled,
  loading,
  placeholder,
  searchPlaceholder,
  triggerAriaLabel,
  searchAriaLabel,
  searchValue,
  onSearchValueChange,
  onSelect,
  emptyText = "No matches.",
  renderOption,
  renderValue,
}: LookupDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const computeMenuPos = () => {
    const box = triggerRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!open) return;
    computeMenuPos();

    const onDocumentDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      onSearchValueChange("");
    };

    const onLayoutChange = () => computeMenuPos();
    document.addEventListener("mousedown", onDocumentDown);
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);

    return () => {
      document.removeEventListener("mousedown", onDocumentDown);
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
    };
  }, [open, onSearchValueChange]);

  const close = () => {
    setOpen(false);
    onSearchValueChange("");
  };

  return (
    <div className="position-relative" ref={triggerRef}>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        className="form-control d-flex align-items-center justify-content-between"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <span className="text-truncate" style={{ maxWidth: "92%" }}>
          {value ? (renderValue ? renderValue(value) : value.label) : <span className="text-muted">{placeholder}</span>}
        </span>
        <i className={`fa fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>

      {open && !disabled && menuPos
        ? ReactDOM.createPortal(
            <div
              ref={menuRef}
              className="border rounded shadow-sm bg-white position-absolute mt-1"
              style={{
                zIndex: 2100,
                width: menuPos.width,
                maxHeight: 340,
                overflow: "auto",
                top: menuPos.top,
                left: menuPos.left,
              }}
            >
              <div className="p-2 border-bottom">
                <input
                  className="form-control form-control-sm"
                  aria-label={searchAriaLabel}
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(event) => onSearchValueChange(event.target.value)}
                  autoFocus
                />
                <div className="small text-muted mt-2">
                  {loading ? "Loading..." : `${options.length} result${options.length === 1 ? "" : "s"}`}
                </div>
              </div>

              <div className="list-group list-group-flush">
                {options.length === 0 ? (
                  <div className="small text-muted px-3 py-2">{loading ? "Loading..." : emptyText}</div>
                ) : (
                  options.map((option) => {
                    const isSelected = value?.id === option.id;
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className="list-group-item list-group-item-action py-2"
                        onClick={() => {
                          onSelect(option);
                          close();
                        }}
                      >
                        {renderOption ? (
                          renderOption(option, isSelected)
                        ) : (
                          <span style={isSelected ? { color: SELECTED_ORANGE } : undefined}>{option.label}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="p-2 border-top d-flex justify-content-end">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={close}>
                  Close
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function ConceptColumnMapsPage() {
  const queryClient = useQueryClient();
  const { canMutate } = useSemanticAdminPermissions();
  const workspaceId = getApiWorkspaceId() ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const supportsServerTextFiltersRef = useRef(true);

  const [vertical, setVertical] = useState(() => searchParams.get("vertical") ?? "");
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [conceptKeyFilter, setConceptKeyFilter] = useState(() => searchParams.get("concept_key") ?? "");
  const [columnNameFilter, setColumnNameFilter] = useState(() => searchParams.get("column_name") ?? "");
  const [workspaceColumnIdFilter, setWorkspaceColumnIdFilter] = useState(() => searchParams.get("workspace_column_id") ?? "");
  const [relationshipKindFilter, setRelationshipKindFilter] = useState(() => searchParams.get("relationship_kind") ?? "");
  const [page, setPage] = useState(() => parsePositiveInt(searchParams.get("page"), 1));
  const [pageSize, setPageSize] = useState(() => {
    const parsed = parsePositiveInt(searchParams.get("page_size"), DEFAULT_PAGE_SIZE);
    return [10, 25, 50, 100].includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
  });
  const [apiError, setApiError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedItem, setSelectedItem] = useState<ConceptColumnMap | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [conceptLookupInput, setConceptLookupInput] = useState("");
  const [workspaceTableLookupInput, setWorkspaceTableLookupInput] = useState("");
  const [workspaceColumnLookupInput, setWorkspaceColumnLookupInput] = useState("");
  const debouncedQ = useDebouncedValue(q, TYPEAHEAD_DEBOUNCE_MS);
  const debouncedConceptKey = useDebouncedValue(conceptKeyFilter, TYPEAHEAD_DEBOUNCE_MS);
  const debouncedColumnName = useDebouncedValue(columnNameFilter, TYPEAHEAD_DEBOUNCE_MS);
  const debouncedConceptLookupInput = useDebouncedValue(conceptLookupInput, TYPEAHEAD_DEBOUNCE_MS);
  const debouncedWorkspaceTableLookupInput = useDebouncedValue(workspaceTableLookupInput, TYPEAHEAD_DEBOUNCE_MS);
  const debouncedWorkspaceColumnLookupInput = useDebouncedValue(workspaceColumnLookupInput, TYPEAHEAD_DEBOUNCE_MS);
  const readOnly = drawerMode === "view" || !canMutate;

  const normalizedVertical = sanitizeSearchInput(vertical);
  const normalizedQ = sanitizeSearchInput(debouncedQ);
  const normalizedConceptKey = sanitizeSearchInput(debouncedConceptKey);
  const normalizedColumnName = sanitizeSearchInput(debouncedColumnName);
  const normalizedWorkspaceColumnId = sanitizeSearchInput(workspaceColumnIdFilter);
  const hasTextFilters = Boolean(normalizedQ || normalizedConceptKey || normalizedColumnName);

  useEffect(() => {
    // One-time cleanup for legacy cache keys that were not workspace scoped.
    queryClient.removeQueries({ queryKey: ["semantic", "concept-column-maps"], exact: true });
  }, [queryClient]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    const verticalValue = sanitizeSearchInput(vertical);
    const qValue = sanitizeSearchInput(q);
    const conceptValue = sanitizeSearchInput(conceptKeyFilter);
    const columnValue = sanitizeSearchInput(columnNameFilter);

    if (verticalValue) nextParams.set("vertical", verticalValue);
    if (qValue) nextParams.set("q", qValue);
    if (conceptValue) nextParams.set("concept_key", conceptValue);
    if (columnValue) nextParams.set("column_name", columnValue);
    if (normalizedWorkspaceColumnId) nextParams.set("workspace_column_id", normalizedWorkspaceColumnId);
    if (relationshipKindFilter) nextParams.set("relationship_kind", relationshipKindFilter);
    if (page > 1) nextParams.set("page", String(page));
    if (pageSize !== DEFAULT_PAGE_SIZE) nextParams.set("page_size", String(pageSize));

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    vertical,
    q,
    conceptKeyFilter,
    columnNameFilter,
    relationshipKindFilter,
    normalizedWorkspaceColumnId,
    page,
    pageSize,
    searchParams,
    setSearchParams,
  ]);

  const mapsQ = useQuery({
    queryKey: [
      "semantic",
      "concept-column-maps",
      workspaceId,
      normalizedVertical,
      normalizedQ,
      normalizedConceptKey,
      normalizedColumnName,
      normalizedWorkspaceColumnId,
      relationshipKindFilter,
      page,
      pageSize,
    ],
    queryFn: () => {
      const params: ConceptColumnMapListParams = {
        page,
        page_size: pageSize,
      };
      if (normalizedVertical) params.vertical = normalizedVertical;
      if (relationshipKindFilter) params.relationship_kind = relationshipKindFilter;
      if (normalizedWorkspaceColumnId) {
        const id = Number(normalizedWorkspaceColumnId);
        if (Number.isFinite(id) && id > 0) {
          params.workspace_column_id = id;
        }
      }
      if (!hasTextFilters || !supportsServerTextFiltersRef.current) {
        return listConceptColumnMaps(params);
      }

      const withTextFilters: ConceptColumnMapListParams = {
        ...params,
        q: normalizedQ || undefined,
        concept_key: normalizedConceptKey || undefined,
        column_name: normalizedColumnName || undefined,
      };

      return listConceptColumnMaps(withTextFilters).catch((error: unknown) => {
        const status = (error as { status?: number } | undefined)?.status;
        if (status === 400 || status === 500) {
          supportsServerTextFiltersRef.current = false;
          return listConceptColumnMaps(params);
        }
        throw error;
      });
    },
    staleTime: 15_000,
  });

  const form = useForm<ConceptColumnMapMutationPayload>({
    resolver: zodResolver(conceptColumnMapMutationSchema),
    defaultValues,
  });
  const drawerVertical = form.watch("vertical_norm");
  const selectedConceptId = form.watch("semantic_concept_id");
  const selectedWorkspaceColumnId = form.watch("workspace_column_id");
  const [selectedWorkspaceTableId, setSelectedWorkspaceTableId] = useState<number | null>(null);

  const conceptsLookupQ = useQuery({
    queryKey: [
      "semantic",
      "concepts",
      "lookup",
      drawerOpen,
      sanitizeSearchInput(drawerVertical),
      sanitizeSearchInput(debouncedConceptLookupInput),
    ],
    enabled: drawerOpen && !readOnly,
    queryFn: () =>
      listConcepts({
        vertical: sanitizeSearchInput(drawerVertical) || undefined,
        q: sanitizeSearchInput(debouncedConceptLookupInput) || undefined,
        page: 1,
        page_size: LOOKUP_PAGE_SIZE,
      }),
    staleTime: 15_000,
  });

  const workspaceTablesLookupQ = useQuery({
    queryKey: [
      "workspace-tables",
      "lookup",
      workspaceId,
      drawerOpen,
      sanitizeSearchInput(debouncedWorkspaceTableLookupInput),
    ],
    enabled: drawerOpen && !readOnly,
    queryFn: () =>
      fetchWorkspaceTables({
        workspaceId: workspaceId || undefined,
        q: sanitizeSearchInput(debouncedWorkspaceTableLookupInput) || undefined,
        mapped: true,
        limit: LOOKUP_PAGE_SIZE,
        offset: 0,
      }),
    staleTime: 15_000,
  });

  const workspaceColumnsLookupQ = useQuery({
    queryKey: [
      "workspace-columns",
      "lookup",
      workspaceId,
      selectedWorkspaceTableId,
    ],
    enabled: drawerOpen && !readOnly && selectedWorkspaceTableId != null,
    queryFn: () =>
      fetchWorkspaceTableColumns(Number(selectedWorkspaceTableId), workspaceId || undefined),
    staleTime: 15_000,
  });

  const createM = useMutation({
    mutationFn: (payload: ConceptColumnMapMutationPayload) => createConceptColumnMap(payload),
    onSuccess: async () => {
      SemanticToast.success("Concept-column map created.");
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "concept-column-maps"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const updateM = useMutation({
    mutationFn: (payload: ConceptColumnMapMutationPayload) => {
      if (!selectedItem) throw new Error("No map selected.");
      return updateConceptColumnMap(selectedItem.map_id, payload);
    },
    onSuccess: async () => {
      SemanticToast.success("Concept-column map updated.");
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "concept-column-maps"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const deleteM = useMutation({
    mutationFn: (mapId: number) => deleteConceptColumnMap(mapId),
    onSuccess: async () => {
      SemanticToast.success("Concept-column map deleted.");
      setDeleteOpen(false);
      setSelectedItem(null);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "concept-column-maps"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const openExistingMap = (item: ConceptColumnMap) => {
    openDrawer(canMutate ? "edit" : "view", item);
  };

  const columns = useMemo<DataTableColumn<ConceptColumnMap>[]>(
    () => {
      const base: DataTableColumn<ConceptColumnMap>[] = [
        {
          key: "concept_key",
          label: "Concept Key",
          render: (row) => (
            <button
              type="button"
              className="semantic-admin-row-link"
              onClick={(event) => {
                event.stopPropagation();
                openExistingMap(row);
              }}
            >
              {row.concept_key || "Unknown"}
            </button>
          ),
        },
        {
          key: "concept_name",
          label: "Concept Name",
          render: (row) => row.concept_name || "Unknown",
        },
        {
          key: "column_name",
          label: "Column Name",
          render: (row) => row.column_name || "Unknown",
        },
        {
          key: "model_table_name",
          label: "Model Table",
          render: (row) => row.model_table_name || "Unknown",
        },
        {
          key: "relationship_kind",
          label: "Relationship",
          render: (row) => (
            <span className="badge text-bg-light border">{row.relationship_kind}</span>
          ),
        },
        {
          key: "weight",
          label: "Weight",
          render: (row) => row.weight,
        },
      ];

      if (canMutate) {
        base.push({
          key: "actions",
          label: "",
          className: "text-end",
          headerClassName: "text-end",
          render: (row) => (
            <button
              type="button"
              className="semantic-admin-delete-btn"
              aria-label={`Delete concept-column map ${row.map_id}`}
              title="Delete"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedItem(row);
                setDeleteOpen(true);
              }}
            >
              <i className="fa fa-trash" />
            </button>
          ),
        });
      }

      return base;
    },
    [canMutate]
  );

  function openDrawer(mode: DrawerMode, item: ConceptColumnMap | null) {
    setDrawerMode(mode);
    setSelectedItem(item);
    setConceptLookupInput("");
    setWorkspaceTableLookupInput("");
    setWorkspaceColumnLookupInput("");
    setSelectedWorkspaceTableId(null);
    if (item) {
      form.reset({
        vertical_norm: item.vertical_norm,
        semantic_concept_id: item.semantic_concept_id,
        workspace_column_id: item.workspace_column_id ?? 0,
        relationship_kind: item.relationship_kind as ConceptColumnMapMutationPayload["relationship_kind"],
        weight: item.weight,
      });
    } else {
      form.reset(defaultValues);
    }
    setDrawerOpen(true);
  }

  async function onSubmit(values: ConceptColumnMapMutationPayload) {
    if (drawerMode === "edit") {
      await updateM.mutateAsync(values);
      return;
    }
    await createM.mutateAsync(values);
  }

  const rawRows = mapsQ.data?.items ?? [];
  const useLocalTextFilterFallback = hasTextFilters && !supportsServerTextFiltersRef.current;
  const rows = useMemo(() => {
    if (!useLocalTextFilterFallback) return rawRows;
    return rawRows.filter((row) => {
      const qHaystack = [
        row.concept_key ?? "",
        row.concept_name ?? "",
        row.column_name ?? "",
        row.model_table_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const conceptKey = (row.concept_key ?? "").toLowerCase();
      const columnName = (row.column_name ?? "").toLowerCase();
      const qMatch = !normalizedQ || qHaystack.includes(normalizedQ);
      const conceptMatch = !normalizedConceptKey || conceptKey.includes(normalizedConceptKey);
      const columnMatch = !normalizedColumnName || columnName.includes(normalizedColumnName);
      return qMatch && conceptMatch && columnMatch;
    });
  }, [
    useLocalTextFilterFallback,
    rawRows,
    normalizedQ,
    normalizedConceptKey,
    normalizedColumnName,
  ]);
  const total = useLocalTextFilterFallback ? rows.length : (mapsQ.data?.total ?? 0);
  const conceptOptions = useMemo<SelectOption[]>(() => {
    const map = new Map<number, SelectOption>();
    (conceptsLookupQ.data?.items ?? []).forEach((concept) => {
      map.set(concept.concept_id, {
        id: concept.concept_id,
        label: formatConceptLabel(concept),
        searchText: `${concept.concept_key} ${concept.name ?? ""}`.toLowerCase(),
      });
    });

    if (selectedItem?.semantic_concept_id && !map.has(selectedItem.semantic_concept_id)) {
      map.set(selectedItem.semantic_concept_id, {
        id: selectedItem.semantic_concept_id,
        label: selectedItem.concept_key
          ? selectedItem.concept_name
            ? `${selectedItem.concept_name} (${selectedItem.concept_key})`
            : selectedItem.concept_key
          : `Concept #${selectedItem.semantic_concept_id}`,
        searchText: `${selectedItem.concept_key ?? ""} ${selectedItem.concept_name ?? ""}`.toLowerCase(),
      });
    }

    return [...map.values()];
  }, [conceptsLookupQ.data?.items, selectedItem]);
  const workspaceTableOptions = useMemo<SelectOption[]>(() => {
    const map = new Map<number, SelectOption>();
    (workspaceTablesLookupQ.data?.rows ?? []).forEach((table: WorkspaceTableRow) => {
      const id = Number(table.workspace_table_id);
      if (!Number.isFinite(id) || id <= 0) return;
      const tableName = table.full_name || table.table_name || `workspace_table_${id}`;
      map.set(id, {
        id,
        label: tableName,
        searchText: `${tableName} ${table.table_name ?? ""}`.toLowerCase(),
      });
    });

    if (selectedWorkspaceTableId && !map.has(selectedWorkspaceTableId)) {
      map.set(selectedWorkspaceTableId, {
        id: selectedWorkspaceTableId,
        label: `workspace_table_${selectedWorkspaceTableId}`,
        searchText: String(selectedWorkspaceTableId),
      });
    }

    return [...map.values()];
  }, [workspaceTablesLookupQ.data?.rows, selectedWorkspaceTableId]);
  const workspaceColumnOptions = useMemo<SelectOption[]>(() => {
    const map = new Map<number, SelectOption>();
    const activeTableOption =
      workspaceTableOptions.find((option) => option.id === selectedWorkspaceTableId) ?? null;
    const activeTableLabel = activeTableOption?.label ?? null;

    (workspaceColumnsLookupQ.data?.rows ?? []).forEach((column: WorkspaceColumnRow) => {
      const id = Number(column.id);
      const columnName = String(column.column_name ?? "").trim();
      if (!Number.isFinite(id) || id <= 0 || !columnName) return;
      map.set(id, {
        id,
        label: formatWorkspaceColumnLabel(activeTableLabel, columnName),
        searchText: `${columnName} ${id}`.toLowerCase(),
        tableName: activeTableLabel,
        columnName,
        workspaceTableId: selectedWorkspaceTableId,
      });
    });

    if (selectedItem?.workspace_column_id && !map.has(selectedItem.workspace_column_id)) {
      map.set(selectedItem.workspace_column_id, {
        id: selectedItem.workspace_column_id,
        label: selectedItem.column_name
          ? formatWorkspaceColumnLabel(selectedItem.model_table_name, selectedItem.column_name)
          : `Workspace column #${selectedItem.workspace_column_id}`,
        searchText: `${selectedItem.column_name ?? ""} ${selectedItem.workspace_column_id}`.toLowerCase(),
        tableName: selectedItem.model_table_name ?? null,
        columnName: selectedItem.column_name ?? null,
      });
    }

    return [...map.values()];
  }, [workspaceColumnsLookupQ.data?.rows, workspaceTableOptions, selectedWorkspaceTableId, selectedItem]);
  const selectedConceptOption = conceptOptions.find((option) => option.id === selectedConceptId) ?? null;
  const selectedWorkspaceTableOption =
    workspaceTableOptions.find((option) => option.id === selectedWorkspaceTableId) ?? null;
  const selectedWorkspaceColumnOption =
    workspaceColumnOptions.find((option) => option.id === selectedWorkspaceColumnId) ?? null;
  const filteredConceptOptions = useMemo(() => {
    const term = sanitizeSearchInput(conceptLookupInput).toLowerCase();
    if (!term) return conceptOptions;
    return conceptOptions.filter((option) => option.searchText.includes(term));
  }, [conceptOptions, conceptLookupInput]);
  const filteredWorkspaceTableOptions = useMemo(() => {
    const term = sanitizeSearchInput(workspaceTableLookupInput).toLowerCase();
    if (!term) return workspaceTableOptions;
    return workspaceTableOptions.filter((option) => option.searchText.includes(term));
  }, [workspaceTableOptions, workspaceTableLookupInput]);
  const filteredWorkspaceColumnOptions = useMemo(() => {
    const term = sanitizeSearchInput(workspaceColumnLookupInput).toLowerCase();
    if (!term) return workspaceColumnOptions;
    return workspaceColumnOptions.filter((option) => option.searchText.includes(term));
  }, [workspaceColumnOptions, workspaceColumnLookupInput]);
  const conceptKeySuggestions = useMemo(() => {
    const uniqueValues = new Set<string>();
    rows.forEach((row) => {
      if (row.concept_key) uniqueValues.add(row.concept_key);
    });
    return [...uniqueValues].sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const columnNameSuggestions = useMemo(() => {
    const uniqueValues = new Set<string>();
    rows.forEach((row) => {
      if (row.column_name) uniqueValues.add(row.column_name);
    });
    return [...uniqueValues].sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const globalSuggestions = useMemo(() => {
    const uniqueValues = new Set<string>();
    rows.forEach((row) => {
      if (row.concept_key) uniqueValues.add(row.concept_key);
      if (row.concept_name) uniqueValues.add(row.concept_name);
      if (row.column_name) uniqueValues.add(row.column_name);
      if (row.model_table_name) uniqueValues.add(row.model_table_name);
    });
    return [...uniqueValues].sort((a, b) => a.localeCompare(b)).slice(0, 100);
  }, [rows]);
  const busy = createM.isPending || updateM.isPending;
  const canSubmitMap =
    !readOnly &&
    !busy &&
    sanitizeSearchInput(form.watch("vertical_norm")).length > 0 &&
    selectedConceptId > 0 &&
    selectedWorkspaceColumnId > 0;

  return (
    <SemanticAdminShell
      title="Concept-Column Maps"
      subtitle="Control concept-to-column relationships used for constrained planning."
      actions={
        canMutate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openDrawer("create", null)}>
            Create Map
          </button>
        ) : undefined
      }
    >
      <ApiErrorBanner message={apiError} onDismiss={() => setApiError(null)} />

      <div className="semantic-admin-toolbar">
        <input
          className="form-control form-control-sm"
          style={{ width: 320 }}
          placeholder="Search concept, concept name, column, table..."
          value={q}
          list="concept-column-maps-global-suggestions"
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
        <datalist id="concept-column-maps-global-suggestions">
          {globalSuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <input
          className="form-control form-control-sm"
          style={{ width: 170 }}
          placeholder="Vertical"
          value={vertical}
          onChange={(event) => {
            setVertical(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 190 }}
          placeholder="Concept key"
          value={conceptKeyFilter}
          list="concept-column-maps-concept-key-suggestions"
          onChange={(event) => {
            setConceptKeyFilter(event.target.value);
            setPage(1);
          }}
        />
        <datalist id="concept-column-maps-concept-key-suggestions">
          {conceptKeySuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <input
          className="form-control form-control-sm"
          style={{ width: 170 }}
          placeholder="Column name"
          value={columnNameFilter}
          list="concept-column-maps-column-name-suggestions"
          onChange={(event) => {
            setColumnNameFilter(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 190 }}
          placeholder="Workspace column ID"
          value={workspaceColumnIdFilter}
          onChange={(event) => {
            setWorkspaceColumnIdFilter(event.target.value.replace(/[^\d]/g, ""));
            setPage(1);
          }}
        />
        <datalist id="concept-column-maps-column-name-suggestions">
          {columnNameSuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <select
          className="form-select form-select-sm"
          style={{ width: 190 }}
          value={relationshipKindFilter}
          onChange={(event) => {
            setRelationshipKindFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any relationship</option>
          {RELATIONSHIP_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {mapsQ.isError ? (
        <div className="d-flex justify-content-end mb-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void mapsQ.refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={openExistingMap}
        loading={mapsQ.isLoading || mapsQ.isFetching}
        error={mapsQ.isError ? (mapsQ.error as Error).message : null}
        emptyText="No mappings found."
      />

      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
      />

      <Drawer
        open={drawerOpen}
        title={drawerMode === "create" ? "Create Concept-Column Map" : drawerMode === "edit" ? "Edit Concept-Column Map" : "View Concept-Column Map"}
        onClose={() => setDrawerOpen(false)}
        footer={
          readOnly ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDrawerOpen(false)}>
              Close
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDrawerOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-primary" disabled={!canSubmitMap} onClick={form.handleSubmit(onSubmit)}>
                {busy ? "Saving..." : "Save"}
              </button>
            </>
          )
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField label="Vertical" error={form.formState.errors.vertical_norm?.message}>
            <input className="form-control" disabled={readOnly} {...form.register("vertical_norm")} />
          </FormField>
          <FormField
            label="Semantic Concept"
            error={conceptsLookupQ.isError ? "Unable to load semantic concepts." : form.formState.errors.semantic_concept_id?.message}
          >
            <LookupDropdown
              value={selectedConceptOption}
              options={filteredConceptOptions}
              disabled={readOnly}
              loading={conceptsLookupQ.isLoading || conceptsLookupQ.isFetching}
              placeholder="Select semantic concept"
              searchPlaceholder="Search concept by name or key"
              triggerAriaLabel="Semantic Concept"
              searchAriaLabel="Search semantic concept"
              searchValue={conceptLookupInput}
              onSearchValueChange={setConceptLookupInput}
              onSelect={(option) => {
                form.setValue("semantic_concept_id", option.id, { shouldDirty: true, shouldTouch: true });
                form.clearErrors("semantic_concept_id");
              }}
              renderOption={(option, selected) => (
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <span className="text-truncate" style={selected ? { color: SELECTED_ORANGE } : undefined}>
                    {option.label}
                  </span>
                  {selected ? (
                    <span
                      className="badge"
                      style={{
                        color: SELECTED_ORANGE,
                        background: "rgba(242, 74, 18, 0.12)",
                        border: "1px solid rgba(242, 74, 18, 0.25)",
                      }}
                    >
                      Selected
                    </span>
                  ) : null}
                </div>
              )}
              renderValue={(option) => <span>{option.label}</span>}
            />
          </FormField>
          <FormField
            label="Workspace Table"
            error={workspaceTablesLookupQ.isError ? "Unable to load workspace tables." : undefined}
          >
            <LookupDropdown
              value={selectedWorkspaceTableOption}
              options={filteredWorkspaceTableOptions}
              disabled={readOnly}
              loading={workspaceTablesLookupQ.isLoading || workspaceTablesLookupQ.isFetching}
              placeholder="Select workspace table"
              searchPlaceholder="Search workspace table"
              triggerAriaLabel="Workspace Table"
              searchAriaLabel="Search workspace table"
              searchValue={workspaceTableLookupInput}
              onSearchValueChange={setWorkspaceTableLookupInput}
              onSelect={(option) => {
                setSelectedWorkspaceTableId(option.id);
                form.setValue("workspace_column_id", 0, { shouldDirty: true, shouldTouch: true });
                form.clearErrors("workspace_column_id");
                setWorkspaceColumnLookupInput("");
              }}
              renderOption={(option, selected) => (
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <span className="text-truncate">
                    <span style={selected ? { color: SELECTED_ORANGE } : undefined}>
                      {option.label}
                    </span>
                  </span>
                  {selected ? (
                    <span
                      className="badge"
                      style={{
                        color: SELECTED_ORANGE,
                        background: "rgba(242, 74, 18, 0.12)",
                        border: "1px solid rgba(242, 74, 18, 0.25)",
                      }}
                    >
                      Selected
                    </span>
                  ) : null}
                </div>
              )}
              renderValue={(option) => <span>{option.label}</span>}
            />
          </FormField>
          <FormField
            label="Workspace Column"
            error={
              workspaceColumnsLookupQ.isError
                ? "Unable to load workspace columns."
                : form.formState.errors.workspace_column_id?.message
            }
          >
            <LookupDropdown
              value={selectedWorkspaceColumnOption}
              options={filteredWorkspaceColumnOptions}
              disabled={readOnly || !selectedWorkspaceTableId}
              loading={workspaceColumnsLookupQ.isLoading || workspaceColumnsLookupQ.isFetching}
              placeholder={
                selectedWorkspaceTableId ? "Select workspace column" : "Select a workspace table first"
              }
              searchPlaceholder="Search workspace column"
              triggerAriaLabel="Workspace Column"
              searchAriaLabel="Search workspace column"
              searchValue={workspaceColumnLookupInput}
              onSearchValueChange={setWorkspaceColumnLookupInput}
              onSelect={(option) => {
                form.setValue("workspace_column_id", option.id, { shouldDirty: true, shouldTouch: true });
                form.clearErrors("workspace_column_id");
              }}
              renderOption={(option, selected) => (
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <span className="text-truncate">
                    {option.tableName ? <span className="text-muted">{option.tableName}.</span> : null}
                    <span style={selected ? { color: SELECTED_ORANGE } : undefined}>
                      {option.columnName ?? option.label}
                    </span>
                  </span>
                  <span className="text-muted small">#{option.id}</span>
                </div>
              )}
              renderValue={(option) => (
                <span>
                  {option.tableName ? <span className="text-muted">{option.tableName}.</span> : null}
                  <span>{option.columnName ?? option.label}</span>
                </span>
              )}
            />
          </FormField>
          <FormField label="Relationship Kind" error={form.formState.errors.relationship_kind?.message}>
            <SelectField
              options={RELATIONSHIP_KIND_OPTIONS}
              disabled={readOnly}
              value={form.watch("relationship_kind")}
              onChange={(event) =>
                form.setValue(
                  "relationship_kind",
                  event.target.value as ConceptColumnMapMutationPayload["relationship_kind"],
                  { shouldDirty: true, shouldTouch: true }
                )
              }
            />
          </FormField>
          <FormField label="Weight" error={form.formState.errors.weight?.message}>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              className="form-control"
              disabled={readOnly}
              {...form.register("weight", { valueAsNumber: true })}
            />
          </FormField>
        </form>
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Concept-Column Map"
        message={`Delete map #${selectedItem?.map_id ?? ""}?`}
        confirmText="Delete"
        busy={deleteM.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!selectedItem) return;
          deleteM.mutate(selectedItem.map_id);
        }}
      />
    </SemanticAdminShell>
  );
}

export default ConceptColumnMapsPage;
