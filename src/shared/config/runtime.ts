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

export const appRuntimeConfig = {
  planDomainFastModeDefault: readPlanDomainFastModeDefault(),
};
