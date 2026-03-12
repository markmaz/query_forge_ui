import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../../../shared/runtime/hooks";

function AuthGuardLoading() {
  return <div style={{ padding: 24 }}>Loading…</div>;
}

export default function RequireAuth() {
  const { isAuthenticated, bootstrapped } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!bootstrapped) return <AuthGuardLoading />;

  if (isAuthenticated) {
    return <Outlet />;
  }

  return <Navigate to="/auth" replace state={{ from: location }} />;
}
