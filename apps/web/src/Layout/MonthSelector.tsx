import { useMemo } from "react";
import Icon from "../components/Icon";
import { getAdjacentMonth } from "../domain";
import { useFinanceStore } from "../Store/FinanceStore";
import { formatMonthTitle, getCurrentMonth } from "../Utils/Date";
import { useTransactions } from "@/Store/selectors";

/**
 * Seletor de mês global: todas as telas leem `currentMonth` da store.
 * Meses futuros são sempre livres; meses passados só valem se tiveram movimentação.
 */
export default function MonthSelector() {
  const currentMonth = useFinanceStore((s) => s.currentMonth);
  const setCurrentMonth = useFinanceStore((s) => s.setCurrentMonth);
  const transactions = useTransactions();
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const notes = useFinanceStore((s) => s.notes);
  const goals = useFinanceStore((s) => s.goals);

  const realCurrentMonth = getCurrentMonth();

  const previous = useMemo(
    () => getAdjacentMonth({ transactions, creditTransactions, creditCards, extraExpenses, notes, goals }, currentMonth, realCurrentMonth, -1),
    [transactions, creditTransactions, creditCards, extraExpenses, notes, goals, currentMonth, realCurrentMonth],
  );
  const next = useMemo(
    () => getAdjacentMonth({ transactions, creditTransactions, creditCards, extraExpenses, notes, goals }, currentMonth, realCurrentMonth, 1),
    [transactions, creditTransactions, creditCards, extraExpenses, notes, goals, currentMonth, realCurrentMonth],
  );

  const arrow =
    "grid h-10 w-10 place-items-center sm:h-9 sm:w-9 rounded-md border border-border-strong bg-card text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40";

  return (
    <div data-tour="mes" className="flex items-center gap-1.5 max-[700px]:w-full max-[700px]:justify-between">
      <button type="button" aria-label="Mês anterior" className={arrow} disabled={!previous} onClick={() => previous && setCurrentMonth(previous)}>
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
      <button type="button" aria-label="Próximo mês" className={arrow} disabled={!next} onClick={() => next && setCurrentMonth(next)}>
        <Icon name="chevronR" size={16} />
      </button>
    </div>
  );
}
