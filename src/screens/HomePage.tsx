import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { routes } from "../app/navigation/routes";
import HomeWidget, { HomePageProps } from "../features/landing/ui/Home";
import type { ActivityPulseDay, ActivityPulseMetric } from "../features/landing/ui/components/ActivityPulseWidget";
import type { ActivitySummaryItem } from "../features/landing/ui/components/ActivitiesSummary";
import type { RecentQueryRow } from "../features/landing/ui/components/RecentQueriesWidget";
import { listForgeMatchSessions } from "../features/forgeMatch/api";
import { listFlowForgeRuns } from "../features/flowforge/api/runsApi";
import { listFlowForgeWorkflows } from "../features/flowforge/api/workflowsApi";
import { listSkills } from "../features/skills/api";
import { useAppSelector } from "../shared/runtime/hooks";
import { hydrateQueryTree } from "../shared/services/queryTreeApi";
import { fetchDomains } from "../shared/services/queryStudioAdminApi";

const timestamp = (iso?: string | null) => {
  if (!iso) return 0;
  const parsed = new Date(iso).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const recentId = (kind: string, id: string | number) => `${kind}:${id}`;

const DAY_MS = 24 * 60 * 60 * 1000;

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const isoDateKey = (iso?: string | null) => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateKey(parsed);
};

const HomePage = () => {
  const navigate = useNavigate();
  const firstName = useAppSelector((state) => state.user.user?.first_name);
  const lastName = useAppSelector((state) => state.user.user?.last_name);
  const workspaceName = useAppSelector((state) => state.userWorkspaces.defaultWorkspace?.name);
  const userDisplayName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const queryTreeQuery = useQuery({
    queryKey: ["query-tree", "all"],
    queryFn: hydrateQueryTree,
    staleTime: 30_000,
  });
  const domainsQuery = useQuery({
    queryKey: ["domains", "home"],
    queryFn: fetchDomains,
    staleTime: 60_000,
  });
  const workflowsQuery = useQuery({
    queryKey: ["flowforge", "workflows", "home"],
    queryFn: listFlowForgeWorkflows,
    staleTime: 30_000,
    retry: false,
  });
  const workflowRunsQuery = useQuery({
    queryKey: ["flowforge", "runs", "home"],
    queryFn: () => listFlowForgeRuns({ limit: 100, offset: 0 }),
    staleTime: 30_000,
    retry: false,
  });
  const skillsQuery = useQuery({
    queryKey: ["skills", "home"],
    queryFn: () => listSkills({}),
    staleTime: 30_000,
    retry: false,
  });
  const forgeMatchSessionsQuery = useQuery({
    queryKey: ["forge-match-sessions", "home"],
    queryFn: () => listForgeMatchSessions({ page: 1, pageSize: 50, status: "all" }),
    staleTime: 30_000,
    retry: false,
  });
  const domainsCount = domainsQuery.data?.rows?.length ?? null;
  const recentRows = useMemo<RecentQueryRow[]>(() => {
    const queryRows =
      queryTreeQuery.data?.recent?.map((item) => ({
        id: recentId("query", item.id),
        title: item.title,
        updatedAtIso: item.updatedAt ?? undefined,
        status: "saved" as const,
        ownerLabel: "Query Studio",
      })) ?? [];
    const workflowRows =
      workflowsQuery.data?.map((workflow) => ({
        id: recentId("workflow", workflow.id),
        title: workflow.name || "Untitled workflow",
        updatedAtIso: workflow.updated_at ?? workflow.created_at ?? undefined,
        status: "workflow" as const,
        ownerLabel: `Workflow Studio${workflow.lifecycle ? ` · ${workflow.lifecycle}` : ""}`,
      })) ?? [];
    const skillRows =
      skillsQuery.data?.rows?.map((skill) => ({
        id: recentId("skill", skill.id),
        title: skill.name || "Untitled skill",
        updatedAtIso: skill.lastRunAt ?? skill.updatedAt ?? skill.createdAt ?? undefined,
        status: (skill.status === "active" || skill.status === "paused" || skill.status === "error" ? skill.status : "skill") as RecentQueryRow["status"],
        ownerLabel: `Skills${skill.queryName ? ` · ${skill.queryName}` : ""}`,
      })) ?? [];
    const forgeMatchRows =
      forgeMatchSessionsQuery.data?.rows?.map((session) => ({
        id: recentId("forge-match", session.id),
        title: session.uploaded_filename || "Forge Match session",
        updatedAtIso: session.updated_at ?? session.analysis_completed_at ?? session.created_at ?? undefined,
        status: "forge_match" as const,
        ownerLabel: `Forge Match · ${session.status}`,
      })) ?? [];

    return [...queryRows, ...workflowRows, ...skillRows, ...forgeMatchRows].sort(
      (a, b) => timestamp(b.updatedAtIso) - timestamp(a.updatedAtIso),
    );
  }, [forgeMatchSessionsQuery.data, queryTreeQuery.data, skillsQuery.data, workflowsQuery.data]);

  const activityItems = useMemo<ActivitySummaryItem[]>(() => {
    const windowStart = Date.now() - 14 * DAY_MS;
    const inWindow = (iso?: string | null) => {
      const time = timestamp(iso);
      return time >= windowStart;
    };
    const queryActivity = queryTreeQuery.data?.recent?.filter((item) => inWindow(item.updatedAt)).length ?? 0;
    const workflowRuns = workflowRunsQuery.data?.runs?.filter((run) =>
      inWindow(run.started_at ?? run.created_at ?? run.updated_at),
    ).length ?? 0;
    const skillActivity = skillsQuery.data?.rows?.filter((skill) =>
      inWindow(skill.lastRunAt ?? skill.updatedAt ?? skill.createdAt),
    ).length ?? 0;
    const forgeMatchActivity = forgeMatchSessionsQuery.data?.rows?.filter((session) =>
      inWindow(session.updated_at ?? session.analysis_completed_at ?? session.created_at),
    ).length ?? 0;

    return [
      {
        id: "query-activity",
        label: "Query activity",
        value: queryActivity,
        description: "Queries created or updated",
        tone: "query",
        onClick: () => navigate(routes.NoCodeQueryBuilder),
      },
      {
        id: "workflow-runs",
        label: "Workflow runs",
        value: workflowRuns,
        description: "Recent runtime executions",
        tone: "workflow",
        onClick: () => navigate(routes.FlowForgeRuns),
      },
      {
        id: "skill-activity",
        label: "Skill activity",
        value: skillActivity,
        description: "Skills run or updated",
        tone: "skill",
        onClick: () => navigate(routes.AutomationSkills),
      },
      {
        id: "forge-match-activity",
        label: "Forge Match",
        value: forgeMatchActivity,
        description: "Mapping sessions analyzed",
        tone: "forgeMatch",
        onClick: () => navigate(routes.ForgeMatch),
      },
    ];
  }, [forgeMatchSessionsQuery.data, navigate, queryTreeQuery.data, skillsQuery.data, workflowRunsQuery.data]);

  const pulse = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: ActivityPulseDay[] = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today.getTime() - (13 - index) * DAY_MS);
      return {
        date: dateKey(date),
        label: dateLabel(date),
        queries: 0,
        workflows: 0,
        skills: 0,
        forgeMatch: 0,
      };
    });
    const byDate = new Map(days.map((day) => [day.date, day]));
    const increment = (iso: string | null | undefined, key: keyof Pick<ActivityPulseDay, "queries" | "workflows" | "skills" | "forgeMatch">) => {
      const bucket = byDate.get(isoDateKey(iso) ?? "");
      if (bucket) bucket[key] += 1;
    };

    queryTreeQuery.data?.recent?.forEach((item) => increment(item.updatedAt, "queries"));
    workflowsQuery.data?.forEach((workflow) => increment(workflow.updated_at ?? workflow.created_at, "workflows"));
    skillsQuery.data?.rows?.forEach((skill) => increment(skill.lastRunAt ?? skill.updatedAt ?? skill.createdAt, "skills"));
    forgeMatchSessionsQuery.data?.rows?.forEach((session) =>
      increment(session.updated_at ?? session.analysis_completed_at ?? session.created_at, "forgeMatch"),
    );

    const totals = days.reduce(
      (acc, day) => ({
        queries: acc.queries + day.queries,
        workflows: acc.workflows + day.workflows,
        skills: acc.skills + day.skills,
        forgeMatch: acc.forgeMatch + day.forgeMatch,
      }),
      { queries: 0, workflows: 0, skills: 0, forgeMatch: 0 },
    );
    const metrics: ActivityPulseMetric[] = [
      { label: "Queries", value: totals.queries, tone: "query" },
      { label: "Workflows", value: totals.workflows, tone: "workflow" },
      { label: "Skills", value: totals.skills, tone: "skill" },
      { label: "Forge Match", value: totals.forgeMatch, tone: "forgeMatch" },
    ];

    return {
      days,
      metrics,
      totalCount: totals.queries + totals.workflows + totals.skills + totals.forgeMatch,
    };
  }, [forgeMatchSessionsQuery.data, queryTreeQuery.data, skillsQuery.data, workflowsQuery.data]);

  const openRecent = (id: string) => {
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

  const openGettingStarted = (id: string) => {
    if (id === "forge-match") {
      navigate(routes.ForgeMatch);
      return;
    }
    if (id === "skills") {
      navigate(routes.AutomationSkills);
      return;
    }
    if (id === "workflows") {
      navigate(routes.FlowForgeStudio);
      return;
    }
    if (id === "dictionary") {
      navigate(routes.NoCodeDataDictionary);
      return;
    }
    navigate(routes.NoCodeQueryBuilder);
  };

  const homeProps: HomePageProps = {
    welcome: {
      userDisplayName: userDisplayName || undefined,
      workspaceName,
      onOpenDocs: () => navigate(routes.NoCodeQueryBuilder),
    },
    recent: {
      rows: recentRows,
      onOpen: openRecent,
      onViewAll: () => navigate(routes.Activity),
      loading: queryTreeQuery.isLoading || workflowsQuery.isLoading || skillsQuery.isLoading || forgeMatchSessionsQuery.isLoading,
      error:
        recentRows.length === 0 &&
        queryTreeQuery.isError &&
        workflowsQuery.isError &&
        skillsQuery.isError &&
        forgeMatchSessionsQuery.isError
          ? "Failed to load recent work."
          : null,
    },
    actions: {
      onNewQuery: () => navigate(routes.NoCodeQueryBuilder),
      onNewWorkflow: () => navigate(routes.FlowForgeStudio),
      onForgeMatch: () => navigate(routes.ForgeMatch),
      onNewSkill: () => navigate(routes.AutomationSkills),
      onAiAssist: () => navigate(routes.NoCodeQueryBuilder),
    },
    pulse: {
      ...pulse,
      onOpenActivity: () => navigate(routes.Activity),
    },
    activity: {
      items: activityItems,
      loading: queryTreeQuery.isLoading || workflowRunsQuery.isLoading || skillsQuery.isLoading || forgeMatchSessionsQuery.isLoading,
      error:
        queryTreeQuery.isError && workflowRunsQuery.isError && skillsQuery.isError && forgeMatchSessionsQuery.isError
          ? "Failed to load recent activity."
          : null,
      latestLabel: recentRows[0]?.title ?? null,
      latestUpdatedAtIso: recentRows[0]?.updatedAtIso ?? null,
    },
    help: {
      links: [
        {
          id: "query-studio",
          title: "Query Studio",
          description: "Ask governed questions over curated domains.",
          tag: "Query",
        },
        {
          id: "forge-match",
          title: "Forge Match",
          description: "Upload source fields and reconcile them to your data foundation.",
          tag: "Map",
        },
        {
          id: "workflows",
          title: "Workflow Studio",
          description: "Build intake, matching, review, and notification flows.",
          tag: "Flow",
        },
        {
          id: "skills",
          title: "Skills",
          description: "Turn saved queries into alerts, digests, and delivery automation.",
          tag: "Automate",
        },
        {
          id: "dictionary",
          title: "Data Dictionary",
          description: "Inspect domains, tables, and searchable metadata.",
          tag: "Catalog",
        },
      ],
      onClickLink: openGettingStarted,
    },
    env: {
      warehouseName: workspaceName ?? "Primary Warehouse",
      connected: Boolean(workspaceName),
      domainsCount,
      lastMetadataRefreshIso: "2025-02-10T20:30:00.000Z",
      onRefreshMetadata: () => navigate(routes.NoCodeDataDictionary),
    },
  };

  return <HomeWidget {...homeProps} />;
};

export default HomePage;
