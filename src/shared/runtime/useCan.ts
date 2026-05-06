import { useMemo } from "react";
import { useAppSelector } from "./hooks";

const normalize = (value: string) => (value ?? "").trim().toLowerCase();
const ROLE_IMPLICATIONS: Record<string, string[]> = {
  admin: ["admin", "designer", "operator", "viewer", "user"],
  designer: ["designer", "viewer", "user"],
  operator: ["operator", "viewer", "user"],
  user: ["viewer", "user"],
  viewer: ["viewer"],
};

export function roleSatisfies(assignedRole: string, requiredRole: string) {
  const assigned = normalize(assignedRole);
  const required = normalize(requiredRole);
  const implied = ROLE_IMPLICATIONS[assigned];

  if (implied != null && ROLE_IMPLICATIONS[required] != null) {
    return implied.includes(required);
  }

  return assigned === required;
}

function normalizeRoleMap(input: Record<string, string[] | undefined>) {
  return Object.entries(input).reduce<Record<string, string[]>>((accumulator, [key, roles]) => {
    accumulator[normalize(key)] = (roles ?? []).map((role) => normalize(String(role)));
    return accumulator;
  }, {});
}

function normalizeCapabilities(capabilities: unknown[]) {
  return capabilities.map((capability) => normalize(String(capability)));
}

export function useCan() {
  const rolesByFeatureRaw = useAppSelector((state) => state.user.rolesByFeature) ?? {};
  const capabilitiesRaw = useAppSelector((state) => state.user.capabilities) ?? [];

  const rolesByFeature = useMemo(
    () => normalizeRoleMap(rolesByFeatureRaw),
    [rolesByFeatureRaw]
  );

  const capabilities = useMemo(
    () => normalizeCapabilities(capabilitiesRaw),
    [capabilitiesRaw]
  );

  const hasFeature = (feature: string) => Boolean(rolesByFeature[normalize(feature)]);

  const hasRole = (feature: string, role: string) => {
    const normalizedFeature = normalize(feature);
    const normalizedRole = normalize(role);
    return (rolesByFeature[normalizedFeature] ?? []).some((assignedRole) =>
      roleSatisfies(assignedRole, normalizedRole)
    );
  };

  const has = (capability: string) => capabilities.includes(normalize(capability));
  const any = (required: string[]) => required.some((capability) => has(capability));
  const all = (required: string[]) => required.every((capability) => has(capability));

  return { hasFeature, hasRole, has, any, all, rolesByFeature, capabilities };
}
