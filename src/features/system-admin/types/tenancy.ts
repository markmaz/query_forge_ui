export type TenancyId = string;

export interface TenancyListParams {
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface TenancyPagedResponse<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrganizationListParams extends TenancyListParams {
  q?: string;
}

export interface OrganizationMembershipListParams extends TenancyListParams {}

export interface WorkspaceMembershipListParams extends TenancyListParams {}

export interface DatasourceListParams extends TenancyListParams {}

export interface WorkspaceBindingListParams extends TenancyListParams {
  organization_id?: string;
}

export interface TenancyOrganization {
  organization_id: TenancyId;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrganizationCreateRequest {
  name: string;
  slug?: string;
  description?: string | null;
  is_active?: boolean;
}

export type OrganizationCreateResponse = TenancyOrganization;
export type OrganizationInput = OrganizationCreateRequest;

export interface TenancyMembership {
  membership_id: TenancyId;
  user_id: string;
  username: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  role: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface MembershipInput {
  user_id: string;
  role?: string | null;
  is_active?: boolean;
}

export interface MembershipPatchInput {
  role?: string | null;
  is_active?: boolean;
}

export interface TenancyDatasource {
  datasource_id: TenancyId;
  organization_id: TenancyId;
  name: string;
  slug: string;
  type: TenancyDatasourceType | string;
  description: string | null;
  is_active: boolean;
  secret_ref: string | null;
  config_json: Record<string, unknown>;
  last_test_status: string | null;
  last_test_time: string | null;
  last_test_latency_ms: number | null;
  last_test_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type TenancyDatasourceType = "databricks" | "snowflake" | "mysql" | "postgres" | "bigquery";

export interface DatasourceInput {
  name: string;
  slug?: string;
  type: TenancyDatasourceType | string;
  description?: string | null;
  is_active?: boolean;
  secret_ref?: string | null;
  config_json?: Record<string, unknown>;
}

export type DatasourceCreateRequest = DatasourceInput;
export type DatasourceCreateResponse = TenancyDatasource;

export interface DatasourcePatchInput extends Partial<DatasourceInput> {}

export interface DatasourceTestResult {
  status: string;
  success: boolean;
  latency_ms: number | null;
  message: string | null;
  tested_at: string | null;
}

export interface DatasourceNamespaces {
  datasource_id: TenancyId;
  datasource_type: TenancyDatasourceType | string;
  catalogs: string[];
  schemas: string[];
  current_catalog: string | null;
  current_schema: string | null;
}

export interface WorkspaceBindingRow {
  workspace_id: TenancyId;
  workspace_name: string;
  organization_id: TenancyId | null;
  organization_name: string | null;
  datasource_id: TenancyId | null;
  datasource_name: string | null;
  datasource_type: string | null;
  workspace_is_active: boolean;
}

export interface WorkspaceBindingDetail extends WorkspaceBindingRow {
  description: string | null;
  default_catalog: string | null;
  default_schema: string | null;
}

export interface WorkspaceBindingPatchInput {
  organization_id?: TenancyId | null;
  datasource_id?: TenancyId | null;
  name?: string;
  description?: string | null;
  is_active?: boolean;
  default_catalog?: string | null;
  default_schema?: string | null;
}

export interface WorkspaceCreateRequest {
  workspace_id?: string;
  organization_id: TenancyId;
  datasource_id?: TenancyId | null;
  name?: string;
  description?: string | null;
  is_active?: boolean;
  default_catalog?: string | null;
  default_schema?: string | null;
}

export type WorkspaceCreateResponse = WorkspaceBindingDetail;

export interface WorkspaceBindingUpdateRequest {
  datasource_id: TenancyId;
}

export type WorkspaceBindingUpdateResponse = WorkspaceBindingDetail;

export interface TenancyBootstrapRequest {
  workspace_id: string;
  organization_name: string;
  organization_id?: string | null;
  organization_slug?: string | null;
  organization_description?: string | null;
  datasource_name: string;
  datasource_type: TenancyDatasourceType;
  datasource_slug?: string | null;
  datasource_description?: string | null;
  datasource_secret_ref?: string | null;
  datasource_config_json?: Record<string, unknown> | null;
  default_catalog?: string | null;
  default_schema?: string | null;
  admin_user_id?: string | null;
}

export interface TenancyBootstrapResult {
  workspace_id: string;
  organization: Record<string, unknown>;
  datasource: Record<string, unknown>;
  workspace_binding: Record<string, unknown>;
  memberships: Record<string, unknown>;
}
