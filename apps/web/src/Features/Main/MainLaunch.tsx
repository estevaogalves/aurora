import Expenses from "../Expenses/Expenses";
import Incomes from "../Income/Incomes";

export default function MainLaunch() {
  return (
    <div className="space-y-6">
      <Incomes />
      <Expenses />
    </div>
  );
}
