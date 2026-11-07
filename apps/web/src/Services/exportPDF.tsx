import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_DISTRIBUTION, distributeBalance, getPeriodTotals, getReportRows, type ReportOptions } from "../domain";
import { formatBRL } from "../lib/money";
import { useFinanceStore } from "../Store/FinanceStore";
import { formatMonth, getToday } from "../Utils/Date";

const VIOLET: [number, number, number] = [91, 72, 232];
const SOFT: [number, number, number] = [243, 244, 251];

export interface PdfOptions extends ReportOptions {
  distribution: boolean;
}

type LastTable = { lastAutoTable: { finalY: number } };

/** Gera o PDF do período (lista de meses "YYYY-MM"). Com um só mês, mostra a sugestão de distribuição se pedida. */
export function exportPDF(months: string[], options: PdfOptions) {
  const doc = new jsPDF();
  const store = useFinanceStore.getState();
  const data = { transactions: store.transactions, creditTransactions: store.creditTransactions };
  const totals = getPeriodTotals(data, months);
  const multi = months.length > 1;
  const periodLabel = multi
    ? `${formatMonth(months[0])} a ${formatMonth(months[months.length - 1])}`
    : formatMonth(months[0]);

  // cabeçalho
  doc.setFillColor(...VIOLET);
  doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("AURORA", 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Relatório - ${periodLabel}`, 14, 28);
  doc.setTextColor(0, 0, 0);

  let y = 45;

  // cartões de total
  const card = (label: string, value: string, x: number) => {
    doc.setFillColor(...SOFT);
    doc.roundedRect(x, y, 55, 22, 3, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(label, x + 3, y + 7);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(value, x + 3, y + 15);
  };
  card("Receitas", formatBRL(totals.income), 14);
  card("Despesas", formatBRL(totals.expense), 74);
  card("Saldo", formatBRL(totals.balance), 134);
  y += 35;

  const table = (title: string, head: string[], body: string[][], right: number[] = []) => {
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text(title, 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [head],
      body,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: VIOLET, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: SOFT },
      columnStyles: Object.fromEntries(right.map((i) => [i, { halign: "right" as const }])),
      // o cabeçalho acompanha o alinhamento da coluna
      didParseCell: (cell) => {
        if (cell.section === "head" && right.includes(cell.column.index)) cell.cell.styles.halign = "right";
      },
    });
    y = (doc as unknown as LastTable).lastAutoTable.finalY + 10;
  };

  if (options.summary) {
    table(
      "Resumo por mês",
      ["Mês", "Receitas", "Despesas", "Saldo"],
      totals.months.map((m) => [formatMonth(m.month), formatBRL(m.totalIncome), formatBRL(m.totalExpense), formatBRL(m.balance)]),
      [1, 2, 3],
    );
  }

  if (options.distribution && !multi) {
    const balance = totals.months[0].balance;
    if (balance > 0) {
      const parts = distributeBalance(balance, store.distribution ?? DEFAULT_DISTRIBUTION).filter((p) => p.item.percent > 0);
      table(
        "Sugestão de distribuição do saldo",
        ["Destino", "%", "Valor"],
        parts.map((p) => [p.item.label, `${p.item.percent}%`, formatBRL(p.value)]),
        [1, 2],
      );
    } else {
      doc.setFontSize(11);
      doc.setTextColor(120);
      doc.text("Sem saldo disponível para distribuição", 14, y);
      doc.setTextColor(0);
      y += 10;
    }
  }

  if (options.entries || options.credit) {
    const rows = getReportRows(data, months, options);
    table(
      "Lançamentos",
      multi ? ["Mês", "Nome", "Categoria", "Tipo", "Valor"] : ["Nome", "Categoria", "Tipo", "Valor"],
      rows.map((r) => {
        const name = r.note ? `${r.name} (${r.note})` : r.name;
        const cells = [name, r.category, r.type, formatBRL(r.amount)];
        return multi ? [formatMonth(r.month), ...cells] : cells;
      }),
      [multi ? 4 : 3],
    );
  }

  // rodapé
  const h = doc.internal.pageSize.height;
  doc.setDrawColor(200);
  doc.line(14, h - 15, 196, h - 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${getToday()} • Aurora`, 14, h - 8);

  doc.save(`relatorio-${months[0]}${multi ? `_a_${months[months.length - 1]}` : ""}.pdf`);
}
