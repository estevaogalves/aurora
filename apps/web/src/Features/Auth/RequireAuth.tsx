import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/Store/AuthStore";

/** Só deixa passar quem está logado; os outros vão para o login e voltam depois. */
export default function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") return null;
  if (status === "anonymous") return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
