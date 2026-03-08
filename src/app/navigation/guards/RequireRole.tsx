import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../../../shared/runtime/hooks";
import { useCan } from "../../../shared/runtime/useCan";

type Props = {
  product: string;
  role?: string | string[];
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
};

function isAuthorized(
  product: string,
  role: Props["role"],
  hasProduct: (name: string) => boolean,
  hasRole: (productName: string, roleName: string) => boolean
) {
  if (role == null) return hasProduct(product);
  if (Array.isArray(role)) return role.some((candidate) => hasRole(product, candidate));
  return hasRole(product, role);
}

export default function RequireRole({
  product,
  role,
  children,
  redirectTo = "/403",
  fallback,
}: Props) {
  const { initialized, loading } = useAppSelector((state) => state.user);
  const { hasProduct, hasRole } = useCan();

  if (loading || !initialized) {
    return <>{fallback ?? <div style={{ padding: 16 }}>Loading…</div>}</>;
  }

  const allowed = isAuthorized(product, role, hasProduct, hasRole);
  return allowed ? <>{children}</> : <Navigate to={redirectTo} replace />;
}
