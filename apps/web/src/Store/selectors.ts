import { useMemo } from "react";
import {
  getCreditByMonth,
  DEFAULT_DISTRIBUTION,
  distributeBalance,
  getExpensesByCategory,
  getHiddenTransactionsByMonth,
  getMonthSummary,
  getTransactionsByMonth,
} from "../domain";
import { useFinanceStore } from "./FinanceStore";

/**
 * Hooks de leitura. Assinam os dados (e não funções da store), então a tela
 * atualiza quando lançamentos, crédito ou o mês mudam.
 * Sem argumento, usam o mês que o usuário está vendo.
 */

function useMonth(month?: string) {
  const current = useFinanceStore((s) => s.currentMonth);
  return month ?? current;
}

export function useMonthSummary(month?: string) {
  const m = useMonth(month);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);

  return useMemo(
    () => getMonthSummary({ transactions, creditTransactions }, m),
    [transactions, creditTransactions, m],
  );
}

export function useMonthTransactions(month?: string) {
  const m = useMonth(month);
  const transactions = useFinanceStore((s) => s.transactions);

  return useMemo(() => getTransactionsByMonth(transactions, m), [transactions, m]);
}

export function useHiddenTransactions(month?: string) {
  const m = useMonth(month);
  const transactions = useFinanceStore((s) => s.transactions);

  return useMemo(
    () => getHiddenTransactionsByMonth(transactions, m),
    [transactions, m],
  );
}

export function useMonthCredit(month?: string) {
  const m = useMonth(month);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);

  return useMemo(() => getCreditByMonth(creditTransactions, m), [creditTransactions, m]);
}

export function useCategoryTotals(month?: string) {
  const summary = useMonthSummary(month);
  return useMemo(() => getExpensesByCategory(summary), [summary]);
}

/** Percentuais em uso (os do usuário ou os padrão). */
export function useDistributionItems() {
  const custom = useFinanceStore((s) => s.distribution);
  return custom ?? DEFAULT_DISTRIBUTION;
}

/** Sugestão de divisão do saldo do mês, já com os percentuais do usuário. */
export function useDistribution(month?: string) {
  const { balance } = useMonthSummary(month);
  const items = useDistributionItems();
  return useMemo(() => distributeBalance(balance, items), [balance, items]);
}
