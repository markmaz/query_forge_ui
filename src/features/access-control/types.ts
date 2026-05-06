export type AccessFeatureKey =
  | "catalog"
  | "workspaces"
  | "forge_match"
  | "forge_insights"
  | "query_studio"
  | "skills"
  | "flowforge"
  | "planner"
  | "semantic"
  | "ingestion"
  | "exports"
  | "vector"
  | "ai"
  | "system"
  | "queryforge_mcp";

export type AccessRoleCategory = "workspace" | "feature" | "system";
export type AccessLevel = "admin" | "user" | "viewer" | "none";
export type AccessStatus = "granted" | "blocked_feature" | "no_role";

export interface AccessRoleDefinition {
  role_id: string;
  role_key: string;
  role_name: string;
  display_name: string;
  description: string | null;
  category: AccessRoleCategory;
  feature_key: AccessFeatureKey | null;
  access_level: AccessLevel;
}

export interface WorkspaceRoleAssignment {
  assignment_id: string;
  user_id: string;
  workspace_id: string | null;
  role_id: string | null;
  role_key: string;
  role_name: string;
  display_name: string;
  category: AccessRoleCategory;
  feature_key: AccessFeatureKey | null;
  access_level: AccessLevel;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkspaceFeatureEntitlement {
  workspace_id: string;
  feature_key: AccessFeatureKey;
  enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
  note: string | null;
}

export interface EffectiveAccessEntry {
  feature_key: AccessFeatureKey;
  feature_name: string;
  feature_enabled: boolean;
  access_level: AccessLevel;
  status: AccessStatus;
  assigned_role_key: string | null;
  assigned_role_name: string | null;
  message: string;
}

export interface WorkspaceReadiness {
  workspace_id: string;
  workspace_name: string | null;
  has_workspace_admin: boolean;
  enabled_feature_count: number;
  super_user_present: boolean;
  setup_complete: boolean;
  completed_steps: string[];
  missing_steps: string[];
}

export interface WorkspaceOnboardingPayload {
  feature_keys: AccessFeatureKey[];
  workspace_admin_user_id: string;
  super_user_id?: string | null;
}

export interface AccessUserOption {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
}

export type MCPAppPrincipalTool =
  | "search_domains"
  | "get_domain_profile"
  | "search_dictionary"
  | "plan_query"
  | "validate_query_plan"
  | "compile_query"
  | "preview_query"
  | "list_saved_queries"
  | "run_saved_query";

export interface MCPAppPrincipalGrant {
  enabled: boolean;
  allowed_tools: MCPAppPrincipalTool[];
  allowed_domain_keys: string[];
  can_preview: boolean;
  preview_row_limit: number;
  expires_at: string | null;
  revoked_at: string | null;
  updated_at: string | null;
}

export interface MCPAppPrincipal {
  client_id: string;
  display_name: string;
  description: string | null;
  owning_workspace_id: string;
  owner_user_id: string | null;
  created_by: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  rotation_required_at: string | null;
  grant: MCPAppPrincipalGrant;
}

export interface MCPAppPrincipalCreatePayload {
  display_name: string;
  description?: string | null;
  owner_user_id?: string | null;
  allowed_tools?: MCPAppPrincipalTool[];
  allowed_domain_keys?: string[];
  can_preview?: boolean;
  preview_row_limit?: number;
  expires_at?: string | null;
}

export interface MCPAppPrincipalCreateResult {
  workspace_id: string;
  client_secret: string;
  item: MCPAppPrincipal;
}
