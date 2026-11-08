import { CREDIT_CATEGORY, getMonthSummary } from "./summary";
import { getCreditByMonth } from "./credit";
import { getTransactionsByMonth } from "./transactions";
import { getMonthsBetween, changeMonth, formatMonth } from "../Utils/Date";
import { formatBRL } from "../lib/money";
import type { Category } from "../Types/Category";
import type { FinanceData, Month, MonthSummary } from "./types";

type Source = Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses">>;

/** Os `count` meses terminando em `end` (inclusive), do mais antigo ao mais novo. */
export function lastMonths(end: Month, count: number): Month[] {
  return getMonthsBetween(changeMonth(end, -(count - 1)), end);
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
  credit: boolean;
}

export interface ReportRow {
  month: Month;
  name: string;
  category: string;
  type: "Receita" | "Despesa";
  /** centavos */
  amount: number;
  note: string;
}

/** Lançamentos do período, com as parcelas do crédito como despesas. */
export function getReportRows(data: Source, months: Month[], options: Pick<ReportOptions, "entries" | "credit">): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const month of months) {
    if (options.entries) {
      for (const t of getTransactionsByMonth(data.transactions, month)) {
        rows.push({
          month,
          name: t.name,
          category: t.category,
          type: t.type === "income" ? "Receita" : "Despesa",
          amount: t.amount,
          note: t.fixed ? "Fixa" : "",
        });
      }
    }
    if (options.entries) {
      for (const e of data.extraExpenses ?? []) {
        if (e.month === month) rows.push({ month, name: e.name, category: "Outros", type: "Despesa", amount: e.amount, note: "Despesa extra" });
      }
    }
    if (options.credit) {
      for (const c of getCreditByMonth(data.creditTransactions, month)) {
        rows.push({
          month,
          name: c.name,
          category: CREDIT_CATEGORY,
          type: "Despesa",
          amount: c.installmentValue,
          note: `Parcela ${c.currentInstallment}/${c.installments}`,
        });
      }
    }
  }
  return rows;
}

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
    lines.push(["Mês", "Nome", "Categoria", "Tipo", "Valor", "Observação"].join(";"));
    for (const r of getReportRows(data, months, options)) {
      lines.push([r.month, csvCell(r.name), csvCell(r.category), r.type, reais(r.amount), csvCell(r.note)].join(";"));
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** Texto simples, bom para colar em mensagem ou nota. */
export function buildTxt(data: Source, months: Month[], options: ReportOptions): string {
  const lines: string[] = ["AURORA · Relatório financeiro", `Período: ${formatMonth(months[0])} a ${formatMonth(months[months.length - 1])}`, ""];

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
      lines.push(`${r.month} · ${r.type} · ${r.name} (${r.category}${r.note ? `, ${r.note}` : ""}): ${formatBRL(r.amount)}`);
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
