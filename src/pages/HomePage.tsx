import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { routes } from "../app/routes/routes";
import HomeWidget, { HomePageProps } from "../features/home/ui/Home";
import { useAppSelector } from "../shared/lib/hooks";
import { hydrateQueryTree } from "../shared/api/queryTreeApi";
import type { TreeNode } from "../shared/model/savedQueries";

const countQueries = (nodes: TreeNode[]) => {
  let total = 0;
  let drafts = 0;

  for (const node of nodes) {
    if (node.nodeType === "folder") {
      const childCounts = countQueries(node.children || []);
      total += childCounts.total;
      drafts += childCounts.drafts;
      continue;
    }

    total += 1;
    if (node.scope === "draft") drafts += 1;
  }

  return { total, drafts };
};

const HomePage = () => {
  const navigate = useNavigate();
  const email = useAppSelector((state) => state.auth.email);
  const workspaceName = useAppSelector((state) => state.userWorkspaces.defaultWorkspace?.name);
  const queryTreeQuery = useQuery({
    queryKey: ["query-tree", "all"],
    queryFn: hydrateQueryTree,
    staleTime: 30_000,
  });
  const activityCounts = useMemo(() => {
    const trees = queryTreeQuery.data?.trees;
    if (!trees) return { saved: 0, shared: 0, drafts: 0 };

    const mine = countQueries(trees.my.rootNodes);
    const shared = countQueries(trees.shared.rootNodes);
    return {
      saved: mine.total,
      shared: shared.total,
      drafts: mine.drafts,
    };
  }, [queryTreeQuery.data]);

  const homeProps: HomePageProps = {
    welcome: {
      userDisplayName: email ?? undefined,
      workspaceName,
      onOpenDocs: () => navigate(routes.NoCodeQueryBuilder),
    },
    recent: {
      onOpen: () => navigate(routes.NoCodeQueryBuilder),
      onViewAll: () => navigate(routes.NoCodeQueryManagement),
    },
    actions: {
      onNewQuery: () => navigate(routes.NoCodeQueryBuilder),
      onFromTemplate: () => navigate(routes.NoCodeQueryBuilder),
      onAiAssist: () => navigate(routes.NoCodeQueryBuilder),
    },
    templates: {
      templates: [
        {
          id: "tpl-1",
          title: "Student ADM",
          description: "Take a look at the ADM for a student.",
          tag: "Popular",
        },
        {
          id: "tpl-2",
          title: "District ADM",
          description: "Take a look at the ADM for a district.",
        },
        {
          id: "tpl-3",
          title: "Student Attendance",
          description: "Take a look at the attendance for a student.",
        },
      ],
      onUseTemplate: () => navigate(routes.NoCodeQueryBuilder),
      onBrowseAll: () => navigate(routes.NoCodeQueryBuilder),
    },
    activity: {
      savedCount: activityCounts.saved,
      sharedWithMeCount: activityCounts.shared,
      draftsCount: activityCounts.drafts,
      onOpenSaved: () => navigate(routes.NoCodeQueryBuilder),
      onOpenShared: () => navigate(routes.NoCodeQueryBuilder),
      onOpenDrafts: () => navigate(routes.NoCodeQueryBuilder),
    },
    help: {
      links: [
        {
          id: "build-first",
          title: "Build your first query",
          description: "Walk through the visual builder in under 5 minutes.",
        },
        {
          id: "share",
          title: "Share results with your team",
          description: "Learn how to save and share query outputs.",
        },
        {
          id: "templates",
          title: "Use a template",
          description: "Start from a vetted query and customize quickly.",
        },
      ],
      onClickLink: () => navigate(routes.NoCodeQueryBuilder),
    },
    env: {
      warehouseName: workspaceName ?? "Primary Warehouse",
      connected: Boolean(workspaceName),
      domainsCount: 12,
      lastMetadataRefreshIso: "2025-02-10T20:30:00.000Z",
      onRefreshMetadata: () => navigate(routes.NoCodeDataDictionary),
    },
  };

  return <HomeWidget {...homeProps} />;
};

export default HomePage;
