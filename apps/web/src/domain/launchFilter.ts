import type { Payment, PaymentMethod } from "./types";
import { isScheduled } from "./payment";

/**
 * Busca e filtros da tela Lançamentos. Mudam só o que a lista mostra: os totais oficiais do mês (Painel, Projeção,
 * Comparação e os totais no rodapé dos cards) nunca são recalculados por causa de um filtro.
 */
export interface LaunchFilter {
  /** texto procurado no nome, na observação, na categoria e nas tags (sem acento nem maiúscula) */
  text: string;
  /** "" = todas */
  category: string;
  /** só vale para despesas: paga (ou boleto agendado) ou pendente */
  status: "all" | "paid" | "pending";
  /** só vale para despesas: forma de pagamento registrada; "" = qualquer */
  method: "" | PaymentMethod;
  /** faixa de valor em centavos; null = sem limite */
  min: number | null;
  max: number | null;
  /** "" = qualquer tag */
  tag: string;
}

export const EMPTY_FILTER: LaunchFilter = { text: "", category: "", status: "all", method: "", min: null, max: null, tag: "" };

export const isFilterActive = (f: LaunchFilter) =>
  f.text.trim() !== "" || f.category !== "" || f.status !== "all" || f.method !== "" || f.min !== null || f.max !== null || f.tag !== "";

/** O que um lançamento precisa ter para ser filtrado. */
export interface Filterable {
  name: string;
  notes?: string;
  category: string;
  /** centavos (o valor do mês visto) */
  amount: number;
  tags?: string[];
  /** pagamento do mês visto, se houver (despesas) */
  payment?: Payment;
}

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** O lançamento passa no filtro? `kind`: rendas ignoram status e forma de pagamento (não têm pagamento). */
export function matchesFilter(item: Filterable, f: LaunchFilter, kind: "income" | "expense"): boolean {
  const text = plain(f.text);
  if (text) {
    const haystack = plain([item.name, item.notes ?? "", item.category, ...(item.tags ?? [])].join(" "));
    if (!haystack.includes(text)) return false;
  }
  if (f.category && item.category !== f.category) return false;
  if (f.min !== null && item.amount < f.min) return false;
  if (f.max !== null && item.amount > f.max) return false;
  if (f.tag && !(item.tags ?? []).some((t) => plain(t) === plain(f.tag))) return false;
  if (kind === "expense") {
    // "paga" = tem pagamento registrado (o boleto agendado conta como registrado, como em "Próximos vencimentos")
    const paid = !!item.payment;
    if (f.status === "paid" && !paid) return false;
    if (f.status === "pending" && paid) return false;
    if (f.method && item.payment?.method !== f.method) return false;
  }
  return true;
}

/** Resumo do que o filtro deixou passar: quantos e quanto, separando despesas e rendas. */
export function summarizeFiltered(expenses: Filterable[], incomes: Filterable[]) {
  return {
    count: expenses.length + incomes.length,
    expense: expenses.reduce((s, x) => s + x.amount, 0),
    income: incomes.reduce((s, x) => s + x.amount, 0),
  };
}

/** Status de pagamento para a lista ("scheduled" só para boleto com data futura). */
export const paymentStatus = (p: Payment | undefined): "none" | "scheduled" | "paid" => (!p ? "none" : isScheduled(p) ? "scheduled" : "paid");
