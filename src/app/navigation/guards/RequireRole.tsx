import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../../../shared/runtime/hooks";
import { useCan } from "../../../shared/runtime/useCan";

type Props = {
  feature: string;
  role?: string | string[];
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
};

function isAuthorized(
  feature: string,
  role: Props["role"],
  hasFeature: (name: string) => boolean,
  hasRole: (featureName: string, roleName: string) => boolean
) {
  if (role == null) return hasFeature(feature);
  if (Array.isArray(role)) return role.some((candidate) => hasRole(feature, candidate));
  return hasRole(feature, role);
}

export default function RequireRole({
  feature,
  role,
  children,
  redirectTo = "/403",
  fallback,
}: Props) {
  const { initialized, loading } = useAppSelector((state) => state.user);
  const { hasFeature, hasRole } = useCan();

  if (loading || !initialized) {
    return <>{fallback ?? <div style={{ padding: 16 }}>Loading…</div>}</>;
  }

  const allowed = isAuthorized(feature, role, hasFeature, hasRole);
  return allowed ? <>{children}</> : <Navigate to={redirectTo} replace />;
}
