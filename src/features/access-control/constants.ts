import type { AccessFeatureKey, AccessRoleDefinition } from "./types";

export type FeatureDefinition = {
  key: AccessFeatureKey;
  label: string;
  shortLabel: string;
  description: string;
  unlocks: string;
  rolePrefix: string;
};

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: "catalog",
    label: "Catalog",
    shortLabel: "Catalog",
    description: "Manage the business catalog, dictionary, and rules that support QueryForge.",
    unlocks: "Unlocks dictionary, data rules, and catalog-backed administration surfaces.",
    rolePrefix: "catalog",
  },
  {
    key: "workspaces",
    label: "Workspaces",
    shortLabel: "Workspaces",
    description: "Manage workspace-level setup, tenancy context, and workspace-scoped operations.",
    unlocks: "Unlocks workspace selection, workspace bindings, external links, and workspace setup flows.",
    rolePrefix: "workspaces",
  },
  {
    key: "forge_insights",
    label: "Forge Insights",
    shortLabel: "Insights",
    description: "Conversational and insight-driven workflows built on QueryForge context.",
    unlocks: "Unlocks Forge Insights chat, threaded reasoning, and workspace-aware insight experiences.",
    rolePrefix: "forge_insights",
  },
  {
    key: "query_studio",
    label: "Query Studio",
    shortLabel: "Query Studio",
    description: "Build, refine, and run QueryForge semantic queries.",
    unlocks: "Enables the core query builder and saved-query workflows.",
    rolePrefix: "query_studio",
  },
  {
    key: "forge_match",
    label: "Forge Match",
    shortLabel: "ForgeMatch",
    description: "AI-assisted source-to-catalog mapping with human review.",
    unlocks: "Unlocks upload, analysis, review, and export for mapping sessions.",
    rolePrefix: "forge_match",
  },
  {
    key: "skills",
    label: "Skills",
    shortLabel: "Skills",
    description: "Automate saved-query alerts, summaries, and deliveries.",
    unlocks: "Unlocks query-bound automations and delivery workflows.",
    rolePrefix: "skills",
  },
  {
    key: "planner",
    label: "Planner",
    shortLabel: "Planner",
    description: "Guided planning and semantic suggestion flows.",
    unlocks: "Unlocks planning assistants and next-step guidance.",
    rolePrefix: "planner",
  },
  {
    key: "semantic",
    label: "Semantic Registry",
    shortLabel: "Semantic",
    description: "Manage semantic concepts, aliases, and relationships.",
    unlocks: "Unlocks semantic administration and catalog curation.",
    rolePrefix: "semantic",
  },
  {
    key: "ingestion",
    label: "Ingestion",
    shortLabel: "Ingestion",
    description: "Sync metadata and ingestion pipelines into QueryForge.",
    unlocks: "Unlocks metadata sync and ingestion monitor tooling.",
    rolePrefix: "ingestion",
  },
  {
    key: "exports",
    label: "Exports",
    shortLabel: "Exports",
    description: "Run and deliver exported results from QueryForge workflows.",
    unlocks: "Unlocks execution history, export jobs, and downstream delivery operations.",
    rolePrefix: "exports",
  },
  {
    key: "vector",
    label: "Vector Indexes",
    shortLabel: "Vector",
    description: "Maintain vector indexes used for retrieval and ranking.",
    unlocks: "Unlocks vector index administration and rebuild tasks.",
    rolePrefix: "vector",
  },
  {
    key: "ai",
    label: "AI Services",
    shortLabel: "AI",
    description: "Enable AI-powered assistance across QueryForge.",
    unlocks: "Unlocks AI-backed suggestions and reasoning surfaces.",
    rolePrefix: "ai",
  },
  {
    key: "system",
    label: "System Admin",
    shortLabel: "System",
    description: "Administrative controls and diagnostic tooling.",
    unlocks: "Unlocks system-level admin pages and operations.",
    rolePrefix: "system",
  },
];

export const FEATURE_BY_KEY = new Map(
  FEATURE_DEFINITIONS.map((feature) => [feature.key, feature]),
);

export const ROLE_USAGE_COPY: Record<string, string> = {
  library_admin:
    "Administrative access to shared library queries and folders across workspaces.",
  workspace_admin:
    "Administrative access across the selected workspace, including feature-gated QueryForge tooling.",
  "system:super_user":
    "Elevated system-wide access used for bootstrap and emergency administration.",
  "catalog:admin": "Administer catalog entities, dictionary content, and rules management.",
  "catalog:user": "Use catalog-backed dictionary and rule experiences in an enabled workspace.",
  "workspaces:admin": "Administer workspace configuration and workspace-scoped management flows.",
  "workspaces:user": "Use workspace-scoped experiences and workspace-bound integrations.",
  "forge_insights:admin": "Administer Forge Insights conversations and related controls.",
  "forge_insights:user": "Use Forge Insights chat and insight workflows in an enabled workspace.",
  "skills:admin": "Manage Skills automations, configuration, and review flows.",
  "skills:user": "Use Skills workflows within an enabled workspace.",
  "forge_match:admin": "Manage ForgeMatch sessions, review controls, and mapping outcomes.",
  "forge_match:user": "Use ForgeMatch uploads and review workflows in an enabled workspace.",
  "planner:admin": "Administer planner configuration and planning-assisted workflows.",
  "planner:user": "Use planner and semantic planning flows.",
  "semantic:admin": "Administer semantic concepts, aliases, and relationships.",
  "semantic:user": "Use semantic catalog-backed experiences where enabled.",
  "query_studio:admin": "Administer Query Studio and related authoring controls.",
  "query_studio:user": "Use Query Studio build and run workflows.",
  "ingestion:admin": "Administer ingestion and metadata sync operations.",
  "ingestion:user": "Use ingestion-facing workspace tooling where available.",
  "exports:admin": "Administer export execution and delivery workflows.",
  "exports:user": "Use export and execution features where enabled.",
  "vector:admin": "Administer vector indexes and retrieval infrastructure.",
  "vector:user": "Use vector-backed retrieval features where enabled.",
  "ai:admin": "Administer AI-enabled workflows and supporting controls.",
  "ai:user": "Use AI-assisted features where enabled.",
  "system:admin": "Administrative access to system-level controls.",
};

export const WORKSPACE_ADMIN_ROLE_KEY = "workspace_admin";
export const SUPER_USER_ROLE_KEY = "system:super_user";

export function inferRoleCategory(roleKey: string): AccessRoleDefinition["category"] {
  if (roleKey === "library_admin" || roleKey === "super_admin") return "system";
  if (roleKey === WORKSPACE_ADMIN_ROLE_KEY) return "workspace";
  if (roleKey.startsWith("system:")) return "system";
  if (roleKey.includes(":")) return "feature";
  return "workspace";
}

export function inferRoleFeatureKey(roleKey: string): AccessFeatureKey | null {
  if (roleKey === WORKSPACE_ADMIN_ROLE_KEY) return null;
  const prefix = roleKey.split(":")[0]?.trim();
  const matched = FEATURE_DEFINITIONS.find((feature) => feature.rolePrefix === prefix);
  return matched?.key ?? null;
}

export function inferRoleAccessLevel(roleKey: string): AccessRoleDefinition["access_level"] {
  if (roleKey === WORKSPACE_ADMIN_ROLE_KEY) return "admin";
  if (roleKey.endsWith(":admin") || roleKey.endsWith("_admin")) return "admin";
  if (roleKey.endsWith(":viewer") || roleKey.endsWith(":read")) return "viewer";
  if (roleKey.endsWith(":user")) return "user";
  if (roleKey === SUPER_USER_ROLE_KEY) return "admin";
  return "user";
}

export function normalizeRoleDisplayName(roleKey: string, fallback?: string | null): string {
  if (fallback && fallback.trim().length > 0) return fallback.trim();
  return roleKey
    .replace(/[_:]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
