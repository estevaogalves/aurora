import { changeMonth, compareMonths, getMonthsBetween } from "../Utils/Date";
import type { Month, Transaction } from "./types";

/**
 * Uma transação fixa vale do mês em que foi criada em diante, menos nos meses ocultados e depois do mês em que
 * foi encerrada (`endMonth`, o último mês em que vale).
 */
export function isFixedActiveIn(t: Transaction, month: Month): boolean {
  if (!t.fixed) return false;
  if (compareMonths(month, t.month) < 0) return false;
  if (t.endMonth && compareMonths(month, t.endMonth) > 0) return false;
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
      return { ...t, ...(override !== undefined && { amount: override }), notes, ...(t.variableAmount && override === undefined && { estimated: true }) };
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

/** Fixas encerradas que já não valem neste mês (para poder reativar). */
export function getEndedTransactionsByMonth(transactions: Transaction[], month: Month): Transaction[] {
  return transactions.filter((t) => t.fixed && !!t.endMonth && compareMonths(month, t.month) >= 0 && compareMonths(month, t.endMonth) > 0);
}

export type EndResult = { ok: true; patch: Partial<Transaction> } | { ok: false; error: string };

/**
 * Encerra uma fixa a partir de `month` (inclusive): o último mês em que vale passa a ser o anterior. Os meses
 * anteriores, os valores e os pagamentos já registrados não mudam. Não encerra no mês em que a fixa começa
 * (nesse caso ela sumiria inteira: para isso existe Excluir).
 */
export function patchEndFromMonth(t: Transaction, month: Month): EndResult {
  if (!t.fixed) return { ok: false, error: "Só despesas e rendas fixas podem ser encerradas." };
  if (compareMonths(month, t.month) <= 0) return { ok: false, error: "A fixa começa neste mês: para tirá-la por inteiro, use Excluir." };
  return { ok: true, patch: { endMonth: changeMonth(month, -1) } };
}

/**
 * Reativa uma fixa encerrada a partir de `month` (inclusive). Os meses que ficaram desativados entre o fim e este
 * mês continuam desativados: eles passam a constar como ocultos (dá para restaurar cada um, se quiser). Reativar
 * no mês logo depois do fim só tira o fim.
 */
export function patchResumeFixed(t: Transaction, month: Month): Partial<Transaction> {
  if (!t.endMonth) return {};
  const gap = getMonthsBetween(changeMonth(t.endMonth, 1), changeMonth(month, -1));
  if (gap.length === 0) return { endMonth: undefined };
  const hidden = [...new Set([...(t.hiddenMonths ?? []), ...gap])].sort(compareMonths);
  return { endMonth: undefined, hiddenMonths: hidden };
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
  return { fixed: false, hiddenMonths: undefined, monthlyValues: undefined, variableAmount: undefined, endMonth: undefined };
}

/** Fixa de valor variável: tira o valor real deste mês e ele volta ao estimado. null se o mês já está estimado. */
export function patchClearMonthValue(t: Transaction, month: Month): Partial<Transaction> | null {
  if (!t.fixed || !t.variableAmount || t.monthlyValues?.[month] === undefined) return null;
  const rest = { ...t.monthlyValues };
  delete rest[month];
  return { monthlyValues: rest };
}
