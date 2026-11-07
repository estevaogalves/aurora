import { DISTRIBUTION } from "./summary";
import type { DistributionItem } from "./types";

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
