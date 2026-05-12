import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { hydrateQueryTree } from "@/shared/services/queryTreeApi";
import { useAppSelector } from "@/shared/runtime/hooks";
import { useCan } from "@/shared/runtime/useCan";

import { SKILL_TYPE_LABELS } from "../constants";
import {
  useCreateSkill,
  useDeleteSkill,
  useExecuteSkill,
  usePatchSkillStatus,
  useSkillRuns,
  useSkills,
  useSkillTemplates,
  useUpdateSkill,
} from "../hooks";
import type {
  QueryOption,
  SaveSkillPayload,
  Skill,
  SkillLifecycleAction,
  SkillStatus,
  SkillType,
} from "../types";
import SkillBuilderDrawer from "../components/SkillBuilderDrawer";
import DestinationsTab from "../components/DestinationsTab";
import SkillsEmptyState from "../components/SkillsEmptyState";
import SkillsList from "../components/SkillsList";
import SkillsPageHeader from "../components/SkillsPageHeader";
import "../styles/skills.css";

type DrawerMode = "create" | "edit";

function flattenQueries(
  nodes: Array<Record<string, unknown>>,
  output: QueryOption[],
) {
  nodes.forEach((node) => {
    const nodeType = String(node.nodeType ?? "");
    if (nodeType === "query") {
      const id = String(node.id ?? "");
      const name = String(node.name ?? "Untitled query");
      if (id) output.push({ id, name });
      return;
    }

    if (nodeType === "folder" && Array.isArray(node.children)) {
      flattenQueries(node.children as Array<Record<string, unknown>>, output);
    }
  });
}

export default function SkillsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSkillId = searchParams.get("skillId")?.trim() || null;
  const requestedSkillTab = searchParams.get("tab") === "runs" ? "runs" : "builder";
  const templates = useSkillTemplates();
  const workspaceId = useAppSelector(
    (state) => state.userWorkspaces.selectedWorkspaceId ?? "",
  );
  const { hasRole, has } = useCan();
  const userIsAdmin = has("skills:admin") || hasRole("skills", "admin");

  const [pageTab, setPageTab] = useState<"skills" | "destinations">("skills");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SkillStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<SkillType | "all">("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [drawerSkill, setDrawerSkill] = useState<Skill | null>(null);
  const [drawerTab, setDrawerTab] = useState<"builder" | "runs">("builder");
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  const skillsQ = useSkills({
    q: search,
    status: statusFilter,
    skillType: typeFilter,
  });
  const runsQ = useSkillRuns(drawerSkill?.id ?? null);

  const queryTreeQ = useQuery({
    queryKey: ["skills", "query-tree"],
    queryFn: hydrateQueryTree,
    staleTime: 60_000,
  });

  const createMutation = useCreateSkill();
  const updateMutation = useUpdateSkill(drawerSkill?.id ?? null);
  const deleteMutation = useDeleteSkill();
  const executeMutation = useExecuteSkill();
  const patchStatusMutation = usePatchSkillStatus();

  const queryOptions = useMemo(() => {
    const rows: QueryOption[] = [];
    if (!queryTreeQ.data?.trees) return rows;
    const trees = queryTreeQ.data.trees;
    flattenQueries(
      (trees.my?.rootNodes ?? []) as Array<Record<string, unknown>>,
      rows,
    );
    flattenQueries(
      (trees.shared?.rootNodes ?? []) as Array<Record<string, unknown>>,
      rows,
    );
    flattenQueries(
      (trees.library?.rootNodes ?? []) as Array<Record<string, unknown>>,
      rows,
    );
    const deduped = new Map<string, QueryOption>();
    rows.forEach((item) => deduped.set(item.id, item));
    return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [queryTreeQ.data]);

  const queryNameById = useMemo(
    () =>
      queryOptions.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.name;
        return acc;
      }, {}),
    [queryOptions],
  );

  const rows = skillsQ.data?.rows ?? [];

  const openCreate = (templateId?: string | null) => {
    setDrawerMode("create");
    setDrawerSkill(null);
    setDrawerTab("builder");
    setDefaultTemplateId(templateId ?? null);
    setDrawerOpen(true);
  };

  const openEdit = (skill: Skill, tab: "builder" | "runs" = "builder") => {
    setDrawerMode("edit");
    setDrawerSkill(skill);
    setDrawerTab(tab);
    setDefaultTemplateId(null);
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (!requestedSkillId) return;
    const target = rows.find((skill) => skill.id === requestedSkillId);
    if (!target) return;
    setDrawerMode("edit");
    setDrawerSkill(target);
    setDrawerTab(requestedSkillTab);
    setDefaultTemplateId(null);
    setDrawerOpen(true);
  }, [requestedSkillId, requestedSkillTab, rows]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerSkill(null);
    setDrawerTab("builder");
    setDefaultTemplateId(null);
    if (requestedSkillId) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("skillId");
        next.delete("tab");
        return next;
      }, { replace: true });
    }
  };

  const onAction = async (skill: Skill, action: SkillLifecycleAction) => {
    try {
      if (action === "edit") {
        openEdit(skill, "builder");
        return;
      }
      if (action === "view_runs") {
        openEdit(skill, "runs");
        return;
      }
      if (action === "delete") {
        setDeleteTarget(skill);
        return;
      }
      if (action === "pause") {
        await patchStatusMutation.mutateAsync({
          skillId: skill.id,
          status: "paused",
        });
        toast.success("Skill paused.");
        return;
      }
      if (action === "resume") {
        await patchStatusMutation.mutateAsync({
          skillId: skill.id,
          status: "active",
        });
        toast.success("Skill resumed.");
        return;
      }
      if (action === "duplicate") {
        const payload: SaveSkillPayload = {
          name: `${skill.name} Copy`,
          description: skill.description,
          queryId: skill.queryId,
          queryName: skill.queryName,
          skillType: skill.skillType,
          status: "draft",
          trigger: skill.trigger,
          conditions: skill.conditions,
          actions: skill.actions,
        };
        await createMutation.mutateAsync(payload);
        toast.success("Skill duplicated.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed.";
      toast.error(message);
    }
  };

  const saveDraft = async (payload: SaveSkillPayload) => {
    try {
      const draftPayload = { ...payload, status: "draft" as const };
      if (drawerMode === "edit" && drawerSkill) {
        await updateMutation.mutateAsync(draftPayload);
        toast.success("Skill saved.");
      } else {
        await createMutation.mutateAsync(draftPayload);
        toast.success("Skill saved.");
      }
      closeDrawer();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save skill.";
      toast.error(message);
    }
  };

  const saveSkill = async (payload: SaveSkillPayload) => {
    try {
      const nextStatus = payload.status === "draft" ? "active" : payload.status;
      const finalPayload = { ...payload, status: nextStatus };
      if (drawerMode === "edit" && drawerSkill) {
        await updateMutation.mutateAsync(finalPayload);
        toast.success("Skill saved.");
      } else {
        await createMutation.mutateAsync(finalPayload);
        toast.success("Skill saved.");
      }
      closeDrawer();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save skill.";
      toast.error(message);
    }
  };

  const hasRows = rows.length > 0;

  const confirmDeleteSkill = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Skill deleted.");
      setDeleteTarget(null);
      if (drawerSkill?.id === deleteTarget.id) closeDrawer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete skill.";
      toast.error(message);
    }
  };

  return (
    <div className="container-fluid py-3 skills-page">
      <SkillsPageHeader
        onCreate={() => openCreate()}
        onBrowseTemplates={() => openCreate()}
      />

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link${pageTab === "skills" ? " active" : ""}`}
            onClick={() => setPageTab("skills")}
          >
            Skills
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${pageTab === "destinations" ? " active" : ""}`}
            onClick={() => setPageTab("destinations")}
          >
            Destinations
          </button>
        </li>
      </ul>

      {pageTab === "destinations" && (
        <DestinationsTab workspaceId={workspaceId} isAdmin={userIsAdmin} />
      )}

      {pageTab === "skills" && (
        <>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="row g-2">
                <div className="col-lg-5">
                  <label className="form-label mb-1">Search</label>
                  <input
                    className="form-control"
                    placeholder="Search skills"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="col-lg-3">
                  <label className="form-label mb-1">Status</label>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as SkillStatus | "all")
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div className="col-lg-4">
                  <label className="form-label mb-1">Skill Type</label>
                  <select
                    className="form-select"
                    value={typeFilter}
                    onChange={(event) =>
                      setTypeFilter(event.target.value as SkillType | "all")
                    }
                  >
                    <option value="all">All types</option>
                    {Object.entries(SKILL_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {!hasRows && !skillsQ.isLoading ? (
            <SkillsEmptyState
              templates={templates}
              onCreate={() => openCreate()}
              onUseTemplate={(templateId) => openCreate(templateId)}
            />
          ) : (
            <SkillsList
              rows={rows}
              loading={skillsQ.isLoading}
              error={
                skillsQ.isError
                  ? ((skillsQ.error as Error)?.message ??
                    "Failed to load skills.")
                  : null
              }
              queryNameById={queryNameById}
              onOpenSkill={(skill) => openEdit(skill, "builder")}
              onAction={(skill, action) => {
                void onAction(skill, action);
              }}
            />
          )}

          <SkillBuilderDrawer
            open={drawerOpen}
            mode={drawerMode}
            skill={drawerSkill}
            workspaceId={workspaceId}
            queryOptions={queryOptions}
            templates={templates}
            runs={runsQ.data ?? []}
            runsLoading={runsQ.isLoading}
            saving={createMutation.isPending || updateMutation.isPending}
            deleting={deleteMutation.isPending}
            testing={executeMutation.isPending}
            initialTab={drawerTab}
            queryContext={
              drawerSkill
                ? {
                    queryId: drawerSkill.queryId,
                    queryName: drawerSkill.queryName,
                  }
                : undefined
            }
            defaultTemplateId={defaultTemplateId}
            onClose={closeDrawer}
            onManageDestinations={() => {
              setPageTab("destinations");
              closeDrawer();
            }}
            onSaveDraft={saveDraft}
            onSaveSkill={saveSkill}
            onDelete={
              drawerSkill
                ? async (skill) => {
                    setDeleteTarget(skill);
                  }
                : undefined
            }
            onTest={
              drawerSkill
                ? async (skill) => {
                    try {
                      const result = await executeMutation.mutateAsync(
                        skill.id,
                      );
                      toast.success(result.message);
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : "Failed to run skill test.";
                      toast.error(message);
                    }
                  }
                : undefined
            }
            onStatusChange={
              drawerSkill
                ? async (skill, status) => {
                    await patchStatusMutation.mutateAsync({
                      skillId: skill.id,
                      status,
                    });
                    toast.success(
                      status === "active" ? "Skill resumed." : "Skill paused.",
                    );
                  }
                : undefined
            }
          />
        </>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete skill"
        message={`Delete skill "${deleteTarget?.name ?? ""}"?`}
        confirmLabel="Delete skill"
        busy={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteSkill}
      />
    </div>
  );
}
