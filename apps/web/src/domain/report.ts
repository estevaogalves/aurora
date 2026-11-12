import { creditCategoryOf, getMonthSummary } from "./summary";
import { getCreditByMonth } from "./credit";
import { cardPaymentOf, dayMonth, getCardInvoice, isCardPurchase, resolveCardExpenses, resolveCredits } from "./invoice";
import { getTransactionsByMonth } from "./transactions";
import { formatPaymentDate, formatPaymentDay, paymentMethodLabel, paymentOf, paymentStatusLabel } from "./payment";
import { getMonthsBetween, changeMonth, compareMonths, formatMonth, formatMonthAbbr } from "../Utils/Date";
import { formatBRL } from "../lib/money";
import type { Category } from "../Types/Category";
import type { FinanceData, Month, MonthSummary, Payment } from "./types";

type Source = Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>;

/** Os `count` meses terminando em `end` (inclusive), do mais antigo ao mais novo. */
export function lastMonths(end: Month, count: number): Month[] {
  return getMonthsBetween(changeMonth(end, -(count - 1)), end);
}

/** Meses sem repetição, do mais antigo ao mais novo. */
export const sortMonths = (months: Month[]): Month[] => [...new Set(months)].sort(compareMonths);

/** Os meses são seguidos, sem pular nenhum? */
const isContiguous = (months: Month[]) => months.every((m, i) => i === 0 || m === changeMonth(months[i - 1], 1));

/**
 * Texto do período para títulos: "novembro de 2026" (um mês), "setembro de 2026 a novembro de 2026" (meses
 * seguidos) ou "Set/26, Nov/26 e Dez/26" (meses soltos; com mais de 6, só o primeiro, o último e a contagem).
 */
export function formatPeriodLabel(months: Month[]): string {
  const m = sortMonths(months);
  if (m.length === 0) return "";
  if (m.length === 1) return formatMonth(m[0]);
  if (isContiguous(m)) return `${formatMonth(m[0])} a ${formatMonth(m[m.length - 1])}`;
  const short = (x: Month) => `${formatMonthAbbr(x)}/${x.slice(2, 4)}`;
  if (m.length > 6) return `${short(m[0])} a ${short(m[m.length - 1])} (${m.length} meses escolhidos)`;
  return `${m.slice(0, -1).map(short).join(", ")} e ${short(m[m.length - 1])}`;
}

/** Nome do arquivo (sem extensão): "relatorio-2026-11", "relatorio-2026-09_a_2026-11" ou, com meses soltos, os meses. */
export function periodFileName(months: Month[]): string {
  const m = sortMonths(months);
  if (m.length <= 1) return `relatorio-${m[0] ?? ""}`;
  if (isContiguous(m)) return `relatorio-${m[0]}_a_${m[m.length - 1]}`;
  return m.length <= 4 ? `relatorio-${m.join("_")}` : `relatorio-${m[0]}_a_${m[m.length - 1]}_${m.length}-meses`;
}

export interface PeriodTotals {
  months: MonthSummary[];
  income: number;
  expense: number;
  balance: number;
  /** categoria com mais gasto no período, ou null se não há despesa */
  topCategory: { category: Category; value: number } | null;
}

export function getPeriodTotals(data: Source, months: Month[]): PeriodTotals {
  const summaries = months.map((m) => getMonthSummary(data, m));
  const byCategory: Partial<Record<Category, number>> = {};
  for (const s of summaries) {
    for (const [c, v] of Object.entries(s.byCategory) as [Category, number][]) {
      byCategory[c] = (byCategory[c] ?? 0) + v;
    }
  }
  const top = (Object.entries(byCategory) as [Category, number][]).sort((a, b) => b[1] - a[1])[0];
  const income = summaries.reduce((s, m) => s + m.totalIncome, 0);
  const expense = summaries.reduce((s, m) => s + m.totalExpense, 0);

  return {
    months: summaries,
    income,
    expense,
    balance: income - expense,
    topCategory: top ? { category: top[0], value: top[1] } : null,
  };
}

export interface ReportOptions {
  summary: boolean;
  entries: boolean;
  /** parcelas e recorrências em linhas próprias; no app, elas vão dentro das faturas e isto fica desligado */
  credit?: boolean;
  /** faturas dos cartões: parcelas, recorrências, compras avulsas e o ajuste de cada uma (visão agrupada: não soma nada) */
  invoices?: boolean;
}

export interface ReportRow {
  month: Month;
  /** de onde vem a linha: lançamento (renda, despesa, despesa extra) ou parcela/recorrência do crédito */
  source: "entry" | "credit";
  name: string;
  category: string;
  type: "Receita" | "Despesa";
  /** centavos */
  amount: number;
  note: string;
  /** despesa paga (só informação: não muda nenhum total) */
  payment?: Payment;
}

/** Rótulo curto do selo, como em Lançamentos: "Paga · Pix · 08/11" ou "Agendada · Boleto · 15/11". */
export const describePaidBadge = (p: Payment): string => `${paymentStatusLabel(p)} · ${paymentMethodLabel(p.method)} · ${formatPaymentDay(p.date)}`;

/** "Paga · Pix · 08/11/2026" ou "Agendada · Boleto · 15/11/2026" (com a observação, se houver), para PDF e texto. */
export function describePaidRow(p: Payment): string {
  return `${paymentStatusLabel(p)} · ${paymentMethodLabel(p.method)} · ${formatPaymentDate(p.date)}${p.notes ? ` — ${p.notes}` : ""}`;
}

/** Lançamentos do período, com as parcelas do crédito como despesas. */
export function getReportRows(data: Source, months: Month[], options: Pick<ReportOptions, "entries" | "credit" | "invoices">): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const month of months) {
    if (options.entries) {
      for (const t of getTransactionsByMonth(resolveCardExpenses(data.transactions, data.creditCards), month)) {
        // com as faturas no relatório, a compra no cartão aparece só dentro da fatura
        if (options.invoices && isCardPurchase(t)) continue;
        rows.push({
          month,
          source: "entry",
          name: t.name,
          category: t.category,
          type: t.type === "income" ? "Receita" : "Despesa",
          amount: t.amount,
          note: t.fixed ? "Fixa" : "",
          payment: t.type === "expense" ? paymentOf(t, month) : undefined,
        });
      }
    }
    if (options.entries) {
      for (const e of resolveCardExpenses(data.extraExpenses ?? [], data.creditCards)) {
        if (e.month === month && !(options.invoices && isCardPurchase(e))) rows.push({ month, source: "entry", name: e.name, category: "Outros", type: "Despesa", amount: e.amount, note: "Despesa extra", payment: e.payment });
      }
    }
    if (options.credit) {
      for (const c of getCreditByMonth(resolveCredits(data.creditTransactions, data.creditCards), month)) {
        rows.push({
          month,
          source: "credit",
          name: c.name,
          category: creditCategoryOf(c),
          type: "Despesa",
          amount: c.installmentValue,
          note: c.recurring
            ? "Recorrente no cartão"
            : c.advanced
            ? `Parcela ${c.currentInstallment}/${c.installments} adiantada, original em ${formatMonth(c.advanced.originalMonth)}, desconto ${formatBRL(c.advanced.discount)}`
            : `Parcela ${c.currentInstallment}/${c.installments}`,
        });
      }
    }
  }
  return rows;
}

/* ---------- faturas dos cartões ---------- */

export interface ReportInvoiceItem {
  kind: "installment" | "recurring" | "purchase" | "adjustment";
  /** "TV (parcela 1/3)", "Streaming (recorrente)", "01/11 · Padaria", "20/11 · Viagem (despesa extra)" */
  description: string;
  /** centavos (negativo no desconto) */
  amount: number;
  /** só nas compras avulsas: dia da compra, "AAAA-MM-DD" */
  purchaseDate?: string;
}

/** Uma fatura no relatório: o cartão, o mês do vencimento, o total e o que há dentro dela. */
export interface ReportInvoice {
  /** mês do vencimento (o mês em que o valor é contabilizado) */
  month: Month;
  cardName: string;
  /** "AAAA-MM-DD" */
  closingDate: string;
  dueDate: string;
  /** centavos: o total a pagar da fatura (parcelas + recorrências + compras avulsas + o ajuste), igual à soma dos itens */
  total: number;
  limit: number | null;
  overLimit: boolean;
  /** pagamento da fatura (só registro) */
  payment?: Payment;
  /** parcelas, depois recorrências, depois compras avulsas (pelo dia da compra) */
  items: ReportInvoiceItem[];
}

/**
 * Faturas dos cartões com movimento nos meses do período (ou já pagas). É só uma visão agrupada dos lançamentos que
 * já estão nos totais do período: nenhum valor daqui é somado de novo.
 */
export function getReportInvoices(data: Source, months: Month[]): ReportInvoice[] {
  const out: ReportInvoice[] = [];
  const credits = (month: Month) => getCreditByMonth(resolveCredits(data.creditTransactions, data.creditCards), month);
  const installmentItems = (list: ReturnType<typeof credits>): ReportInvoiceItem[] => [
    ...list.filter((c) => !c.recurring).map((c): ReportInvoiceItem => ({
      kind: "installment",
      description: `${c.name} (parcela ${c.currentInstallment}/${c.installments}${c.advanced ? ", adiantada" : ""})`,
      amount: c.installmentValue,
    })),
    ...list.filter((c) => c.recurring).map((c): ReportInvoiceItem => ({ kind: "recurring", description: `${c.name} (recorrente)`, amount: c.installmentValue })),
  ];
  for (const month of months) {
    for (const card of data.creditCards ?? []) {
      const inv = getCardInvoice(data, card, month);
      const payment = cardPaymentOf(card, month);
      if (inv.total === 0 && !payment && inv.adjustmentApplied === 0) continue;
      const listed = inv.adjustments.reduce((s, a) => s + a.amount, 0);
      const items: ReportInvoiceItem[] = [
        ...installmentItems([...inv.installments, ...inv.recurring]),
        ...inv.purchases.map((p): ReportInvoiceItem => ({
          kind: "purchase",
          description: `${dayMonth(p.purchaseDate)} · ${p.name}${p.source === "extra" ? " (despesa extra)" : ""}`,
          amount: p.amount,
          purchaseDate: p.purchaseDate,
        })),
        ...inv.adjustments.map((a): ReportInvoiceItem => ({ kind: "adjustment", description: `${a.amount < 0 ? "Desconto" : "Acréscimo"}${a.note ? ` · ${a.note}` : ""}`, amount: a.amount })),
        // o desconto nunca passa do total das compras: a diferença aparece, para a soma das linhas bater com o total
        ...(inv.adjustmentApplied !== listed ? [{ kind: "adjustment" as const, description: "Limite: o desconto não passa do total das compras", amount: inv.adjustmentApplied - listed }] : []),
      ];
      out.push({ month, cardName: card.name, closingDate: inv.closingDate, dueDate: inv.dueDate, total: inv.payable, limit: inv.limit, overLimit: inv.overLimit, payment, items });
    }
    // parcelas e recorrências sem cartão cadastrado também precisam aparecer: ficam num grupo à parte
    const cardIds = new Set((data.creditCards ?? []).map((k) => k.id));
    const cardOf = new Map(data.creditTransactions.map((c) => [c.id, c.cardId]));
    const loose = credits(month).filter((c) => !cardIds.has(cardOf.get(c.id) ?? ""));
    if (loose.length > 0) {
      const items = installmentItems(loose);
      out.push({ month, cardName: NO_CARD_NAME, closingDate: "", dueDate: "", total: items.reduce((s, i) => s + i.amount, 0), limit: null, overLimit: false, items });
    }
  }
  return out;
}

/** Nome do grupo das parcelas e recorrências que não estão ligadas a nenhum cartão cadastrado. */
export const NO_CARD_NAME = "Sem cartão";

/** "Fatura Nubank" */
export const invoiceTitle = (i: Pick<ReportInvoice, "cardName">) => (i.cardName === NO_CARD_NAME ? "Parcelas sem cartão" : `Fatura ${i.cardName}`);

/**
 * Injeção de fórmula (CSV injection): o Excel/LibreOffice executam como fórmula uma célula de texto que começa com
 * `=`, `+`, `-` ou `@` (ou com TAB/CR, e também após espaços). Um nome de lançamento como `=HYPERLINK(...)` viraria
 * um link ou comando ao abrir a planilha. A defesa padrão (OWASP) é prefixar uma aspa simples, que torna a célula
 * texto. Vale só para texto do usuário (nome, categoria, observação); valores numéricos como `-800,00` não passam aqui.
 */
const FORMULA_START = /^[\t\r ]*[=+\-@]|^[\t\r]/;
export const neutralizeFormula = (value: string) => (FORMULA_START.test(value) ? `'${value}` : value);

const csvCell = (raw: string) => {
  const value = neutralizeFormula(raw);
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};
const reais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** CSV com ponto e vírgula e vírgula decimal (abre direto no Excel em português). */
export function buildCsv(data: Source, months: Month[], options: ReportOptions): string {
  const lines: string[] = [];

  if (options.summary) {
    lines.push("Resumo");
    lines.push(["Mês", "Renda", "Despesas", "Saldo"].join(";"));
    for (const s of getPeriodTotals(data, months).months) {
      lines.push([s.month, reais(s.totalIncome), reais(s.totalExpense), reais(s.balance)].join(";"));
    }
    lines.push("");
  }

  if (options.entries || options.credit) {
    lines.push("Lançamentos");
    lines.push(["Mês", "Nome", "Categoria", "Tipo", "Valor", "Observação", "Situação", "Pagamento", "Data do pagamento", "Obs. do pagamento"].join(";"));
    for (const r of getReportRows(data, months, options)) {
      const p = r.payment;
      lines.push([
        r.month, csvCell(r.name), csvCell(r.category), r.type, reais(r.amount), csvCell(r.note),
        p ? paymentStatusLabel(p) : "", p ? paymentMethodLabel(p.method) : "", p ? formatPaymentDate(p.date) : "", p ? csvCell(p.notes ?? "") : "",
      ].join(";"));
    }
  }

  if (options.invoices) {
    const invoices = getReportInvoices(data, months);
    if (invoices.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("Faturas dos cartões");
      lines.push(["Mês", "Cartão", "Fechamento", "Vencimento", "Tipo", "Descrição", "Data da compra", "Valor", "Situação", "Pagamento", "Data do pagamento", "Obs. do pagamento"].join(";"));
      for (const i of invoices) {
        const p = i.payment;
        // a primeira linha de cada fatura é o total; as seguintes, a descrição dos gastos
        lines.push([
          i.month, csvCell(i.cardName), i.closingDate, i.dueDate, "Fatura", csvCell(invoiceTitle(i)), "", reais(i.total),
          p ? paymentStatusLabel(p) : "", p ? paymentMethodLabel(p.method) : "", p ? formatPaymentDate(p.date) : "", p ? csvCell(p.notes ?? "") : "",
        ].join(";"));
        for (const it of i.items) {
          const kind = it.kind === "installment" ? "Parcela" : it.kind === "recurring" ? "Recorrente" : it.kind === "adjustment" ? "Ajuste" : "Compra avulsa";
          lines.push([i.month, csvCell(i.cardName), "", "", kind, csvCell(it.description), it.purchaseDate ?? "", reais(it.amount), "", "", "", ""].join(";"));
        }
      }
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** Texto simples, bom para colar em mensagem ou nota. */
export function buildTxt(data: Source, months: Month[], options: ReportOptions): string {
  const lines: string[] = ["AURORA · Relatório financeiro", `Período: ${formatPeriodLabel(months)}`, ""];

  if (options.summary) {
    const t = getPeriodTotals(data, months);
    lines.push("RESUMO");
    for (const s of t.months) {
      lines.push(`${formatMonth(s.month)}: renda ${formatBRL(s.totalIncome)} | despesas ${formatBRL(s.totalExpense)} | saldo ${formatBRL(s.balance)}`);
    }
    lines.push(`Total: renda ${formatBRL(t.income)} | despesas ${formatBRL(t.expense)} | saldo ${formatBRL(t.balance)}`, "");
  }

  if (options.entries || options.credit) {
    lines.push("LANÇAMENTOS");
    for (const r of getReportRows(data, months, options)) {
      lines.push(`${r.month} · ${r.type} · ${r.name} (${r.category}${r.note ? `, ${r.note}` : ""}): ${formatBRL(r.amount)}${r.payment ? ` [${describePaidRow(r.payment)}]` : ""}`);
    }
  }

  if (options.invoices) {
    const invoices = getReportInvoices(data, months);
    if (invoices.length > 0) {
      lines.push("", "FATURAS DOS CARTÕES");
      for (const i of invoices) {
        lines.push(`${invoiceTitle(i)} · ${formatMonth(i.month)}${i.dueDate ? ` · fecha ${dayMonth(i.closingDate)} · vence ${formatPaymentDate(i.dueDate)}` : ""}: ${formatBRL(i.total)}${i.payment ? ` [${describePaidRow(i.payment)}]` : ""}`);
        for (const it of i.items) lines.push(`  - ${it.description}: ${formatBRL(it.amount)}`);
      }
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
