import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  createSemanticRelationship,
  deleteSemanticRelationship,
  getSemanticRelationship,
  listSemanticRelationshipConcepts,
  listSemanticRelationships,
  patchSemanticRelationship,
  type SemanticRelationship,
  type SemanticRelationshipConcept,
  type SemanticRelationshipPatchPayload,
  type ServiceError,
} from "../../../shared/services/semantic";
import useSemanticAdminPermissions from "../lib/useSemanticAdminPermissions";
import ApiErrorBanner from "./components/ApiErrorBanner";
import ConfirmDialog from "./components/ConfirmDialog";
import DataTable, { type DataTableColumn } from "./components/DataTable";
import Drawer from "./components/Drawer";
import FormField from "./components/FormField";
import PaginationControls from "./components/PaginationControls";
import SemanticAdminShell from "./components/SemanticAdminShell";
import SemanticToast from "./components/Toast";
import "./styles/semanticAdmin.css";

type DrawerMode = "create" | "edit" | "view";

const LOOKUP_PAGE_SIZE = 25;
const LOOKUP_DEBOUNCE_MS = 300;

const relationshipFormSchema = z
  .object({
    parent_concept_id: z.coerce.number().int().positive("Parent concept is required."),
    child_concept_id: z.coerce.number().int().positive("Child concept is required."),
    relationship_type: z.string().trim().min(1, "Relationship type is required."),
  })
  .refine((value) => value.parent_concept_id !== value.child_concept_id, {
    path: ["child_concept_id"],
    message: "Parent and child concepts must be different.",
  });

type RelationshipFormValues = z.infer<typeof relationshipFormSchema>;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function toNumberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function formatRelationshipDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatDetailLines(details: unknown): string[] {
  if (!details) return [];
  if (typeof details === "string") return [details];
  if (Array.isArray(details)) return details.flatMap((entry) => formatDetailLines(entry));
  if (typeof details === "object") {
    const detailsRecord = details as Record<string, unknown>;
    if (Array.isArray(detailsRecord.errors)) {
      return detailsRecord.errors.flatMap((entry) => {
        if (typeof entry === "string") return [entry];
        if (entry && typeof entry === "object") {
          const item = entry as Record<string, unknown>;
          const field = typeof item.field === "string" ? `${item.field}: ` : "";
          const message = typeof item.message === "string" ? item.message : null;
          if (message) return [`${field}${message}`];
        }
        return [JSON.stringify(entry)];
      });
    }
    if (typeof detailsRecord.message === "string") return [detailsRecord.message];
    if (typeof detailsRecord.error === "string") return [detailsRecord.error];
  }
  return [];
}

function buildInlineErrorMessage(error: unknown, fallback: string): string {
  const serviceError = error as ServiceError | null;
  const message = serviceError?.message || fallback;
  const lines = formatDetailLines(serviceError?.details);
  return lines.length ? `${message} ${lines.join(" ")}` : message;
}

function conceptOptionLabel(option: SemanticRelationshipConcept): string {
  return option.display_label || option.name || option.concept_key || `Concept #${option.concept_id}`;
}

type ConceptLookupSelectorProps = {
  inputId: string;
  placeholder: string;
  vertical?: string;
  selected: SemanticRelationshipConcept | null;
  disabled?: boolean;
  onSelect: (concept: SemanticRelationshipConcept) => void;
  onClear: () => void;
};

function ConceptLookupSelector({
  inputId,
  placeholder,
  vertical,
  selected,
  disabled,
  onSelect,
  onClear,
}: ConceptLookupSelectorProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const debouncedInput = useDebouncedValue(inputValue, LOOKUP_DEBOUNCE_MS);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputValue(selected ? conceptOptionLabel(selected) : "");
  }, [selected]);

  useEffect(() => {
    if (!open) return;

    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [open]);

  const conceptsQ = useQuery({
    queryKey: [
      "semantic",
      "relationships",
      "concept-lookup",
      (vertical ?? "").trim(),
      debouncedInput.trim(),
    ],
    enabled: open && !disabled,
    queryFn: () =>
      listSemanticRelationshipConcepts({
        vertical: vertical?.trim() || undefined,
        q: debouncedInput.trim() || undefined,
        page: 1,
        page_size: LOOKUP_PAGE_SIZE,
      }),
    staleTime: 15_000,
  });

  const options = conceptsQ.data?.items ?? [];
  const showDropdown = open && !disabled;

  return (
    <div ref={rootRef} className="position-relative">
      <input
        id={inputId}
        className="form-control"
        placeholder={placeholder}
        value={inputValue}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const next = event.target.value;
          setInputValue(next);
          setOpen(true);
          if (selected && next !== conceptOptionLabel(selected)) {
            onClear();
          }
        }}
      />
      {showDropdown ? (
        <div className="semantic-admin-lookup-menu border rounded bg-white shadow-sm mt-1">
          {conceptsQ.isLoading ? (
            <div className="small text-muted px-3 py-2">Loading concepts...</div>
          ) : conceptsQ.isError ? (
            <div className="small text-danger px-3 py-2">Unable to load concepts.</div>
          ) : options.length === 0 ? (
            <div className="small text-muted px-3 py-2">No concepts found.</div>
          ) : (
            options.map((option) => (
              <button
                key={option.concept_id}
                type="button"
                className="list-group-item list-group-item-action border-0 text-start"
                onClick={() => {
                  onSelect(option);
                  setInputValue(conceptOptionLabel(option));
                  setOpen(false);
                }}
              >
                <div className="fw-semibold">{conceptOptionLabel(option)}</div>
                <div className="small text-muted">
                  ID {option.concept_id}
                  {option.concept_key ? ` · ${option.concept_key}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
      {selected ? (
        <div className="small text-muted mt-1">
          ID {selected.concept_id}
          {selected.concept_key ? ` · ${selected.concept_key}` : ""}
        </div>
      ) : null}
    </div>
  );
}

export function RelationshipsPage() {
  const queryClient = useQueryClient();
  const { canMutate } = useSemanticAdminPermissions();
  const supportsServerSearchRef = useRef(true);

  const [vertical, setVertical] = useState("");
  const [relationshipTypeFilter, setRelationshipTypeFilter] = useState("");
  const [parentIdFilter, setParentIdFilter] = useState("");
  const [childIdFilter, setChildIdFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [apiError, setApiError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<number | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<SemanticRelationship | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [parentConcept, setParentConcept] = useState<SemanticRelationshipConcept | null>(null);
  const [childConcept, setChildConcept] = useState<SemanticRelationshipConcept | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SemanticRelationship | null>(null);

  const parentId = toNumberOrUndefined(parentIdFilter);
  const childId = toNumberOrUndefined(childIdFilter);
  const debouncedSearch = useDebouncedValue(search, LOOKUP_DEBOUNCE_MS);
  const normalizedSearch = debouncedSearch.trim();

  const form = useForm<RelationshipFormValues>({
    resolver: zodResolver(relationshipFormSchema),
    defaultValues: {
      parent_concept_id: 0,
      child_concept_id: 0,
      relationship_type: "",
    },
  });

  const relationshipsQ = useQuery({
    queryKey: [
      "semantic",
      "relationships",
      vertical,
      relationshipTypeFilter,
      parentId,
      childId,
      normalizedSearch,
      page,
      pageSize,
      supportsServerSearchRef.current ? "server-search" : "local-search",
    ],
    queryFn: () => {
      const baseParams = {
        vertical: vertical.trim() || undefined,
        relationship_type: relationshipTypeFilter.trim() || undefined,
        parent_id: parentId,
        child_id: childId,
        parent_concept_id: parentId,
        child_concept_id: childId,
        page,
        page_size: pageSize,
      };

      if (!normalizedSearch || !supportsServerSearchRef.current) {
        return listSemanticRelationships(baseParams);
      }

      return listSemanticRelationships({
        ...baseParams,
        q: normalizedSearch,
      }).catch((error: unknown) => {
        const status = (error as { status?: number } | undefined)?.status;
        if (status === 400 || status === 404 || status === 500) {
          supportsServerSearchRef.current = false;
          return listSemanticRelationships(baseParams);
        }
        throw error;
      });
    },
    staleTime: 15_000,
  });

  const relationshipDetailQ = useQuery({
    queryKey: ["semantic", "relationships", "detail", selectedRelationshipId],
    enabled: drawerOpen && selectedRelationshipId != null && drawerMode !== "create",
    queryFn: () => getSemanticRelationship(Number(selectedRelationshipId)),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!relationshipDetailQ.data || drawerMode === "create") return;
    const relationship = relationshipDetailQ.data;
    setSelectedRelationship(relationship);
    form.reset({
      parent_concept_id: relationship.parent_concept_id,
      child_concept_id: relationship.child_concept_id,
      relationship_type: relationship.relationship_type,
    });
    setParentConcept({
      concept_id: relationship.parent_concept_id,
      concept_key: relationship.parent_concept_name ?? null,
      name: relationship.parent_concept_name ?? null,
      display_label:
        relationship.parent_display_label ??
        relationship.parent_concept_name ??
        `Concept #${relationship.parent_concept_id}`,
      vertical_norm: relationship.vertical_norm,
    });
    setChildConcept({
      concept_id: relationship.child_concept_id,
      concept_key: relationship.child_concept_name ?? null,
      name: relationship.child_concept_name ?? null,
      display_label:
        relationship.child_display_label ??
        relationship.child_concept_name ??
        `Concept #${relationship.child_concept_id}`,
      vertical_norm: relationship.vertical_norm,
    });
  }, [drawerMode, form, relationshipDetailQ.data]);

  const createM = useMutation({
    mutationFn: createSemanticRelationship,
    onSuccess: async () => {
      SemanticToast.success("Relationship created.");
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ["semantic", "relationships"] });
    },
    onError: (error) => {
      setFormError(buildInlineErrorMessage(error, "Unable to create relationship."));
    },
  });

  const patchM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SemanticRelationshipPatchPayload }) =>
      patchSemanticRelationship(id, payload),
    onSuccess: async () => {
      SemanticToast.success("Relationship updated.");
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ["semantic", "relationships"] });
    },
    onError: (error) => {
      setFormError(buildInlineErrorMessage(error, "Unable to update relationship."));
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteSemanticRelationship(id),
    onSuccess: async () => {
      SemanticToast.success("Relationship deleted.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "relationships"] });
    },
    onError: (error: unknown) => {
      setApiError(buildInlineErrorMessage(error, "Unable to delete relationship."));
    },
  });

  const rows = relationshipsQ.data?.items ?? [];
  const total = relationshipsQ.data?.total ?? 0;
  const normalizedLocalSearch = search.trim().toLowerCase();
  const filteredRows = normalizedLocalSearch
    ? rows.filter((row) =>
        [
          row.relationship_type,
          row.parent_display_label,
          row.parent_concept_name,
          row.child_display_label,
          row.child_concept_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedLocalSearch)
      )
    : rows;

  const columns = useMemo<DataTableColumn<SemanticRelationship>[]>(
    () => {
      const base: DataTableColumn<SemanticRelationship>[] = [
        {
          key: "id",
          label: "ID",
          render: (row) => <span className="text-muted small">#{row.id}</span>,
        },
        {
          key: "relationship_type",
          label: "Relationship Type",
          render: (row) => (
            <button
              type="button"
              className="semantic-admin-row-link"
              onClick={(event) => {
                event.stopPropagation();
                openDrawer(canMutate ? "edit" : "view", row);
              }}
            >
              {row.relationship_type}
            </button>
          ),
        },
        {
          key: "parent_display_label",
          label: "Parent Concept",
          render: (row) => (
            <div>
              <div>{row.parent_display_label ?? row.parent_concept_name ?? `Concept #${row.parent_concept_id}`}</div>
              <div className="small text-muted">ID {row.parent_concept_id}</div>
            </div>
          ),
        },
        {
          key: "child_display_label",
          label: "Child Concept",
          render: (row) => (
            <div>
              <div>{row.child_display_label ?? row.child_concept_name ?? `Concept #${row.child_concept_id}`}</div>
              <div className="small text-muted">ID {row.child_concept_id}</div>
            </div>
          ),
        },
        {
          key: "vertical_norm",
          label: "Vertical",
          render: (row) => row.vertical_norm || "-",
        },
        {
          key: "created_at",
          label: "Created",
          render: (row) => formatRelationshipDate(row.created_at),
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
              aria-label={`Delete relationship ${row.id}`}
              title="Delete"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget(row);
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

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerMode("create");
    setSelectedRelationshipId(null);
    setSelectedRelationship(null);
    setParentConcept(null);
    setChildConcept(null);
    setFormError(null);
    form.reset({
      parent_concept_id: 0,
      child_concept_id: 0,
      relationship_type: "",
    });
  }

  function openDrawer(mode: DrawerMode, row: SemanticRelationship | null) {
    setDrawerMode(mode);
    setDrawerOpen(true);
    setFormError(null);
    setSelectedRelationship(row);
    setSelectedRelationshipId(row?.id ?? null);

    if (row) {
      form.reset({
        parent_concept_id: row.parent_concept_id,
        child_concept_id: row.child_concept_id,
        relationship_type: row.relationship_type,
      });
      setParentConcept({
        concept_id: row.parent_concept_id,
        concept_key: row.parent_concept_name ?? null,
        name: row.parent_concept_name ?? null,
        display_label: row.parent_display_label ?? row.parent_concept_name ?? `Concept #${row.parent_concept_id}`,
        vertical_norm: row.vertical_norm,
      });
      setChildConcept({
        concept_id: row.child_concept_id,
        concept_key: row.child_concept_name ?? null,
        name: row.child_concept_name ?? null,
        display_label: row.child_display_label ?? row.child_concept_name ?? `Concept #${row.child_concept_id}`,
        vertical_norm: row.vertical_norm,
      });
    } else {
      form.reset({
        parent_concept_id: 0,
        child_concept_id: 0,
        relationship_type: "",
      });
      setParentConcept(null);
      setChildConcept(null);
    }
  }

  async function onSubmit(values: RelationshipFormValues) {
    setFormError(null);
    const payload = {
      parent_concept_id: values.parent_concept_id,
      child_concept_id: values.child_concept_id,
      relationship_type: values.relationship_type.trim(),
    };

    if (drawerMode === "create") {
      try {
        await createM.mutateAsync(payload);
      } catch {
        return;
      }
      return;
    }

    const current = relationshipDetailQ.data ?? selectedRelationship;
    if (!current) {
      throw new Error("No relationship selected.");
    }

    const patchPayload: SemanticRelationshipPatchPayload = {};
    if (payload.relationship_type !== current.relationship_type) {
      patchPayload.relationship_type = payload.relationship_type;
    }
    if (payload.parent_concept_id !== current.parent_concept_id) {
      patchPayload.parent_concept_id = payload.parent_concept_id;
    }
    if (payload.child_concept_id !== current.child_concept_id) {
      patchPayload.child_concept_id = payload.child_concept_id;
    }

    if (Object.keys(patchPayload).length === 0) {
      SemanticToast.success("No changes to save.");
      closeDrawer();
      return;
    }

    try {
      await patchM.mutateAsync({ id: current.id, payload: patchPayload });
    } catch {
      return;
    }
  }

  const readOnly = drawerMode === "view" || !canMutate;
  const isBusy = createM.isPending || patchM.isPending;
  const showDetailLoading = drawerMode !== "create" && relationshipDetailQ.isLoading;

  return (
    <SemanticAdminShell
      title="Semantic Relationships"
      subtitle="Manage semantic relationship links using concept labels instead of raw IDs."
      actions={
        canMutate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openDrawer("create", null)}>
            Create Relationship
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
          style={{ width: 220 }}
          placeholder="Relationship type"
          value={relationshipTypeFilter}
          onChange={(event) => {
            setRelationshipTypeFilter(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 170 }}
          placeholder="Parent ID"
          value={parentIdFilter}
          onChange={(event) => {
            setParentIdFilter(event.target.value.replace(/[^\d]/g, ""));
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 170 }}
          placeholder="Child ID"
          value={childIdFilter}
          onChange={(event) => {
            setChildIdFilter(event.target.value.replace(/[^\d]/g, ""));
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 280 }}
          placeholder="Search type or concept labels"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        onRowClick={(row) => openDrawer(canMutate ? "edit" : "view", row)}
        loading={relationshipsQ.isLoading}
        error={relationshipsQ.isError ? (relationshipsQ.error as Error).message : null}
        emptyText="No relationships found."
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
        title={
          drawerMode === "create"
            ? "Create Relationship"
            : drawerMode === "edit"
              ? "Edit Relationship"
              : "View Relationship"
        }
        onClose={closeDrawer}
        footer={
          readOnly ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeDrawer}>
              Close
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeDrawer}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-primary" disabled={isBusy} onClick={form.handleSubmit(onSubmit)}>
                {isBusy ? "Saving..." : "Save"}
              </button>
            </>
          )
        }
      >
        {showDetailLoading ? <div className="text-muted">Loading relationship details...</div> : null}
        {formError ? <div className="alert alert-danger py-2">{formError}</div> : null}
        {relationshipDetailQ.isError && drawerMode !== "create" ? (
          <div className="alert alert-warning py-2">Unable to refresh relationship details. You can still edit current values.</div>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField label="Relationship Type" error={form.formState.errors.relationship_type?.message}>
            <input className="form-control" {...form.register("relationship_type")} disabled={readOnly} />
          </FormField>

          <FormField label="Parent Concept" error={form.formState.errors.parent_concept_id?.message}>
            <ConceptLookupSelector
              inputId="semantic-relationship-parent"
              placeholder="Search parent concept"
              vertical={vertical}
              selected={parentConcept}
              disabled={readOnly}
              onSelect={(concept) => {
                setParentConcept(concept);
                form.setValue("parent_concept_id", concept.concept_id, { shouldDirty: true });
              }}
              onClear={() => {
                setParentConcept(null);
                form.setValue("parent_concept_id", 0, { shouldDirty: true });
              }}
            />
          </FormField>

          <FormField label="Child Concept" error={form.formState.errors.child_concept_id?.message}>
            <ConceptLookupSelector
              inputId="semantic-relationship-child"
              placeholder="Search child concept"
              vertical={vertical}
              selected={childConcept}
              disabled={readOnly}
              onSelect={(concept) => {
                setChildConcept(concept);
                form.setValue("child_concept_id", concept.concept_id, { shouldDirty: true });
              }}
              onClear={() => {
                setChildConcept(null);
                form.setValue("child_concept_id", 0, { shouldDirty: true });
              }}
            />
          </FormField>
        </form>
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete relationship?"
        body={
          deleteTarget
            ? `Delete "${deleteTarget.relationship_type}" between "${deleteTarget.parent_display_label ?? deleteTarget.parent_concept_name ?? `Concept #${deleteTarget.parent_concept_id}`}" and "${deleteTarget.child_display_label ?? deleteTarget.child_concept_name ?? `Concept #${deleteTarget.child_concept_id}`}"?`
            : "Delete this relationship?"
        }
        confirmText={deleteM.isPending ? "Deleting..." : "Delete"}
        onCancel={() => {
          if (!deleteM.isPending) setDeleteOpen(false);
        }}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteM.mutate(deleteTarget.id);
        }}
        loading={deleteM.isPending}
      />
    </SemanticAdminShell>
  );
}

export default RelationshipsPage;
