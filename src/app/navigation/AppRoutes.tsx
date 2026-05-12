import { lazy, type JSX } from "react";
import { Navigate, type RouteObject } from "react-router-dom";

import { routes } from "./routes";
import RequireRole from "./guards/RequireRole";
import RequireAdmin from "./guards/RequireAdmin";
import RequireSystemAdmin from "./guards/RequireSystemAdmin";
import { appRuntimeConfig } from "../../shared/meta/runtime";

const HomePage = lazy(() => import("../../screens/HomePage"));
const ActivityPage = lazy(() => import("../../screens/ActivityPage"));
const SettingsPage = lazy(() => import("../../screens/SettingsPage"));
const AccountSettingsPage = lazy(
  () => import("../../screens/AccountSettingsPage"),
);
const Error404 = lazy(() => import("../../screens/Error404"));
const UserManagementPage = lazy(
  () => import("../../screens/UserManagementPage"),
);
const WorkspaceFeatureManagementPage = lazy(
  () =>
    import("../../features/access-control/pages/WorkspaceFeatureManagementPage"),
);
const MCPAppPrincipalsPage = lazy(
  () => import("../../features/access-control/pages/MCPAppPrincipalsPage"),
);
const DataDictionaryPage = lazy(
  () => import("../../features/domain-studio/ui/DataDictionaryPage"),
);
const QueryForgePage = lazy(
  () => import("../../features/query-forge/ui/QueryForgePage"),
);
const QueryStudioV3Page = lazy(
  () => import("../../features/query-forge/ui/v3/QueryStudioV3Page"),
);
const Auth = lazy(() => import("../../features/identity/ui"));
const ListManagementPage = lazy(
  () => import("../../features/list-ops/ui/ListManagementPage"),
);
const NoCodeManagementPage = lazy(
  () => import("../../features/domain-studio/ui/NoCodeManagementPage"),
);
const DictionaryTab = lazy(() =>
  import("../../features/domain-studio/ui/components/DictionaryTab").then(
    (m) => ({
      default: m.DictionaryTab,
    }),
  ),
);
const DomainsTab = lazy(() =>
  import("../../features/domain-studio/ui/components/DomainsTab").then((m) => ({
    default: m.DomainsTab,
  })),
);
const DomainGraphBuilder = lazy(
  () =>
    import("../../features/domain-studio/ui/components/domain-graph/DomainGraphBuilder"),
);
const DomainGraphEditorPage = lazy(
  () => import("../../features/domain-studio/ui/DomainGraphEditorPage"),
);
const ConceptsPage = lazy(
  () => import("../../features/semantic-admin/ui/ConceptsPage"),
);
const AliasesPage = lazy(
  () => import("../../features/semantic-admin/ui/AliasesPage"),
);
const ValueAliasesPage = lazy(
  () => import("../../features/semantic-admin/ui/ValueAliasesPage"),
);
const ConceptColumnMapsPage = lazy(
  () => import("../../features/semantic-admin/ui/ConceptColumnMapsPage"),
);
const PlannerPage = lazy(
  () => import("../../features/semantic-admin/ui/PlannerPage"),
);
const SemanticHelpPage = lazy(
  () => import("../../features/semantic-admin/ui/SemanticHelpPage"),
);
const RelationshipsPage = lazy(
  () => import("../../features/semantic-admin/ui/RelationshipsPage"),
);
const ForgeInsightsPage = lazy(
  () => import("../../features/llm-chat/ui/ForgeInsightsPage"),
);
const ForgeMatchPage = lazy(
  () => import("../../features/forgeMatch/pages/ForgeMatchPage"),
);
const SkillsPage = lazy(() => import("../../features/skills/pages/SkillsPage"));
const FlowForgeStudioPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeStudioPage"),
);
const FlowForgeRunsPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeRunsPage"),
);
const FlowForgeRunDetailPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeRunDetailPage"),
);
const FlowForgeNeedsAttentionPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeNeedsAttentionPage"),
);
const FlowForgeReportsPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeReportsPage"),
);
const FlowForgeDataMovementPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeDataMovementPage"),
);
const FlowForgeIntegrationsPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeIntegrationsPage"),
);
const FlowForgeResourcesPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeResourcesPage"),
);
const FlowForgeMatchingPoliciesPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeMatchingPoliciesPage"),
);
const FlowForgeCommunicationTemplatesPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeCommunicationTemplatesPage"),
);
const FlowForgeSettingsPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgeSettingsPage"),
);
const HealthDashboard = lazy(
  () => import("../../features/system-admin/ui/health/HealthDashboard"),
);
const ProfileList = lazy(
  () => import("../../features/system-admin/ui/pipeline/ProfileList"),
);
const VectorIndexPage = lazy(
  () => import("../../features/system-admin/ui/vectors/VectorIndexPage"),
);
const DomainProfileList = lazy(
  () => import("../../features/system-admin/ui/domains/DomainProfileList"),
);
const PlannerPoliciesPage = lazy(
  () => import("../../features/system-admin/ui/domains/PlannerPoliciesPage"),
);
const DataRefineryPage = lazy(
  () => import("../../features/system-admin/ui/data-refinery/DataRefineryPage"),
);
const AdminPromptFeedbackPage = lazy(
  () =>
    import("../../features/system-admin/ui/prompt-feedback/AdminPromptFeedbackPage"),
);
const FeedbackLearningPage = lazy(
  () => import("../../features/feedback-learning/ui/FeedbackLearningPage"),
);
const AdminIngestionMonitorPage = lazy(
  () =>
    import("../../features/system-admin/ui/ingestion/AdminIngestionMonitorPage"),
);
const DataFoundationHelpPage = lazy(
  () => import("../../features/system-admin/ui/help/DataFoundationHelpPage"),
);
const SemanticCatalogBuilderPage = lazy(
  () =>
    import("../../features/system-admin/ui/semantic-catalog/SemanticCatalogBuilderPage"),
);
const IngestionPage = lazy(
  () => import("../../features/ingestion/ui/IngestionPage"),
);
const TenancyOrganizationsPage = lazy(
  () =>
    import("../../features/system-admin/ui/tenancy/TenancyOrganizationsPage"),
);
const TenancyDatasourcesPage = lazy(
  () => import("../../features/system-admin/ui/tenancy/TenancyDatasourcesPage"),
);
const TenancyWorkspaceBindingsPage = lazy(
  () =>
    import("../../features/system-admin/ui/tenancy/TenancyWorkspaceBindingsPage"),
);
const WorkspaceLLMPage = lazy(
  () => import("../../features/system-admin/ui/tenancy/WorkspaceLLMPage"),
);
const CustomerInitializationPage = lazy(
  () =>
    import("../../features/system-admin/ui/tenancy/CustomerInitializationPage"),
);
const TenancyHelpPage = lazy(
  () => import("../../features/system-admin/ui/help/TenancyHelpPage"),
);
const WorkspaceOnboardingPage = lazy(
  () => import("../../features/access-control/pages/WorkspaceOnboardingPage"),
);

type AccessRule =
  | {
      kind: "feature";
      feature: string;
      role?: string | string[];
      redirectTo?: string;
    }
  | {
      kind: "admin";
      redirectTo?: string;
    }
  | {
      kind: "systemAdmin";
      redirectTo?: string;
    };

type RouteSpec = {
  path: string;
  element: JSX.Element;
  access?: AccessRule;
  children?: RouteObject[];
};

function wrapWithAccess(
  element: JSX.Element,
  access?: AccessRule,
): JSX.Element {
  if (!access) return element;

  if (access.kind === "admin") {
    return (
      <RequireAdmin redirectTo={access.redirectTo ?? "/403"}>
        {element}
      </RequireAdmin>
    );
  }

  if (access.kind === "systemAdmin") {
    return (
      <RequireSystemAdmin redirectTo={access.redirectTo ?? "/403"}>
        {element}
      </RequireSystemAdmin>
    );
  }

  return (
    <RequireRole
      feature={access.feature}
      role={access.role}
      redirectTo={access.redirectTo ?? "/403"}
    >
      {element}
    </RequireRole>
  );
}

function toRouteObject(spec: RouteSpec): RouteObject {
  return {
    path: spec.path,
    element: wrapWithAccess(spec.element, spec.access),
    children: spec.children,
  };
}

const appRouteSpecs: RouteSpec[] = [
  { path: routes.Home, element: <HomePage /> },
  { path: routes.SettingsView, element: <SettingsPage /> },
  { path: routes.SettingsAccountView, element: <AccountSettingsPage /> },
  { path: routes.HomePage, element: <HomePage /> },
  { path: routes.Activity, element: <ActivityPage /> },

  {
    path: routes.UsermanagementView,
    element: <UserManagementPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.WorkspaceFeaturesView,
    element: <WorkspaceFeatureManagementPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.MCPAppPrincipalsView,
    element: <MCPAppPrincipalsPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminWorkspaceOnboarding,
    element: <WorkspaceOnboardingPage />,
    access: { kind: "systemAdmin" },
  },
  {
    path: routes.CrosswalkManagement,
    element: <ListManagementPage />,
    access: { kind: "feature", feature: "catalog", role: "user" },
  },

  {
    path: routes.NoCodeQueryBuilder,
    element: <QueryForgePage />,
    access: { kind: "feature", feature: "query_studio", role: "user" },
  },
  {
    path: routes.NoCodeQueryBuilderV2,
    element: <QueryForgePage />,
    access: { kind: "feature", feature: "query_studio", role: "user" },
  },
  {
    path: routes.NoCodeQueryBuilderV3,
    element: <QueryStudioV3Page />,
    access: { kind: "admin" },
  },
  {
    path: "/no-code/builder",
    element: <Navigate to={routes.NoCodeQueryBuilder} replace />,
    access: { kind: "feature", feature: "query_studio", role: "user" },
  },
  {
    path: "/no-code/builder/v2",
    element: <Navigate to={routes.NoCodeQueryBuilderV2} replace />,
    access: { kind: "feature", feature: "query_studio", role: "user" },
  },
  {
    path: "/no-code/builder/v3",
    element: <Navigate to={routes.NoCodeQueryBuilderV3} replace />,
    access: { kind: "admin" },
  },
  {
    path: routes.NoCodeDataDictionary,
    element: <DataDictionaryPage />,
    access: { kind: "feature", feature: "catalog", role: "user" },
    children: [{ index: true, element: <DictionaryTab /> }],
  },
  {
    path: routes.NoCodeQueryManagement,
    element: <NoCodeManagementPage />,
    access: { kind: "feature", feature: "query_studio", role: "user" },
    children: [
      { index: true, element: <Navigate to="domains" replace /> },
      { path: routes.NoCodeAdminDomains, element: <DomainsTab /> },
      { path: routes.NoCodeAdminDomainGraph, element: <DomainGraphBuilder /> },
    ],
  },
  {
    path: routes.NoCodeAdminDomainGraphEditor,
    element: <DomainGraphEditorPage />,
    access: { kind: "feature", feature: "query_studio", role: "user" },
  },

  {
    path: routes.SemanticConcepts,
    element: <ConceptsPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.SemanticAliases,
    element: <AliasesPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.SemanticValueAliases,
    element: <ValueAliasesPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.SemanticConceptColumnMaps,
    element: <ConceptColumnMapsPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.SemanticPlanner,
    element: <PlannerPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.SemanticHelp,
    element: <SemanticHelpPage />,
    access: { kind: "feature", feature: "semantic", role: "user" },
  },
  {
    path: routes.AdminSemanticRelationships,
    element: <RelationshipsPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.ForgeInsights,
    element: <ForgeInsightsPage />,
    access: { kind: "feature", feature: "forge_insights", role: "user" },
  },
  {
    path: "/forge-match",
    element: <Navigate to={routes.ForgeMatch} replace />,
    access: { kind: "feature", feature: "forge_match", role: "user" },
  },
  {
    path: routes.ForgeMatch,
    element: <ForgeMatchPage />,
    access: { kind: "feature", feature: "forge_match", role: "user" },
  },
  {
    path: routes.AutomationSkills,
    element: <SkillsPage />,
    access: { kind: "feature", feature: "skills", role: "user" },
  },
  {
    path: routes.FlowForgeStudio,
    element: <FlowForgeStudioPage />,
    access: { kind: "feature", feature: "flowforge", role: "designer" },
  },
  {
    path: routes.FlowForgeRuns,
    element: <FlowForgeRunsPage />,
    access: { kind: "feature", feature: "flowforge", role: "viewer" },
  },
  {
    path: routes.FlowForgeRunDetail,
    element: <FlowForgeRunDetailPage />,
    access: { kind: "feature", feature: "flowforge", role: "viewer" },
  },
  {
    path: routes.FlowForgeNeedsAttention,
    element: <FlowForgeNeedsAttentionPage />,
    access: { kind: "feature", feature: "flowforge", role: "operator" },
  },
  {
    path: routes.FlowForgeReports,
    element: <FlowForgeReportsPage />,
    access: { kind: "feature", feature: "flowforge", role: "viewer" },
  },
  {
    path: routes.FlowForgeDataMovement,
    element: <FlowForgeDataMovementPage />,
    access: { kind: "feature", feature: "flowforge", role: "operator" },
  },
  {
    path: routes.FlowForgeAdminIntegrations,
    element: <FlowForgeIntegrationsPage />,
    access: { kind: "feature", feature: "flowforge", role: "designer" },
  },
  {
    path: routes.FlowForgeAdminResources,
    element: <FlowForgeResourcesPage />,
    access: { kind: "feature", feature: "flowforge", role: "designer" },
  },
  {
    path: routes.FlowForgeAdminMatchingPolicies,
    element: <FlowForgeMatchingPoliciesPage />,
    access: { kind: "feature", feature: "flowforge", role: "designer" },
  },
  {
    path: routes.FlowForgeAdminMatchingPoliciesAlias,
    element: <FlowForgeMatchingPoliciesPage />,
    access: { kind: "feature", feature: "flowforge", role: "designer" },
  },
  {
    path: routes.FlowForgeAdminCommunicationTemplates,
    element: <FlowForgeCommunicationTemplatesPage />,
    access: { kind: "feature", feature: "flowforge", role: "designer" },
  },
  {
    path: routes.FlowForgeAdminSettings,
    element: <FlowForgeSettingsPage />,
    access: { kind: "feature", feature: "flowforge", role: "admin" },
  },

  {
    path: routes.AdminHealth,
    element: <HealthDashboard />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminPipelineProfiles,
    element: <ProfileList />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminVectorIndexes,
    element: <VectorIndexPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminDomainProfiles,
    element: <DomainProfileList />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminPlannerPolicies,
    element: <PlannerPoliciesPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminDataRefinery,
    element: <DataRefineryPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminPromptFeedback,
    element: <AdminPromptFeedbackPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminFeedbackLearning,
    element: <FeedbackLearningPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminIngestionMonitor,
    element: <AdminIngestionMonitorPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminSemanticCatalogBuilder,
    element: <SemanticCatalogBuilderPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminDataFoundationHelp,
    element: <DataFoundationHelpPage />,
    access: { kind: "admin" },
  },
  ...(appRuntimeConfig.adminTenancyEnabled
    ? [
        {
          path: routes.AdminCustomerInitialization,
          element: <CustomerInitializationPage />,
          access: { kind: "admin" } as const,
        },
        {
          path: routes.AdminTenancyOrganizations,
          element: <TenancyOrganizationsPage />,
          access: { kind: "admin" } as const,
        },
        {
          path: routes.AdminTenancyDatasources,
          element: <TenancyDatasourcesPage />,
          access: { kind: "admin" } as const,
        },
        {
          path: routes.AdminTenancyWorkspaceBindings,
          element: <TenancyWorkspaceBindingsPage />,
          access: { kind: "admin" } as const,
        },
        {
          path: routes.AdminTenancyWorkspaceLLMs,
          element: <WorkspaceLLMPage />,
          access: { kind: "admin" } as const,
        },
        {
          path: routes.AdminTenancyHelp,
          element: <TenancyHelpPage />,
          access: { kind: "admin" } as const,
        },
      ]
    : []),
  {
    path: routes.IngestionSync,
    element: <IngestionPage />,
    access: { kind: "admin" },
  },
];

export const AppRoutes: RouteObject[] = appRouteSpecs.map(toRouteObject);

export const AuthRoutes: RouteObject[] = [
  { path: routes.Auth, element: <Auth /> },
  { path: routes.ErrorPages.Error404, element: <Error404 /> },
];
