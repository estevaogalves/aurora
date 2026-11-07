import { changeMonth, compareMonths, getMonthsBetween } from "../Utils/Date";
import type { Category } from "../Types/Category";
import { getCreditByMonth, getCreditTotalByMonth } from "./credit";
import { getTransactionsByMonth } from "./transactions";
import type {
  CreditTransaction,
  ExtraExpense,
  FinanceData,
  Month,
  MonthSummary,
  ProjectionMonth,
  Transaction,
} from "./types";

export const CREDIT_CATEGORY: Category = "Crédito/Parcelado";

/** Resumo de um mês: renda, despesas (com as parcelas do crédito), saldo e por categoria. */
export function getMonthSummary(
  data: Pick<FinanceData, "transactions" | "creditTransactions">,
  month: Month,
): MonthSummary {
  const monthTransactions = getTransactionsByMonth(data.transactions, month);
  const installments = getCreditByMonth(data.creditTransactions, month);

  let totalIncome = 0;
  let directExpense = 0;
  const byCategory: Partial<Record<Category, number>> = {};

  for (const t of monthTransactions) {
    if (t.type === "income") {
      totalIncome += t.amount;
    } else {
      directExpense += t.amount;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount;
    }
  }

  const creditExpense = installments.reduce((s, c) => s + c.installmentValue, 0);
  if (creditExpense > 0) {
    byCategory[CREDIT_CATEGORY] = (byCategory[CREDIT_CATEGORY] ?? 0) + creditExpense;
  }

  const totalExpense = directExpense + creditExpense;

  return {
    month,
    totalIncome,
    totalExpense,
    creditExpense,
    balance: totalIncome - totalExpense,
    expensePercentage: totalIncome === 0 ? 0 : (totalExpense / totalIncome) * 100,
    byCategory,
  };
}

/* ---------- sugestão de distribuição do saldo ---------- */

/** Única fonte dos percentuais (antes estavam repetidos na store e no CardPositive). */
export const DISTRIBUTION = [
  { key: "emergency", label: "Reserva de emergência", percent: 30 },
  { key: "invest", label: "Investimentos", percent: 20 },
  { key: "leisure", label: "Lazer", percent: 20 },
  { key: "education", label: "Educação", percent: 15 },
  { key: "costs", label: "Gastos pessoais", percent: 15 },
] as const;

export type DistributionKey = (typeof DISTRIBUTION)[number]["key"];

/**
 * Divide o saldo (centavos) pelos percentuais. Saldo zero ou negativo não distribui.
 * Os centavos que sobram do arredondamento ficam na reserva de emergência,
 * então a soma das partes é sempre igual ao saldo.
 */
export function getDistribution(balance: number): Record<DistributionKey, number> {
  const result = {
    emergency: 0,
    invest: 0,
    leisure: 0,
    education: 0,
    costs: 0,
  };

  if (balance <= 0) return result;

  let distributed = 0;
  for (const item of DISTRIBUTION) {
    const part = Math.floor((balance * item.percent) / 100);
    result[item.key] = part;
    distributed += part;
  }
  result.emergency += balance - distributed;

  return result;
}

/* ---------- meses com dados ---------- */

function creditEndMonth(c: CreditTransaction): Month {
  return changeMonth(c.startMonth, c.installments - 1);
}

/**
 * Meses entre o primeiro e o último mês que têm algum dado,
 * em ordem. Fixas contam só pelo mês em que foram criadas.
 */
export function getAvailableMonths(
  data: FinanceData,
  today: Month,
): Month[] {
  const points: Month[] = [
    ...data.transactions.map((t) => t.month),
    ...data.creditTransactions.map((c) => c.startMonth),
    ...data.creditTransactions.map(creditEndMonth),
  ];

  if (points.length === 0) return [];

  const sorted = [...points].sort(compareMonths);
  const first = sorted[0];
  // não passa do mês atual, a não ser que haja dado futuro (crédito ainda em curso)
  const last = sorted[sorted.length - 1];
  return getMonthsBetween(first, compareMonths(last, today) > 0 ? last : today);
}

/* ---------- por categoria ---------- */

/** Despesas do mês agrupadas por categoria, da maior para a menor, só as que têm valor. */
export function getExpensesByCategory(
  summary: MonthSummary,
): { category: Category; value: number }[] {
  return (Object.entries(summary.byCategory) as [Category, number][])
    .filter(([, value]) => value > 0)
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
}

/* ---------- projeção ---------- */

function fixedTotal(
  transactions: Transaction[],
  month: Month,
  type: Transaction["type"],
): number {
  return getTransactionsByMonth(transactions, month)
    .filter((t) => t.fixed && t.type === type)
    .reduce((s, t) => s + t.amount, 0);
}

/**
 * Projeção dos próximos `count` meses a partir de `startMonth` (inclusive).
 * Considera só o que já está previsto: rendas fixas, despesas fixas,
 * parcelas do crédito e despesas extras planejadas.
 */
export function getProjection(
  data: Pick<FinanceData, "transactions" | "creditTransactions">,
  extras: ExtraExpense[],
  startMonth: Month,
  count: number,
): ProjectionMonth[] {
  const result: ProjectionMonth[] = [];
  let accumulated = 0;

  for (let i = 0; i < count; i++) {
    const month = changeMonth(startMonth, i);

    const income = fixedTotal(data.transactions, month, "income");
    const fixedExpense = fixedTotal(data.transactions, month, "expense");
    const creditExpense = getCreditTotalByMonth(data.creditTransactions, month);
    const extraExpense = extras
      .filter((e) => e.month === month)
      .reduce((s, e) => s + e.amount, 0);

    const expense = fixedExpense + creditExpense + extraExpense;
    const balance = income - expense;
    accumulated += balance;

    result.push({
      month,
      income,
      expense,
      creditExpense,
      extraExpense,
      balance,
      accumulated,
    });
  }

  return result;
}
