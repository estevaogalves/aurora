import { formatBRL } from "../lib/money";
import { changeMonth, getMonthName } from "../Utils/Date";
import { getGoalAlerts } from "./goals";
import { resolveCardExpenses, resolveCredits } from "./invoice";
import { getCreditByMonth } from "./credit";
import { getMonthSummary, getProjection } from "./summary";
import { getTransactionsByMonth } from "./transactions";
import type { FinanceData, Month } from "./types";

/**
 * Insights automáticos do Painel: frases curtas geradas por regras sobre o que o usuário já cadastrou (sem IA,
 * sem enviar nada para fora). Texto neutro: descreve o que mudou, sem julgar nem recomendar.
 */
export type InsightData = Pick<FinanceData, "transactions" | "creditTransactions" | "goals"> & Partial<Pick<FinanceData, "creditCards" | "extraExpenses">>;

export interface Insight {
  /** identifica o insight naquele mês, para dispensá-lo (ex.: "cat:Alimentação:2026-11") */
  id: string;
  text: string;
  /** tela relacionada */
  to: "/comparacao" | "/projecao" | "/metas" | "/lancamentos";
}

/** Variação mínima de uma categoria (vs mês anterior) para virar insight. */
export const CATEGORY_CHANGE_MIN = 0.2;
/** Diferença mínima, em valor, para a variação de categoria não ser ruído (R$ 50). */
export const CATEGORY_CHANGE_MIN_CENTS = 5000;
/** Despesa nova só conta se passar desta fração da renda do mês. */
export const NEW_EXPENSE_MIN_SHARE = 0.1;
/** Diferença mínima, em pontos percentuais, entre o saldo do mês e a média dos anteriores. */
export const SAVINGS_MIN_POINTS = 5;
/** Quantos meses anteriores entram na média. */
export const HISTORY_MONTHS = 3;
/** No máximo, quantos insights aparecem de uma vez. */
export const MAX_INSIGHTS = 3;

const pct = (n: number) => `${Math.round(n)}%`;
const monthName = (m: Month) => getMonthName(m).toLowerCase();

/** Gera os insights do mês visto. Vazio se não houver pelo menos 2 meses com movimentação (o visto e um dos anteriores). */
export function getInsights(data: InsightData, month: Month, today: Month): Insight[] {
  const base = { transactions: data.transactions, creditTransactions: data.creditTransactions, creditCards: data.creditCards, extraExpenses: data.extraExpenses };
  const current = getMonthSummary(base, month);
  const previous = Array.from({ length: HISTORY_MONTHS }, (_, i) => getMonthSummary(base, changeMonth(month, -(i + 1))));
  const hasData = (s: { totalIncome: number; totalExpense: number }) => s.totalIncome > 0 || s.totalExpense > 0;
  const withData = previous.filter(hasData);
  if (!hasData(current) || withData.length === 0) return [];

  const out: Insight[] = [];

  // 1) mês futuro apertado (usa a Projeção: itens fixos, parcelas e extras já previstos)
  const projection = getProjection(base, data.extraExpenses ?? [], month, 6);
  const tight = projection.find((p) => p.month >= today && p.balance < 0 && p.income > 0);
  if (tight) {
    out.push({ id: `tight:${tight.month}`, to: "/projecao", text: `A projeção de ${monthName(tight.month)} mostra saldo negativo (${formatBRL(tight.balance)}) com o que já está previsto.` });
  }

  // 2) metas: prazo vencido ou aporte mensal que não fecha no prazo; em dia
  for (const a of getGoalAlerts(data.goals, today)) {
    if (a.level === "overdue") out.push({ id: `goal-late:${a.goal.id}:${a.goal.deadline}`, to: "/metas", text: `A meta “${a.goal.name}” passou do prazo e faltam ${formatBRL(a.remaining)}.` });
    else if (!a.onTrack && a.goal.monthly > 0) out.push({ id: `goal-slow:${a.goal.id}:${a.goal.deadline}`, to: "/metas", text: `Na meta “${a.goal.name}”, o aporte de ${formatBRL(a.goal.monthly)} por mês não cobre o que falta até o prazo (seriam ${formatBRL(a.neededPerMonth)}).` });
    else if (a.onTrack) out.push({ id: `goal-ok:${a.goal.id}:${a.goal.deadline}`, to: "/metas", text: `A meta “${a.goal.name}” está no ritmo para o prazo.` });
  }

  // 3) categoria que mais subiu ou caiu mais de 20% vs o mês anterior
  const last = previous[0];
  if (hasData(last)) {
    let best: { category: string; from: number; to: number; change: number } | null = null;
    for (const category of new Set([...Object.keys(current.byCategory), ...Object.keys(last.byCategory)])) {
      const to = current.byCategory[category as keyof typeof current.byCategory] ?? 0;
      const from = last.byCategory[category as keyof typeof last.byCategory] ?? 0;
      if (from <= 0 || Math.abs(to - from) < CATEGORY_CHANGE_MIN_CENTS) continue;
      const change = (to - from) / from;
      if (Math.abs(change) < CATEGORY_CHANGE_MIN) continue;
      if (!best || Math.abs(to - from) > Math.abs(best.to - best.from)) best = { category, from, to, change };
    }
    if (best) {
      out.push({
        id: `cat:${best.category}:${month}`,
        to: "/comparacao",
        text: `${best.category} ${best.change > 0 ? "subiu" : "caiu"} ${pct(Math.abs(best.change) * 100)} em relação a ${monthName(changeMonth(month, -1))} (de ${formatBRL(best.from)} para ${formatBRL(best.to)}).`,
      });
    }
  }

  // 4) despesa nova e relevante (mais de 10% da renda e que não aparecia no mês anterior)
  if (current.totalIncome > 0) {
    const limit = current.totalIncome * NEW_EXPENSE_MIN_SHARE;
    const namesBefore = new Set(
      getTransactionsByMonth(resolveCardExpenses(data.transactions, data.creditCards), changeMonth(month, -1)).map((t) => t.name.trim().toLowerCase()),
    );
    const creditNow = getCreditByMonth(resolveCredits(data.creditTransactions, data.creditCards), month);
    const candidates = [
      ...getTransactionsByMonth(resolveCardExpenses(data.transactions, data.creditCards), month)
        .filter((t) => t.type === "expense" && !t.fixed && !namesBefore.has(t.name.trim().toLowerCase()))
        .map((t) => ({ name: t.name, amount: t.amount })),
      ...creditNow.filter((c) => c.currentInstallment === 1 && !c.recurring).map((c) => ({ name: c.name, amount: c.installmentValue })),
    ].filter((x) => x.amount > limit);
    const top = candidates.sort((a, b) => b.amount - a.amount)[0];
    if (top) out.push({ id: `new:${top.name.trim().toLowerCase()}:${month}`, to: "/lancamentos", text: `“${top.name}” é uma despesa nova neste mês e equivale a ${pct((top.amount / current.totalIncome) * 100)} da renda (${formatBRL(top.amount)}).` });
  }

  // 5) saldo do mês, em % da renda, vs a média dos meses anteriores com renda
  const rates = withData.filter((s) => s.totalIncome > 0).map((s) => (s.balance / s.totalIncome) * 100);
  if (current.totalIncome > 0 && rates.length > 0) {
    const now = (current.balance / current.totalIncome) * 100;
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    if (Math.abs(now - avg) >= SAVINGS_MIN_POINTS) {
      out.push({ id: `rate:${month}`, to: "/comparacao", text: `O saldo do mês equivale a ${pct(now)} da renda; a média dos ${rates.length === 1 ? "mês anterior" : `${rates.length} meses anteriores`} foi ${pct(avg)}.` });
    }
  }

  return out;
}

/** Tira os dispensados e limita a `MAX_INSIGHTS`, na ordem de prioridade. */
export function visibleInsights(all: Insight[], dismissed: string[]): Insight[] {
  const hidden = new Set(dismissed);
  return all.filter((i) => !hidden.has(i.id)).slice(0, MAX_INSIGHTS);
}
