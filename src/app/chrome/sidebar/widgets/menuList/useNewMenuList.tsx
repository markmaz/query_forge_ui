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
import { appRuntimeConfig } from "../../../../../shared/meta/runtime";
import { fetchWorkspaceExternalLinks } from "@/shared/services/workspace";

export const useNewMenuList = (): MenuItem[] => {
  const dispatch = useDispatch<AppDispatch>();
  const { canMutate } = useSemanticAdminPermissions();
  const adminUser = canMutate;
  const { workspaces, defaultWorkspace, selectedWorkspaceId, loaded, loading } =
    useAppSelector((state) => state.userWorkspaces);
  const selectedWorkspace =
    (workspaces ?? []).find(
      (w: { workspace_id: string }) =>
        String(w.workspace_id) === String(selectedWorkspaceId ?? ""),
    ) ?? defaultWorkspace;
  const activeWorkspaceId = String(
    selectedWorkspace?.workspace_id ?? selectedWorkspaceId ?? ""
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
          guard: { product: "workspace", role: "user" },
        },
      ]
    : [
        {
          id: 0,
          title: "External Console",
          icon: "screwdriver-wrench",
          type: "link",
          disabled: true,
          guard: { product: "workspace", role: "user" },
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
          title: "Query Studio",
          url: routes.NoCodeQueryBuilder,
          icon: "wand-magic-sparkles",
          type: "link",
          guard: { product: "no code builder", role: "user" },
        },
        ...(adminUser
          ? [
              {
                id: 302,
                title: "Query Studio V3",
                url: routes.NoCodeQueryBuilderV3,
                icon: "diagram-project",
                type: "link" as const,
              },
            ]
          : []),
        {
          id: 303,
          title: "Forge Insights",
          url: routes.ForgeInsights,
          icon: "comments",
          type: "link",
          guard: { product: "forge insights", role: "user" },
        },
        {
          id: 304,
          title: "Forge Management",
          url: routes.NoCodeQueryManagement,
          icon: "gear",
          type: "link",
          guard: { product: "no code builder", role: "user" },
        },
        {
          id: 305,
          title: "Data Dictionary",
          url: routes.NoCodeDataDictionary,
          icon: "book-open",
          type: "link",
          guard: { product: "dictionary", role: "user" },
        },
        {
          id: 306,
          title: "Data Rules",
          url: routes.CrosswalkManagement,
          icon: "right-left",
          type: "link",
          guard: { product: "crosswalk manager", role: "user" },
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
              {
                id: 504,
                title: "Ingestion Monitor",
                url: routes.AdminIngestionMonitor,
                icon: "wave-square",
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
                          title: "Customer Initialization",
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
                          title: "Workspace Bindings",
                          url: routes.AdminTenancyWorkspaceBindings,
                          icon: "link",
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
                    id: 508,
                    title: "Vector Indexes",
                    url: routes.AdminVectorIndexes,
                    icon: "database",
                    type: "link" as const,
                  },
                  {
                    id: 509,
                    title: "Model Catalog",
                    url: routes.AdminModelCatalog,
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
                    title: "Concept-Column Maps",
                    url: routes.SemanticConceptColumnMaps,
                    icon: "diagram-project",
                    type: "link" as const,
                  },
                  {
                    id: 516,
                    title: "Semantic Planner",
                    url: routes.SemanticPlanner,
                    icon: "brain",
                    type: "link" as const,
                  },
                ],
              },
            ],
          },
        ]
      : []),

    // Admin (no top-level checks; items guarded)
    {
      title: "Admin",
      id: 100,
      Items: [
        {
          id: 101,
          title: "User Management",
          url: routes.UsermanagementView,
          icon: "users",
          type: "link",
          guard: { product: "user management", role: "admin" },
        },
        {
          id: 102,
          title: "Product Management",
          url: routes.ProductManagementView,
          icon: "list-check",
          type: "link",
          guard: { product: "product management", role: "admin" },
        },
      ],
    },

    // Query Studio Applications (visibility controlled by guard per item)
    {
      title: "External Links",
      Items: externalLinkItems,
    },
  ];
};
