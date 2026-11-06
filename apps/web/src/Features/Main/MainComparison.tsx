import BalanceRanking from "../Comparison/BalanceRanking";
import DashboardComparison from "../Comparison/DashboardComparison";
import GraphicsComparison from "../Comparison/GraphicsComparison";

export default function MainComparison() {
  return (
    <>
      <DashboardComparison />
      <GraphicsComparison/>
      <BalanceRanking/>
    </>
  );
}
