import Expenses from "../Expenses/Expenses";
import Incomes from "../Income/Incomes";
import DetailsDate from "../Navbar/DetailsDate";
import SummaryCard from "../Navbar/SummaryCard";
import MoneyCard from "../Observations/MoneyCard";
import Notes from "../Observations/Notes";

export default function MainDashboard() {
  return (
    <>
      <DetailsDate />
      <SummaryCard />
      <div className="grid grid-cols-3 gap-6 mx-44 mt-6">
        <div className="col-span-2">
          <Incomes />
          <Expenses />
        </div>
        <div className="col-span-1">
          <MoneyCard />
          <Notes />
        </div>
      </div>
    </>
  );
}

//  <DetailsDate />
//       <SummaryCard />
//       <div className="grid grid-cols-3 gap-6 mx-44 mt-6">
//         <div className="col-span-2">
//           <Incomes />
//           <Expenses />
//         </div>
//         <div className="col-span-1">
//           <MoneyCard />
//           <Notes />
//         </div>
//       </div>