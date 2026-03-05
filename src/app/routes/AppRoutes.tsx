  // Defines main application routes

  import { routes } from "./routes";
  import { Navigate } from "react-router-dom";

  //Pages
  import HomePage from "../../pages/HomePage";
  import SettingsPage from "../../pages/SettingsPage";
  import AccountSettingsPage from "../../pages/AccountSettingsPage";
  import Error404 from "../..//pages/Error404";
  import DashboardViewer from "../../features/dashboards/ui/DashboardViewer";
  import UserManagementPage from "../../pages/UserManagementPage";
  import ProductManagementPage from "../../features/product-management/ui/ProductManagementPage";
  import DataDictionaryPage from "../../features/no-code-admin/ui/DataDictionaryPage";
  import QueryForgePage from "../../features/query-forge/ui/QueryForgePage";
  import RequireRole from "./guards/RequireRole";
  import { JSX } from "react";
  import Auth from "../../features/auth/ui";
  import ListManagementPage from "../../features/crosswalks/ui/ListManagementPage";
  import NoCodeManagementPage from "../../features/no-code-admin/ui/NoCodeManagementPage";
  import { DictionaryTab } from "../../features/no-code-admin/ui/components/DictionaryTab";
  import { ReconTab } from "../../features/no-code-admin/ui/components/ReconTab";
  import { DomainsTab } from "../../features/no-code-admin/ui/components/DomainsTab";
  import ConceptsPage from "../../features/semantic-admin/ui/ConceptsPage";
  import AliasesPage from "../../features/semantic-admin/ui/AliasesPage";
  import ValueAliasesPage from "../../features/semantic-admin/ui/ValueAliasesPage";
  import ConceptColumnMapsPage from "../../features/semantic-admin/ui/ConceptColumnMapsPage";
  import PlannerPage from "../../features/semantic-admin/ui/PlannerPage";
  import RequireAdmin from "./guards/RequireAdmin";
  import ForgeInsightsPage from "../../features/llm-chat/ui/ForgeInsightsPage";
  import HealthDashboard from "../../features/system-admin/ui/health/HealthDashboard";
  import ProfileList from "../../features/system-admin/ui/pipeline/ProfileList";
  import VectorIndexPage from "../../features/system-admin/ui/vectors/VectorIndexPage";
  import DomainProfileList from "../../features/system-admin/ui/domains/DomainProfileList";
  
  const protect = (
    element: JSX.Element,
    product: string,
    role?: string | string[],
    redirectTo = "/403"
  ) => (
    <RequireRole product={product} role={role} redirectTo={redirectTo}>
      {element}
    </RequireRole>
  );

  const protectAdmin = (element: JSX.Element, redirectTo = "/403") => (
    <RequireAdmin redirectTo={redirectTo}>{element}</RequireAdmin>
  );

  export const AppRoutes = [
    
    //Pages
    { path: routes.Home, element: <HomePage/>},
    { path: routes.DashboardView, element: <DashboardViewer/>},
    { path: routes.SettingsView, element: <SettingsPage/>},
    { path: routes.SettingsAccountView, element: <AccountSettingsPage/>},
    { path: routes.HomePage, element: <HomePage/>},

    { path: routes.UsermanagementView, element: protect(<UserManagementPage/>, "user management", "admin")},
    { path: routes.ProductManagementView, element: protect(<ProductManagementPage/>, "product management", "admin")},

    { path: routes.CrosswalkManagement, element: protect(<ListManagementPage/>, "crosswalk manager", "user")},

    { path: routes.NoCodeQueryBuilder, element: <QueryForgePage/>},
    { path: routes.NoCodeQueryBuilderV2, element: <QueryForgePage/>},
    {
      path: routes.NoCodeDataDictionary,
      element: protect(<DataDictionaryPage />, "dictionary", "user"),
      children: [
        { index: true, element: <DictionaryTab /> },
        { path: "reconcile", element: <ReconTab /> },
      ],
    },
    {
      path: routes.NoCodeQueryManagement,
      element: <NoCodeManagementPage />,
      children: [
        { index: true, element: <Navigate to="domains" replace /> },
        { path: routes.NoCodeAdminDomains, element: <DomainsTab /> },
      ],
    },
    { path: routes.SemanticConcepts, element: protectAdmin(<ConceptsPage />) },
    { path: routes.SemanticAliases, element: protectAdmin(<AliasesPage />) },
    { path: routes.SemanticValueAliases, element: protectAdmin(<ValueAliasesPage />) },
    { path: routes.SemanticConceptColumnMaps, element: protectAdmin(<ConceptColumnMapsPage />) },
    { path: routes.SemanticPlanner, element: protectAdmin(<PlannerPage />) },
    { path: routes.ForgeInsights, element: protect(<ForgeInsightsPage />, "forge insights", "user") },

    { path: routes.AdminHealth, element: protectAdmin(<HealthDashboard />) },
    { path: routes.AdminPipelineProfiles, element: protectAdmin(<ProfileList />) },
    { path: routes.AdminVectorIndexes, element: protectAdmin(<VectorIndexPage />) },
    { path: routes.AdminDomainProfiles, element: protectAdmin(<DomainProfileList />) },
  ];

  export const AuthRoutes = [

    {path: routes.Auth, element: <Auth/>},
    // Error Pages
    { path: routes.ErrorPages.Error404, element: <Error404 /> },
    
  ];
