import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { SlCalender } from "react-icons/sl";
import { Button } from "../../components/ui/button";
import { useFinanceStore } from "../../Store/FinanceStore";
import {
  changeMonth,
  compareMonths,
  formatMonth,
  getCurrentMonth,
  getToday,
  isCurrentMonth,
} from "../../Utils/Date";

// 🟢 IMPORT CORRETO da função do serviço

export default function DetailsDate() {
  const { currentMonth, setCurrentMonth } = useFinanceStore();
  const transactions = useFinanceStore((state) => state.transactions);
  const notes = useFinanceStore((state) => state.notes);

  const realCurrentMonth = getCurrentMonth();
  const showCurrentButton = currentMonth !== realCurrentMonth;

  const monthLabel = isCurrentMonth(currentMonth)
    ? "Mês atual"
    : "Mês anterior";

  function hasDataInMonth(month: string) {
    const hasTransaction = transactions.some((t) => {
      if (t.fixed) {
        return !t.hiddenMonths?.includes(month);
      }
      return t.month === month;
    });

    const hasNotes = notes.some((n) => n.month === month);

    return hasTransaction || hasNotes;
  }

  function getOldestMonthWithData() {
    const monthsWithData = new Set<string>();

    transactions.forEach((t) => {
      if (t.fixed) {
        monthsWithData.add(t.month);

        if (t.monthlyValues) {
          Object.keys(t.monthlyValues).forEach((m) => monthsWithData.add(m));
        }
      } else {
        monthsWithData.add(t.month);
      }
    });

    notes.forEach((n) => monthsWithData.add(n.month));

    if (monthsWithData.size === 0) return null;

    return Array.from(monthsWithData).sort(compareMonths)[0];
  }

  function goToCurrentMonth() {
    setCurrentMonth(realCurrentMonth);
  }

  function handleNext() {
    const next = changeMonth(currentMonth, 1);

    if (compareMonths(next, realCurrentMonth) <= 0) {
      setCurrentMonth(next);
    }
  }

  function handlePrev() {
    const prev = changeMonth(currentMonth, -1);

    if (hasDataInMonth(prev)) {
      setCurrentMonth(prev);
    }
  }

  // 🟢 REMOVA a função exportPDF daqui (a que está dentro do componente)

  const previousMonthHasData = hasDataInMonth(changeMonth(currentMonth, -1));
  const oldestMonth = getOldestMonthWithData();

  const canGoBack = oldestMonth
    ? compareMonths(oldestMonth, currentMonth) < 0
    : false;

  const canGoForward = compareMonths(currentMonth, realCurrentMonth) < 0;

  return (
    <div className="mx-44 mt-6">
      <div className="flex justify-between items-center">
        <section>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-xl font-medium text-gray-300">
            Visão geral do seu mês
          </p>
        </section>

        <div className="flex items-center gap-8">
          <section className="flex items-center">
            <div className="bg-green-950 text-emerald-600 border border-emerald-600 px-2 py-2 rounded-lg mr-3">
              <SlCalender className="text-lg" />
            </div>

            <section>
              <h1 className="text-2xl font-bold text-white">
                {formatMonth(currentMonth)}
              </h1>

              <p className="text-lg font-medium text-gray-300">{monthLabel}</p>
            </section>
          </section>

          <section className="flex items-center gap-2">
            <Button
              onClick={handlePrev}
              disabled={!previousMonthHasData || !canGoBack}
              className="bg-green-800 text-white border border-emerald-600 hover:bg-green-900"
            >
              <IoChevronBack />
            </Button>

            {showCurrentButton && (
              <Button
                onClick={goToCurrentMonth}
                className="bg-green-800 text-white border border-emerald-600 hover:bg-green-900"
              >
                Mês atual
              </Button>
            )}

            <Button
              disabled={!canGoForward}
              onClick={handleNext}
              className="bg-green-800 text-white border border-emerald-600 hover:bg-green-900"
            >
              <IoChevronForward />
            </Button>

            <span className="text-lg font-semibold border border-emerald-600 px-2 py-1 bg-green-800 rounded-lg text-white">
              {getToday()}
            </span>
          </section>
        </div>

        {/* <Button
          onClick={() => exportPDF(currentMonth)}  
          className="text-lg font-semibold border border-emerald-600 px-4 !h-[45px] bg-green-800 hover:bg-green-900 rounded-lg text-white flex items-center gap-2"
        >
          <PiExportBold className="text-xl font-bold" />
          Exportar relatório
        </Button> */}
      </div>
    </div>
  );
}
