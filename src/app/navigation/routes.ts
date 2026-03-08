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
  NoCodeQueryBuilderV3: `/no-code/builder/v3`,
  CrosswalkManagement: '/crosswalk/management',

  NoCodeQueryManagement: "/no-code/admin",
  NoCodeDataDictionary: "/no-code/dictionary",
  NoCodeAdminDomains: "/no-code/admin/domains",
  NoCodeAdminDomainGraph: "/no-code/admin/domain-graph",
  NoCodeAdminAccess: "/no-code/admin/access",
  SemanticConcepts: "/semantic/concepts",
  SemanticAliases: "/semantic/aliases",
  SemanticValueAliases: "/semantic/value-aliases",
  SemanticConceptColumnMaps: "/semantic/concept-column-maps",
  SemanticPlanner: "/semantic/planner",
  ForgeInsights: "/forge-insights",

  AdminHealth: "/admin/health",
  AdminPipelineProfiles: "/admin/pipeline-profiles",
  AdminVectorIndexes: "/admin/vector-indexes",
  AdminDomainProfiles: "/admin/domain-profiles",
  AdminPromptFeedback: "/admin/prompt-feedback",

  //Other
  ErrorPages: {
    Error404: `/error-pages/error-404`,
  },
};
