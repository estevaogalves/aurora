import { useMemo } from "react";
import { isCardPurchase, isFilterActive, matchesFilter, paymentOf, summarizeFiltered, type ExtraExpense, type Filterable, type Transaction } from "@/domain";
import { useLaunchFilter } from "@/lib/launchFilter";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useMonthTransactions, useResolvedExtras } from "@/Store/selectors";

const ofTransaction = (t: Transaction, month: string): Filterable => ({ name: t.name, notes: t.notes, category: t.category, amount: t.amount, tags: t.tags, payment: paymentOf(t, month) });
const ofExtra = (e: ExtraExpense): Filterable => ({ name: e.name, category: "Outros", amount: e.amount, payment: e.payment });

/**
 * A busca e os filtros aplicados ao mês visto. As listas só escondem linhas: os totais oficiais (rodapés, Painel,
 * Projeção, Comparação) seguem calculados sobre tudo.
 */
export function useLaunchFiltering() {
  const filter = useLaunchFilter((s) => s.filter);
  const month = useFinanceStore((s) => s.currentMonth);
  const transactions = useMonthTransactions();
  const extras = useResolvedExtras();
  const active = isFilterActive(filter);

  const summary = useMemo(() => {
    const incomes = transactions.filter((t) => t.type === "income").map((t) => ofTransaction(t, month));
    const expenses = [
      ...transactions.filter((t) => t.type === "expense" && !isCardPurchase(t)).map((t) => ofTransaction(t, month)),
      ...extras.filter((e) => e.month === month && !isCardPurchase(e)).map(ofExtra),
    ];
    return summarizeFiltered(expenses.filter((x) => matchesFilter(x, filter, "expense")), incomes.filter((x) => matchesFilter(x, filter, "income")));
  }, [transactions, extras, month, filter]);

  return {
    filter,
    active,
    summary,
    income: (t: Transaction) => !active || matchesFilter(ofTransaction(t, month), filter, "income"),
    expense: (t: Transaction) => !active || matchesFilter(ofTransaction(t, month), filter, "expense"),
    extra: (e: ExtraExpense) => !active || matchesFilter(ofExtra(e), filter, "expense"),
  };
}
