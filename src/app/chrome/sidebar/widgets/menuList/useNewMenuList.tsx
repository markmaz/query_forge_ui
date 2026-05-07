import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { menuList as staticMenuList } from "./SidebarMenuList";
import { MenuItem } from "../../../../../domain-model/Layout";
import { useAppSelector } from "../../../../../shared/runtime/hooks";
import { fetchUserWorkspaceDetail } from "../../../../../features/preferences/model/settingsSlice";
import { AppDispatch } from "../../../../core/store";
import { routes } from "../../../../navigation/routes";
import useSemanticAdminPermissions from "../../../../../features/semantic-admin/lib/useSemanticAdminPermissions";
import { useCan } from "../../../../../shared/runtime/useCan";
import { appRuntimeConfig } from "../../../../../shared/meta/runtime";
import { fetchWorkspaceExternalLinks } from "@/shared/services/workspace";
import { useHasAdminAccess, useIsStrictSystemAdmin } from "@/shared/security/systemAdminAccess";

export const useNewMenuList = (): MenuItem[] => {
  const dispatch = useDispatch<AppDispatch>();
  const { canMutate } = useSemanticAdminPermissions();
  const { hasRole } = useCan();
  const hasAdminAccess = useHasAdminAccess();
  const adminUser = canMutate || hasAdminAccess;
  const systemAdminUser = useIsStrictSystemAdmin();
  const semanticRegistryUser = hasRole("semantic", "user") || hasRole("semantic", "admin");
  const { workspaces, defaultWorkspace, selectedWorkspaceId, loaded, loading } =
    useAppSelector((state) => state.userWorkspaces);
  const selectedWorkspace =
    (workspaces ?? []).find(
      (w: { workspace_id: string }) =>
        String(w.workspace_id) === String(selectedWorkspaceId ?? ""),
    ) ?? defaultWorkspace;
  const activeWorkspaceId = String(
    selectedWorkspace?.workspace_id ?? selectedWorkspaceId ?? "",
  ).trim();

  useEffect(() => {
    if (!loaded && !loading) {
      dispatch(fetchUserWorkspaceDetail());
    }
  }, [dispatch, loaded, loading]);

  const workspaceExternalLinksQuery = useQuery({
    queryKey: [`workspace-external-links:${activeWorkspaceId}`],
    queryFn: () => fetchWorkspaceExternalLinks(activeWorkspaceId),
    enabled: loaded && activeWorkspaceId.length > 0,
    staleTime: 60_000,
  });
  const defaultExternalLink =
    workspaceExternalLinksQuery.data?.links.find((link) => link.is_default) ??
    workspaceExternalLinksQuery.data?.links[0] ??
    null;
  const externalLinkItems: MenuItem[] = defaultExternalLink
    ? [
        {
          id: 0,
          title: defaultExternalLink.label,
          url: defaultExternalLink.url,
          icon: "screwdriver-wrench",
          type: "link",
          guard: { feature: "workspaces", role: "user" },
        },
      ]
    : [
        {
          id: 0,
          title: "External Console",
          icon: "screwdriver-wrench",
          type: "link",
          disabled: true,
          guard: { feature: "workspaces", role: "user" },
        },
      ];

  return [
    // keep anything static you already have, except we’ll re-insert "Query Studio Applications"
    ...staticMenuList.filter(
      (item) => item.title !== "Query Studio Applications",
    ),

    {
      title: "Query Forge",
      id: 300,
      Items: [
        {
          id: 301,
          title: "Build",
          icon: "hammer",
          type: "sub",
          menu: [
            {
              id: 311,
              title: "Query Studio",
              url: routes.NoCodeQueryBuilder,
              icon: "wand-magic-sparkles",
              type: "link",
              guard: { feature: "query_studio", role: "user" },
            },
            ...(adminUser
              ? [
                  {
                    id: 312,
                    title: "Analysis Studio",
                    url: routes.NoCodeQueryBuilderV3,
                    icon: "diagram-project",
                    type: "link" as const,
                  },
                ]
              : []),
          ],
        },
        {
          id: 302,
          title: "Shape",
          icon: "draw-polygon",
          type: "sub",
          menu: [
            {
              id: 313,
              title: "Domain Studio",
              url: routes.NoCodeQueryManagement,
              icon: "sitemap",
              type: "link",
              guard: { feature: "query_studio", role: "user" },
            },
            {
              id: 314,
              title: "Data Dictionary",
              url: routes.NoCodeDataDictionary,
              icon: "book-open",
              type: "link",
              guard: { feature: "catalog", role: "user" },
            },
            {
              id: 315,
              title: "Data Mappings",
              url: routes.CrosswalkManagement,
              icon: "shuffle",
              type: "link",
              guard: { feature: "catalog", role: "user" },
            },
          ],
        },
        {
          id: 303,
          title: "AI",
          icon: "brain",
          type: "sub",
          menu: [
            {
              id: 316,
              title: "Forge Insights",
              url: routes.ForgeInsights,
              icon: "comments",
              type: "link",
              guard: { feature: "forge_insights", role: "user" },
            },
            {
              id: 317,
              title: "Forge Match",
              url: routes.ForgeMatch,
              icon: "file-import",
              type: "link",
              guard: { feature: "forge_match", role: "user" },
            },
          ],
        },
        {
          id: 304,
          title: "Automation",
          icon: "bolt",
          type: "sub",
          menu: [
            {
              id: 318,
              title: "Skills",
              url: routes.AutomationSkills,
              icon: "bolt",
              type: "link",
              guard: { feature: "skills", role: "user" },
            },
            {
              id: 319,
              title: "FlowForge",
              icon: "diagram-project",
              type: "sub",
              guard: {
                feature: "flowforge",
                role: ["admin", "designer", "operator", "viewer", "user"],
              },
              menu: [
                {
                  id: 320,
                  title: "Designer",
                  url: routes.FlowForgeStudio,
                  icon: "diagram-project",
                  type: "link",
                  guard: { feature: "flowforge", role: "designer" },
                },
                {
                  id: 321,
                  title: "Runs",
                  url: routes.FlowForgeRuns,
                  icon: "list-check",
                  type: "link",
                  guard: { feature: "flowforge", role: "viewer" },
                },
                {
                  id: 322,
                  title: "Needs Attention",
                  url: routes.FlowForgeNeedsAttention,
                  icon: "triangle-exclamation",
                  type: "link",
                  guard: { feature: "flowforge", role: "operator" },
                },
                {
                  id: 323,
                  title: "Reports",
                  url: routes.FlowForgeReports,
                  icon: "chart-line",
                  type: "link",
                  guard: { feature: "flowforge", role: "viewer" },
                },
                {
                  id: 329,
                  title: "Data Movement",
                  url: routes.FlowForgeDataMovement,
                  icon: "right-left",
                  type: "link",
                  guard: { feature: "flowforge", role: "operator" },
                },
                {
                  id: 324,
                  title: "Admin",
                  icon: "sliders",
                  type: "sub",
                  guard: { feature: "flowforge", role: "designer" },
                  menu: [
                    {
                      id: 325,
                      title: "Integrations",
                      url: routes.FlowForgeAdminIntegrations,
                      icon: "plug",
                      type: "link",
                      guard: { feature: "flowforge", role: "designer" },
                    },
                    {
                      id: 326,
                      title: "Resources",
                      url: routes.FlowForgeAdminResources,
                      icon: "users-gear",
                      type: "link",
                      guard: { feature: "flowforge", role: "designer" },
                    },
                    {
                      id: 327,
                      title: "Matching Policies",
                      url: routes.FlowForgeAdminMatchingPolicies,
                      icon: "scale-balanced",
                      type: "link",
                      guard: { feature: "flowforge", role: "designer" },
                    },
                    {
                      id: 330,
                      title: "Templates",
                      url: routes.FlowForgeAdminCommunicationTemplates,
                      icon: "envelope-open-text",
                      type: "link",
                      guard: { feature: "flowforge", role: "designer" },
                    },
                    {
                      id: 328,
                      title: "Settings",
                      url: routes.FlowForgeAdminSettings,
                      icon: "gear",
                      type: "link",
                      guard: { feature: "flowforge", role: "admin" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    ...(adminUser
      ? [
          {
            title: "System Admin",
            id: 500,
            Items: [
              {
                id: 501,
                title: "System Health",
                url: routes.AdminHealth,
                icon: "heartbeat",
                type: "link" as const,
              },
              {
                id: 502,
                title: "Pipeline Profiles",
                url: routes.AdminPipelineProfiles,
                icon: "chart-bar",
                type: "link" as const,
              },
              {
                id: 503,
                title: "Prompt Feedback",
                url: routes.AdminPromptFeedback,
                icon: "comments",
                type: "link" as const,
              },
              ...(appRuntimeConfig.adminTenancyEnabled
                ? [
                    {
                      id: 517,
                      title: "Tenancy",
                      icon: "building",
                      menu: [
                        {
                          id: 521,
                          title: "Initialize",
                          url: routes.AdminCustomerInitialization,
                          icon: "rocket",
                          type: "link" as const,
                        },
                        {
                          id: 518,
                          title: "Organizations",
                          url: routes.AdminTenancyOrganizations,
                          icon: "building",
                          type: "link" as const,
                        },
                        {
                          id: 519,
                          title: "Datasources",
                          url: routes.AdminTenancyDatasources,
                          icon: "server",
                          type: "link" as const,
                        },
                        {
                          id: 520,
                          title: "Workspaces",
                          url: routes.AdminTenancyWorkspaceBindings,
                          icon: "link",
                          type: "link" as const,
                        },
                        {
                          id: 523,
                          title: "Workspace LLMs",
                          url: routes.AdminTenancyWorkspaceLLMs,
                          icon: "robot",
                          type: "link" as const,
                        },
                        {
                          id: 525,
                          title: "Help",
                          url: routes.AdminTenancyHelp,
                          icon: "circle-question",
                          type: "link" as const,
                        },
                      ],
                    },
                  ]
                : []),
              {
                id: 506,
                title: "Data Foundation",
                icon: "sitemap",
                menu: [
                  {
                    id: 507,
                    title: "Domain Profiles",
                    url: routes.AdminDomainProfiles,
                    icon: "layer-group",
                    type: "link" as const,
                  },
                  {
                    id: 527,
                    title: "Planner Policies",
                    url: routes.AdminPlannerPolicies,
                    icon: "sliders",
                    type: "link" as const,
                  },
                  {
                    id: 528,
                    title: "Feedback Learning",
                    url: routes.AdminFeedbackLearning,
                    icon: "wand-magic-sparkles",
                    type: "link" as const,
                  },
                  {
                    id: 508,
                    title: "Vector Indexes",
                    url: routes.AdminVectorIndexes,
                    icon: "database",
                    type: "link" as const,
                  },
                  {
                    id: 509,
                    title: "Data Refinery",
                    url: routes.AdminDataRefinery,
                    icon: "table",
                    type: "link" as const,
                  },
                  {
                    id: 510,
                    title: "Metadata Sync",
                    url: routes.IngestionSync,
                    icon: "database",
                    type: "link" as const,
                  },
                  {
                    id: 522,
                    title: "Ingestion Monitor",
                    url: routes.AdminIngestionMonitor,
                    icon: "wave-square",
                    type: "link" as const,
                  },
                  {
                    id: 526,
                    title: "Help",
                    url: routes.AdminDataFoundationHelp,
                    icon: "circle-question",
                    type: "link" as const,
                  },
                ],
              },
              {
                id: 511,
                title: "Semantic Registry",
                icon: "brain",
                menu: [
                  {
                    id: 512,
                    title: "Concepts",
                    url: routes.SemanticConcepts,
                    icon: "list",
                    type: "link" as const,
                  },
                  {
                    id: 513,
                    title: "Aliases",
                    url: routes.SemanticAliases,
                    icon: "tag",
                    type: "link" as const,
                  },
                  {
                    id: 514,
                    title: "Value Aliases",
                    url: routes.SemanticValueAliases,
                    icon: "tags",
                    type: "link" as const,
                  },
                  {
                    id: 515,
                    title: "Column Maps",
                    url: routes.SemanticConceptColumnMaps,
                    icon: "table-columns",
                    type: "link" as const,
                  },
                  {
                    id: 516,
                    title: "Relationships",
                    url: routes.AdminSemanticRelationships,
                    icon: "diagram-project",
                    type: "link" as const,
                  },
                  {
                    id: 516,
                    title: "Catalog Builder",
                    url: routes.AdminSemanticCatalogBuilder,
                    icon: "brain",
                    type: "link" as const,
                  },
                  {
                    id: 524,
                    title: "Help",
                    url: routes.SemanticHelp,
                    icon: "circle-question",
                    type: "link" as const,
                  },
                ],
              },
            ],
          },
        ]
      : []),

    ...(!adminUser && semanticRegistryUser
      ? [
          {
            title: "Semantic Registry",
            id: 530,
            Items: [
              {
                id: 531,
                title: "Help",
                url: routes.SemanticHelp,
                icon: "circle-question",
                type: "link" as const,
                guard: { feature: "semantic", role: "user" },
              },
            ],
          },
        ]
      : []),

    // Admin (no top-level checks; items guarded)
    ...(adminUser
      ? [
          {
            title: "Admin",
            id: 100,
            Items: [
              {
                id: 101,
                title: "User Management",
                url: routes.UsermanagementView,
                icon: "users",
                type: "link" as const,
              },
              {
                id: 102,
                title: "Workspace Features",
                url: routes.WorkspaceFeaturesView,
                icon: "list-check",
                type: "link" as const,
              },
              {
                id: 104,
                title: "MCP App Principals",
                url: routes.MCPAppPrincipalsView,
                icon: "key",
                type: "link" as const,
              },
              ...(systemAdminUser
                ? [
                    {
                      id: 103,
                      title: "Workspace Onboarding",
                      url: routes.AdminWorkspaceOnboarding,
                      icon: "rocket",
                      type: "link" as const,
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),

    // Query Studio Applications (visibility controlled by guard per item)
    {
      title: "External Links",
      Items: externalLinkItems,
    },
  ];
};
