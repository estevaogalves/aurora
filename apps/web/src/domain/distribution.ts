import { BALANCE_SOURCE, parseDistributionOrigin } from "./origin";
import { resolveCardExpenses } from "./invoice";
import { DISTRIBUTION, getMonthSummary } from "./summary";
import { getTransactionsByMonth } from "./transactions";
import type { DistributionItem, FinanceData, Goal, GoalMovement, Investment, InvestmentMovement, Month } from "./types";

/** Percentuais padrão da sugestão (as cinco fatias obrigatórias). */
export const DEFAULT_DISTRIBUTION: DistributionItem[] = DISTRIBUTION.map((d) => ({
  id: d.key,
  label: d.label,
  percent: d.percent,
}));

const REQUIRED_IDS = DEFAULT_DISTRIBUTION.map((d) => d.id);

/** Fatias que não podem ser apagadas. */
export const isRequiredItem = (item: DistributionItem) => REQUIRED_IDS.includes(item.id);

/**
 * Confere a configuração. Devolve a mensagem do primeiro problema, ou null se está válida:
 * as cinco fatias padrão presentes, nomes únicos, percentuais inteiros de 0 a 100 e soma igual a 100.
 */
export function validateDistribution(items: DistributionItem[]): string | null {
  for (const id of REQUIRED_IDS) {
    if (!items.some((i) => i.id === id)) return "As cinco categorias padrão são obrigatórias.";
  }

  const names = new Set<string>();
  for (const item of items) {
    const name = item.label.trim().toLowerCase();
    if (!name) return "Toda categoria precisa de um nome.";
    if (names.has(name)) return `Há duas categorias chamadas "${item.label.trim()}".`;
    names.add(name);
    if (!Number.isInteger(item.percent) || item.percent < 0 || item.percent > 100) {
      return `O percentual de "${item.label.trim()}" deve ser um número inteiro de 0 a 100.`;
    }
  }

  const total = sumPercent(items);
  if (total !== 100) return `Os percentuais somam ${total}%. A soma precisa ser exatamente 100%.`;
  return null;
}

export const sumPercent = (items: DistributionItem[]) => items.reduce((s, i) => s + i.percent, 0);

export interface DistributionPart {
  item: DistributionItem;
  /** centavos */
  value: number;
}

/**
 * Divide o saldo (centavos) entre as fatias. Saldo zero ou negativo não distribui.
 * Os centavos que sobram do arredondamento vão para a primeira fatia com percentual,
 * então a soma das partes é sempre igual ao saldo.
 */
export function distributeBalance(balance: number, items: DistributionItem[]): DistributionPart[] {
  if (balance <= 0) return items.map((item) => ({ item, value: 0 }));

  const parts = items.map((item) => ({ item, value: Math.floor((balance * item.percent) / 100) }));
  const rest = balance - parts.reduce((s, p) => s + p.value, 0);
  const first = parts.find((p) => p.item.percent > 0) ?? parts[0];
  if (first) first.value += rest;
  return parts;
}

/* ---------- fontes da sugestão: o saldo do mês e as rendas "distribuir separado" ---------- */

/** De onde sai uma sugestão: o saldo do mês ou uma renda marcada para distribuir à parte (13º, bônus). */
export interface DistributionSource {
  /** "balance" (saldo do mês) ou o id da renda separada */
  id: string;
  label: string;
  /** centavos a distribuir (o saldo pode ser zero ou negativo) */
  amount: number;
  /** é uma renda separada (valor cheio), não o saldo do mês */
  separate: boolean;
}

type SourcesData = Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>;

/**
 * Fontes da sugestão do saldo em `month`. O saldo do mês não soma meses anteriores e fica só com o que não é de
 * uma renda separada; cada renda variável marcada "distribuir separado" ganha a sua fonte, com o valor cheio.
 * Sem nenhuma renda separada, há uma fonte só (o saldo do mês), como sempre foi.
 */
export function getDistributionSources(data: SourcesData, month: Month): DistributionSource[] {
  const separate = getTransactionsByMonth(resolveCardExpenses(data.transactions, data.creditCards), month).filter((t) => t.type === "income" && t.separate && !t.fixed);
  const separateTotal = separate.reduce((s, t) => s + t.amount, 0);
  return [
    { id: BALANCE_SOURCE, label: "Saldo do mês", amount: getMonthSummary(data, month).balance - separateTotal, separate: false },
    ...separate.map((t): DistributionSource => ({ id: t.id, label: t.name, amount: t.amount, separate: true })),
  ];
}

/** Para onde foi (ou vai) uma parte da sugestão. */
export interface SentTarget {
  kind: "goal" | "piggy" | "investment";
  name: string;
  /** centavos */
  amount: number;
}

export interface SentSummary {
  /** centavos já enviados */
  total: number;
  targets: SentTarget[];
}

/** Chave de uma fatia dentro de uma fonte: "balance|emergency". */
export const sentKey = (source: string, slice: string) => `${source}|${slice}`;

/**
 * O que já foi enviado de cada fatia das sugestões de `month`, somando os aportes de metas, porquinhos e
 * investimentos que nasceram do atalho "Enviar" (a origem guarda mês, fonte e fatia). Só aporte conta.
 */
export function getSentByDistribution(
  data: { goals: Goal[]; goalMovements: GoalMovement[]; investments: Investment[]; investmentMovements: InvestmentMovement[] },
  month: Month,
): Record<string, SentSummary> {
  const out: Record<string, SentSummary> = {};
  const add = (origin: string | undefined, target: SentTarget) => {
    const o = parseDistributionOrigin(origin);
    if (!o || o.month !== month) return;
    const entry = (out[sentKey(o.source, o.slice)] ??= { total: 0, targets: [] });
    entry.total += target.amount;
    const same = entry.targets.find((t) => t.kind === target.kind && t.name === target.name);
    if (same) same.amount += target.amount;
    else entry.targets.push({ ...target });
  };
  for (const m of data.goalMovements) {
    if (m.type !== "contribution") continue;
    const goal = data.goals.find((g) => g.id === m.goalId);
    if (goal) add(m.origin, { kind: goal.piggy ? "piggy" : "goal", name: goal.name, amount: m.amount });
  }
  for (const m of data.investmentMovements) {
    if (m.type !== "contribution") continue;
    const inv = data.investments.find((i) => i.id === m.investmentId);
    if (inv) add(m.origin, { kind: "investment", name: inv.name, amount: m.amount });
  }
  return out;
}
