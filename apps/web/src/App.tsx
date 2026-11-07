import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import ComparisonPage from "./Features/Comparison/ComparisonPage";
import Painel from "./Features/Dashboard/Painel";
import GoalsPage from "./Features/Goals/GoalsPage";
import LaunchPage from "./Features/Launch/LaunchPage";
import ProjectionPage from "./Features/Projection/ProjectionPage";
import ReportsPage from "./Features/Reports/ReportsPage";
import AppShell from "./Layout/AppShell";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/painel" replace />} />
          <Route path="/painel" element={<Painel />} />
          <Route path="/lancamentos" element={<LaunchPage />} />
          <Route path="/projecao" element={<ProjectionPage />} />
          <Route path="/comparacao" element={<ComparisonPage />} />
          <Route path="/metas" element={<GoalsPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
