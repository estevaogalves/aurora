import { changeMonth, getMonthName } from "../Utils/Date";
import { getTransactionsByMonth } from "./transactions";
import { getMonthSummary } from "./summary";
import type { FinanceData, Month } from "./types";

/**
 * Cenários da Projeção para a renda variável (13º, bônus, freelas, qualquer renda que não é fixa). A Projeção só
 * conta rendas fixas; o cenário acrescenta uma estimativa da renda variável nos meses FUTUROS. Mês que já passou (ou o
 * atual) nunca usa estimativa. "Conservador" não estima nada e reproduz a Projeção de sempre.
 */
export type Scenario = "conservative" | "average" | "optimistic";

export const SCENARIOS: { value: Scenario; label: string; hint: string }[] = [
  { value: "conservative", label: "Conservador", hint: "só renda fixa (0% da variável)" },
  { value: "average", label: "Médio", hint: "média da renda variável dos últimos meses" },
  { value: "optimistic", label: "Otimista", hint: "o maior valor de renda variável dos últimos meses" },
];

/** Quantos meses (até o atual) entram na média e no maior valor. */
export const SCENARIO_WINDOW = 3;

export type ScenarioData = Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "creditCards" | "extraExpenses">>;

/** Renda variável de um mês: rendas que não são fixas (centavos). */
export function variableIncomeOf(transactions: FinanceData["transactions"], month: Month): number {
  return getTransactionsByMonth(transactions, month)
    .filter((t) => t.type === "income" && !t.fixed && !t.cardId)
    .reduce((sum, t) => sum + t.amount, 0);
}

export interface VariableEstimate {
  /** centavos por mês, para cada mês futuro */
  perMonth: number;
  /** meses (com movimento) que serviram de base, do mais antigo ao mais novo */
  basis: Month[];
  /** o cenário usa histórico, mas não há nenhum mês com movimento */
  noHistory: boolean;
}

/** Estima a renda variável de um mês futuro pelo cenário, usando os últimos `SCENARIO_WINDOW` meses até `today`. */
export function estimateVariableIncome(data: ScenarioData, scenario: Scenario, today: Month): VariableEstimate {
  if (scenario === "conservative") return { perMonth: 0, basis: [], noHistory: false };
  const base = { transactions: data.transactions, creditTransactions: data.creditTransactions, creditCards: data.creditCards, extraExpenses: data.extraExpenses };
  const basis: Month[] = [];
  const values: number[] = [];
  for (let i = SCENARIO_WINDOW - 1; i >= 0; i--) {
    const month = changeMonth(today, -i);
    const s = getMonthSummary(base, month);
    // mês sem nenhum movimento não conta (senão um mês vazio puxaria a média para baixo)
    if (s.totalIncome === 0 && s.totalExpense === 0) continue;
    basis.push(month);
    values.push(variableIncomeOf(data.transactions, month));
  }
  if (values.length === 0) return { perMonth: 0, basis, noHistory: true };
  const perMonth = scenario === "optimistic" ? Math.max(...values) : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { perMonth, basis, noHistory: false };
}

/** "Set–Nov" ou "Nov" (rótulo da base da estimativa). */
export function basisLabel(basis: Month[]): string {
  if (basis.length === 0) return "";
  const name = (m: Month) => {
    const n = getMonthName(m);
    return n.charAt(0).toUpperCase() + n.slice(1, 3);
  };
  return basis.length === 1 ? name(basis[0]) : `${name(basis[0])}–${name(basis[basis.length - 1])}`;
}

export const isScenario = (v: unknown): v is Scenario => v === "conservative" || v === "average" || v === "optimistic";
