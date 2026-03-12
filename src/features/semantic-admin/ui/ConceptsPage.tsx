import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useAppSelector } from "../../../shared/runtime/hooks";
import {
  createConcept,
  deleteConcept,
  listConcepts,
  rebuildSemanticPlanIndexes,
  type SemanticPlanIndexRebuildStepResult,
  rebuildSemanticConceptVectors,
  seedConcepts,
  updateConcept,
  type ConceptMutationPayload,
  type ServiceError,
  type SemanticConcept,
  conceptMutationSchema,
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
import { STATUS_OPTIONS } from "./constants";
import "./styles/semanticAdmin.css";

type DrawerMode = "create" | "edit" | "view";

const defaultConceptValues: ConceptMutationPayload = {
  vertical_norm: "",
  concept_key: "",
  name: "",
  description: "",
  semantic_type: "",
  sub_type: "",
  entity: "",
  granularity_rank: null,
  filter_allowed: false,
  group_by_allowed: false,
  aggregation_allowed: false,
  is_identifier: false,
  is_metric: false,
  display_priority: null,
  sensitive: false,
  status: "active",
};

function conceptToFormValues(concept: SemanticConcept): ConceptMutationPayload {
  return {
    vertical_norm: concept.vertical_norm,
    concept_key: concept.concept_key,
    name: concept.name ?? "",
    description: concept.description ?? "",
    semantic_type: concept.semantic_type,
    sub_type: concept.sub_type ?? "",
    entity: concept.entity ?? "",
    granularity_rank: concept.granularity_rank ?? null,
    filter_allowed: concept.filter_allowed,
    group_by_allowed: concept.group_by_allowed,
    aggregation_allowed: concept.aggregation_allowed,
    is_identifier: concept.is_identifier,
    is_metric: concept.is_metric,
    display_priority: concept.display_priority ?? null,
    sensitive: concept.sensitive,
    status: concept.status,
  };
}

export function ConceptsPage() {
  const queryClient = useQueryClient();
  const { canMutate } = useSemanticAdminPermissions();
  const workspaceId = useAppSelector((state) => state.userWorkspaces.selectedWorkspaceId ?? "");

  const [vertical, setVertical] = useState("");
  const [semanticType, setSemanticType] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [apiError, setApiError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedConcept, setSelectedConcept] = useState<SemanticConcept | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedVertical, setSeedVertical] = useState("");
  const [rebuildConfirmOpen, setRebuildConfirmOpen] = useState(false);
  const [rebuildVerticalInput, setRebuildVerticalInput] = useState("");
  const [rebuildPlanOpen, setRebuildPlanOpen] = useState(false);
  const [rebuildPlanVerticalInput, setRebuildPlanVerticalInput] = useState("");
  const [rebuildPlanProgress, setRebuildPlanProgress] = useState<string | null>(null);
  const [rebuildPlanResults, setRebuildPlanResults] = useState<SemanticPlanIndexRebuildStepResult[]>([]);
  const [rebuildPlanSummary, setRebuildPlanSummary] = useState<string | null>(null);
  const [rebuildPlanShowDetails, setRebuildPlanShowDetails] = useState(false);

  const conceptsQ = useQuery({
    queryKey: ["semantic", "concepts", vertical, semanticType, q, page, pageSize],
    queryFn: () =>
      listConcepts({
        vertical: vertical || undefined,
        semantic_type: semanticType || undefined,
        q: q || undefined,
        page,
        page_size: pageSize,
      }),
    staleTime: 15_000,
  });

  const form = useForm<ConceptMutationPayload>({
    resolver: zodResolver(conceptMutationSchema),
    defaultValues: defaultConceptValues,
  });

  const createM = useMutation({
    mutationFn: (payload: ConceptMutationPayload) => createConcept(payload),
    onSuccess: async () => {
      SemanticToast.success("Concept created.");
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "concepts"] });
    },
    onError: (error: Error) => {
      setApiError(error.message);
    },
  });

  const updateM = useMutation({
    mutationFn: (payload: ConceptMutationPayload) => {
      if (!selectedConcept) throw new Error("No concept selected.");
      return updateConcept(selectedConcept.concept_id, payload);
    },
    onSuccess: async () => {
      SemanticToast.success("Concept updated.");
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "concepts"] });
    },
    onError: (error: Error) => {
      setApiError(error.message);
    },
  });

  const deleteM = useMutation({
    mutationFn: (conceptId: number) => deleteConcept(conceptId),
    onSuccess: async () => {
      SemanticToast.success("Concept deleted.");
      setDeleteOpen(false);
      setSelectedConcept(null);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "concepts"] });
    },
    onError: (error: Error) => {
      setApiError(error.message);
    },
  });

  const seedM = useMutation({
    mutationFn: (seedValue: string) => seedConcepts(seedValue),
    onSuccess: async () => {
      SemanticToast.success("Seed process started.");
      setSeedOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["semantic", "concepts"] });
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const rebuildM = useMutation({
    mutationFn: (verticalNorm: string) => rebuildSemanticConceptVectors(verticalNorm),
    onSuccess: (result, verticalNorm) => {
      const summary =
        (typeof result.summary === "string" && result.summary.trim()) ||
        (typeof result.message === "string" && result.message.trim()) ||
        `vertical: ${result.vertical_norm ?? verticalNorm}`;
      SemanticToast.success(`Vector index rebuild started (${summary}).`);
      setRebuildConfirmOpen(false);
    },
    onError: (error: ServiceError) => {
      const message = error.status === 403 ? "Admin access required" : error.message;
      setApiError(message);
      SemanticToast.error(message);
      setRebuildConfirmOpen(false);
    },
  });

  const rebuildPlanM = useMutation({
    mutationFn: async ({ verticalNorm, currentWorkspaceId }: { verticalNorm: string; currentWorkspaceId: string }) =>
      rebuildSemanticPlanIndexes(
        {
          vertical_norm: verticalNorm,
          workspace_id: currentWorkspaceId,
        },
        {
          onStepStart: (step) => {
            setRebuildPlanProgress(step.progressLabel);
          },
          onStepComplete: (result) => {
            setRebuildPlanResults((previous) => [...previous, result]);
          },
        }
      ),
    onSuccess: (results, variables) => {
      setRebuildPlanProgress(null);
      const failed = results.filter((step) => !step.ok);
      const successCount = results.length - failed.length;
      const summary =
        failed.length === 0
          ? `Completed. ${successCount}/${results.length} steps succeeded.`
          : `Completed with partial failure. ${successCount}/${results.length} steps succeeded and ${failed.length} failed.`;
      setRebuildPlanSummary(summary);
      if (failed.length === 0) {
        SemanticToast.success(`Semantic plan index rebuild completed for "${variables.verticalNorm}".`);
      } else {
        SemanticToast.error(summary);
      }
    },
    onError: (error: Error) => {
      setRebuildPlanProgress(null);
      setRebuildPlanSummary("Unable to start semantic plan index rebuild.");
      setApiError(error.message);
    },
  });

  const rebuildVerticalNorm = rebuildVerticalInput.trim() || "generic";
  const rebuildPlanVerticalNorm = rebuildPlanVerticalInput.trim() || "generic";

  const openExistingConcept = (concept: SemanticConcept) => {
    openDrawer(canMutate ? "edit" : "view", concept);
  };

  const formatDetailsSnippet = (value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "string") return value.slice(0, 800);
    try {
      const json = JSON.stringify(value, null, 2);
      return json.length > 800 ? `${json.slice(0, 800)}…` : json;
    } catch {
      return String(value).slice(0, 800);
    }
  };

  const columns = useMemo<DataTableColumn<SemanticConcept>[]>(
    () => {
      const base: DataTableColumn<SemanticConcept>[] = [
        {
          key: "name",
          label: "Name",
          render: (row) => (
            <div>
              <button
                type="button"
                className="semantic-admin-row-link"
                onClick={(event) => {
                  event.stopPropagation();
                  openExistingConcept(row);
                }}
              >
                {row.name ?? row.concept_key}
              </button>
              <div className="small text-muted">{row.concept_key}</div>
            </div>
          ),
        },
        {
          key: "type",
          label: "Type",
          render: (row) => (
            <div>
              <div>{row.semantic_type}</div>
              <div className="small text-muted">{row.sub_type ?? "-"}</div>
            </div>
          ),
        },
        {
          key: "vertical",
          label: "Vertical",
          render: (row) => row.vertical_norm || "-",
        },
        {
          key: "flags",
          label: "Flags",
          render: (row) => (
            <div className="d-flex gap-1 flex-wrap">
              {row.filter_allowed ? <span className="badge text-bg-light border">Filter</span> : null}
              {row.group_by_allowed ? <span className="badge text-bg-light border">Group By</span> : null}
              {row.aggregation_allowed ? <span className="badge text-bg-light border">Aggregate</span> : null}
              {row.sensitive ? <span className="badge text-bg-warning">Sensitive</span> : null}
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
              aria-label={`Delete concept ${row.name ?? row.concept_key}`}
              title="Delete"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedConcept(row);
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

  function openDrawer(mode: DrawerMode, concept: SemanticConcept | null) {
    setDrawerMode(mode);
    setSelectedConcept(concept);
    form.reset(concept ? conceptToFormValues(concept) : defaultConceptValues);
    setDrawerOpen(true);
  }

  async function onSubmit(values: ConceptMutationPayload) {
    const payload: ConceptMutationPayload = {
      ...values,
      description: values.description || null,
      sub_type: values.sub_type || null,
      entity: values.entity || null,
      granularity_rank: values.granularity_rank ?? null,
      display_priority: values.display_priority ?? null,
    };

    if (drawerMode === "edit") {
      await updateM.mutateAsync(payload);
      return;
    }
    await createM.mutateAsync(payload);
  }

  const listRows = conceptsQ.data?.items ?? [];
  const total = conceptsQ.data?.total ?? 0;
  const busy = createM.isPending || updateM.isPending;
  const readOnly = drawerMode === "view" || !canMutate;

  return (
    <SemanticAdminShell
      title="Semantic Concepts"
      subtitle="Manage concept registry metadata used by planner and retrieval."
      actions={
        <div className="d-flex gap-2">
          {canMutate ? (
            <>
              <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setSeedOpen(true)}>
                Seed
              </button>
              <button
                type="button"
                className="btn btn-outline-dark btn-sm"
                disabled={rebuildM.isPending}
                onClick={() => {
                  setRebuildVerticalInput(vertical.trim());
                  setRebuildConfirmOpen(true);
                }}
              >
                {rebuildM.isPending ? "Rebuilding..." : "Rebuild Vector Index"}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={rebuildPlanM.isPending || !workspaceId}
                title={!workspaceId ? "Select a workspace before rebuilding plan indexes." : undefined}
                onClick={() => {
                  setRebuildPlanVerticalInput(vertical.trim());
                  setRebuildPlanProgress(null);
                  setRebuildPlanResults([]);
                  setRebuildPlanSummary(null);
                  setRebuildPlanShowDetails(false);
                  setRebuildPlanOpen(true);
                }}
              >
                {rebuildPlanM.isPending ? "Rebuilding Plan Indexes..." : "Rebuild Semantic Plan Indexes"}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openDrawer("create", null)}>
                Create Concept
              </button>
            </>
          ) : null}
        </div>
      }
    >
      <ApiErrorBanner message={apiError} onDismiss={() => setApiError(null)} />

      <div className="semantic-admin-toolbar">
        <input
          className="form-control form-control-sm"
          style={{ width: 190 }}
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
          placeholder="Semantic type"
          value={semanticType}
          onChange={(event) => {
            setSemanticType(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="form-control form-control-sm"
          style={{ width: 260 }}
          placeholder="Search concepts"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        rows={listRows}
        onRowClick={openExistingConcept}
        loading={conceptsQ.isLoading}
        error={conceptsQ.isError ? (conceptsQ.error as Error).message : null}
        emptyText="No semantic concepts found."
      />

      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
      />

      <Drawer
        open={drawerOpen}
        title={drawerMode === "create" ? "Create Concept" : drawerMode === "edit" ? "Edit Concept" : "View Concept"}
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
              <button type="button" className="btn btn-sm btn-primary" onClick={form.handleSubmit(onSubmit)} disabled={busy}>
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

          <FormField label="Concept Key" error={form.formState.errors.concept_key?.message}>
            <input className="form-control" disabled={readOnly} {...form.register("concept_key")} />
          </FormField>

          <FormField label="Name" error={form.formState.errors.name?.message}>
            <input className="form-control" disabled={readOnly} {...form.register("name")} />
          </FormField>

          <FormField label="Description">
            <textarea className="form-control" rows={3} disabled={readOnly} {...form.register("description")} />
          </FormField>

          <div className="row">
            <div className="col-md-6">
              <FormField label="Semantic Type" error={form.formState.errors.semantic_type?.message}>
                <input className="form-control" disabled={readOnly} {...form.register("semantic_type")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Sub Type">
                <input className="form-control" disabled={readOnly} {...form.register("sub_type")} />
              </FormField>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormField label="Entity">
                <input className="form-control" disabled={readOnly} {...form.register("entity")} />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Status" error={form.formState.errors.status?.message}>
                <select className="form-select" disabled={readOnly} {...form.register("status")}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormField label="Granularity Rank">
                <input
                  type="number"
                  className="form-control"
                  disabled={readOnly}
                  {...form.register("granularity_rank", {
                    setValueAs: (value) => (value === "" ? null : Number(value)),
                  })}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Display Priority">
                <input
                  type="number"
                  className="form-control"
                  disabled={readOnly}
                  {...form.register("display_priority", {
                    setValueAs: (value) => (value === "" ? null : Number(value)),
                  })}
                />
              </FormField>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <div className="form-check mb-2">
                <input id="filter_allowed" type="checkbox" className="form-check-input" disabled={readOnly} {...form.register("filter_allowed")} />
                <label htmlFor="filter_allowed" className="form-check-label">
                  Filter Allowed
                </label>
              </div>
              <div className="form-check mb-2">
                <input id="group_by_allowed" type="checkbox" className="form-check-input" disabled={readOnly} {...form.register("group_by_allowed")} />
                <label htmlFor="group_by_allowed" className="form-check-label">
                  Group By Allowed
                </label>
              </div>
              <div className="form-check mb-2">
                <input
                  id="aggregation_allowed"
                  type="checkbox"
                  className="form-check-input"
                  disabled={readOnly}
                  {...form.register("aggregation_allowed")}
                />
                <label htmlFor="aggregation_allowed" className="form-check-label">
                  Aggregation Allowed
                </label>
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-check mb-2">
                <input id="is_identifier" type="checkbox" className="form-check-input" disabled={readOnly} {...form.register("is_identifier")} />
                <label htmlFor="is_identifier" className="form-check-label">
                  Identifier
                </label>
              </div>
              <div className="form-check mb-2">
                <input id="is_metric" type="checkbox" className="form-check-input" disabled={readOnly} {...form.register("is_metric")} />
                <label htmlFor="is_metric" className="form-check-label">
                  Metric
                </label>
              </div>
              <div className="form-check mb-2">
                <input id="sensitive" type="checkbox" className="form-check-input" disabled={readOnly} {...form.register("sensitive")} />
                <label htmlFor="sensitive" className="form-check-label">
                  Sensitive
                </label>
              </div>
            </div>
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Concept"
        message={`Delete concept "${selectedConcept?.name ?? selectedConcept?.concept_key ?? ""}"? This cannot be undone.`}
        confirmText="Delete"
        busy={deleteM.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!selectedConcept) return;
          deleteM.mutate(selectedConcept.concept_id);
        }}
      />

      <ConfirmDialog
        open={rebuildConfirmOpen}
        title="Rebuild Concept Vector Index"
        message={
          <>
            <p className="mb-3">
              Rebuild vector indexes for semantic concepts? This will re-embed concepts for the selected vertical and may
              take a few minutes. Enter a vertical (e.g., "education") or leave blank to use "generic".
            </p>
            <FormField label="Vertical">
              <input
                className="form-control"
                placeholder="education"
                value={rebuildVerticalInput}
                onChange={(event) => setRebuildVerticalInput(event.target.value)}
              />
            </FormField>
          </>
        }
        confirmText="Rebuild Indexes"
        cancelText="Cancel"
        busy={rebuildM.isPending}
        onCancel={() => {
          setRebuildConfirmOpen(false);
          setRebuildVerticalInput("");
        }}
        onConfirm={() => rebuildM.mutate(rebuildVerticalNorm)}
      />

      {rebuildPlanOpen ? (
        <div
          className="semantic-admin-dialog-backdrop"
          role="presentation"
          onClick={() => {
            if (!rebuildPlanM.isPending) setRebuildPlanOpen(false);
          }}
        >
          <div className="semantic-admin-dialog" role="dialog" aria-modal="true" aria-label="Rebuild semantic plan indexes?" onClick={(event) => event.stopPropagation()}>
            <div className="semantic-admin-dialog-header">Rebuild semantic plan indexes?</div>
            <div className="semantic-admin-dialog-body">
              <p className="mb-3">
                This will rebuild concept, column/table, and domain indexes used by semantic planning. It may take a few minutes.
              </p>
              <FormField label="Vertical (optional)">
                <input
                  className="form-control"
                  placeholder="generic"
                  value={rebuildPlanVerticalInput}
                  disabled={rebuildPlanM.isPending}
                  onChange={(event) => setRebuildPlanVerticalInput(event.target.value)}
                />
              </FormField>

              {rebuildPlanM.isPending && rebuildPlanProgress ? (
                <div className="alert alert-info py-2 mb-2">{rebuildPlanProgress}</div>
              ) : null}

              {rebuildPlanResults.length > 0 ? (
                <div className="mb-2">
                  <div className="fw-semibold mb-1">Step Results</div>
                  <ul className="list-unstyled mb-0">
                    {rebuildPlanResults.map((result) => (
                      <li key={result.id} className="small mb-1">
                        <strong>{result.progressLabel.replace("...", "")}:</strong>{" "}
                        {result.ok ? "Success" : "Failed"}
                        {typeof result.status === "number" ? ` (HTTP ${result.status})` : ""}
                        {!result.ok && result.errorMessage ? ` - ${result.errorMessage}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rebuildPlanSummary ? (
                <div
                  className={`alert py-2 mb-2 ${
                    rebuildPlanResults.some((step) => !step.ok) ? "alert-warning" : "alert-success"
                  }`}
                >
                  {rebuildPlanSummary}
                </div>
              ) : null}

              {rebuildPlanResults.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary mb-2"
                  onClick={() => setRebuildPlanShowDetails((current) => !current)}
                >
                  {rebuildPlanShowDetails ? "Hide details" : "View details"}
                </button>
              ) : null}

              {rebuildPlanShowDetails && rebuildPlanResults.length > 0 ? (
                <div className="semantic-admin-card p-2">
                  {rebuildPlanResults.map((result) => (
                    <div key={`${result.id}-details`} className="mb-2">
                      <div className="fw-semibold small">{result.progressLabel.replace("...", "")}</div>
                      <div className="small text-muted">Endpoint: {result.endpoint}</div>
                      <div className="small text-muted">
                        Status Code: {typeof result.status === "number" ? result.status : "n/a"}
                      </div>
                      <div className="small text-muted">Payload:</div>
                      <pre className="small bg-light border rounded p-2 mb-1">{formatDetailsSnippet(result.payload)}</pre>
                      <div className="small text-muted">Response Snippet:</div>
                      <pre className="small bg-light border rounded p-2 mb-0">
                        {formatDetailsSnippet(result.response) || (result.errorMessage ?? "No response payload.")}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="semantic-admin-dialog-footer">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={rebuildPlanM.isPending}
                onClick={() => setRebuildPlanOpen(false)}
              >
                {rebuildPlanM.isPending ? "Running..." : "Close"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={rebuildPlanM.isPending || !workspaceId}
                onClick={() => {
                  if (!workspaceId) {
                    setApiError("Select a workspace before rebuilding plan indexes.");
                    return;
                  }
                  setRebuildPlanProgress(null);
                  setRebuildPlanResults([]);
                  setRebuildPlanSummary(null);
                  setRebuildPlanShowDetails(false);
                  rebuildPlanM.mutate({
                    verticalNorm: rebuildPlanVerticalNorm,
                    currentWorkspaceId: String(workspaceId),
                  });
                }}
              >
                {rebuildPlanM.isPending ? "Rebuilding..." : "Rebuild Plan Indexes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {seedOpen ? (
        <div className="semantic-admin-dialog-backdrop" onClick={() => setSeedOpen(false)} role="presentation">
          <div className="semantic-admin-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="semantic-admin-dialog-header">Seed Concepts</div>
            <div className="semantic-admin-dialog-body">
              <FormField label="Vertical">
                <input
                  className="form-control"
                  value={seedVertical}
                  onChange={(event) => setSeedVertical(event.target.value)}
                  placeholder="education"
                />
              </FormField>
            </div>
            <div className="semantic-admin-dialog-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSeedOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!seedVertical.trim() || seedM.isPending}
                onClick={() => seedM.mutate(seedVertical.trim())}
              >
                {seedM.isPending ? "Seeding..." : "Start Seed"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SemanticAdminShell>
  );
}

export default ConceptsPage;
