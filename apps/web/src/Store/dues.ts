import { useMemo } from "react";
import { dueAlertKey, getDueAlerts, getUpcomingDues, todayISO, type DueItem } from "@/domain";
import { usePrefsStore } from "@/lib/preferences";
import { useFinanceStore } from "./FinanceStore";

/** Vencimentos da janela escolhida no card do Painel (7, 14 ou 30 dias), com atrasados primeiro. */
export function useUpcomingDues() {
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const window = usePrefsStore((s) => s.dueWindow);
  return useMemo(() => getUpcomingDues({ transactions, creditTransactions, creditCards, extraExpenses }, todayISO(), window), [transactions, creditTransactions, creditCards, extraExpenses, window]);
}

/**
 * Avisos de vencimento do sino, no mesmo molde dos de metas e investimentos: `unseen` conta no sino, `seen` fica em
 * "Já vistos". As chaves ficam em `seenAlerts` com o prefixo `due:` e mudam quando o vencimento piora (vira atrasado).
 */
export function useDueAlerts() {
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const seenKeys = useFinanceStore((s) => s.seenAlerts);
  const markAlertsSeen = useFinanceStore((s) => s.markAlertsSeen);
  const markAlertUnseen = useFinanceStore((s) => s.markAlertUnseen);

  const all = useMemo(() => getDueAlerts({ transactions, creditTransactions, creditCards, extraExpenses }, todayISO()), [transactions, creditTransactions, creditCards, extraExpenses]);
  const seenSet = useMemo(() => new Set(seenKeys), [seenKeys]);
  const unseen = useMemo(() => all.filter((d) => !seenSet.has(dueAlertKey(d))), [all, seenSet]);
  const seen = useMemo(() => all.filter((d) => seenSet.has(dueAlertKey(d))), [all, seenSet]);

  return {
    all,
    unseen,
    seen,
    markSeen: (items: DueItem[]) => markAlertsSeen(items.map(dueAlertKey)),
    markUnseen: (item: DueItem) => markAlertUnseen(dueAlertKey(item)),
  };
}
