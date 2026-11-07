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
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-xl font-medium text-foreground/80">
            Visão geral do seu mês
          </p>
        </section>

        <div className="flex items-center gap-8">
          <section className="flex items-center">
            <div className="bg-primary/10 text-primary border border-primary px-2 py-2 rounded-lg mr-3">
              <SlCalender className="text-lg" />
            </div>

            <section>
              <h1 className="text-2xl font-bold text-foreground">
                {formatMonth(currentMonth)}
              </h1>

              <p className="text-lg font-medium text-foreground/80">{monthLabel}</p>
            </section>
          </section>

          <section className="flex items-center gap-2">
            <Button
              onClick={handlePrev}
              disabled={!canGoBack}
              className="bg-primary text-primary-foreground border border-primary hover:bg-primary/80"
            >
              <IoChevronBack />
            </Button>

            {showCurrentButton && (
              <Button
                onClick={goToCurrentMonth}
                className="bg-primary text-primary-foreground border border-primary hover:bg-primary/80"
              >
                Mês atual
              </Button>
            )}

            <Button
              disabled={!canGoForward}
              onClick={handleNext}
              className="bg-primary text-primary-foreground border border-primary hover:bg-primary/80"
            >
              <IoChevronForward />
            </Button>

            <span className="text-lg font-semibold border border-primary px-2 py-1 bg-primary rounded-lg text-primary-foreground">
              {getToday()}
            </span>
          </section>
        </div>

        {/* <Button
          onClick={() => exportPDF(currentMonth)}  
          className="text-lg font-semibold border border-primary px-4 !h-[45px] bg-primary hover:bg-primary/80 rounded-lg text-primary-foreground flex items-center gap-2"
        >
          <PiExportBold className="text-xl font-bold" />
          Exportar relatório
        </Button> */}
      </div>
    </div>
  );
}
