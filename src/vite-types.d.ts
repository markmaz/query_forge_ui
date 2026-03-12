/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly REACT_APP_QF_PLAN_DOMAIN_FAST_MODE_DEFAULT?: string;
  readonly VITE_QF_PLAN_DOMAIN_FAST_MODE_DEFAULT?: string;
  readonly REACT_APP_USE_WORKSPACE_IDS?: string;
  readonly VITE_USE_WORKSPACE_IDS?: string;
  readonly REACT_APP_ADMIN_TENANCY_ENABLED?: string;
  readonly VITE_ADMIN_TENANCY_ENABLED?: string;
  // add more env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
