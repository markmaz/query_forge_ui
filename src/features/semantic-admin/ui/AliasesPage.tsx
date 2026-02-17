import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  conceptAliasMutationSchema,
  createConceptAlias,
  deleteConceptAlias,
  listConceptAliases,
  updateConceptAlias,
  type ConceptAlias,
  type ConceptAliasMutationPayload,
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
import { MATCH_KIND_OPTIONS } from "./constants";
import "./styles/semanticAdmin.css";

type DrawerMode = "create" | "edit" | "view";

const defaultValues: ConceptAliasMutationPayload = {
  vertical_norm: "",
  alias_key: "",
  concept_key: "",
  match_kind: "contains",
  weight: 1,
};

export function AliasesPage() {
  const queryClient = useQueryClient();
  const { canMutate } = useSemanticAdminPermissions();

  const [vertical, setVertical] = useState("");
  const [conceptKey, setConceptKey] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [apiError, setApiError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedAlias, setSelectedAlias] = useState<ConceptAlias | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const aliasesQ = useQuery({
    queryKey: ["semantic", "aliases", vertical, conceptKey, q, page, pageSize],
    queryFn: () =>
      listConceptAliases({
        vertical: vertical || undefined,
        concept_key: conceptKey || undefined,
        q: q || undefined,
        page,
        page_size: pageSize,
      }),
    staleTime: 15_000,
  });

  const form = useForm<ConceptAliasMutationPayload>({
    resolver: zodResolver(conceptAliasMutationSchema),
    defaultValues,
  });

  const createM = useMutation({
    mutationFn: (payload: ConceptAliasMutationPayload) => createConceptAlias(payload),
    onSuccess: async () => {
      SemanticToast.success("Alias created.");
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "aliases"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const updateM = useMutation({
    mutationFn: (payload: ConceptAliasMutationPayload) => {
      if (!selectedAlias) throw new Error("No alias selected.");
      return updateConceptAlias(selectedAlias.alias_id, payload);
    },
    onSuccess: async () => {
      SemanticToast.success("Alias updated.");
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "aliases"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const deleteM = useMutation({
    mutationFn: (aliasId: number) => deleteConceptAlias(aliasId),
    onSuccess: async () => {
      SemanticToast.success("Alias deleted.");
      setDeleteOpen(false);
      setSelectedAlias(null);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "aliases"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const openExistingAlias = (alias: ConceptAlias) => {
    openDrawer(canMutate ? "edit" : "view", alias);
  };

  const columns = useMemo<DataTableColumn<ConceptAlias>[]>(
    () => {
      const base: DataTableColumn<ConceptAlias>[] = [
        {
          key: "alias_key",
          label: "Alias Key",
          render: (row) => (
            <button
              type="button"
              className="semantic-admin-row-link"
              onClick={(event) => {
                event.stopPropagation();
                openExistingAlias(row);
              }}
            >
              {row.alias_key}
            </button>
          ),
        },
        {
          key: "concept_key",
          label: "Concept Key",
          render: (row) => row.concept_key,
        },
        {
          key: "vertical_norm",
          label: "Vertical",
          render: (row) => row.vertical_norm,
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
              aria-label={`Delete alias ${row.alias_key}`}
              title="Delete"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedAlias(row);
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

  function openDrawer(mode: DrawerMode, alias: ConceptAlias | null) {
    setDrawerMode(mode);
    setSelectedAlias(alias);
    if (alias) {
      form.reset({
        vertical_norm: alias.vertical_norm,
        alias_key: alias.alias_key,
        concept_key: alias.concept_key,
        match_kind: alias.match_kind,
        weight: alias.weight,
      });
    } else {
      form.reset(defaultValues);
    }
    setDrawerOpen(true);
  }

  async function onSubmit(values: ConceptAliasMutationPayload) {
    if (drawerMode === "edit") {
      await updateM.mutateAsync(values);
      return;
    }
    await createM.mutateAsync(values);
  }

  const rows = aliasesQ.data?.items ?? [];
  const total = aliasesQ.data?.total ?? 0;
  const busy = createM.isPending || updateM.isPending;
  const readOnly = drawerMode === "view" || !canMutate;

  return (
    <SemanticAdminShell
      title="Concept Aliases"
      subtitle="Maintain semantic alias matching and weights."
      actions={
        canMutate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openDrawer("create", null)}>
            Create Alias
          </button>
        ) : undefined
      }
    >
      <ApiErrorBanner message={apiError} onDismiss={() => setApiError(null)} />

      <div className="semantic-admin-toolbar">
        <input
          className="form-control form-control-sm"
          style={{ width: 180 }}
          placeholder="Vertical"
          value={vertical}
          onChange={(event) => {
            setVertical(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 200 }}
          placeholder="Concept key"
          value={conceptKey}
          onChange={(event) => {
            setConceptKey(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 240 }}
          placeholder="Search aliases"
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
        onRowClick={openExistingAlias}
        loading={aliasesQ.isLoading}
        error={aliasesQ.isError ? (aliasesQ.error as Error).message : null}
        emptyText="No aliases found."
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
        title={drawerMode === "create" ? "Create Alias" : drawerMode === "edit" ? "Edit Alias" : "View Alias"}
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
          <FormField label="Alias Key" error={form.formState.errors.alias_key?.message}>
            <input className="form-control" disabled={readOnly} {...form.register("alias_key")} />
          </FormField>
          <FormField label="Concept Key" error={form.formState.errors.concept_key?.message}>
            <input className="form-control" disabled={readOnly} {...form.register("concept_key")} />
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
        title="Delete Alias"
        message={`Delete alias "${selectedAlias?.alias_key ?? ""}"?`}
        confirmText="Delete"
        busy={deleteM.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!selectedAlias) return;
          deleteM.mutate(selectedAlias.alias_id);
        }}
      />
    </SemanticAdminShell>
  );
}

export default AliasesPage;
