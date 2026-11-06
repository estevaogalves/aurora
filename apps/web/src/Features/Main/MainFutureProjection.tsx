import DashboardFutureProjection from "../FutureProjection/DashboardFutureProjection";
import DividedExpenses from "../FutureProjection/DividedExpenses";
import ExtraExpenses from "../FutureProjection/ExtraExpenses";
import GraphicsFutureProjection from "../FutureProjection/GraphicsFutureProjection";


export default function MainFutureProjection() {
  return (
    <div>
       <DashboardFutureProjection/>
       <GraphicsFutureProjection/>
       <ExtraExpenses/>
       <DividedExpenses/>
    </div>
  )
}