import { BALANCE_SOURCE, parseDistributionOrigin } from "./origin";
import { resolveCardExpenses } from "./invoice";
import { DISTRIBUTION, getMonthSummary } from "./summary";
import { getTransactionsByMonth } from "./transactions";
import type { DistributionItem, FinanceData, Goal, GoalMovement, Investment, InvestmentMovement, Month, Transaction } from "./types";

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

/* ---------- distribuições do mês: Dist 1 (o saldo) e as próprias (Dist 2, 3...) ---------- */

/** Maior número de distribuição própria (Dist 20). */
export const MAX_DIST_GROUP = 20;

/** "Dist 1", "Dist 2"... */
export const distLabel = (group: number) => `Dist ${group}`;

/** Id da distribuição na origem dos envios: "balance" para a Dist 1 (o saldo do mês) e "d2", "d3"... para as próprias. */
export const distSourceId = (group: number) => (group <= 1 ? BALANCE_SOURCE : `d${group}`);

/** O número da distribuição pelo id da origem; null se o id não é de uma distribuição (formato antigo, por exemplo). */
export function distGroupOfSource(source: string): number | null {
  if (source === BALANCE_SOURCE) return 1;
  const m = /^d(\d{1,2})$/.exec(source);
  const n = m ? Number(m[1]) : 0;
  return n >= 2 && n <= MAX_DIST_GROUP ? n : null;
}

/**
 * Em que distribuição uma renda entra: 1 (o saldo do mês) ou de 2 a 20. Só renda variável (não fixa) pode ter
 * distribuição própria. Lê também a marca antiga "distribuir separado" (`separate`), que vira a Dist 2.
 */
export function distGroupOf(t: Pick<Transaction, "type" | "fixed" | "distGroup">): number {
  if (t.type !== "income" || t.fixed) return 1;
  const legacy = (t as { separate?: boolean }).separate ? 2 : 1;
  const group = t.distGroup ?? legacy;
  return Number.isInteger(group) && group >= 2 && group <= MAX_DIST_GROUP ? group : 1;
}

/** Chave dos percentuais próprios de uma distribuição de um mês: "AAAA-MM|n". */
export const overrideKey = (month: Month, group: number) => `${month}|${group}`;

/** Uma distribuição do mês: o saldo (Dist 1) ou as rendas variáveis que entraram numa distribuição própria. */
export interface MonthDistribution {
  /** 1 = Dist 1 (o saldo do mês); 2 a 20 = distribuição própria */
  group: number;
  /** "balance" (Dist 1) ou "d2", "d3"... (veja `distSourceId`) */
  id: string;
  /** "Dist 1", "Dist 2"... */
  label: string;
  /** centavos a distribuir (a Dist 1 pode ficar zerada ou negativa) */
  amount: number;
  /** as rendas que formam uma distribuição própria (a Dist 1 é o saldo: lista vazia) */
  incomes: { id: string; name: string; amount: number }[];
}

type DistributionData = Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>;

/**
 * As distribuições do saldo de `month`, em ordem: a Dist 1 (o saldo do mês, que não soma meses anteriores) e uma por
 * número de distribuição própria que alguma renda variável do mês escolheu. A Dist 1 fica só com o que não entrou
 * numa distribuição própria; cada distribuição própria vale a soma das rendas dela, com o valor cheio.
 * Sem nenhuma distribuição própria, há uma só (a Dist 1), como sempre foi.
 */
export function getMonthDistributions(data: DistributionData, month: Month): MonthDistribution[] {
  const own = getTransactionsByMonth(resolveCardExpenses(data.transactions, data.creditCards), month)
    .filter((t) => t.type === "income" && distGroupOf(t) >= 2)
    .map((t) => ({ group: distGroupOf(t), income: { id: t.id, name: t.name, amount: t.amount } }));
  const ownTotal = own.reduce((s, x) => s + x.income.amount, 0);
  const groups = [...new Set(own.map((x) => x.group))].sort((a, b) => a - b);
  return [
    { group: 1, id: distSourceId(1), label: distLabel(1), amount: getMonthSummary(data, month).balance - ownTotal, incomes: [] },
    ...groups.map((group): MonthDistribution => {
      const incomes = own.filter((x) => x.group === group).map((x) => x.income);
      return { group, id: distSourceId(group), label: distLabel(group), amount: incomes.reduce((s, i) => s + i.amount, 0), incomes };
    }),
  ];
}

/**
 * Em que distribuição uma renda nova de `month` pode entrar: os números já usados por outras rendas do mês (mais a
 * Dist 1) e o próximo número livre para criar uma nova (o menor a partir de 2 que ninguém usa, então os nomes ficam
 * seguidos: Dist 2, Dist 3...). `exceptId` ignora a renda que está sendo editada.
 */
export function distGroupChoices(transactions: Transaction[], month: Month, exceptId?: string): { existing: number[]; next: number | null } {
  const used = new Set(
    getTransactionsByMonth(transactions, month)
      .filter((t) => t.type === "income" && t.id !== exceptId && distGroupOf(t) >= 2)
      .map((t) => distGroupOf(t)),
  );
  let next: number | null = 2;
  while (next !== null && used.has(next)) next = next < MAX_DIST_GROUP ? next + 1 : null;
  return { existing: [...used].sort((a, b) => a - b), next };
}

/** Os percentuais de uma distribuição: os próprios do mês (Dist 2 em diante), senão o padrão do usuário, senão o do app. */
export function distributionItemsFor(
  settings: { distribution: DistributionItem[] | null; distributionOverrides?: Record<string, DistributionItem[]> },
  month: Month,
  group: number,
): DistributionItem[] {
  const own = group >= 2 ? settings.distributionOverrides?.[overrideKey(month, group)] : undefined;
  return own ?? settings.distribution ?? DEFAULT_DISTRIBUTION;
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

/** Os aportes (em metas, porquinhos e investimentos) que nasceram de uma fatia de uma distribuição: o que "Desfazer envio" remove. */
export function findSentMovements(
  data: { goalMovements: GoalMovement[]; investmentMovements: InvestmentMovement[] },
  month: Month,
  source: string,
  slice: string,
): { goalMovements: GoalMovement[]; investmentMovements: InvestmentMovement[] } {
  const same = (origin: string | undefined) => {
    const o = parseDistributionOrigin(origin);
    return !!o && o.month === month && o.source === source && o.slice === slice;
  };
  return {
    goalMovements: data.goalMovements.filter((m) => m.type === "contribution" && same(m.origin)),
    investmentMovements: data.investmentMovements.filter((m) => m.type === "contribution" && same(m.origin)),
  };
}
