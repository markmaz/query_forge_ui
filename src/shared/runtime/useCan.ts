import { useMemo } from "react";
import { useAppSelector } from "./hooks";

const normalize = (value: string) => (value ?? "").trim().toLowerCase();

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
    return (rolesByFeature[normalizedFeature] ?? []).includes(normalizedRole);
  };

  const has = (capability: string) => capabilities.includes(normalize(capability));
  const any = (required: string[]) => required.some((capability) => has(capability));
  const all = (required: string[]) => required.every((capability) => has(capability));

  return { hasFeature, hasRole, has, any, all, rolesByFeature, capabilities };
}
