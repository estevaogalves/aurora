import { changeMonth, monthsDifference } from "../Utils/Date";
import { splitInstallments } from "../lib/money";
import type { CreditInstallment, CreditTransaction, Month } from "./types";

/** Em qual parcela (1..N) a compra está neste mês, ou null se não cobra neste mês. */
export function getInstallmentNumber(
  credit: CreditTransaction,
  month: Month,
): number | null {
  const diff = monthsDifference(month, credit.startMonth);
  if (diff < 0 || diff >= credit.installments) return null;
  return diff + 1;
}

/** Parcelas que caem em um mês. Os centavos que sobram vão para as primeiras parcelas. */
export function getCreditByMonth(
  credits: CreditTransaction[],
  month: Month,
): CreditInstallment[] {
  const result: CreditInstallment[] = [];

  for (const credit of credits) {
    const number = getInstallmentNumber(credit, month);
    if (number === null) continue;

    const parts = splitInstallments(credit.totalAmount, credit.installments);

    result.push({
      id: credit.id,
      name: credit.name,
      category: credit.category,
      installments: credit.installments,
      currentInstallment: number,
      installmentValue: parts[number - 1],
      totalAmount: credit.totalAmount,
    });
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

/** Andamento de uma compra parcelada visto de um mês: parcelas já cobradas (com a do mês), as que faltam e o mês da última. */
export function getCreditProgress(
  credit: Pick<CreditTransaction, "startMonth" | "installments">,
  month: Month,
): { done: number; remaining: number; endMonth: Month } {
  const done = Math.min(credit.installments, Math.max(0, monthsDifference(month, credit.startMonth) + 1));
  return {
    done,
    remaining: credit.installments - done,
    endMonth: changeMonth(credit.startMonth, credit.installments - 1),
  };
}
