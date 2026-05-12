import { routes } from "@/app/navigation/routes";
import type { FlowForgeReportingDomain, FlowForgeReportingFilter } from "./reportTypes";

export function buildQueryForgeDomainLaunchUrl(domain: FlowForgeReportingDomain, prompt?: string): string {
  const launch = domain.queryforge_launch;
  const defaultFilters: FlowForgeReportingFilter[] = launch?.default_filters?.length
    ? launch.default_filters
    : domain.default_filters;
  const params = new URLSearchParams({
    source: launch?.source ?? "flowforge",
    domain_key: launch?.domain_key ?? domain.domain_key,
    read_model: launch?.read_model ?? domain.read_model,
    default_filters: JSON.stringify(defaultFilters),
  });
  if (typeof launch?.domain_id === "number" && Number.isFinite(launch.domain_id) && launch.domain_id > 0) {
    params.set("domain_id", String(launch.domain_id));
  }
  const starterPrompt = prompt ?? launch?.starter_prompt;
  if (starterPrompt) {
    params.set("prompt", starterPrompt);
  }
  return `${routes.NoCodeQueryBuilder}?${params.toString()}`;
}
