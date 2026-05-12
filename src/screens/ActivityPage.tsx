import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { routes } from "../app/navigation/routes";
import { listForgeMatchSessions } from "../features/forgeMatch/api";
import { listFlowForgeWorkflows } from "../features/flowforge/api/workflowsApi";
import { listSkills } from "../features/skills/api";
import type { SkillStatus } from "../features/skills/types";
import type { TreeNode } from "../shared/domain-state/savedQueries";
import { hydrateQueryTree } from "../shared/services/queryTreeApi";

type ActivityKind = "all" | "query" | "workflow" | "skill" | "forge-match";

type ActivityItem = {
  id: string;
  kind: Exclude<ActivityKind, "all">;
  title: string;
  status: string;
  detail: string;
  updatedAtIso?: string | null;
};

const filterOptions: Array<{ key: ActivityKind; label: string }> = [
  { key: "all", label: "All" },
  { key: "query", label: "Queries" },
  { key: "workflow", label: "Workflows" },
  { key: "skill", label: "Skills" },
  { key: "forge-match", label: "Forge Match" },
];

const timestamp = (iso?: string | null) => {
  if (!iso) return 0;
  const parsed = new Date(iso).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatUpdated = (iso?: string | null) => {
  if (!iso) return "No timestamp";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "No timestamp";
  return parsed.toLocaleString();
};

const activityId = (kind: ActivityItem["kind"], id: string | number) => `${kind}:${id}`;

const statusClass = (kind: ActivityItem["kind"], status: string) => {
  const normalized = status.toLowerCase();
  if (kind === "workflow") return "text-bg-danger";
  if (kind === "forge-match") return "text-bg-dark";
  if (normalized === "active" || normalized === "saved" || normalized === "analyzed") return "text-bg-success";
  if (normalized === "paused" || normalized === "draft" || normalized === "uploaded") return "text-bg-secondary";
  if (normalized === "error") return "text-bg-danger";
  if (normalized === "shared") return "text-bg-primary";
  return "text-bg-info";
};

const collectQueryNodes = (nodes: TreeNode[], shared = false): ActivityItem[] =>
  nodes.flatMap((node) => {
    if (node.nodeType === "folder") {
      return collectQueryNodes(node.children ?? [], shared);
    }
    const status = shared ? "shared" : node.scope === "draft" ? "draft" : "saved";
    return [
      {
        id: activityId("query", node.id),
        kind: "query",
        title: node.name,
        status,
        detail: shared ? "Shared query" : "Query Studio",
        updatedAtIso: node.updatedAt,
      },
    ];
  });

const normalizeSkillStatus = (status: SkillStatus) => {
  if (status === "active") return "active";
  if (status === "paused") return "paused";
  if (status === "error") return "error";
  return "draft";
};

export default function ActivityPage() {
  const navigate = useNavigate();
  const [activeKind, setActiveKind] = useState<ActivityKind>("all");
  const queryTreeQuery = useQuery({
    queryKey: ["query-tree", "all"],
    queryFn: hydrateQueryTree,
    staleTime: 30_000,
  });
  const workflowsQuery = useQuery({
    queryKey: ["flowforge", "workflows", "activity"],
    queryFn: listFlowForgeWorkflows,
    staleTime: 30_000,
    retry: false,
  });
  const skillsQuery = useQuery({
    queryKey: ["skills", "activity"],
    queryFn: () => listSkills({}),
    staleTime: 30_000,
    retry: false,
  });
  const forgeMatchSessionsQuery = useQuery({
    queryKey: ["forge-match-sessions", "activity"],
    queryFn: () => listForgeMatchSessions({ page: 1, pageSize: 100, status: "all" }),
    staleTime: 30_000,
    retry: false,
  });

  const activity = useMemo<ActivityItem[]>(() => {
    const queryRows = [
      ...collectQueryNodes(queryTreeQuery.data?.trees.my.rootNodes ?? []),
      ...collectQueryNodes(queryTreeQuery.data?.trees.shared.rootNodes ?? [], true),
    ];
    const workflowRows =
      workflowsQuery.data?.map((workflow) => ({
        id: activityId("workflow", workflow.id),
        kind: "workflow" as const,
        title: workflow.name || "Untitled workflow",
        status: workflow.lifecycle || workflow.status || "workflow",
        detail: workflow.owner_display_name ? `Workflow Studio · ${workflow.owner_display_name}` : "Workflow Studio",
        updatedAtIso: workflow.updated_at ?? workflow.created_at,
      })) ?? [];
    const skillRows =
      skillsQuery.data?.rows.map((skill) => ({
        id: activityId("skill", skill.id),
        kind: "skill" as const,
        title: skill.name || "Untitled skill",
        status: normalizeSkillStatus(skill.status),
        detail: skill.queryName ? `Skills · ${skill.queryName}` : "Skills",
        updatedAtIso: skill.lastRunAt ?? skill.updatedAt ?? skill.createdAt,
      })) ?? [];
    const forgeMatchRows =
      forgeMatchSessionsQuery.data?.rows.map((session) => ({
        id: activityId("forge-match", session.id),
        kind: "forge-match" as const,
        title: session.uploaded_filename || "Forge Match session",
        status: session.status,
        detail: `Forge Match${session.source_record_count != null ? ` · ${session.source_record_count} source fields` : ""}`,
        updatedAtIso: session.updated_at ?? session.analysis_completed_at ?? session.created_at,
      })) ?? [];

    return [...queryRows, ...workflowRows, ...skillRows, ...forgeMatchRows].sort(
      (a, b) => timestamp(b.updatedAtIso) - timestamp(a.updatedAtIso),
    );
  }, [forgeMatchSessionsQuery.data, queryTreeQuery.data, skillsQuery.data, workflowsQuery.data]);

  const filteredActivity = useMemo(
    () => (activeKind === "all" ? activity : activity.filter((item) => item.kind === activeKind)),
    [activeKind, activity],
  );
  const loading =
    queryTreeQuery.isLoading || workflowsQuery.isLoading || skillsQuery.isLoading || forgeMatchSessionsQuery.isLoading;
  const failedCount = [queryTreeQuery, workflowsQuery, skillsQuery, forgeMatchSessionsQuery].filter((query) => query.isError).length;

  const openActivity = (id: string) => {
    const separator = id.indexOf(":");
    const kind = separator >= 0 ? id.slice(0, separator) : "query";
    const rawId = separator >= 0 ? id.slice(separator + 1) : id;
    if (kind === "workflow") {
      navigate(`${routes.FlowForgeStudio}?workflowId=${encodeURIComponent(rawId)}`);
      return;
    }
    if (kind === "skill") {
      navigate(`${routes.AutomationSkills}?skillId=${encodeURIComponent(rawId)}`);
      return;
    }
    if (kind === "forge-match") {
      navigate(`${routes.ForgeMatch}?sessionId=${encodeURIComponent(rawId)}`);
      return;
    }
    navigate(routes.NoCodeQueryBuilder);
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h1 className="h4 mb-1">Activity</h1>
          <div className="text-muted">Recent and saved work across Query Studio, Workflow Studio, Skills, and Forge Match.</div>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={() => navigate(routes.HomePage)}>
          Back home
        </button>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-body d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="btn-group" role="group" aria-label="Activity filter">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`btn btn-sm ${activeKind === option.key ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setActiveKind(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="small text-muted">
            {filteredActivity.length} item{filteredActivity.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="p-3 text-muted">Loading activity...</div>
          ) : filteredActivity.length === 0 ? (
            <div className="p-3 text-muted">No activity found for this view.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Name</th>
                    <th scope="col">Context</th>
                    <th scope="col">Updated</th>
                    <th scope="col" className="text-end">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className={`badge ${statusClass(item.kind, item.status)}`}>{item.status}</span>
                      </td>
                      <td className="fw-semibold">{item.title}</td>
                      <td className="text-muted">{item.detail}</td>
                      <td className="text-muted">{formatUpdated(item.updatedAtIso)}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-primary" type="button" onClick={() => openActivity(item.id)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {failedCount > 0 ? (
          <div className="card-footer text-muted small">
            {failedCount} activity source{failedCount === 1 ? "" : "s"} could not be loaded.
          </div>
        ) : null}
      </div>
    </div>
  );
}
