import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import MainComparison from "./Features/Main/MainComparison";
import MainDashboard from "./Features/Main/MainDashboard";
import MainFutureProjection from "./Features/Main/MainFutureProjection";
import MainGoals from "./Features/Main/MainGoals";
import MainLaunch from "./Features/Main/MainLaunch";
import MainReports from "./Features/Main/MainReports";
import AppShell from "./Layout/AppShell";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/painel" replace />} />
          <Route path="/painel" element={<MainDashboard />} />
          <Route path="/lancamentos" element={<MainLaunch />} />
          <Route path="/projecao" element={<MainFutureProjection />} />
          <Route path="/comparacao" element={<MainComparison />} />
          <Route path="/metas" element={<MainGoals />} />
          <Route path="/relatorios" element={<MainReports />} />
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
