import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../../../shared/lib/hooks";
import { getAccessToken } from "../../../shared/lib/accessTokenStore";
import { isAdmin } from "../../../shared/services/auth";

type Props = {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
};

export default function RequireAdmin({ children, redirectTo = "/403", fallback }: Props) {
  const { initialized, loading } = useAppSelector((state) => state.user);

  if (loading || !initialized) {
    return <>{fallback ?? <div style={{ padding: 16 }}>Loading…</div>}</>;
  }

  return isAdmin(getAccessToken()) ? <>{children}</> : <Navigate to={redirectTo} replace />;
}

