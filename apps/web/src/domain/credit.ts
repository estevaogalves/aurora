import { changeMonth, compareMonths, monthsDifference } from "../Utils/Date";
import { splitInstallments } from "../lib/money";
import type { CreditInstallment, CreditTransaction, InstallmentAdjustment, Month } from "./types";

type Schedule = Pick<CreditTransaction, "totalAmount" | "installments" | "startMonth" | "adjustments" | "recurring" | "endMonth">;

/** A compra recorrente cobra neste mês: do mês inicial até o mês final, se foi cancelada. */
export function recurringCharges(
  credit: Pick<CreditTransaction, "recurring" | "startMonth" | "endMonth">,
  month: Month,
): boolean {
  if (!credit.recurring || compareMonths(month, credit.startMonth) < 0) return false;
  return !credit.endMonth || compareMonths(month, credit.endMonth) <= 0;
}

/** Em qual parcela (1..N) a compra está neste mês, ou null se não cobra neste mês. */
export function getInstallmentNumber(
  credit: Pick<CreditTransaction, "startMonth" | "installments" | "recurring">,
  month: Month,
): number | null {
  if (credit.recurring) return null;
  const diff = monthsDifference(month, credit.startMonth);
  if (diff < 0 || diff >= credit.installments) return null;
  return diff + 1;
}

/** Mês original da parcela `n` (1..N). */
export function getInstallmentMonth(credit: Pick<CreditTransaction, "startMonth">, n: number): Month {
  return changeMonth(credit.startMonth, n - 1);
}

const adjustmentOf = (credit: Pick<CreditTransaction, "adjustments">, n: number): InstallmentAdjustment | undefined =>
  credit.adjustments?.[String(n)];

/** Valor da parcela `n` antes de qualquer desconto: o ajustado, ou a divisão do total (centavos que sobram nas primeiras). */
export function getInstallmentValue(credit: Schedule, n: number): number {
  if (credit.recurring) return credit.totalAmount;
  return adjustmentOf(credit, n)?.value ?? splitInstallments(credit.totalAmount, credit.installments)[n - 1];
}

/** Parcela ainda "em aberto": não foi excluída nem adiantada. */
const isOpen = (credit: Pick<CreditTransaction, "adjustments" | "recurring">, n: number) => {
  if (credit.recurring) return false;
  const adj = adjustmentOf(credit, n);
  return !adj?.removed && !adj?.advanced;
};

/** Última parcela que não foi excluída nem adiantada, ou null se não sobrou nenhuma. */
export function getLastOpenInstallment(credit: Pick<CreditTransaction, "installments" | "adjustments" | "recurring">): number | null {
  for (let n = credit.installments; n >= 1; n--) if (isOpen(credit, n)) return n;
  return null;
}

/** Só a última parcela em aberto, e só se cair depois de `today`, pode ser adiantada. */
export function canAdvanceInstallment(credit: Schedule, n: number, today: Month): boolean {
  return n === getLastOpenInstallment(credit) && compareMonths(getInstallmentMonth(credit, n), today) > 0;
}

/** Parcelas que caem em um mês: as normais e as adiantadas para este mês. */
export function getCreditByMonth(
  credits: CreditTransaction[],
  month: Month,
): CreditInstallment[] {
  const result: CreditInstallment[] = [];

  for (const credit of credits) {
    const base = {
      id: credit.id,
      name: credit.name,
      category: credit.category,
      installments: credit.installments,
      totalAmount: credit.totalAmount,
    };

    if (recurringCharges(credit, month)) {
      result.push({
        ...base,
        installments: 0,
        recurring: true,
        currentInstallment: monthsDifference(month, credit.startMonth) + 1,
        installmentValue: credit.totalAmount,
      });
      continue;
    }

    const number = getInstallmentNumber(credit, month);
    if (number !== null && isOpen(credit, number)) {
      result.push({
        ...base,
        currentInstallment: number,
        installmentValue: getInstallmentValue(credit, number),
        adjusted: adjustmentOf(credit, number)?.value !== undefined || undefined,
      });
    }

    // adiantadas: cobradas no mês em que o usuário adiantou
    for (const [key, adj] of Object.entries(credit.adjustments ?? {})) {
      if (adj.advanced?.month !== month) continue;
      const n = Number(key);
      result.push({
        ...base,
        currentInstallment: n,
        installmentValue: adj.advanced.amount,
        advanced: {
          originalMonth: getInstallmentMonth(credit, n),
          discount: adj.advanced.discount,
          originalValue: adj.advanced.amount + adj.advanced.discount,
        },
      });
    }
  }

  return result;
}

/** Soma das parcelas que caem em um mês (centavos). */
export function getCreditTotalByMonth(
  credits: CreditTransaction[],
  month: Month,
): number {
  return getCreditByMonth(credits, month).reduce(
    (sum, c) => sum + c.installmentValue,
    0,
  );
}

/** Total da compra considerando parcelas excluídas e ajustadas (sem os descontos de adiantamento). */
export function getCreditEffectiveTotal(credit: Schedule): number {
  let total = 0;
  for (let n = 1; n <= credit.installments; n++) {
    if (!adjustmentOf(credit, n)?.removed) total += getInstallmentValue(credit, n);
  }
  return total;
}

/** Andamento de uma compra parcelada visto de um mês: parcelas já cobradas (com a do mês), as que faltam e o mês da última. */
export function getCreditProgress(
  credit: Pick<CreditTransaction, "startMonth" | "installments" | "adjustments" | "recurring">,
  month: Month,
): { done: number; remaining: number; endMonth: Month } {
  const done = Math.min(credit.installments, Math.max(0, monthsDifference(month, credit.startMonth) + 1));
  let remaining = 0;
  for (let n = done + 1; n <= credit.installments; n++) if (isOpen(credit, n)) remaining++;
  const last = getLastOpenInstallment(credit) ?? credit.installments;
  return { done, remaining, endMonth: getInstallmentMonth(credit, last) };
}

/* ---------- adiantar, editar e excluir uma parcela: devolvem o patch a aplicar ---------- */

export type PatchResult = { ok: true; patch: Partial<Pick<CreditTransaction, "adjustments" | "endMonth">> } | { ok: false; error: string };

const withAdjustment = (credit: Pick<CreditTransaction, "adjustments">, n: number, adj: InstallmentAdjustment): PatchResult => ({
  ok: true,
  patch: { adjustments: { ...credit.adjustments, [String(n)]: adj } },
});

/** Valor adiantado = valor da parcela menos o desconto. */
export const advancedAmount = (value: number, discount: number) => value - discount;

/** Desconto entre zero e o valor da parcela, sem zerar o valor adiantado. Null se válido. */
export function validateDiscount(value: number, discount: number): string | null {
  if (!Number.isInteger(discount) || discount < 0) return "O desconto não pode ser negativo.";
  if (advancedAmount(value, discount) <= 0) return "O desconto deve ser menor que o valor da parcela.";
  return null;
}

/** Adianta a última parcela em aberto (futura): o valor com desconto passa a ser cobrado em `today`. */
export function patchAdvanceInstallment(credit: Schedule, n: number, discount: number, today: Month): PatchResult {
  if (n !== getLastOpenInstallment(credit)) return { ok: false, error: "Só a última parcela da compra pode ser adiantada." };
  if (!canAdvanceInstallment(credit, n, today)) return { ok: false, error: "Só é possível adiantar parcelas de meses futuros." };
  const value = getInstallmentValue(credit, n);
  const error = validateDiscount(value, discount);
  if (error) return { ok: false, error };
  return withAdjustment(credit, n, { ...adjustmentOf(credit, n), advanced: { month: today, discount, amount: advancedAmount(value, discount) } });
}

/** Muda só o valor de uma parcela (centavos). Parcelas adiantadas ou excluídas não mudam. */
export function patchEditInstallment(credit: Schedule, n: number, cents: number): PatchResult {
  if (n < 1 || n > credit.installments || !isOpen(credit, n)) return { ok: false, error: "Esta parcela não pode ser alterada." };
  if (!Number.isInteger(cents) || cents <= 0) return { ok: false, error: "Informe um valor maior que zero." };
  return withAdjustment(credit, n, { ...adjustmentOf(credit, n), value: cents });
}

/** Remove só a cobrança de uma parcela; as outras mantêm número e mês. */
export function patchRemoveInstallment(credit: Schedule, n: number): PatchResult {
  if (n < 1 || n > credit.installments || !isOpen(credit, n)) return { ok: false, error: "Esta parcela não pode ser excluída." };
  return withAdjustment(credit, n, { ...adjustmentOf(credit, n), removed: true });
}

/**
 * Cancela a recorrência: o último mês cobrado passa a ser `last` (o mês que o usuário está vendo), mas nunca
 * antes do mês atual nem do mês inicial, então o que já foi cobrado continua como está.
 */
export function patchCancelRecurrence(
  credit: Pick<CreditTransaction, "recurring" | "endMonth" | "startMonth">,
  last: Month,
  today: Month,
): PatchResult {
  if (!credit.recurring) return { ok: false, error: "Só compras recorrentes podem ter a recorrência cancelada." };
  if (credit.endMonth) return { ok: false, error: "A recorrência desta compra já foi cancelada." };
  const end = [last, today, credit.startMonth].reduce((a, b) => (compareMonths(a, b) >= 0 ? a : b));
  return { ok: true, patch: { endMonth: end } };
}

/** Editar todas: troca nome, categoria e total (e nº de parcelas, só enquanto não houver ajustes). As adiantadas e ajustadas ficam como estão. */
export function patchEditAll(
  credit: Schedule,
  changes: Partial<Pick<CreditTransaction, "name" | "category" | "totalAmount" | "installments">>,
): { ok: true; patch: Partial<CreditTransaction> } | { ok: false; error: string } {
  const hasAdjustments = Object.keys(credit.adjustments ?? {}).length > 0;
  if (hasAdjustments && changes.installments !== undefined && changes.installments !== credit.installments) {
    return { ok: false, error: "Não dá para mudar o número de parcelas de uma compra com parcelas ajustadas, excluídas ou adiantadas." };
  }
  return { ok: true, patch: changes };
}
