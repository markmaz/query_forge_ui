import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";

import {
  createValueAlias,
  deleteValueAlias,
  listConceptColumnMaps,
  listConceptKeys,
  listConcepts,
  listValueAliases,
  updateValueAlias,
  valueAliasMutationSchema,
  type ValueAlias,
  type ValueAliasMutationPayload,
} from "../../../shared/services/semantic";
import { routes } from "../../../app/navigation/routes";
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
import { MATCH_KIND_OPTIONS } from "./constants";
import "./styles/semanticAdmin.css";

type DrawerMode = "create" | "edit" | "view";

const parsePositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const defaultValues: ValueAliasMutationPayload = {
  semantic_concept_id: 0,
  canonical_value: "",
  alias_value: "",
  match_kind: "contains",
  weight: 1,
};

export function ValueAliasesPage() {
  const queryClient = useQueryClient();
  const { canMutate } = useSemanticAdminPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const [semanticConceptIdFilter, setSemanticConceptIdFilter] = useState(() => searchParams.get("semantic_concept_id") ?? "");
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [page, setPage] = useState(() => parsePositiveInt(searchParams.get("page"), 1));
  const [pageSize, setPageSize] = useState(() => {
    const parsed = parsePositiveInt(searchParams.get("page_size"), 25);
    return [10, 25, 50, 100].includes(parsed) ? parsed : 25;
  });
  const [apiError, setApiError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedItem, setSelectedItem] = useState<ValueAlias | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const valueAliasesQ = useQuery({
    queryKey: ["semantic", "value-aliases", semanticConceptIdFilter, q, page, pageSize],
    queryFn: () =>
      listValueAliases({
        semantic_concept_id: semanticConceptIdFilter ? Number(semanticConceptIdFilter) : undefined,
        q: q || undefined,
        page,
        page_size: pageSize,
      }),
    staleTime: 15_000,
  });

  const form = useForm<ValueAliasMutationPayload>({
    resolver: zodResolver(valueAliasMutationSchema),
    defaultValues,
  });
  const editableDrawer = drawerOpen && drawerMode !== "view" && canMutate;
  const [selectedConceptKey, setSelectedConceptKey] = useState("");

  useEffect(() => {
    const nextParams = new URLSearchParams();
    const normalizedConceptId = semanticConceptIdFilter.trim();
    const normalizedQuery = q.trim();

    if (normalizedConceptId) nextParams.set("semantic_concept_id", normalizedConceptId);
    if (normalizedQuery) nextParams.set("q", normalizedQuery);
    if (page > 1) nextParams.set("page", String(page));
    if (pageSize !== 25) nextParams.set("page_size", String(pageSize));

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [page, pageSize, q, searchParams, semanticConceptIdFilter, setSearchParams]);

  const conceptKeysQ = useQuery({
    queryKey: ["semantic", "concepts", "keys", "value-aliases"],
    queryFn: () => listConceptKeys(),
    enabled: editableDrawer,
    staleTime: 15_000,
  });

  const conceptsQ = useQuery({
    queryKey: ["semantic", "concepts", "value-aliases"],
    queryFn: () =>
      listConcepts({
        page: 1,
        page_size: 500,
      }),
    enabled: editableDrawer,
    staleTime: 15_000,
  });
  const loadedConcepts = conceptsQ.data?.items ?? [];
  const selectedConceptPresentInLoadedList = loadedConcepts.some((item) => item.concept_key === selectedConceptKey);

  const selectedConceptLookupQ = useQuery({
    queryKey: ["semantic", "concepts", "value-aliases", "lookup", selectedConceptKey],
    queryFn: () =>
      listConcepts({
        q: selectedConceptKey || undefined,
        page: 1,
        page_size: 25,
      }),
    enabled:
      editableDrawer &&
      selectedConceptKey.trim().length > 0 &&
      !selectedConceptPresentInLoadedList,
    staleTime: 15_000,
  });

  const conceptIdByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of loadedConcepts) {
      map.set(item.concept_key, item.concept_id);
    }
    for (const item of selectedConceptLookupQ.data?.items ?? []) {
      map.set(item.concept_key, item.concept_id);
    }
    return map;
  }, [loadedConcepts, selectedConceptLookupQ.data?.items]);

  const conceptKeyById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of loadedConcepts) {
      map.set(item.concept_id, item.concept_key);
    }
    for (const item of selectedConceptLookupQ.data?.items ?? []) {
      map.set(item.concept_id, item.concept_key);
    }
    return map;
  }, [loadedConcepts, selectedConceptLookupQ.data?.items]);

  useEffect(() => {
    if (!editableDrawer) return;
    const semanticConceptId = form.getValues("semantic_concept_id");
    if (!semanticConceptId || semanticConceptId <= 0) return;
    if (selectedConceptKey && conceptIdByKey.get(selectedConceptKey) === semanticConceptId) return;
    const mappedKey = conceptKeyById.get(semanticConceptId);
    if (mappedKey) {
      setSelectedConceptKey(mappedKey);
    }
  }, [conceptIdByKey, conceptKeyById, editableDrawer, form, selectedConceptKey]);

  useEffect(() => {
    if (!editableDrawer) return;
    if (!selectedConceptKey.trim()) return;
    const resolvedConceptId = conceptIdByKey.get(selectedConceptKey) ?? 0;
    if (resolvedConceptId <= 0) return;
    if (form.getValues("semantic_concept_id") === resolvedConceptId) return;
    form.setValue("semantic_concept_id", resolvedConceptId, {
      shouldDirty: true,
      shouldTouch: true,
    });
    form.clearErrors("semantic_concept_id");
  }, [conceptIdByKey, editableDrawer, form, selectedConceptKey]);

  const createM = useMutation({
    mutationFn: (payload: ValueAliasMutationPayload) => createValueAlias(payload),
    onSuccess: async () => {
      SemanticToast.success("Value alias created.");
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "value-aliases"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const updateM = useMutation({
    mutationFn: (payload: ValueAliasMutationPayload) => {
      if (!selectedItem) throw new Error("No value alias selected.");
      return updateValueAlias(selectedItem.value_alias_id, payload);
    },
    onSuccess: async () => {
      SemanticToast.success("Value alias updated.");
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "value-aliases"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const deleteM = useMutation({
    mutationFn: (valueAliasId: number) => deleteValueAlias(valueAliasId),
    onSuccess: async () => {
      SemanticToast.success("Value alias deleted.");
      setDeleteOpen(false);
      setSelectedItem(null);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "value-aliases"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const openExistingValueAlias = (item: ValueAlias) => {
    openDrawer(canMutate ? "edit" : "view", item);
  };

  const columns = useMemo<DataTableColumn<ValueAlias>[]>(
    () => {
      const base: DataTableColumn<ValueAlias>[] = [
        {
          key: "canonical_value",
          label: "Canonical Value",
          render: (row) => row.canonical_value,
        },
        {
          key: "alias_value",
          label: "Alias Value",
          render: (row) => (
            <button
              type="button"
              className="semantic-admin-row-link"
              onClick={(event) => {
                event.stopPropagation();
                openExistingValueAlias(row);
              }}
            >
              {row.alias_value}
            </button>
          ),
        },
        {
          key: "concept_name",
          label: "Concept Name",
          render: (row) => row.concept_name ?? "Unknown",
        },
        {
          key: "match_kind",
          label: "Match",
          render: (row) => (
            <div className="d-flex gap-2 align-items-center">
              <span className="badge text-bg-light border">{row.match_kind}</span>
              <span className="small text-muted">weight {row.weight}</span>
            </div>
          ),
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
              aria-label={`Delete value alias ${row.alias_value}`}
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

  function openDrawer(mode: DrawerMode, valueAlias: ValueAlias | null) {
    setDrawerMode(mode);
    setSelectedItem(valueAlias);
    if (valueAlias) {
      form.reset({
        semantic_concept_id: valueAlias.semantic_concept_id,
        canonical_value: valueAlias.canonical_value,
        alias_value: valueAlias.alias_value,
        match_kind: valueAlias.match_kind,
        weight: valueAlias.weight,
      });
      setSelectedConceptKey(valueAlias.concept_key ?? "");
    } else {
      form.reset(defaultValues);
      setSelectedConceptKey("");
    }
    setDrawerOpen(true);
  }

  async function onSubmit(values: ValueAliasMutationPayload) {
    if (drawerMode === "edit") {
      await updateM.mutateAsync(values);
      return;
    }
    await createM.mutateAsync(values);
  }

  const rows = valueAliasesQ.data?.items ?? [];
  const total = valueAliasesQ.data?.total ?? 0;
  const busy = createM.isPending || updateM.isPending;
  const readOnly = drawerMode === "view" || !canMutate;
  const conceptKeyOptions = conceptKeysQ.data?.concept_keys ?? [];
  const conceptLookupError = conceptKeysQ.isError
    ? "Unable to load semantic concept keys."
    : conceptsQ.isError
      ? "Unable to load semantic concepts."
      : selectedConceptLookupQ.isError
        ? "Unable to resolve selected semantic concept."
      : null;
  const conceptKeySelected = conceptKeyOptions.includes(selectedConceptKey);
  const selectedConceptId =
    conceptKeySelected && conceptIdByKey.has(selectedConceptKey) ? conceptIdByKey.get(selectedConceptKey) ?? 0 : 0;
  const conceptMapsQ = useQuery({
    queryKey: ["semantic", "concept-column-maps", "value-aliases-link", selectedConceptId],
    queryFn: () =>
      listConceptColumnMaps({
        semantic_concept_id: selectedConceptId,
        page: 1,
        page_size: 5,
      }),
    enabled: drawerOpen && selectedConceptId > 0,
    staleTime: 15_000,
  });
  const selectedConceptMapCount = conceptMapsQ.data?.total ?? conceptMapsQ.data?.items.length ?? 0;
  const conceptMapsHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedConceptId > 0) params.set("semantic_concept_id", String(selectedConceptId));
    const query = params.toString();
    return query ? `${routes.SemanticConceptColumnMaps}?${query}` : routes.SemanticConceptColumnMaps;
  }, [selectedConceptId]);
  const conceptKeyOutsideOptions =
    editableDrawer &&
    !conceptKeysQ.isLoading &&
    !conceptLookupError &&
    selectedConceptKey.trim().length > 0 &&
    !conceptKeySelected;
  const conceptKeyUnmapped =
    editableDrawer &&
    !conceptKeysQ.isLoading &&
    !conceptsQ.isLoading &&
    !selectedConceptLookupQ.isLoading &&
    !conceptLookupError &&
    conceptKeySelected &&
    selectedConceptId <= 0;
  const conceptKeyFieldError =
    conceptLookupError ??
    (conceptKeyOutsideOptions
      ? "Select a concept key from the dropdown."
      : conceptKeyUnmapped
        ? "Unable to resolve concept id for selected concept key."
        : form.formState.errors.semantic_concept_id?.message);
  const disableAliasSubmit =
    editableDrawer &&
    (
      conceptKeysQ.isLoading ||
      conceptsQ.isLoading ||
      selectedConceptLookupQ.isLoading ||
      Boolean(conceptLookupError) ||
      selectedConceptId <= 0
    );
  const submitDisabled = busy || disableAliasSubmit;
  const submitText = drawerMode === "create" ? "Create Value Alias" : "Save";
  const submitBusyText = drawerMode === "create" ? "Creating..." : "Saving...";

  function onConceptKeyChange(value: string) {
    setSelectedConceptKey(value);
    form.setValue("semantic_concept_id", conceptIdByKey.get(value) ?? 0, { shouldDirty: true });
  }

  return (
    <SemanticAdminShell
      title="Value Aliases"
      subtitle="Manage canonical values and synonym matching for semantic concepts."
      actions={
        canMutate ? (
          <div className="d-flex gap-2">
            <Link className="btn btn-outline-secondary btn-sm" to={routes.SemanticConceptColumnMaps}>
              Column Maps
            </Link>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openDrawer("create", null)}>
              Create Value Alias
            </button>
          </div>
        ) : undefined
      }
    >
      <ApiErrorBanner message={apiError} onDismiss={() => setApiError(null)} />

      <div className="semantic-admin-toolbar">
        <input
          className="form-control form-control-sm"
          style={{ width: 220 }}
          placeholder="Semantic concept id"
          value={semanticConceptIdFilter}
          onChange={(event) => {
            setSemanticConceptIdFilter(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 240 }}
          placeholder="Search values"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={openExistingValueAlias}
        loading={valueAliasesQ.isLoading}
        error={valueAliasesQ.isError ? (valueAliasesQ.error as Error).message : null}
        emptyText="No value aliases found."
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
        title={drawerMode === "create" ? "Create Value Alias" : drawerMode === "edit" ? "Edit Value Alias" : "View Value Alias"}
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
              <button type="button" className="btn btn-sm btn-primary" onClick={form.handleSubmit(onSubmit)} disabled={submitDisabled}>
                {busy ? submitBusyText : submitText}
              </button>
            </>
          )
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {drawerMode !== "view" ? (
            <FormField label="Concept Key" error={conceptKeyFieldError}>
              <>
                <div className="input-group">
                  <input
                    list="semantic-value-alias-concept-keys"
                    className="form-control"
                    disabled={readOnly || conceptKeysQ.isLoading || conceptsQ.isLoading || Boolean(conceptLookupError)}
                    value={selectedConceptKey}
                    placeholder={
                      conceptKeysQ.isLoading || conceptsQ.isLoading
                        ? "Loading concept keys..."
                        : selectedConceptLookupQ.isLoading
                          ? "Resolving selected concept..."
                          : "Search concept key"
                    }
                    onChange={(event) => onConceptKeyChange(event.target.value)}
                  />
                  {conceptKeysQ.isLoading || conceptsQ.isLoading || selectedConceptLookupQ.isLoading ? (
                    <span className="input-group-text">
                      <span
                        className="spinner-border spinner-border-sm"
                        role="status"
                        aria-label={selectedConceptLookupQ.isLoading ? "Resolving selected concept" : "Loading concept keys"}
                      />
                    </span>
                  ) : null}
                </div>
                <datalist id="semantic-value-alias-concept-keys">
                  {conceptKeyOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </>
            </FormField>
          ) : (
            <FormField label="Semantic Concept ID" error={form.formState.errors.semantic_concept_id?.message}>
              <input type="number" className="form-control" disabled={readOnly} {...form.register("semantic_concept_id", { valueAsNumber: true })} />
            </FormField>
          )}
          {drawerOpen && selectedConceptId > 0 ? (
            <div
              className={`alert ${selectedConceptMapCount > 0 ? "alert-info" : "alert-warning"} py-2 px-3 small`}
              role="status"
            >
              {conceptMapsQ.isLoading ? (
                <span>Checking concept-column maps for this concept...</span>
              ) : conceptMapsQ.isError ? (
                <>
                  <span>Unable to confirm whether this concept is mapped to any workspace columns.</span>{" "}
                  <Link className="alert-link" to={conceptMapsHref}>
                    Open Column Maps
                  </Link>
                </>
              ) : selectedConceptMapCount > 0 ? (
                <>
                  <span>
                    This concept has {selectedConceptMapCount} column map{selectedConceptMapCount === 1 ? "" : "s"}.
                    Value aliases only affect planner filters when the concept is assigned to workspace columns.
                  </span>{" "}
                  <Link className="alert-link" to={conceptMapsHref}>
                    View Column Maps
                  </Link>
                </>
              ) : (
                <>
                  <span>
                    No column maps exist for this concept yet. Value aliases alone will not rewrite planner filters until
                    the concept is assigned to at least one workspace column.
                  </span>{" "}
                  <Link className="alert-link" to={conceptMapsHref}>
                    Map Columns For This Concept
                  </Link>
                </>
              )}
            </div>
          ) : null}
          <FormField label="Canonical Value" error={form.formState.errors.canonical_value?.message}>
            <input className="form-control" disabled={readOnly} {...form.register("canonical_value")} />
          </FormField>
          <FormField label="Alias Value" error={form.formState.errors.alias_value?.message}>
            <input className="form-control" disabled={readOnly} {...form.register("alias_value")} />
          </FormField>
          <FormField label="Match Kind" error={form.formState.errors.match_kind?.message}>
            <SelectField
              options={MATCH_KIND_OPTIONS}
              disabled={readOnly}
              value={form.watch("match_kind")}
              onChange={(event) => form.setValue("match_kind", event.target.value, { shouldValidate: true })}
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
        title="Delete Value Alias"
        message={`Delete alias value "${selectedItem?.alias_value ?? ""}"?`}
        confirmText="Delete"
        busy={deleteM.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!selectedItem) return;
          deleteM.mutate(selectedItem.value_alias_id);
        }}
      />
    </SemanticAdminShell>
  );
}

export default ValueAliasesPage;
