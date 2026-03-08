import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../../../shared/runtime/hooks";

export default function PublicOnly() {
  const authenticated = useAppSelector((state) => state.auth.isAuthenticated);

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
