import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../../../shared/lib/hooks";

export default function PublicOnly() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}
