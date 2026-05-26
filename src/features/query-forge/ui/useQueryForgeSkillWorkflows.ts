import { useState, type ComponentProps, type Dispatch, type SetStateAction } from "react";
import { toast } from "react-toastify";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import {
  useCreateSkill,
  useDeleteSkill,
  useExecuteSkill,
  usePatchSkillStatus,
  useSkillRuns,
  useSkillTemplates,
  useUpdateSkill,
} from "@/features/skills/hooks";
import type { SaveSkillPayload, Skill } from "@/features/skills/types";

import {
  createSavedQuery,
  updateSavedQuery,
} from "../../../shared/services/queryTreeApi";

import type { SqlQueryJson } from "../model/sqlJson";
import type { OpenQueryState } from "./queryForgePageTypes";
import { persistSavedQuerySnapshot } from "./useQueryForgeWorkingQueryPersistence";

type SkillLaunchContext = {
  queryId: string | null;
  queryName: string | null;
};

type UseQueryForgeSkillWorkflowsParams = {
  workspaceId: string | null;
  openQuery: OpenQueryState;
  setOpenQuery: Dispatch<SetStateAction<OpenQueryState>>;
  sqlJson: SqlQueryJson;
  ensureToolMeta: (next: SqlQueryJson) => SqlQueryJson;
  setSelectedSavedQueryId: (value: string | undefined) => void;
  refetchTree: () => Promise<void>;
  skillQueryOptions: Array<{ id: string; name: string }>;
};

type SaveQueryParams = {
  name: string;
  description?: string | null;
  folderId: string | null;
  attachSkill: boolean;
};

export function useQueryForgeSkillWorkflows({
  workspaceId,
  openQuery,
  setOpenQuery,
  sqlJson,
  ensureToolMeta,
  setSelectedSavedQueryId,
  refetchTree,
  skillQueryOptions,
}: UseQueryForgeSkillWorkflowsParams) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const skillTemplates = useSkillTemplates();
  const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false);
  const [skillsDrawerMode, setSkillsDrawerMode] = useState<"create" | "edit">(
    "create",
  );
  const [skillsDrawerSkill, setSkillsDrawerSkill] = useState<Skill | null>(
    null,
  );
  const [skillsDrawerTab, setSkillsDrawerTab] = useState<"builder" | "runs">(
    "builder",
  );
  const [skillsDefaultTemplateId, setSkillsDefaultTemplateId] = useState<
    string | null
  >(null);
  const [skillsLaunchContext, setSkillsLaunchContext] =
    useState<SkillLaunchContext>({
      queryId: null,
      queryName: null,
    });
  const [skillDeleteTarget, setSkillDeleteTarget] = useState<Skill | null>(null);

  const createSkillMutation = useCreateSkill();
  const updateSkillMutation = useUpdateSkill(skillsDrawerSkill?.id ?? null);
  const deleteSkillMutation = useDeleteSkill();
  const executeSkillMutation = useExecuteSkill();
  const patchSkillStatusMutation = usePatchSkillStatus();
  const skillRunsQuery = useSkillRuns(skillsDrawerSkill?.id ?? null);

  const launchSkillDrawer = (context: SkillLaunchContext) => {
    setSkillsDrawerMode("create");
    setSkillsDrawerSkill(null);
    setSkillsDrawerTab("builder");
    setSkillsDefaultTemplateId(null);
    setSkillsLaunchContext(context);
    setSkillsDrawerOpen(true);
  };

  const openSkillsFromQueryContext = () => {
    launchSkillDrawer({
      queryId: openQuery.id ?? null,
      queryName: openQuery.name ?? null,
    });
  };

  const closeSkillsDrawer = () => {
    setSkillsDrawerOpen(false);
    setSkillsDrawerSkill(null);
    setSkillsDrawerTab("builder");
    setSkillsDefaultTemplateId(null);
    setSkillsLaunchContext({ queryId: null, queryName: null });
  };

  const openSaveModal = () => setSaveModalOpen(true);
  const closeSaveModal = () => setSaveModalOpen(false);

  const handleSaveQuery = async ({
    name,
    description,
    folderId,
    attachSkill,
  }: SaveQueryParams) => {
    setSaveModalOpen(false);

    setOpenQuery((prev) => ({
      ...prev,
      name,
      description,
      folderId,
      isDirty: true,
    }));

    const saved = openQuery.id
      ? await updateSavedQuery(openQuery.id, {
          name,
          description,
          folderId,
          sqlJson: ensureToolMeta(sqlJson),
        })
      : await createSavedQuery({
          name,
          description,
          folderId,
          sqlJson: ensureToolMeta(sqlJson),
        });

    const savedId =
      saved?.queryId ??
      saved?.query_id ??
      saved?.id ??
      openQuery.id ??
      null;

    if (savedId) setSelectedSavedQueryId(String(savedId));

    setOpenQuery((prev) => ({
      ...prev,
      id: savedId ? String(savedId) : prev.id,
      name: saved?.name ?? name,
      description: saved?.description ?? description ?? null,
      folderId: saved?.folderId ?? folderId ?? null,
      scope: saved?.scope ?? prev.scope,
      isDirty: false,
    }));

    if (savedId) {
      persistSavedQuerySnapshot({
        id: String(savedId),
        name: saved?.name ?? name,
        description: saved?.description ?? description ?? null,
        folderId: saved?.folderId ?? folderId ?? null,
        sqlJson: ensureToolMeta(sqlJson),
      });
    }

    await refetchTree();

    if (attachSkill) {
      launchSkillDrawer({
        queryId: savedId ? String(savedId) : (openQuery.id ?? null),
        queryName: saved?.name ?? name,
      });
    }
  };

  const skillDrawerProps = {
    open: skillsDrawerOpen,
    mode: skillsDrawerMode,
    skill: skillsDrawerSkill,
    workspaceId: workspaceId ?? "",
    queryContext:
      skillsLaunchContext.queryId || skillsLaunchContext.queryName
        ? skillsLaunchContext
        : {
            queryId: openQuery.id ?? null,
            queryName: openQuery.name ?? null,
          },
    queryOptions: skillQueryOptions,
    templates: skillTemplates,
    runs: skillRunsQuery.data ?? [],
    runsLoading: skillRunsQuery.isLoading,
    saving: createSkillMutation.isPending || updateSkillMutation.isPending,
    deleting: deleteSkillMutation.isPending,
    testing: executeSkillMutation.isPending,
    initialTab: skillsDrawerTab,
    defaultTemplateId: skillsDefaultTemplateId,
    onClose: closeSkillsDrawer,
    onSaveDraft: async (payload: SaveSkillPayload) => {
      const savePayload: SaveSkillPayload = { ...payload, status: "draft" };
      try {
        if (skillsDrawerMode === "edit" && skillsDrawerSkill) {
          await updateSkillMutation.mutateAsync(savePayload);
          toast.success("Skill draft updated.");
        } else {
          await createSkillMutation.mutateAsync(savePayload);
          toast.success("Skill draft created.");
        }
        closeSkillsDrawer();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save skill draft.",
        );
      }
    },
    onSaveSkill: async (payload: SaveSkillPayload) => {
      const savePayload: SaveSkillPayload = {
        ...payload,
        status: payload.status === "draft" ? "active" : payload.status,
      };
      try {
        if (skillsDrawerMode === "edit" && skillsDrawerSkill) {
          const updated = await updateSkillMutation.mutateAsync(savePayload);
          setSkillsDrawerSkill(updated);
          toast.success("Skill updated.");
        } else {
          await createSkillMutation.mutateAsync(savePayload);
          toast.success("Skill created.");
        }
        closeSkillsDrawer();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save skill.",
        );
      }
    },
    onDelete: skillsDrawerSkill
      ? (skill: Skill) => setSkillDeleteTarget(skill)
      : undefined,
    onTest: skillsDrawerSkill
      ? async (skill: Skill) => {
          try {
            const result = await executeSkillMutation.mutateAsync(skill.id);
            toast.success(result.message);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Failed to run test.",
            );
          }
        }
      : undefined,
    onStatusChange: skillsDrawerSkill
      ? async (skill: Skill, status: Skill["status"]) => {
          try {
            const updated = await patchSkillStatusMutation.mutateAsync({
              skillId: skill.id,
              status,
            });
            setSkillsDrawerSkill(updated);
            toast.success(status === "active" ? "Skill resumed." : "Skill paused.");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Failed to update status.",
            );
          }
        }
      : undefined,
  };

  const skillDeleteDialogProps: ComponentProps<typeof ConfirmDialog> = {
    open: Boolean(skillDeleteTarget),
    title: "Delete skill",
    message: `Delete skill "${skillDeleteTarget?.name ?? ""}"?`,
    confirmLabel: "Delete skill",
    busy: deleteSkillMutation.isPending,
    onClose: () => setSkillDeleteTarget(null),
    onConfirm: async () => {
      if (!skillDeleteTarget) return;
      try {
        await deleteSkillMutation.mutateAsync(skillDeleteTarget.id);
        toast.success("Skill deleted.");
        setSkillDeleteTarget(null);
        closeSkillsDrawer();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete skill.",
        );
      }
    },
  };

  return {
    closeSaveModal,
    handleSaveQuery,
    openSaveModal,
    openSkillsFromQueryContext,
    saveModalOpen,
    skillDeleteDialogProps,
    skillDrawerProps,
  };
}
