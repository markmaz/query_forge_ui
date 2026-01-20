import { useAppSelector } from "./hooks";

const norm = (s: string) => (s ?? "").trim().toLowerCase();

export function useCan() {
  const rolesByProductRaw = useAppSelector((s) => s.user.rolesByProduct) ?? {};
  const capabilitiesRaw   = useAppSelector((s) => s.user.capabilities) ?? [];

  const rolesByProduct = Object.entries(rolesByProductRaw).reduce<Record<string, string[]>>(
    (acc, [k, roles]) => {
      acc[norm(k)] = (roles ?? []).map((r) => norm(String(r)));
      return acc;
    },
    {}
  );

  const capabilities = (capabilitiesRaw ?? []).map((c) => norm(String(c)));

  const hasProduct = (product: string) => {
    return !!rolesByProduct[norm(product)];
  };

  const hasRole = (product: string, role: string) => {
    return (rolesByProduct[norm(product)] ?? []).includes(norm(role));
  };

  const has = (cap: string) => capabilities.includes(norm(cap));
  const any = (caps: string[]) => caps.some(has);
  const all = (caps: string[]) => caps.every(has);

  return { hasProduct, hasRole, has, any, all, rolesByProduct, capabilities };
}