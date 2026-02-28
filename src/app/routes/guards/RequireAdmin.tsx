import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../../../shared/lib/hooks";
import useSemanticAdminPermissions from "../../../features/semantic-admin/lib/useSemanticAdminPermissions";

type Props = {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
};

export default function RequireAdmin({ children, redirectTo = "/403", fallback }: Props) {
  const { initialized, loading } = useAppSelector((state) => state.user);
  const { canMutate } = useSemanticAdminPermissions();

  if (loading || !initialized) {
    return <>{fallback ?? <div style={{ padding: 16 }}>Loading…</div>}</>;
  }

  return canMutate ? <>{children}</> : <Navigate to={redirectTo} replace />;
}
