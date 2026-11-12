import { changeMonth } from "../Utils/Date";
import { getCardInvoice, isCardPurchase, resolveCardExpenses } from "./invoice";
import { paymentOf } from "./payment";
import { getMonthSummary } from "./summary";
import { getTransactionsByMonth } from "./transactions";
import type { FinanceData, Month, MonthClosing } from "./types";

/**
 * Fechamento do mês: um passo a passo que termina marcando o mês como fechado e guardando um retrato dele (renda,
 * despesas, saldo, categorias e uma anotação). Fechar NÃO apaga nem altera nenhum lançamento; reabrir devolve o mês ao
 * estado editável.
 */
export type ClosingData = Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "creditCards" | "extraExpenses">>;

export const isMonthClosed = (closings: Record<string, MonthClosing>, month: Month) => !!closings[month];

export interface PendingItem {
  kind: "expense" | "extra" | "invoice";
  name: string;
  /** centavos */
  amount: number;
}

/** O que ainda não foi marcado como pago no mês: despesas, despesas extras e faturas de cartão (compras no cartão ficam na fatura). */
export function getClosingPending(data: ClosingData, month: Month): PendingItem[] {
  const items: PendingItem[] = [];
  for (const t of getTransactionsByMonth(data.transactions, month)) {
    if (t.type !== "expense" || t.cardId || t.amount <= 0 || paymentOf(t, month)) continue;
    items.push({ kind: "expense", name: t.name, amount: t.amount });
  }
  for (const e of resolveCardExpenses(data.extraExpenses ?? [], data.creditCards)) {
    if (e.month !== month || isCardPurchase(e) || e.payment || e.amount <= 0) continue;
    items.push({ kind: "extra", name: e.name, amount: e.amount });
  }
  for (const card of data.creditCards ?? []) {
    if (card.payments?.[month]) continue;
    const invoice = getCardInvoice(data, card, month);
    if (invoice.payable > 0) items.push({ kind: "invoice", name: `Fatura ${card.name}`, amount: invoice.payable });
  }
  return items.sort((a, b) => b.amount - a.amount);
}

export interface ClosingComparison {
  previous: Month;
  /** null se o mês anterior não teve movimento */
  hadData: boolean;
  incomeDelta: number;
  expenseDelta: number;
  balanceDelta: number;
  /** categorias que mais mudaram (em valor absoluto), até 3 */
  categories: { category: string; from: number; to: number }[];
}

/** Compara o mês com o anterior: renda, despesas, saldo e as categorias que mais mudaram. */
export function compareWithPrevious(data: ClosingData, month: Month): ClosingComparison {
  const previous = changeMonth(month, -1);
  const now = getMonthSummary(data, month);
  const before = getMonthSummary(data, previous);
  const hadData = before.totalIncome > 0 || before.totalExpense > 0;
  const names = new Set([...Object.keys(now.byCategory), ...Object.keys(before.byCategory)]);
  const categories = [...names]
    .map((category) => ({ category, from: (before.byCategory as Record<string, number>)[category] ?? 0, to: (now.byCategory as Record<string, number>)[category] ?? 0 }))
    .filter((c) => c.from !== c.to)
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
    .slice(0, 3);
  return {
    previous,
    hadData,
    incomeDelta: now.totalIncome - before.totalIncome,
    expenseDelta: now.totalExpense - before.totalExpense,
    balanceDelta: now.balance - before.balance,
    categories,
  };
}

/** O retrato do mês no momento do fechamento. */
export function buildClosing(data: ClosingData, month: Month, today: string, note: string): MonthClosing {
  const s = getMonthSummary(data, month);
  const byCategory: Record<string, number> = {};
  for (const [category, value] of Object.entries(s.byCategory)) if ((value ?? 0) > 0) byCategory[category] = value as number;
  const trimmed = note.trim();
  return { closedAt: today, income: s.totalIncome, expense: s.totalExpense, balance: s.balance, byCategory, ...(trimmed && { note: trimmed }) };
}
