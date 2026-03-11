const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

export function parseBooleanEnvFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return TRUE_ENV_VALUES.has(value.trim().toLowerCase());
}

function readPlanDomainFastModeDefault(): boolean {
  const env = import.meta.env as ImportMetaEnv & {
    REACT_APP_QF_PLAN_DOMAIN_FAST_MODE_DEFAULT?: string;
    VITE_QF_PLAN_DOMAIN_FAST_MODE_DEFAULT?: string;
  };
  return parseBooleanEnvFlag(
    env.REACT_APP_QF_PLAN_DOMAIN_FAST_MODE_DEFAULT ?? env.VITE_QF_PLAN_DOMAIN_FAST_MODE_DEFAULT
  );
}

function readWorkspaceIdPayloadsEnabled(): boolean {
  const env = import.meta.env as ImportMetaEnv & {
    REACT_APP_USE_WORKSPACE_IDS?: string;
    VITE_USE_WORKSPACE_IDS?: string;
  };
  const explicit = env.REACT_APP_USE_WORKSPACE_IDS ?? env.VITE_USE_WORKSPACE_IDS;
  if (typeof explicit === "string") {
    return parseBooleanEnvFlag(explicit);
  }
  return !import.meta.env.PROD;
}

function readAdminTenancyEnabled(): boolean {
  const env = import.meta.env as ImportMetaEnv & {
    REACT_APP_ADMIN_TENANCY_ENABLED?: string;
    VITE_ADMIN_TENANCY_ENABLED?: string;
  };
  return parseBooleanEnvFlag(env.REACT_APP_ADMIN_TENANCY_ENABLED ?? env.VITE_ADMIN_TENANCY_ENABLED);
}

export const appRuntimeConfig = {
  planDomainFastModeDefault: readPlanDomainFastModeDefault(),
  useWorkspaceIdPayloads: readWorkspaceIdPayloadsEnabled(),
  adminTenancyEnabled: readAdminTenancyEnabled(),
};
