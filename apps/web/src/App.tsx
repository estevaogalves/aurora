import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { DATA_SOURCE } from "./config";
import AuthPage from "./Features/Auth/AuthPage";
import ImportPage from "./Features/Auth/ImportPage";
import RequireAuth from "./Features/Auth/RequireAuth";
import ComparisonPage from "./Features/Comparison/ComparisonPage";
import Painel from "./Features/Dashboard/Painel";
import GoalsPage from "./Features/Goals/GoalsPage";
import LaunchPage from "./Features/Launch/LaunchPage";
import ProjectionPage from "./Features/Projection/ProjectionPage";
import ProfilePage from "./Features/Profile/ProfilePage";
import ReportsPage from "./Features/Reports/ReportsPage";
import AppShell from "./Layout/AppShell";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/cadastrar" element={<AuthPage mode="register" />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/painel" replace />} />
            <Route path="/painel" element={<Painel />} />
            <Route path="/lancamentos" element={<LaunchPage />} />
            <Route path="/projecao" element={<ProjectionPage />} />
            <Route path="/comparacao" element={<ComparisonPage />} />
            <Route path="/metas" element={<GoalsPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            {DATA_SOURCE === "local" && <Route path="/perfil" element={<ProfilePage />} />}
            <Route path="/importar" element={<ImportPage />} />
            <Route path="*" element={<Navigate to="/painel" replace />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}
