import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/auth-context";

export function ProtectedRoute() {
  const { isAuthenticated, isCheckingSession } = useAuth();

  if (isCheckingSession) {
    return <section className="panel panel-loading">Checking session...</section>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
