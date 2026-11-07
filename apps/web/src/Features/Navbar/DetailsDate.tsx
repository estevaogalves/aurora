import { useMemo } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { SlCalender } from "react-icons/sl";
import { Button } from "../../components/ui/button";
import { getAvailableMonths } from "../../domain";
import { useFinanceStore } from "../../Store/FinanceStore";
import {
  changeMonth,
  compareMonths,
  formatMonth,
  getCurrentMonth,
  getToday,
  isCurrentMonth,
} from "../../Utils/Date";

export default function DetailsDate() {
  const { currentMonth, setCurrentMonth } = useFinanceStore();
  const transactions = useFinanceStore((state) => state.transactions);
  const creditTransactions = useFinanceStore((state) => state.creditTransactions);
  const notes = useFinanceStore((state) => state.notes);

  const realCurrentMonth = getCurrentMonth();
  const showCurrentButton = currentMonth !== realCurrentMonth;

  const monthLabel = isCurrentMonth(currentMonth)
    ? "Mês atual"
    : "Mês anterior";

  // meses do primeiro dado até hoje, sem buracos: mês vazio no meio não trava a navegação
  const availableMonths = useMemo(() => {
    const months = getAvailableMonths(
      { transactions, creditTransactions, notes: [] },
      realCurrentMonth,
    );
    const noteMonths = notes.map((n) => n.month);
    return [...new Set([...months, ...noteMonths])].sort(compareMonths);
  }, [transactions, creditTransactions, notes, realCurrentMonth]);

  const oldestMonth = availableMonths[0] ?? null;

  function goToCurrentMonth() {
    setCurrentMonth(realCurrentMonth);
  }

  function handleNext() {
    const next = changeMonth(currentMonth, 1);

    if (compareMonths(next, realCurrentMonth) <= 0) {
      setCurrentMonth(next);
    }
  }

  const canGoBack = oldestMonth
    ? compareMonths(oldestMonth, currentMonth) < 0
    : false;

  function handlePrev() {
    if (canGoBack) setCurrentMonth(changeMonth(currentMonth, -1));
  }

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
              disabled={!canGoBack}
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
