import { compareMonths, getMonthsBetween } from "../Utils/Date";
import type { Month, Transaction } from "./types";

/** Uma transação fixa vale do mês em que foi criada em diante, menos nos meses ocultados. */
export function isFixedActiveIn(t: Transaction, month: Month): boolean {
  if (!t.fixed) return false;
  if (compareMonths(month, t.month) < 0) return false;
  return !t.hiddenMonths?.includes(month);
}

/** Transações que valem em um mês, já com o valor específico daquele mês aplicado. */
export function getTransactionsByMonth(
  transactions: Transaction[],
  month: Month,
): Transaction[] {
  return transactions
    .filter((t) => (t.fixed ? isFixedActiveIn(t, month) : t.month === month))
    .map((t) => {
      if (!t.fixed) return t;
      const override = t.monthlyValues?.[month];
      // a observação de uma fixa é só do mês: a própria `notes` vale no mês de criação, os outros têm a sua (ou nenhuma)
      const notes = noteOfMonth(t, month);
      // 0 é um valor válido: só ignora quando não há valor definido
      return { ...t, ...(override !== undefined && { amount: override }), notes };
    });
}

/** Observação de uma transação em um mês. Fixa: a do mês, ou a de criação no mês de criação; nunca a de outro mês. */
export function noteOfMonth(t: Transaction, month: Month): string {
  if (!t.fixed) return t.notes ?? "";
  return t.monthlyNotes?.[month] ?? (month === t.month ? (t.notes ?? "") : "");
}

/** Muda a observação: fixa guarda por mês (só vale naquele mês), normal troca a observação. */
export function patchNotesForMonth(t: Transaction, month: Month, notes: string): Partial<Transaction> {
  if (t.fixed) return { monthlyNotes: { ...t.monthlyNotes, [month]: notes } };
  return { notes };
}

/** Fixas que o usuário ocultou neste mês (para poder restaurar). */
export function getHiddenTransactionsByMonth(
  transactions: Transaction[],
  month: Month,
): Transaction[] {
  return transactions.filter(
    (t) => t.fixed && compareMonths(month, t.month) >= 0 && t.hiddenMonths?.includes(month),
  );
}

/* ---------- alterações: devolvem o patch a aplicar na transação ---------- */

/** Novo valor a partir de um mês: fixa guarda por mês, normal troca o valor. */
export function patchAmountForMonth(
  t: Transaction,
  month: Month,
  cents: number,
): Partial<Transaction> {
  if (t.fixed) {
    return { monthlyValues: { ...t.monthlyValues, [month]: cents } };
  }
  return { amount: cents };
}

/**
 * Novo valor deste mês em diante (fixa). Os meses anteriores mantêm o valor que já tinham:
 * os que dependiam do valor-base ganham um valor próprio, e os valores já definidos
 * para este mês e os seguintes são descartados, para valerem o novo.
 */
export function patchAmountFromMonth(
  t: Transaction,
  month: Month,
  cents: number,
): Partial<Transaction> {
  if (!t.fixed) return { amount: cents };

  const values: Record<Month, number> = {};
  for (const m of getMonthsBetween(t.month, month)) {
    if (m === month) break;
    values[m] = t.monthlyValues?.[m] ?? t.amount;
  }
  return { amount: cents, monthlyValues: values };
}

/** Fixa: oculta neste mês. Normal: não há patch, quem chama deve remover. */
export function patchHideInMonth(
  t: Transaction,
  month: Month,
): Partial<Transaction> | null {
  if (!t.fixed) return null;
  if (t.hiddenMonths?.includes(month)) return {};
  return { hiddenMonths: [...(t.hiddenMonths ?? []), month] };
}

export function patchRestoreInMonth(
  t: Transaction,
  month: Month,
): Partial<Transaction> {
  if (!t.fixed) return {};
  return { hiddenMonths: (t.hiddenMonths ?? []).filter((m) => m !== month) };
}

/**
 * Alterna fixa/não fixa. Ao fixar, a transação passa a valer a partir do mês em
 * que foi criada. Ao desfixar, os valores e ocultações por mês deixam de existir.
 */
export function patchToggleFixed(t: Transaction): Partial<Transaction> {
  if (!t.fixed) {
    return { fixed: true, hiddenMonths: [] };
  }
  return { fixed: false, hiddenMonths: undefined, monthlyValues: undefined };
}
