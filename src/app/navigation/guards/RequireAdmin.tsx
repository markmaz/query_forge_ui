import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../../../shared/runtime/hooks";
import useSemanticAdminPermissions from "../../../features/semantic-admin/lib/useSemanticAdminPermissions";
import { getRolesFromToken, isAdmin } from "../../../shared/services/auth";
import { getAccessToken } from "../../../shared/runtime/accessTokenStore";

type Props = {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
};

export default function RequireAdmin({ children, redirectTo = "/403", fallback }: Props) {
  const { initialized, loading } = useAppSelector((state) => state.user);
  const { canMutate } = useSemanticAdminPermissions();
  const token = getAccessToken();
  const tokenRoles = getRolesFromToken(token).map((role) => role.toLowerCase());
  const tokenAdmin =
    isAdmin(token) ||
    tokenRoles.includes("super_admin") ||
    tokenRoles.includes("workspace_admin");

  if (loading || !initialized) {
    return <>{fallback ?? <div style={{ padding: 16 }}>Loading…</div>}</>;
  }

  return canMutate || tokenAdmin ? <>{children}</> : <Navigate to={redirectTo} replace />;
}
