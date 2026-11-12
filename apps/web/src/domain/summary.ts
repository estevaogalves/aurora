import { changeMonth, compareMonths, getMonthsBetween } from "../Utils/Date";
import type { Category } from "../Types/Category";
import { getCreditByMonth, getCreditTotalByMonth } from "./credit";
import { cardAdjustmentsOf, getCardInvoice, resolveCardExpenses, resolveCredits, type CardInvoice } from "./invoice";
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
/**
 * Categoria em que uma parcela ou recorrência do crédito conta nos totais: a que a compra tem. "Crédito/Parcelado"
 * só serve de reserva para compra antiga sem categoria.
 */
export const creditCategoryOf = (c: { category?: string }): Category => c.category?.trim() || CREDIT_CATEGORY;

/** Despesas extras planejadas não têm categoria própria: entram em "Outros". */
const EXTRA_CATEGORY: Category = "Outros";

/**
 * Reparte o ajuste de uma fatura pelas categorias das compras dela, na proporção de cada uma (os centavos que
 * sobram vão para as maiores). Assim o desconto reduz as mesmas categorias que ele desconta, nenhuma fica
 * negativa e a soma das partes é sempre o ajuste. Fatura sem compras (só acréscimo) vai para o crédito.
 */
export function splitInvoiceAdjustment(invoice: CardInvoice): Partial<Record<Category, number>> {
  const adj = invoice.adjustmentApplied;
  if (adj === 0) return {};
  const parts: Partial<Record<Category, number>> = {};
  const add = (c: Category, v: number) => { parts[c] = (parts[c] ?? 0) + v; };
  for (const c of [...invoice.installments, ...invoice.recurring]) add(creditCategoryOf(c), c.installmentValue);
  for (const p of invoice.purchases) add(p.category as Category, p.amount);
  const entries = (Object.entries(parts) as [Category, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return { [CREDIT_CATEGORY]: adj };

  const sign = adj < 0 ? -1 : 1;
  // BigInt: com valores gigantes, valor × parte passa dos 2^53 que um número inteiro comum representa com exatidão
  const shares = entries.map(([c, v]) => [c, sign * Number((BigInt(Math.abs(adj)) * BigInt(v)) / BigInt(total))] as [Category, number]);
  let rest = adj - shares.reduce((s, [, v]) => s + v, 0);
  for (let i = 0; rest !== 0; i = (i + 1) % shares.length) {
    shares[i][1] += sign;
    rest -= sign;
  }
  return Object.fromEntries(shares.filter(([, v]) => v !== 0)) as Partial<Record<Category, number>>;
}

/** Ajustes das faturas que vencem em `month`: o cartão, a fatura e como o ajuste se reparte pelas categorias. */
export function getInvoiceAdjustments(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>,
  month: Month,
): { invoice: CardInvoice; byCategory: Partial<Record<Category, number>> }[] {
  return (data.creditCards ?? [])
    .filter((k) => cardAdjustmentsOf(k, month).length > 0)
    .map((k) => getCardInvoice(data, k, month))
    .filter((i) => i.adjustmentApplied !== 0)
    .map((invoice) => ({ invoice, byCategory: splitInvoiceAdjustment(invoice) }));
}

/** Resumo de um mês: renda, despesas (com as parcelas do crédito), saldo e por categoria. */
export function getMonthSummary(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>,
  month: Month,
): MonthSummary {
  const monthTransactions = getTransactionsByMonth(resolveCardExpenses(data.transactions, data.creditCards), month);
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

  // cada parcela e recorrência conta na categoria da própria compra (trocar a categoria muda o gráfico)
  let creditExpense = 0;
  for (const c of installments) {
    creditExpense += c.installmentValue;
    if (c.installmentValue > 0) {
      const cat = creditCategoryOf(c);
      byCategory[cat] = (byCategory[cat] ?? 0) + c.installmentValue;
    }
  }

  // despesas extras planejadas para o mês (as mesmas que a Projeção usa)
  const extraExpense = resolveCardExpenses(data.extraExpenses ?? [], data.creditCards).filter((e) => e.month === month).reduce((sum, e) => sum + e.amount, 0);
  if (extraExpense > 0) {
    byCategory[EXTRA_CATEGORY] = (byCategory[EXTRA_CATEGORY] ?? 0) + extraExpense;
  }

  // ajuste (desconto ou acréscimo) das faturas do mês: reduz ou aumenta as categorias da própria fatura
  let invoiceAdjustment = 0;
  for (const a of getInvoiceAdjustments(data, month)) {
    invoiceAdjustment += a.invoice.adjustmentApplied;
    for (const [c, v] of Object.entries(a.byCategory) as [Category, number][]) byCategory[c] = (byCategory[c] ?? 0) + v;
  }
  for (const c of Object.keys(byCategory) as Category[]) if (byCategory[c] === 0) delete byCategory[c];

  const totalExpense = directExpense + creditExpense + extraExpense + invoiceAdjustment;

  return {
    month,
    totalIncome,
    totalExpense,
    creditExpense,
    extraExpense,
    invoiceAdjustment,
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
    ...resolveCardExpenses(data.transactions, data.creditCards).map((t) => t.month),
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

/** Soma das despesas fixas que valem em um mês (centavos). Base da sugestão de reserva e do "dia da liberdade de gastos". */
export function getFixedExpense(transactions: Transaction[], month: Month): number {
  return fixedTotal(transactions, month, "expense");
}

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
  kind: "fixed" | "credit" | "extra" | "adjustment" | "estimate";
}

/** Os lançamentos que formam uma categoria nas despesas do mês (soma igual a `byCategory[category]` de `getMonthSummary`). */
export function getCategoryDetail(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>,
  month: Month,
  category: Category,
): ProjectionLine[] {
  const lines: ProjectionLine[] = getTransactionsByMonth(resolveCardExpenses(data.transactions, data.creditCards), month)
    .filter((t) => t.type === "expense" && t.category === category)
    .map((t) => ({ name: t.name, amount: t.amount, kind: "fixed" as const }));

  // as parcelas e recorrências entram na categoria da própria compra (a mesma regra de `getMonthSummary`)
  for (const c of getCreditByMonth(resolveCredits(data.creditTransactions, data.creditCards), month).filter((x) => creditCategoryOf(x) === category)) {
    lines.push({ name: c.recurring ? `${c.name} (recorrente)` : `${c.name} (${c.currentInstallment}/${c.installments}${c.advanced ? ", adiantada" : ""})`, amount: c.installmentValue, kind: "credit" });
  }
  for (const a of getInvoiceAdjustments(data, month)) {
    const share = a.byCategory[category];
    if (share) lines.push({ name: `${a.invoice.adjustmentApplied < 0 ? "Desconto" : "Acréscimo"} da fatura ${a.invoice.card.name}`, amount: share, kind: "adjustment" });
  }
  if (category === EXTRA_CATEGORY) {
    for (const e of resolveCardExpenses(data.extraExpenses ?? [], data.creditCards).filter((x) => x.month === month)) lines.push({ name: e.name, amount: e.amount, kind: "extra" });
  }
  return lines.sort((a, b) => b.amount - a.amount);
}

/** Renda variável estimada (cenário) que a Projeção soma nos meses depois de `after`. */
export interface ProjectionEstimate {
  /** centavos por mês */
  perMonth: number;
  /** último mês que NÃO recebe estimativa (o mês atual de verdade) */
  after: Month;
}

/** O que compõe a renda e a despesa projetadas de um mês, linha a linha (soma igual à de `getProjection`). */
export function getProjectionDetail(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "creditCards">>,
  extras: ExtraExpense[],
  month: Month,
  estimate?: ProjectionEstimate,
): { incomes: ProjectionLine[]; expenses: ProjectionLine[] } {
  const fixed = getTransactionsByMonth(data.transactions, month).filter((t) => t.fixed);
  const line = (t: Transaction): ProjectionLine => ({ name: t.name, amount: t.amount, kind: "fixed" });
  const estimated = estimate && estimate.perMonth > 0 && compareMonths(month, estimate.after) > 0 ? [{ name: "Renda variável estimada", amount: estimate.perMonth, kind: "estimate" as const }] : [];
  return {
    incomes: [...fixed.filter((t) => t.type === "income").map(line), ...estimated],
    expenses: [
      ...fixed.filter((t) => t.type === "expense").map(line),
      ...getCreditByMonth(resolveCredits(data.creditTransactions, data.creditCards), month).map((c): ProjectionLine => ({ name: c.recurring ? `${c.name} (recorrente)` : `${c.name} (${c.currentInstallment}/${c.installments}${c.advanced ? ", adiantada" : ""})`, amount: c.installmentValue, kind: "credit" })),
      ...resolveCardExpenses(extras, data.creditCards).filter((e) => e.month === month).map((e): ProjectionLine => ({ name: e.name, amount: e.amount, kind: "extra" })),
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
  estimate?: ProjectionEstimate,
): ProjectionMonth[] {
  const result: ProjectionMonth[] = [];
  let accumulated = 0;
  const plannedExtras = resolveCardExpenses(extras, data.creditCards);

  for (let i = 0; i < count; i++) {
    const month = changeMonth(startMonth, i);

    // cenário: a renda variável estimada entra só em meses depois de `estimate.after` (o mês atual); nunca em mês passado
    const variable = estimate && compareMonths(month, estimate.after) > 0 ? estimate.perMonth : 0;
    const income = fixedTotal(data.transactions, month, "income") + variable;
    const fixedExpense = fixedTotal(data.transactions, month, "expense");
    const creditExpense = getCreditTotalByMonth(resolveCredits(data.creditTransactions, data.creditCards), month);
    const extraExpense = plannedExtras
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
    ...resolveCardExpenses(data.transactions, data.creditCards).map((t) => t.month),
    ...resolveCredits(data.creditTransactions, data.creditCards).map((c) => c.startMonth),
    ...resolveCardExpenses(data.extraExpenses, data.creditCards).map((e) => e.month),
    ...data.notes.map((n) => n.month),
    ...data.goals.flatMap((g) => (g.deadline ? [g.deadline] : [])),
  ].sort(compareMonths)[0];
  if (!oldest) return null;
  for (let m = next; compareMonths(m, oldest) >= 0; m = changeMonth(m, -1)) {
    if (hasMonthMovement(data, m)) return m;
  }
  return null;
}
