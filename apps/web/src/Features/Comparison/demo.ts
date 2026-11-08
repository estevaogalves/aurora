import type { MonthSummary } from "@/domain";
import { changeMonth, getCurrentMonth } from "@/Utils/Date";

/** Valores em centavos: [renda, moradia, alimentação, transporte, saúde, lazer, crédito] */
const SAMPLE: number[][] = [
  [520000, 150000, 80000, 30000, 20000, 25000, 40000],
  [520000, 150000, 95000, 35000, 12000, 50000, 40000],
  [560000, 150000, 85000, 28000, 30000, 30000, 40000],
];

/**
 * Meses de exemplo, só para o tour da Comparação ter o que destacar quando o usuário
 * ainda não tem dois meses com movimentação. Nunca entram nos dados dele.
 */
export function getDemoSummaries(): MonthSummary[] {
  const today = getCurrentMonth();
  return SAMPLE.map(([income, housing, food, transport, health, leisure, credit], i) => {
    const byCategory = { Moradia: housing, Alimentação: food, Transporte: transport, Saúde: health, Lazer: leisure, "Crédito/Parcelado": credit };
    const totalExpense = housing + food + transport + health + leisure + credit;
    return {
      month: changeMonth(today, i - SAMPLE.length),
      totalIncome: income,
      totalExpense,
      creditExpense: credit,
      extraExpense: 0,
      balance: income - totalExpense,
      expensePercentage: (totalExpense / income) * 100,
      byCategory,
    };
  });
}
