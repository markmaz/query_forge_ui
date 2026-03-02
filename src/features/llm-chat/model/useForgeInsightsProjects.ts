import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  type ForgeInsightsProject,
  createForgeInsightsProject,
  deleteForgeInsightsProject,
  listForgeInsightsProjects,
  patchForgeInsightsProject,
} from "../../../shared/services/forgeInsightsApi";

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function byUpdatedAtDesc(a: ForgeInsightsProject, b: ForgeInsightsProject) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

type UseForgeInsightsProjectsResult = {
  projects: ForgeInsightsProject[];
  isLoading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description?: string | null) => Promise<ForgeInsightsProject | null>;
  updateProject: (projectId: string, patch: Partial<ForgeInsightsProject>) => Promise<ForgeInsightsProject | null>;
  archiveProject: (projectId: string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
};

export function useForgeInsightsProjects(workspaceId: string | null): UseForgeInsightsProjectsResult {
  const [projects, setProjects] = useState<ForgeInsightsProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedWorkspaceId = useMemo(() => workspaceId?.trim() ?? "", [workspaceId]);

  const refreshProjects = useCallback(async () => {
    if (!normalizedWorkspaceId) {
      setProjects([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    try {
      const rows = await listForgeInsightsProjects({
        workspaceId: normalizedWorkspaceId,
        includeArchived: false,
      });
      setProjects(rows.sort(byUpdatedAtDesc));
      setError(null);
    } catch (requestError) {
      const message = toErrorMessage(requestError, "Unable to load projects.");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedWorkspaceId]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const createProject = useCallback(
    async (name: string, description?: string | null) => {
      if (!normalizedWorkspaceId) return null;
      const trimmedName = name.trim();
      if (!trimmedName) return null;
      const tempId = `tmp-project-${Date.now()}`;
      const optimisticProject: ForgeInsightsProject = {
        id: tempId,
        name: trimmedName,
        description: description?.trim() || null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProjects((prev) => [optimisticProject, ...prev]);

      try {
        const created = await createForgeInsightsProject({
          workspaceId: normalizedWorkspaceId,
          name: trimmedName,
          description: description ?? null,
        });
        setProjects((prev) => [created, ...prev.filter((project) => project.id !== tempId)].sort(byUpdatedAtDesc));
        return created;
      } catch (requestError) {
        setProjects((prev) => prev.filter((project) => project.id !== tempId));
        const message = toErrorMessage(requestError, "Unable to create project.");
        setError(message);
        toast.error(message);
        return null;
      }
    },
    [normalizedWorkspaceId]
  );

  const updateProject = useCallback(
    async (projectId: string, patch: Partial<ForgeInsightsProject>) => {
      if (!normalizedWorkspaceId) return null;
      const previous = projects.find((project) => project.id === projectId);
      if (!previous) return null;
      const optimistic = { ...previous, ...patch, updated_at: new Date().toISOString() };
      setProjects((prev) => prev.map((project) => (project.id === projectId ? optimistic : project)));
      try {
        const updated = await patchForgeInsightsProject({
          workspaceId: normalizedWorkspaceId,
          projectId,
          patch: {
            ...(typeof patch.name === "string" ? { name: patch.name } : {}),
            ...(typeof patch.description === "string" || patch.description === null
              ? { description: patch.description }
              : {}),
            ...(typeof patch.is_archived === "boolean" ? { is_archived: patch.is_archived } : {}),
          },
        });
        const merged = { ...optimistic, ...updated };
        setProjects((prev) => prev.map((project) => (project.id === projectId ? merged : project)).sort(byUpdatedAtDesc));
        return merged;
      } catch (requestError) {
        setProjects((prev) => prev.map((project) => (project.id === projectId ? previous : project)));
        const message = toErrorMessage(requestError, "Unable to update project.");
        setError(message);
        toast.error(message);
        return null;
      }
    },
    [normalizedWorkspaceId, projects]
  );

  const archiveProject = useCallback(
    async (projectId: string) => {
      const existing = projects.find((project) => project.id === projectId);
      if (!existing) return false;
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      try {
        await patchForgeInsightsProject({
          workspaceId: normalizedWorkspaceId,
          projectId,
          patch: { is_archived: true },
        });
        return true;
      } catch (requestError) {
        setProjects((prev) => [existing, ...prev].sort(byUpdatedAtDesc));
        const message = toErrorMessage(requestError, "Unable to archive project.");
        setError(message);
        toast.error(message);
        return false;
      }
    },
    [normalizedWorkspaceId, projects]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      const existing = projects.find((project) => project.id === projectId);
      if (!existing) return false;
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      try {
        await deleteForgeInsightsProject({
          workspaceId: normalizedWorkspaceId,
          projectId,
        });
        return true;
      } catch (requestError) {
        setProjects((prev) => [existing, ...prev].sort(byUpdatedAtDesc));
        const message = toErrorMessage(requestError, "Unable to delete project.");
        setError(message);
        toast.error(message);
        return false;
      }
    },
    [normalizedWorkspaceId, projects]
  );

  return {
    projects,
    isLoading,
    error,
    refreshProjects,
    createProject,
    updateProject,
    archiveProject,
    deleteProject,
  };
}
