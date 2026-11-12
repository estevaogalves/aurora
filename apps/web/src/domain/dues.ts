import { changeMonth } from "../Utils/Date";
import { chargeDate } from "./credit";
import { getCardInvoice } from "./invoice";
import { daysUntil } from "./investments";
import { paymentOf } from "./payment";
import { getTransactionsByMonth } from "./transactions";
import type { FinanceData, Month } from "./types";

/**
 * Próximos vencimentos: despesas com dia de vencimento e faturas de cartão que ainda não foram pagas.
 * É só uma visão: não altera nenhum total do Painel. Despesa sem dia de vencimento não entra (nada é inventado).
 */
export type DuesData = Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "creditCards" | "extraExpenses">>;

/** Janelas de dias que o usuário pode escolher. */
export const DUE_WINDOWS = [7, 14, 30] as const;
export const DEFAULT_DUE_WINDOW = 14;
/** Quantos dias para trás um vencimento sem pagamento ainda aparece como atrasado. */
export const OVERDUE_LOOKBACK_DAYS = 30;

export type DueLevel = "overdue" | "today" | "soon" | "later";

export interface DueItem {
  /** identifica o vencimento (muda a cada mês e a cada nível, para o aviso do sino voltar quando piora) */
  key: string;
  kind: "expense" | "invoice";
  /** id da despesa, ou do cartão (fatura) */
  id: string;
  /** mês em que o pagamento é registrado (para a fatura, o mês do vencimento) */
  month: Month;
  name: string;
  /** centavos */
  amount: number;
  /** vencimento, "AAAA-MM-DD" */
  date: string;
  /** dias até o vencimento: 0 = hoje, negativo = atrasada */
  days: number;
  level: DueLevel;
}

/** Em até quantos dias o vencimento já é "em breve" (destaque mais forte). */
export const DUE_SOON_DAYS = 3;

const levelOf = (days: number): DueLevel => (days < 0 ? "overdue" : days === 0 ? "today" : days <= DUE_SOON_DAYS ? "soon" : "later");

/** "AAAA-MM" de um "AAAA-MM-DD". */
const monthOf = (iso: string): Month => iso.slice(0, 7);

/** Soma `days` dias a um "AAAA-MM-DD". */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Vencimentos não pagos de `today - 30 dias` até `today + windowDays`, os atrasados primeiro (do mais antigo) e depois
 * por data. Despesas de cartão ficam de fora (o pagamento é da fatura, que aparece uma vez, no vencimento).
 */
export function getUpcomingDues(data: DuesData, today: string, windowDays: number = DEFAULT_DUE_WINDOW): DueItem[] {
  const items: DueItem[] = [];
  const from = addDays(today, -OVERDUE_LOOKBACK_DAYS);
  const to = addDays(today, windowDays);
  const inRange = (date: string) => date >= from && date <= to;

  for (let month = monthOf(from); month <= monthOf(to); month = changeMonth(month, 1)) {
    for (const t of getTransactionsByMonth(data.transactions, month)) {
      if (t.type !== "expense" || !t.dueDay || t.cardId) continue;
      if (paymentOf(t, month)) continue; // paga (ou boleto agendado): não é mais pendência
      const date = chargeDate(t.dueDay, month);
      if (!inRange(date)) continue;
      const days = daysUntil(date, today);
      items.push({ key: `tx:${t.id}:${month}`, kind: "expense", id: t.id, month, name: t.name, amount: t.amount, date, days, level: levelOf(days) });
    }

    for (const card of data.creditCards ?? []) {
      if (card.payments?.[month]) continue;
      const invoice = getCardInvoice(data, card, month);
      if (invoice.payable <= 0 || !inRange(invoice.dueDate)) continue;
      const days = daysUntil(invoice.dueDate, today);
      items.push({ key: `card:${card.id}:${month}`, kind: "invoice", id: card.id, month, name: `Fatura ${card.name}`, amount: invoice.payable, date: invoice.dueDate, days, level: levelOf(days) });
    }
  }

  return items.sort((a, b) => {
    if ((a.days < 0) !== (b.days < 0)) return a.days < 0 ? -1 : 1;
    return a.days - b.days || a.name.localeCompare(b.name);
  });
}

/** "vence hoje", "vence amanhã", "vence em 3 dias", "atrasada há 2 dias". */
export function dueLabel(days: number): string {
  if (days < 0) return `atrasada há ${-days} ${-days === 1 ? "dia" : "dias"}`;
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  return `vence em ${days} dias`;
}

/* ---------- sino ---------- */

/** Chave de um aviso de vencimento em `seenAlerts` (as das metas começam pelo id da meta, as dos investimentos por "inv:"). */
export const dueAlertKey = (item: Pick<DueItem, "key" | "level">) => `due:${item.key}:${item.level}`;
/** Prefixo das chaves de aviso de vencimento. */
export const DUE_ALERT_PREFIX = "due:";

/** Vencimentos que avisam no sino: atrasados e os que vencem em até `DUE_SOON_DAYS` dias (o resto só aparece no Painel). */
export function getDueAlerts(data: DuesData, today: string): DueItem[] {
  return getUpcomingDues(data, today, DUE_SOON_DAYS).filter((d) => d.level !== "later");
}

/**
 * Tira de `seenAlerts` as chaves de vencimento de meses já antigos (mais de 3 meses atrás), para a lista não crescer
 * sem fim (a API aceita até 1000 chaves). As chaves de metas e investimentos ficam como estão.
 */
export function pruneSeenAlerts(keys: string[], today: string): string[] {
  const oldest = changeMonth(monthOf(today), -3);
  return keys.filter((k) => {
    if (!k.startsWith(DUE_ALERT_PREFIX)) return true;
    const month = k.match(/:(\d{4}-\d{2}):/)?.[1];
    return !month || month >= oldest;
  });
}
