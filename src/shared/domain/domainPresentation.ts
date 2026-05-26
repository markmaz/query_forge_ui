export const WORKFLOW_DOMAIN_KIND = "workflow_intelligence";

export type DomainPresentationGroupKey = "business" | "workflow";

export type DomainPresentationLike = {
  kind?: string | null;
  domain_kind?: string | null;
  domainKind?: string | null;
  origin?: string | null;
  source_origin?: string | null;
  sourceOrigin?: string | null;
};

export type DomainPresentationGroup<T> = {
  key: DomainPresentationGroupKey;
  label: string;
  className: string;
  rows: T[];
};

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isWorkflowDomain(domain: DomainPresentationLike | null | undefined): boolean {
  if (!domain) return false;
  const kind = normalized(domain.kind ?? domain.domain_kind ?? domain.domainKind);
  const origin = normalized(domain.origin ?? domain.source_origin ?? domain.sourceOrigin);
  return kind === WORKFLOW_DOMAIN_KIND || origin === "flowforge";
}

export function domainGroupKey(domain: DomainPresentationLike | null | undefined): DomainPresentationGroupKey {
  return isWorkflowDomain(domain) ? "workflow" : "business";
}

export function domainGroupLabel(key: DomainPresentationGroupKey): string {
  return key === "workflow" ? "Workflow Intelligence Domains" : "Business Domains";
}

export function domainGroupClassName(key: DomainPresentationGroupKey): string {
  return key === "workflow" ? "qf-domain-group--workflow" : "qf-domain-group--business";
}

export function workflowDomainBadgeLabel(domain: DomainPresentationLike | null | undefined): string | null {
  return isWorkflowDomain(domain) ? "Workflow" : null;
}

export function groupDomainRows<T extends DomainPresentationLike>(rows: T[]): DomainPresentationGroup<T>[] {
  const grouped: Record<DomainPresentationGroupKey, T[]> = {
    business: [],
    workflow: [],
  };

  rows.forEach((row) => {
    grouped[domainGroupKey(row)].push(row);
  });

  return (["business", "workflow"] as DomainPresentationGroupKey[])
    .filter((key) => grouped[key].length > 0)
    .map((key) => ({
      key,
      label: domainGroupLabel(key),
      className: domainGroupClassName(key),
      rows: grouped[key],
    }));
}
