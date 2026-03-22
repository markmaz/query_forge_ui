import { jwtDecode } from "jwt-decode";
import { useMemo } from "react";

import { useAppSelector } from "@/shared/runtime/hooks";
import { getAccessToken } from "@/shared/runtime/accessTokenStore";
import { getRolesFromToken } from "@/shared/services/auth";

type AuthTokenClaims = {
  is_admin?: unknown;
};

function normalizeRoleName(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function extractRoleNamesFromProfile(user: any): string[] {
  const values = new Set<string>();

  const directRoleNames = Array.isArray(user?.rbac_role_names) ? user.rbac_role_names : [];
  directRoleNames.forEach((roleName: unknown) => {
    const normalized = normalizeRoleName(roleName);
    if (normalized) values.add(normalized);
  });

  const roleObjects = Array.isArray(user?.rbac_roles) ? user.rbac_roles : [];
  roleObjects.forEach((role: any) => {
    const normalized = normalizeRoleName(role?.role_name);
    if (normalized) values.add(normalized);
  });

  const effectiveRoleObjects = Array.isArray(user?.effective_roles) ? user.effective_roles : [];
  effectiveRoleObjects.forEach((role: any) => {
    const normalized =
      typeof role === "string"
        ? normalizeRoleName(role)
        : normalizeRoleName(role?.role_name);
    if (normalized) values.add(normalized);
  });

  return [...values];
}

function tokenHasLegacySystemAdmin(token?: string | null): boolean {
  if (!token) return false;
  try {
    const decoded = jwtDecode<AuthTokenClaims>(token);
    return decoded.is_admin === true;
  } catch {
    return false;
  }
}

export function hasStrictSystemAdminAccess(user: any, token?: string | null): boolean {
  const explicitRoleNames = new Set<string>([
    ...getRolesFromToken(token).map((role) => normalizeRoleName(role)),
    ...extractRoleNamesFromProfile(user),
  ]);

  return (
    tokenHasLegacySystemAdmin(token) ||
    explicitRoleNames.has("super_admin") ||
    explicitRoleNames.has("system:admin") ||
    explicitRoleNames.has("system_admin")
  );
}

export function useIsStrictSystemAdmin(): boolean {
  const user = useAppSelector((state) => state.user.user);

  return useMemo(() => hasStrictSystemAdminAccess(user, getAccessToken()), [user]);
}
