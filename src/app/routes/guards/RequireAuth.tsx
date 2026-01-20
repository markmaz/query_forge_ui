import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../../../shared/lib/hooks";

export default function RequireAuth() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const location = useLocation();
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/auth" replace state={{ from: location }} />
  );
}
