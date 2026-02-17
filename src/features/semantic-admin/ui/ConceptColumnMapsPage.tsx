import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  conceptColumnMapMutationSchema,
  createConceptColumnMap,
  deleteConceptColumnMap,
  listConceptColumnMaps,
  updateConceptColumnMap,
  type ConceptColumnMap,
  type ConceptColumnMapMutationPayload,
} from "../../../shared/services/semantic";
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

const defaultValues: ConceptColumnMapMutationPayload = {
  vertical_norm: "",
  semantic_concept_id: 0,
  model_column_id: 0,
  relationship_kind: "primary",
  weight: 1,
};

export function ConceptColumnMapsPage() {
  const queryClient = useQueryClient();
  const { canMutate } = useSemanticAdminPermissions();

  const [vertical, setVertical] = useState("");
  const [semanticConceptIdFilter, setSemanticConceptIdFilter] = useState("");
  const [modelColumnIdFilter, setModelColumnIdFilter] = useState("");
  const [relationshipKindFilter, setRelationshipKindFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [apiError, setApiError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedItem, setSelectedItem] = useState<ConceptColumnMap | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const mapsQ = useQuery({
    queryKey: [
      "semantic",
      "concept-column-maps",
      vertical,
      semanticConceptIdFilter,
      modelColumnIdFilter,
      relationshipKindFilter,
      page,
      pageSize,
    ],
    queryFn: () =>
      listConceptColumnMaps({
        vertical: vertical || undefined,
        semantic_concept_id: semanticConceptIdFilter ? Number(semanticConceptIdFilter) : undefined,
        model_column_id: modelColumnIdFilter ? Number(modelColumnIdFilter) : undefined,
        relationship_kind: relationshipKindFilter || undefined,
        page,
        page_size: pageSize,
      }),
    staleTime: 15_000,
  });

  const form = useForm<ConceptColumnMapMutationPayload>({
    resolver: zodResolver(conceptColumnMapMutationSchema),
    defaultValues,
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
          key: "model_table_name",
          label: "Table",
          render: (row) => row.model_table_name || "Unknown",
        },
        {
          key: "column_name",
          label: "Column",
          render: (row) => row.column_name || "Unknown",
        },
        {
          key: "relationship_kind",
          label: "Relationship Kind",
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
    if (item) {
      form.reset({
        vertical_norm: item.vertical_norm,
        semantic_concept_id: item.semantic_concept_id,
        model_column_id: item.model_column_id,
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

  const rows = mapsQ.data?.items ?? [];
  const total = mapsQ.data?.total ?? 0;
  const busy = createM.isPending || updateM.isPending;
  const readOnly = drawerMode === "view" || !canMutate;

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
          placeholder="Semantic concept id"
          value={semanticConceptIdFilter}
          onChange={(event) => {
            setSemanticConceptIdFilter(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 170 }}
          placeholder="Model column id"
          value={modelColumnIdFilter}
          onChange={(event) => {
            setModelColumnIdFilter(event.target.value);
            setPage(1);
          }}
        />
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

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={openExistingMap}
        loading={mapsQ.isLoading}
        error={mapsQ.isError ? (mapsQ.error as Error).message : null}
        emptyText="No concept-column maps found."
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
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={form.handleSubmit(onSubmit)}>
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
          <FormField label="Semantic Concept ID" error={form.formState.errors.semantic_concept_id?.message}>
            <input type="number" className="form-control" disabled={readOnly} {...form.register("semantic_concept_id", { valueAsNumber: true })} />
          </FormField>
          <FormField label="Model Column ID" error={form.formState.errors.model_column_id?.message}>
            <input type="number" className="form-control" disabled={readOnly} {...form.register("model_column_id", { valueAsNumber: true })} />
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
                  { shouldValidate: true }
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
