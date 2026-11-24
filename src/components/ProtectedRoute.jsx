import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function ProtectedRoute({ requireSuperAdmin = false }) {
  const { user, role, loading } = useAuthStore();
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireSuperAdmin && role !== "superadmin")
    return <Navigate to="/" replace />;
  return <Outlet />;
}
