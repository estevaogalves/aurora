import { compareMonths } from "../Utils/Date";
import { getMonthSummary } from "./summary";
import type { Budgets, FinanceData, Month } from "./types";

/**
 * Orçamento por categoria: um limite mensal opcional em cada categoria. São referências: nunca bloqueiam lançamento
 * (como o teto do cartão) e não mudam nenhum total. O gasto vem do mesmo cálculo do Painel (cada despesa conta uma
 * vez, e o cartão conta no mês do vencimento da fatura).
 */

/** A partir de quanto do limite a categoria entra em atenção. */
export const BUDGET_WARN_PERCENT = 80;
/** A partir de quanto ela estourou. */
export const BUDGET_OVER_PERCENT = 100;

export type BudgetLevel = "ok" | "warn" | "over";

/** Limite de uma categoria num mês: o da última mudança até o mês (herda para a frente); 0 = sem limite. */
export function budgetLimitFor(budgets: Budgets, category: string, month: Month): number {
  const changes = budgets[category];
  if (!changes) return 0;
  let limit = 0;
  let at: Month | null = null;
  for (const [m, value] of Object.entries(changes)) {
    if (compareMonths(m, month) <= 0 && (at === null || compareMonths(m, at) > 0)) {
      at = m;
      limit = value;
    }
  }
  return limit;
}

export const budgetLevel = (percent: number): BudgetLevel => (percent >= BUDGET_OVER_PERCENT ? "over" : percent >= BUDGET_WARN_PERCENT ? "warn" : "ok");

export interface BudgetLine {
  category: string;
  /** centavos gastos no mês */
  spent: number;
  /** centavos de limite no mês (sempre maior que zero aqui) */
  limit: number;
  /** gasto ÷ limite, em % (passa de 100 quando estoura) */
  percent: number;
  level: BudgetLevel;
}

/** Categorias com limite no mês, com o gasto e o nível, da mais perto de estourar para a mais folgada. */
export function getBudgetLines(
  data: Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "creditCards" | "extraExpenses">>,
  budgets: Budgets,
  month: Month,
): BudgetLine[] {
  const byCategory = getMonthSummary(data, month).byCategory as Record<string, number>;
  return Object.keys(budgets)
    .map((category) => {
      const limit = budgetLimitFor(budgets, category, month);
      const spent = byCategory[category] ?? 0;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      return { category, spent, limit, percent, level: budgetLevel(percent) };
    })
    .filter((l) => l.limit > 0)
    .sort((a, b) => b.percent - a.percent || a.category.localeCompare(b.category));
}

/* ---------- sino ---------- */

/** Prefixo das chaves de aviso de orçamento em `seenAlerts`. */
export const BUDGET_ALERT_PREFIX = "budget:";

export interface BudgetAlert extends BudgetLine {
  month: Month;
}

/** Chave do aviso: muda de "warn" para "over", então o aviso volta quando a categoria estoura. */
export const budgetAlertKey = (a: Pick<BudgetAlert, "category" | "month" | "level">) => `${BUDGET_ALERT_PREFIX}${a.category}:${a.month}:${a.level}`;

/** Categorias a partir de 80% do limite no mês (atenção e estourado). */
export function getBudgetAlerts(data: Parameters<typeof getBudgetLines>[0], budgets: Budgets, month: Month): BudgetAlert[] {
  return getBudgetLines(data, budgets, month)
    .filter((l) => l.level !== "ok")
    .map((l) => ({ ...l, month }));
}
