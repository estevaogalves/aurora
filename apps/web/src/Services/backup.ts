import { CURRENT_VERSION, migrateStored } from "../repositories/localMigration";
import type { FinanceData } from "../domain/types";

export const BACKUP_FILENAME = () => `aurora-backup-${new Date().toISOString().slice(0, 10)}.json`;

/** Conteúdo do arquivo de backup: o formato salvo no navegador, com a data da cópia. */
export function buildBackup(data: FinanceData): string {
  return JSON.stringify({ app: "aurora", version: CURRENT_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

/**
 * Lê um arquivo de backup. Aceita o backup do app (com ou sem API) e o "Exportar meus dados" da conta.
 * Devolve null se o texto não for um backup do Aurora.
 */
export function parseBackup(text: string): FinanceData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const file = raw as { version?: unknown; data?: unknown };
  // o export da conta não tem `version`: é sempre o formato atual (valores em centavos)
  return migrateStored({ version: typeof file.version === "number" ? file.version : CURRENT_VERSION, data: file.data });
}

/** Quantos itens de cada tipo o backup tem (para mostrar antes de substituir). */
export function describeBackup(d: FinanceData): [string, number][] {
  return ([
    ["Lançamentos (rendas e despesas)", d.transactions.length],
    ["Compras no crédito", d.creditTransactions.length],
    ["Cartões", (d.creditCards?.length ?? 0)],
    ["Metas", d.goals.length],
    ["Movimentações de metas", d.goalMovements?.length ?? 0],
    ["Investimentos", d.investments?.length ?? 0],
    ["Movimentações de investimentos", d.investmentMovements?.length ?? 0],
    ["Despesas extras", d.extraExpenses.length],
    ["Anotações", d.notes.length],
    ["Categorias próprias", d.customCategories.length],
    ["Categorias com orçamento", Object.keys(d.budgets ?? {}).length],
    ["Dívidas e consórcios", d.debts?.length ?? 0],
    ["Meses fechados", Object.keys(d.closings ?? {}).length],
    ["Ativos de dividendos", d.dividendAssets?.length ?? 0],
  ] as [string, number][]).filter(([, n]) => n > 0);
}
