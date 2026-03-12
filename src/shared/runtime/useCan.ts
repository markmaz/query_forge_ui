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
  const rolesByProductRaw = useAppSelector((state) => state.user.rolesByProduct) ?? {};
  const capabilitiesRaw = useAppSelector((state) => state.user.capabilities) ?? [];

  const rolesByProduct = useMemo(
    () => normalizeRoleMap(rolesByProductRaw),
    [rolesByProductRaw]
  );

  const capabilities = useMemo(
    () => normalizeCapabilities(capabilitiesRaw),
    [capabilitiesRaw]
  );

  const hasProduct = (product: string) => Boolean(rolesByProduct[normalize(product)]);

  const hasRole = (product: string, role: string) => {
    const normalizedProduct = normalize(product);
    const normalizedRole = normalize(role);
    return (rolesByProduct[normalizedProduct] ?? []).includes(normalizedRole);
  };

  const has = (capability: string) => capabilities.includes(normalize(capability));
  const any = (required: string[]) => required.some((capability) => has(capability));
  const all = (required: string[]) => required.every((capability) => has(capability));

  return { hasProduct, hasRole, has, any, all, rolesByProduct, capabilities };
}
