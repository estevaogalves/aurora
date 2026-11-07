import SummaryCard from "../Navbar/SummaryCard";
import MoneyCard from "../Observations/MoneyCard";
import Notes from "../Observations/Notes";

export default function MainDashboard() {
  return (
    <div className="space-y-6">
      <SummaryCard />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MoneyCard />
        </div>
        <Notes />
      </div>
    </div>
  );
}
