import { useMemo } from "react";
import { budgetAlertKey, getBudgetAlerts, todayISO, type BudgetAlert } from "@/domain";
import { useFinanceStore } from "./FinanceStore";
import { useTransactions } from "./selectors";

/**
 * Avisos de orçamento no sino, no mesmo molde dos de metas, investimentos e vencimentos: `unseen` conta no sino e `seen`
 * fica em "Já vistos". Vale para o mês atual de verdade (a partir de 80% e de 100% do limite). Chaves em `seenAlerts`
 * com o prefixo `budget:`; a chave muda de "atenção" para "estourado", então o aviso volta quando estoura.
 */
export function useBudgetAlerts() {
  const transactions = useTransactions();
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const budgets = useFinanceStore((s) => s.budgets);
  const seenKeys = useFinanceStore((s) => s.seenAlerts);
  const markAlertsSeen = useFinanceStore((s) => s.markAlertsSeen);
  const markAlertUnseen = useFinanceStore((s) => s.markAlertUnseen);

  const all = useMemo(() => getBudgetAlerts({ transactions, creditTransactions, creditCards, extraExpenses }, budgets, todayISO().slice(0, 7)), [transactions, creditTransactions, creditCards, extraExpenses, budgets]);
  const seenSet = useMemo(() => new Set(seenKeys), [seenKeys]);
  const unseen = useMemo(() => all.filter((a) => !seenSet.has(budgetAlertKey(a))), [all, seenSet]);
  const seen = useMemo(() => all.filter((a) => seenSet.has(budgetAlertKey(a))), [all, seenSet]);

  return {
    all,
    unseen,
    seen,
    markSeen: (items: BudgetAlert[]) => markAlertsSeen(items.map(budgetAlertKey)),
    markUnseen: (item: BudgetAlert) => markAlertUnseen(budgetAlertKey(item)),
  };
}
