import { useMemo } from "react";
import {
  getCreditByMonth,
  DEFAULT_DISTRIBUTION,
  distributeBalance,
  getExpensesByCategory,
  getHiddenTransactionsByMonth,
  getMonthSummary,
  resolveCardExpenses,
  resolveCredits,
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
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);

  return useMemo(
    () => getMonthSummary({ transactions, creditTransactions, creditCards, extraExpenses }, m),
    [transactions, creditTransactions, creditCards, extraExpenses, m],
  );
}

export function useMonthTransactions(month?: string) {
  const m = useMonth(month);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);

  // despesa avulsa no cartão aparece no mês do vencimento da fatura
  return useMemo(() => getTransactionsByMonth(resolveCardExpenses(transactions, creditCards), m), [transactions, creditCards, m]);
}

export function useHiddenTransactions(month?: string) {
  const m = useMonth(month);
  const transactions = useFinanceStore((s) => s.transactions);

  return useMemo(
    () => getHiddenTransactionsByMonth(transactions, m),
    [transactions, m],
  );
}

/** Despesas extras já no mês em que entram no cálculo (as com cartão, no mês do vencimento da fatura). */
export function useResolvedExtras() {
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const creditCards = useFinanceStore((s) => s.creditCards);
  return useMemo(() => resolveCardExpenses(extraExpenses, creditCards), [extraExpenses, creditCards]);
}

export function useMonthCredit(month?: string) {
  const m = useMonth(month);
  const resolved = useResolvedCredits();

  return useMemo(() => getCreditByMonth(resolved, m), [resolved, m]);
}

/** Compras no crédito já no mês em que entram no cálculo (o do vencimento da fatura do cartão). */
export function useResolvedCredits() {
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  return useMemo(() => resolveCredits(creditTransactions, creditCards), [creditTransactions, creditCards]);
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
