import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { menuList as staticMenuList } from "./SidebarMenuList";
import { MenuItem } from "../../../../../entities/Layout";
import { useAppSelector } from "../../../../../shared/lib/hooks";
import { fetchUserWorkspaceDetail } from "../../../../../features/settings/model/settingsSlice"
import { AppDispatch } from "../../../../providers/store";
import { routes } from "../../../../routes/routes";
import useSemanticAdminPermissions from "../../../../../features/semantic-admin/lib/useSemanticAdminPermissions";

export const useNewMenuList = (): MenuItem[] => {
  const dispatch = useDispatch<AppDispatch>();
  const { canMutate } = useSemanticAdminPermissions();
  const adminUser = canMutate;
  const {
    workspaces,
    defaultWorkspace,
    selectedWorkspaceId,
    loaded,
    loading,
  } = useAppSelector((state) => state.userWorkspaces);
  const selectedWorkspace =
    (workspaces ?? []).find((w: { workspace_id: string }) => String(w.workspace_id) === String(selectedWorkspaceId ?? "")) ??
    defaultWorkspace;

  useEffect(() => {
    if (!loaded && !loading) {
      dispatch(fetchUserWorkspaceDetail());
    }
  }, [dispatch, loaded, loading]);

  return [
    // keep anything static you already have, except we’ll re-insert "Query Studio Applications"
    ...staticMenuList.filter((item) => item.title !== "Query Studio Applications"),

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
        {
          id: 302,
          title: "Forge Insights",
          url: routes.ForgeInsights,
          icon: "comments",
          type: "link",
          guard: { product: "forge insights", role: "user" },
        },
        {
          id: 303,
          title: "Forge Management",
          url: routes.NoCodeQueryManagement,
          icon: "gear",
          type: "link",
          guard: { product: "no code builder", role: "user" },
        },
        {
          id: 304,
          title: "Data Dictionary",
          url: routes.NoCodeDataDictionary,
          icon: "book-open",
          type: "link",
          guard: { product: "dictionary", role: "user" },
        },
        {
          id: 305,
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
                title: "Vector Indexes",
                url: routes.AdminVectorIndexes,
                icon: "database",
                type: "link" as const,
              },
              {
                id: 504,
                title: "Domain Profiles",
                url: routes.AdminDomainProfiles,
                icon: "layer-group",
                type: "link" as const,
              },
            ],
          },
        ]
      : []),

    ...(adminUser
      ? [
          {
            title: "Semantic Registry",
            id: 400,
            Items: [
              {
                id: 401,
                title: "Concepts",
                url: routes.SemanticConcepts,
                icon: "list",
                type: "link" as const,
              },
              {
                id: 402,
                title: "Aliases",
                url: routes.SemanticAliases,
                icon: "tag",
                type: "link" as const,
              },
              {
                id: 403,
                title: "Value Aliases",
                url: routes.SemanticValueAliases,
                icon: "tags",
                type: "link" as const,
              },
              {
                id: 404,
                title: "Concept-Column Maps",
                url: routes.SemanticConceptColumnMaps,
                icon: "diagram-project",
                type: "link" as const,
              },
              {
                id: 405,
                title: "Semantic Planner",
                url: routes.SemanticPlanner,
                icon: "brain",
                type: "link" as const,
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
      Items: [
        {
          id: 0,                     
          title: "Databricks",
          url: selectedWorkspace?.server ?? "#",
          icon: "screwdriver-wrench",
          type: "link",
          guard: { product: "workspace", role: "user" },
        },
      ],
    },
  ];
};
