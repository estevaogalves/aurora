import { useMemo } from "react";
import Icon from "../components/Icon";
import { getAvailableMonths } from "../domain";
import { useFinanceStore } from "../Store/FinanceStore";
import { changeMonth, compareMonths, formatMonthTitle, getCurrentMonth } from "../Utils/Date";

/** Seletor de mês global: todas as telas leem `currentMonth` da store. */
export default function MonthSelector() {
  const currentMonth = useFinanceStore((s) => s.currentMonth);
  const setCurrentMonth = useFinanceStore((s) => s.setCurrentMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const notes = useFinanceStore((s) => s.notes);

  const realCurrentMonth = getCurrentMonth();

  const oldestMonth = useMemo(() => {
    const months = getAvailableMonths({ transactions, creditTransactions, notes: [] }, realCurrentMonth);
    return [...months, ...notes.map((n) => n.month)].sort(compareMonths)[0] ?? null;
  }, [transactions, creditTransactions, notes, realCurrentMonth]);

  const canGoBack = oldestMonth ? compareMonths(oldestMonth, currentMonth) < 0 : false;
  const canGoForward = compareMonths(currentMonth, realCurrentMonth) < 0;

  const arrow =
    "grid h-9 w-9 place-items-center rounded-md border border-border-strong bg-card text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40";

  return (
    <div data-tour="mes" className="flex items-center gap-1.5">
      <button type="button" aria-label="Mês anterior" className={arrow} disabled={!canGoBack} onClick={() => setCurrentMonth(changeMonth(currentMonth, -1))}>
        <Icon name="chevronL" size={16} />
      </button>
      <div className="min-w-[7.75rem] text-center">
        <p className="font-display text-[13px] font-semibold leading-tight">{formatMonthTitle(currentMonth)}</p>
        {currentMonth !== realCurrentMonth && (
          <button type="button" onClick={() => setCurrentMonth(realCurrentMonth)} className="text-xs font-semibold text-primary hover:underline">
            Mês atual
          </button>
        )}
      </div>
      <button type="button" aria-label="Próximo mês" className={arrow} disabled={!canGoForward} onClick={() => setCurrentMonth(changeMonth(currentMonth, 1))}>
        <Icon name="chevronR" size={16} />
      </button>
    </div>
  );
}
