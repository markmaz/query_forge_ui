import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAppSelector } from "../../../shared/runtime/hooks";
import { useIsStrictSystemAdmin } from "../../../shared/security/systemAdminAccess";

type Props = {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
};

export default function RequireSystemAdmin({
  children,
  redirectTo = "/403",
  fallback,
}: Props) {
  const { initialized, loading } = useAppSelector((state) => state.user);
  const allowed = useIsStrictSystemAdmin();

  if (loading || !initialized) {
    return <>{fallback ?? <div style={{ padding: 16 }}>Loading…</div>}</>;
  }

  return allowed ? <>{children}</> : <Navigate to={redirectTo} replace />;
}
