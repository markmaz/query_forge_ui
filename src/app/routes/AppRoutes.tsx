  // Defines main application routes

  import { routes } from "./routes";
  import { Navigate } from "react-router-dom";

  //Pages
  import HomePage from "../../pages/HomePage";
  import SettingsPage from "../../pages/SettingsPage";
  import Error404 from "../..//pages/Error404";
  import DashboardViewer from "../../features/dashboards/ui/DashboardViewer";
  import UserManagementPage from "../../pages/UserManagementPage";
  import ProductManagementPage from "../../features/product-management/ui/ProductManagementPage";
  import { CohortBuilderPage } from "../../features/cohort-builder";
  import { CohortAnalysisPage } from "../../features/cohort-analysis";
  import { CohortManagementPage } from "../../features/cohort-management";
  import DataDictionaryPage from "../../features/no-code-admin/ui/DataDictionaryPage";
  import NoCodeQueryPageV2 from "../../features/no-code-sql/ui/NoCodeQueryPageV2";
  import RequireRole from "./guards/RequireRole";
  import { JSX } from "react";
  import Auth from "../../features/auth/ui";
  import ListManagementPage from "../../features/crosswalks/ui/ListManagementPage";
  import NoCodeManagementPage from "../../features/no-code-admin/ui/NoCodeManagementPage";
  import { DictionaryTab } from "../../features/no-code-admin/ui/components/DictionaryTab";
  import { ReconTab } from "../../features/no-code-admin/ui/components/ReconTab";
  import { DomainsTab } from "../../features/no-code-admin/ui/components/DomainsTab";
  
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

  export const AppRoutes = [
    
    //Pages
    { path: routes.Home, element: <HomePage/>},
    { path: routes.DashboardView, element: <DashboardViewer/>},
    { path: routes.SettingsView, element: <SettingsPage/>},
    { path: routes.HomePage, element: <HomePage/>},

    { path: routes.UsermanagementView, element: protect(<UserManagementPage/>, "user management", "admin")},
    { path: routes.ProductManagementView, element: protect(<ProductManagementPage/>, "product management", "admin")},

    { path: routes.CohortBuilder, element: protect(<CohortBuilderPage/>, "cohort builder", "user")},
    { path: routes.CohortAnalysis, element: protect(<CohortAnalysisPage/>, "cohort analysis", "user")},
    { path: routes.CohortManagement, element: protect(<CohortManagementPage/>, "my cohorts", "user")},
  
    { path: routes.CrosswalkManagement, element: protect(<ListManagementPage/>, "crosswalk manager", "user")},

    { path: routes.NoCodeQueryBuilder, element: <NoCodeQueryPageV2/>},
    { path: routes.NoCodeQueryBuilderV2, element: <NoCodeQueryPageV2/>},
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
  ];

  export const AuthRoutes = [

    {path: routes.Auth, element: <Auth/>},
    // Error Pages
    { path: routes.ErrorPages.Error404, element: <Error404 /> },
    
  ];
