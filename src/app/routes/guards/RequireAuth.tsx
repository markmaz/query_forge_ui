import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../../../shared/lib/hooks";

export default function RequireAuth() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const bootstrapped = useAppSelector((s) => s.auth.bootstrapped);
  const location = useLocation();
  if (!bootstrapped) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/auth" replace state={{ from: location }} />
  );
}
