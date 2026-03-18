import type { JSX } from "react";
import { Navigate, type RouteObject } from "react-router-dom";

import { routes } from "./routes";
import RequireRole from "./guards/RequireRole";
import RequireAdmin from "./guards/RequireAdmin";

import HomePage from "../../screens/HomePage";
import SettingsPage from "../../screens/SettingsPage";
import AccountSettingsPage from "../../screens/AccountSettingsPage";
import Error404 from "../../screens/Error404";
import DashboardViewer from "../../features/insights/ui/DashboardViewer";
import UserManagementPage from "../../screens/UserManagementPage";
import ProductManagementPage from "../../features/catalog-admin/ui/ProductManagementPage";
import DataDictionaryPage from "../../features/domain-studio/ui/DataDictionaryPage";
import QueryForgePage from "../../features/query-forge/ui/QueryForgePage";
import QueryStudioV3Page from "../../features/query-forge/ui/v3/QueryStudioV3Page";
import Auth from "../../features/identity/ui";
import ListManagementPage from "../../features/list-ops/ui/ListManagementPage";
import NoCodeManagementPage from "../../features/domain-studio/ui/NoCodeManagementPage";
import { DictionaryTab } from "../../features/domain-studio/ui/components/DictionaryTab";
import { DomainsTab } from "../../features/domain-studio/ui/components/DomainsTab";
import DomainGraphBuilder from "../../features/domain-studio/ui/components/domain-graph/DomainGraphBuilder";
import DomainGraphEditorPage from "../../features/domain-studio/ui/DomainGraphEditorPage";
import ConceptsPage from "../../features/semantic-admin/ui/ConceptsPage";
import AliasesPage from "../../features/semantic-admin/ui/AliasesPage";
import ValueAliasesPage from "../../features/semantic-admin/ui/ValueAliasesPage";
import PlannerPage from "../../features/semantic-admin/ui/PlannerPage";
import RelationshipsPage from "../../features/semantic-admin/ui/RelationshipsPage";
import ForgeInsightsPage from "../../features/llm-chat/ui/ForgeInsightsPage";
import ForgeMatchPage from "../../features/forgeMatch/pages/ForgeMatchPage";
import SkillsPage from "../../features/skills/pages/SkillsPage";
import HealthDashboard from "../../features/system-admin/ui/health/HealthDashboard";
import ProfileList from "../../features/system-admin/ui/pipeline/ProfileList";
import VectorIndexPage from "../../features/system-admin/ui/vectors/VectorIndexPage";
import DomainProfileList from "../../features/system-admin/ui/domains/DomainProfileList";
import DataRefineryPage from "../../features/system-admin/ui/data-refinery/DataRefineryPage";
import AdminPromptFeedbackPage from "../../features/system-admin/ui/prompt-feedback/AdminPromptFeedbackPage";
import AdminIngestionMonitorPage from "../../features/system-admin/ui/ingestion/AdminIngestionMonitorPage";
import SemanticCatalogBuilderPage from "../../features/system-admin/ui/semantic-catalog/SemanticCatalogBuilderPage";
import IngestionPage from "../../features/ingestion/ui/IngestionPage";
import TenancyOrganizationsPage from "../../features/system-admin/ui/tenancy/TenancyOrganizationsPage";
import TenancyDatasourcesPage from "../../features/system-admin/ui/tenancy/TenancyDatasourcesPage";
import TenancyWorkspaceBindingsPage from "../../features/system-admin/ui/tenancy/TenancyWorkspaceBindingsPage";
import WorkspaceLLMPage from "../../features/system-admin/ui/tenancy/WorkspaceLLMPage";
import CustomerInitializationPage from "../../features/system-admin/ui/tenancy/CustomerInitializationPage";
import { appRuntimeConfig } from "../../shared/meta/runtime";

type AccessRule =
  | {
      kind: "product";
      product: string;
      role?: string | string[];
      redirectTo?: string;
    }
  | {
      kind: "admin";
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

  return (
    <RequireRole
      product={access.product}
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
  { path: routes.DashboardView, element: <DashboardViewer /> },
  { path: routes.SettingsView, element: <SettingsPage /> },
  { path: routes.SettingsAccountView, element: <AccountSettingsPage /> },
  { path: routes.HomePage, element: <HomePage /> },

  {
    path: routes.UsermanagementView,
    element: <UserManagementPage />,
    access: { kind: "product", product: "user management", role: "admin" },
  },
  {
    path: routes.ProductManagementView,
    element: <ProductManagementPage />,
    access: { kind: "product", product: "product management", role: "admin" },
  },
  {
    path: routes.CrosswalkManagement,
    element: <ListManagementPage />,
    access: { kind: "product", product: "crosswalk manager", role: "user" },
  },

  { path: routes.NoCodeQueryBuilder, element: <QueryForgePage /> },
  { path: routes.NoCodeQueryBuilderV2, element: <QueryForgePage /> },
  {
    path: routes.NoCodeQueryBuilderV3,
    element: <QueryStudioV3Page />,
    access: { kind: "admin" },
  },
  {
    path: routes.NoCodeDataDictionary,
    element: <DataDictionaryPage />,
    access: { kind: "product", product: "dictionary", role: "user" },
    children: [{ index: true, element: <DictionaryTab /> }],
  },
  {
    path: routes.NoCodeQueryManagement,
    element: <NoCodeManagementPage />,
    children: [
      { index: true, element: <Navigate to="domains" replace /> },
      { path: routes.NoCodeAdminDomains, element: <DomainsTab /> },
      { path: routes.NoCodeAdminDomainGraph, element: <DomainGraphBuilder /> },
    ],
  },
  {
    path: routes.NoCodeAdminDomainGraphEditor,
    element: <DomainGraphEditorPage />,
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
    path: routes.SemanticPlanner,
    element: <PlannerPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminSemanticRelationships,
    element: <RelationshipsPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.ForgeInsights,
    element: <ForgeInsightsPage />,
    access: { kind: "product", product: "forge insights", role: "user" },
  },
  {
    path: "/forge-match",
    element: <Navigate to={routes.ForgeMatch} replace />,
    access: { kind: "product", product: "no code builder", role: "user" },
  },
  {
    path: routes.ForgeMatch,
    element: <ForgeMatchPage />,
    access: { kind: "product", product: "no code builder", role: "user" },
  },
  {
    path: routes.AutomationSkills,
    element: <SkillsPage />,
    access: { kind: "product", product: "no code builder", role: "user" },
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
    path: routes.AdminIngestionMonitor,
    element: <AdminIngestionMonitorPage />,
    access: { kind: "admin" },
  },
  {
    path: routes.AdminSemanticCatalogBuilder,
    element: <SemanticCatalogBuilderPage />,
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
