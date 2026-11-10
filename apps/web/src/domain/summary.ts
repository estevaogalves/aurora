import { changeMonth, compareMonths, getMonthsBetween } from "../Utils/Date";
import type { Category } from "../Types/Category";
import { getCreditByMonth, getCreditTotalByMonth } from "./credit";
import { resolveCredits } from "./invoice";
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
/** Despesas extras planejadas não têm categoria própria: entram em "Outros". */
const EXTRA_CATEGORY: Category = "Outros";

/** Resumo de um mês: renda, despesas (com as parcelas do crédito), saldo e por categoria. */
export function getMonthSummary(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>,
  month: Month,
): MonthSummary {
  const monthTransactions = getTransactionsByMonth(data.transactions, month);
  const installments = getCreditByMonth(resolveCredits(data.creditTransactions, data.creditCards), month);

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

  // despesas extras planejadas para o mês (as mesmas que a Projeção usa)
  const extraExpense = (data.extraExpenses ?? []).filter((e) => e.month === month).reduce((sum, e) => sum + e.amount, 0);
  if (extraExpense > 0) {
    byCategory[EXTRA_CATEGORY] = (byCategory[EXTRA_CATEGORY] ?? 0) + extraExpense;
  }

  const totalExpense = directExpense + creditExpense + extraExpense;

  return {
    month,
    totalIncome,
    totalExpense,
    creditExpense,
    extraExpense,
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
  // recorrente sem fim não cria dado em meses futuros: segue só até onde o app já mostra
  if (c.recurring) return c.endMonth ?? c.startMonth;
  return changeMonth(c.startMonth, c.installments - 1);
}

/**
 * Meses entre o primeiro e o último mês que têm algum dado,
 * em ordem. Fixas contam só pelo mês em que foram criadas.
 */
export function getAvailableMonths(
  data: Pick<FinanceData, "transactions" | "creditTransactions" | "notes"> & Partial<Pick<FinanceData, "creditCards">>,
  today: Month,
): Month[] {
  const credits = resolveCredits(data.creditTransactions, data.creditCards);
  const points: Month[] = [
    ...data.transactions.map((t) => t.month),
    ...credits.map((c) => c.startMonth),
    ...credits.map(creditEndMonth),
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

export interface ProjectionLine {
  name: string;
  /** centavos */
  amount: number;
  /** de onde vem a linha: fixa do mês, parcela do crédito ou despesa extra planejada */
  kind: "fixed" | "credit" | "extra";
}

/** Os lançamentos que formam uma categoria nas despesas do mês (soma igual a `byCategory[category]` de `getMonthSummary`). */
export function getCategoryDetail(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>,
  month: Month,
  category: Category,
): ProjectionLine[] {
  const lines: ProjectionLine[] = getTransactionsByMonth(data.transactions, month)
    .filter((t) => t.type === "expense" && t.category === category)
    .map((t) => ({ name: t.name, amount: t.amount, kind: "fixed" as const }));

  if (category === CREDIT_CATEGORY) {
    for (const c of getCreditByMonth(resolveCredits(data.creditTransactions, data.creditCards), month)) {
      lines.push({ name: c.recurring ? `${c.name} (recorrente)` : `${c.name} (${c.currentInstallment}/${c.installments}${c.advanced ? ", adiantada" : ""})`, amount: c.installmentValue, kind: "credit" });
    }
  }
  if (category === EXTRA_CATEGORY) {
    for (const e of (data.extraExpenses ?? []).filter((x) => x.month === month)) lines.push({ name: e.name, amount: e.amount, kind: "extra" });
  }
  return lines.sort((a, b) => b.amount - a.amount);
}

/** O que compõe a renda e a despesa projetadas de um mês, linha a linha (soma igual à de `getProjection`). */
export function getProjectionDetail(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "creditCards">>,
  extras: ExtraExpense[],
  month: Month,
): { incomes: ProjectionLine[]; expenses: ProjectionLine[] } {
  const fixed = getTransactionsByMonth(data.transactions, month).filter((t) => t.fixed);
  const line = (t: Transaction): ProjectionLine => ({ name: t.name, amount: t.amount, kind: "fixed" });
  return {
    incomes: fixed.filter((t) => t.type === "income").map(line),
    expenses: [
      ...fixed.filter((t) => t.type === "expense").map(line),
      ...getCreditByMonth(resolveCredits(data.creditTransactions, data.creditCards), month).map((c): ProjectionLine => ({ name: c.recurring ? `${c.name} (recorrente)` : `${c.name} (${c.currentInstallment}/${c.installments}${c.advanced ? ", adiantada" : ""})`, amount: c.installmentValue, kind: "credit" })),
      ...extras.filter((e) => e.month === month).map((e): ProjectionLine => ({ name: e.name, amount: e.amount, kind: "extra" })),
    ],
  };
}

/**
 * Projeção dos próximos `count` meses a partir de `startMonth` (inclusive).
 * Considera só o que já está previsto: rendas fixas, despesas fixas,
 * parcelas do crédito e despesas extras planejadas.
 */
export function getProjection(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "creditCards">>,
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
    const creditExpense = getCreditTotalByMonth(resolveCredits(data.creditTransactions, data.creditCards), month);
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

/* ---------- navegação entre meses ---------- */

type NavigationData = Pick<FinanceData, "transactions" | "creditTransactions" | "extraExpenses" | "notes" | "goals"> & Partial<Pick<FinanceData, "creditCards">>;

/** Mês com renda, despesa (inclui parcela e extra), anotação ou meta com prazo nele. */
export function hasMonthMovement(data: NavigationData, month: Month): boolean {
  const s = getMonthSummary(data, month);
  return (
    s.totalIncome > 0 ||
    s.totalExpense > 0 ||
    data.notes.some((n) => n.month === month) ||
    data.goals.some((g) => g.deadline === month)
  );
}

/**
 * Mês para onde as setas levam (`step` -1 ou 1), ou null se não há para onde ir.
 * Do mês atual em diante tudo é permitido. Meses passados sem movimentação são pulados.
 */
export function getAdjacentMonth(data: NavigationData, from: Month, today: Month, step: 1 | -1): Month | null {
  const next = changeMonth(from, step);
  if (step === 1) {
    if (compareMonths(next, today) >= 0) return next;
    // passado: o próximo com movimento; sem nenhum, o mês atual
    for (let m = next; compareMonths(m, today) < 0; m = changeMonth(m, 1)) {
      if (hasMonthMovement(data, m)) return m;
    }
    return today;
  }

  if (compareMonths(next, today) >= 0) return next;
  const oldest = [
    ...data.transactions.map((t) => t.month),
    ...resolveCredits(data.creditTransactions, data.creditCards).map((c) => c.startMonth),
    ...data.extraExpenses.map((e) => e.month),
    ...data.notes.map((n) => n.month),
    ...data.goals.flatMap((g) => (g.deadline ? [g.deadline] : [])),
  ].sort(compareMonths)[0];
  if (!oldest) return null;
  for (let m = next; compareMonths(m, oldest) >= 0; m = changeMonth(m, -1)) {
    if (hasMonthMovement(data, m)) return m;
  }
  return null;
}
