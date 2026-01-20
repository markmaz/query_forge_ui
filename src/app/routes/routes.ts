export const routes = {
  Home: `/`,
  Auth: `/auth/:mode?/:userId?`,

  //Pages
  HomePage: `/home`,
  DashboardView: `/dashboard-view/:id`,
  SettingsView: `/settings`,
  UsermanagementView: `/user-management`,
  ProductManagementView: `/product-management`,
  CohortBuilder: `/cohort-assistant/builder`,
  CohortAnalysis: `/cohort-assistant/analysis`,
  CohortManagement: `/cohort-assistant/management`,
  NoCodeQueryBuilder: `/no-code/builder`,
  CrosswalkManagement: '/crosswalk/management',

  NoCodeQueryManagement: "/no-code/admin",
  NoCodeAdminDictionary: "/no-code/admin/dictionary",
  NoCodeAdminReconcile: "/no-code/admin/reconcile",
  NoCodeAdminDomains: "/no-code/admin/domains",
  NoCodeAdminAccess: "/no-code/admin/access",
  //Other
  ErrorPages: {
    Error404: `/error-pages/error-404`,
  },
};
