export const routes = {
  Home: `/`,
  Auth: `/auth`,

  //Pages
  HomePage: `/home`,
  DashboardView: `/dashboard-view/:id`,
  SettingsView: `/settings`,
  SettingsAccountView: `/settings/account`,
  UsermanagementView: `/user-management`,
  ProductManagementView: `/product-management`,
  NoCodeQueryBuilder: `/no-code/builder`,
  NoCodeQueryBuilderV2: `/no-code/builder/v2`,
  CrosswalkManagement: '/crosswalk/management',

  NoCodeQueryManagement: "/no-code/admin",
  NoCodeDataDictionary: "/no-code/dictionary",
  NoCodeAdminDomains: "/no-code/admin/domains",
  NoCodeAdminAccess: "/no-code/admin/access",
  SemanticConcepts: "/semantic/concepts",
  SemanticAliases: "/semantic/aliases",
  SemanticValueAliases: "/semantic/value-aliases",
  SemanticConceptColumnMaps: "/semantic/concept-column-maps",
  SemanticPlanner: "/semantic/planner",
  LlmChatTest: "/llm-chat",
  //Other
  ErrorPages: {
    Error404: `/error-pages/error-404`,
  },
};
