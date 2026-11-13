import { useMemo } from "react";
import {
  getCreditByMonth,
  DEFAULT_DISTRIBUTION,
  distributeBalance,
  distributionItemsFor,
  getMonthDistributions,
  getSentByDistribution,
  getExpensesByCategory,
  getEndedTransactionsByMonth,
  getHiddenTransactionsByMonth,
  getMonthSummary,
  resolveCardExpenses,
  resolveCredits,
  getTransactionsByMonth,
  withDebtTransactions,
} from "../domain";
import { useFinanceStore } from "./FinanceStore";

/**
 * Hooks de leitura. Assinam os dados (e não funções da store), então a tela
 * atualiza quando lançamentos, crédito ou o mês mudam.
 * Sem argumento, usam o mês que o usuário está vendo.
 */

/**
 * Os lançamentos que valem para tudo que soma, projeta ou lista: os cadastrados mais as parcelas geradas pelas dívidas
 * e consórcios (calculadas, nunca gravadas). Quem só precisa dos cadastrados usa `s.transactions`.
 */
export function useTransactions() {
  const transactions = useFinanceStore((s) => s.transactions);
  const debts = useFinanceStore((s) => s.debts);
  return useMemo(() => withDebtTransactions(transactions, debts), [transactions, debts]);
}

function useMonth(month?: string) {
  const current = useFinanceStore((s) => s.currentMonth);
  return month ?? current;
}

export function useMonthSummary(month?: string) {
  const m = useMonth(month);
  const transactions = useTransactions();
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
  const transactions = useTransactions();
  const creditCards = useFinanceStore((s) => s.creditCards);

  // despesa avulsa no cartão aparece no mês do vencimento da fatura
  return useMemo(() => getTransactionsByMonth(resolveCardExpenses(transactions, creditCards), m), [transactions, creditCards, m]);
}

export function useHiddenTransactions(month?: string) {
  const m = useMonth(month);
  const transactions = useTransactions();

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

export function useEndedTransactions(month?: string) {
  const m = useMonth(month);
  const transactions = useTransactions();

  return useMemo(() => getEndedTransactionsByMonth(transactions, m), [transactions, m]);
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

/** As distribuições do saldo do mês visto: a Dist 1 (o saldo) e as próprias (Dist 2, 3...). */
export function useMonthDistributions(month?: string) {
  const m = useMonth(month);
  const transactions = useTransactions();
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  return useMemo(() => getMonthDistributions({ transactions, creditTransactions, creditCards, extraExpenses }, m), [transactions, creditTransactions, creditCards, extraExpenses, m]);
}

/** Percentuais de uma distribuição do mês visto: os próprios (Dist 2 em diante), senão o padrão do usuário, senão o do app. */
export function useDistributionItemsFor(group: number, month?: string) {
  const m = useMonth(month);
  const distribution = useFinanceStore((s) => s.distribution);
  const distributionOverrides = useFinanceStore((s) => s.distributionOverrides);
  return useMemo(() => distributionItemsFor({ distribution, distributionOverrides }, m, group), [distribution, distributionOverrides, m, group]);
}

/** O que já foi enviado de cada fatia das sugestões do mês visto (para metas, porquinhos e investimentos). */
export function useSentByDistribution(month?: string) {
  const m = useMonth(month);
  const goals = useFinanceStore((s) => s.goals);
  const goalMovements = useFinanceStore((s) => s.goalMovements);
  const investments = useFinanceStore((s) => s.investments);
  const investmentMovements = useFinanceStore((s) => s.investmentMovements);
  return useMemo(() => getSentByDistribution({ goals, goalMovements, investments, investmentMovements }, m), [goals, goalMovements, investments, investmentMovements, m]);
}
