import { useMemo } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { getAvailableMonths } from "../domain";
import { useFinanceStore } from "../Store/FinanceStore";
import {
  changeMonth,
  compareMonths,
  formatMonth,
  getCurrentMonth,
} from "../Utils/Date";

/** Seletor de mês global: todas as telas leem `currentMonth` da store. */
export default function MonthSelector() {
  const currentMonth = useFinanceStore((s) => s.currentMonth);
  const setCurrentMonth = useFinanceStore((s) => s.setCurrentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const notes = useFinanceStore((s) => s.notes);

  const realCurrentMonth = getCurrentMonth();

  // do primeiro dado até hoje, sem buracos
  const oldestMonth = useMemo(() => {
    const months = getAvailableMonths(
      { transactions, creditTransactions, notes: [] },
      realCurrentMonth,
    );
    const all = [...months, ...notes.map((n) => n.month)].sort(compareMonths);
    return all[0] ?? null;
  }, [transactions, creditTransactions, notes, realCurrentMonth]);

  const canGoBack = oldestMonth ? compareMonths(oldestMonth, currentMonth) < 0 : false;
  const canGoForward = compareMonths(currentMonth, realCurrentMonth) < 0;

  const arrow =
    "grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Mês anterior"
        className={arrow}
        disabled={!canGoBack}
        onClick={() => setCurrentMonth(changeMonth(currentMonth, -1))}
      >
        <IoChevronBack />
      </button>

      <div className="min-w-[8.5rem] text-center">
        <p className="font-display text-sm font-semibold capitalize leading-tight text-foreground">
          {formatMonth(currentMonth)}
        </p>
        {currentMonth !== realCurrentMonth && (
          <button
            type="button"
            onClick={() => setCurrentMonth(realCurrentMonth)}
            className="text-xs text-primary hover:underline"
          >
            Voltar ao mês atual
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Próximo mês"
        className={arrow}
        disabled={!canGoForward}
        onClick={() => setCurrentMonth(changeMonth(currentMonth, 1))}
      >
        <IoChevronForward />
      </button>
    </div>
  );
}
