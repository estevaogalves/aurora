import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { niceTicks, shortReais } from "../components/charts/scale";
import { DEFAULT_DISTRIBUTION, distributeBalance, getPeriodTotals, getReportRows, type ReportOptions } from "../domain";
import { formatBRL } from "../lib/money";
import { useFinanceStore } from "../Store/FinanceStore";
import { categoryHex, hexToRgb } from "../Utils/categoryHex";
import { formatMonth, getToday } from "../Utils/Date";

export interface PdfOptions extends ReportOptions {
  distribution: boolean;
}

type RGB = [number, number, number];
type LastTable = { lastAutoTable: { finalY: number } };

/* Visual "Painel": cabeçalho escuro, cartões coloridos, barras e as cores das categorias. */
const INK: RGB = [13, 16, 23];
const TEXT: RGB = [17, 17, 17];
const GRAY: RGB = [102, 102, 102];
const SOFT_TEXT: RGB = [188, 196, 216];
const LINE: RGB = [227, 230, 242];
const VIOLET: RGB = [91, 72, 232];
const VIOLET_LIGHT: RGB = [142, 128, 255];
const CYAN: RGB = [79, 209, 224];
const TEAL: RGB = [15, 138, 160];
const GREEN: RGB = [14, 143, 115];
const RED: RGB = [214, 51, 90];
const DIST_COLORS = ["#5B48E8", "#0F8AA0", "#D69A12", "#D6335A", "#0E8F73", "#E0732A", "#3D74E8", "#B24BC4", "#8189A3"];

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BODY_TOP = 46;
const BODY_BOTTOM = PAGE_H - 22;

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
/** "2026-06" -> "Jun/26" */
const shortMonth = (month: string) => `${MONTH_ABBR[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`;

/** Gera o PDF do período (lista de meses "YYYY-MM"). Com um só mês, mostra a sugestão de distribuição se pedida. */
export function exportPDF(months: string[], options: PdfOptions) {
  const doc = new jsPDF();
  const store = useFinanceStore.getState();
  const data = { transactions: store.transactions, creditTransactions: store.creditTransactions };
  const totals = getPeriodTotals(data, months);
  const multi = months.length > 1;
  const periodLabel = multi ? `${formatMonth(months[0])} a ${formatMonth(months[months.length - 1])}` : formatMonth(months[0]);
  const hex = (category: string) => hexToRgb(categoryHex(category, store.customCategories));

  /* ---------- peças da página ---------- */
  const drawHeader = () => {
    doc.setFillColor(...INK);
    doc.rect(0, 0, PAGE_W, 34, "F");
    doc.setFillColor(...VIOLET_LIGHT);
    doc.roundedRect(MARGIN, 11, 11, 11, 3, 3, "F");
    doc.setFillColor(...CYAN);
    doc.roundedRect(MARGIN + 6.5, 17.5, 4.5, 4.5, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.setTextColor(255, 255, 255);
    doc.text("AURORA", MARGIN + 15, 20);
    doc.setFontSize(11);
    doc.text("Relatório financeiro", PAGE_W - MARGIN, 17, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SOFT_TEXT);
    doc.text(periodLabel, PAGE_W - MARGIN, 23, { align: "right" });
    doc.setTextColor(...TEXT);
  };

  const drawFooters = () => {
    const pages = doc.getNumberOfPages();
    for (let n = 1; n <= pages; n++) {
      doc.setPage(n);
      doc.setFillColor(...INK);
      doc.rect(0, PAGE_H - 12, PAGE_W, 12, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SOFT_TEXT);
      doc.text(`Gerado em ${getToday()} • Aurora`, MARGIN, PAGE_H - 4.5);
      doc.text(`Página ${n} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 4.5, { align: "right" });
    }
  };

  // páginas que já têm cabeçalho (o autoTable cria páginas por conta própria)
  const withHeader = new Set<number>([1]);
  drawHeader();
  let y = BODY_TOP;

  const currentPage = () => doc.getNumberOfPages();
  const newPage = () => {
    doc.addPage();
    withHeader.add(currentPage());
    drawHeader();
    y = BODY_TOP;
  };
  /** Garante `h` mm livres; senão começa outra página. */
  const ensure = (h: number) => {
    if (y + h > BODY_BOTTOM) newPage();
  };

  const section = (title: string, subtitle?: string) => {
    ensure(subtitle ? 18 : 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...TEXT);
    doc.text(title, MARGIN, y);
    y += 5;
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...GRAY);
      doc.text(subtitle, MARGIN, y);
      y += 5;
    }
    doc.setTextColor(...TEXT);
  };

  const tableDefaults = () => ({
    margin: { top: BODY_TOP, bottom: 20, left: MARGIN, right: MARGIN },
    theme: "plain" as const,
    styles: { fontSize: 9.5, cellPadding: { top: 2.6, bottom: 2.6, left: 1.5, right: 1.5 }, textColor: TEXT, lineWidth: 0 },
    headStyles: { fontSize: 8.5, textColor: GRAY, fontStyle: "bold" as const },
    willDrawPage: () => {
      if (!withHeader.has(currentPage())) {
        withHeader.add(currentPage());
        drawHeader();
      }
    },
    // linha fina embaixo de cada linha; mais grossa no cabeçalho
    didDrawCell: (cell: { section: string; cell: { x: number; y: number; width: number; height: number } }) => {
      const { x, y: cy, width, height } = cell.cell;
      doc.setDrawColor(...(cell.section === "head" ? INK : LINE));
      doc.setLineWidth(cell.section === "head" ? 0.5 : 0.2);
      doc.line(x, cy + height, x + width, cy + height);
    },
  });

  /* ---------- cartões de total ---------- */
  if (options.summary) {
    const tiles: [string, number, RGB][] = [
      ["Receitas", totals.income, TEAL],
      ["Despesas", totals.expense, VIOLET],
      ["Saldo", totals.balance, GREEN],
    ];
    const gap = 4;
    const w = (CONTENT_W - gap * 2) / 3;
    tiles.forEach(([label, value, color], i) => {
      const x = MARGIN + i * (w + gap);
      doc.setFillColor(...color);
      doc.roundedRect(x, y, w, 22, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(label, x + 4, y + 7.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.text(formatBRL(value), x + 4, y + 16);
    });
    doc.setTextColor(...TEXT);
    y += 22 + 10;

    /* ---------- gráfico: renda e despesas por mês ---------- */
    section("Renda e despesas por mês", multi ? "Os meses do período, lado a lado" : "O mês escolhido");
    const chartH = 50;
    const chartTop = y + 3;
    const axisW = 12;
    const plotX = MARGIN + axisW;
    const plotW = CONTENT_W - axisW;
    const maxReais = Math.max(...totals.months.flatMap((m) => [m.totalIncome, m.totalExpense]), 100) / 100;
    const ticks = niceTicks(maxReais);
    const yOf = (reais: number) => chartTop + chartH - (reais / ticks.top) * chartH;

    doc.setFontSize(7);
    for (let i = 0; i <= ticks.n; i++) {
      const v = i * ticks.step;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(plotX, yOf(v), plotX + plotW, yOf(v));
      doc.setTextColor(...GRAY);
      doc.text(shortReais(v), plotX - 2, yOf(v) + 1.2, { align: "right" });
    }

    const band = plotW / totals.months.length;
    const barW = Math.min(14, band * 0.28);
    totals.months.forEach((m, i) => {
      const center = plotX + band * i + band / 2;
      const bars: [number, RGB][] = [[m.totalIncome, CYAN], [m.totalExpense, VIOLET_LIGHT]];
      bars.forEach(([cents, color], j) => {
        const h = Math.max(0.6, (cents / 100 / ticks.top) * chartH);
        doc.setFillColor(...color);
        doc.roundedRect(center - barW - 0.4 + j * (barW + 0.8), chartTop + chartH - h, barW, h, 0.8, 0.8, "F");
      });
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(shortMonth(m.month), center, chartTop + chartH + 5, { align: "center" });
    });
    y = chartTop + chartH + 11;

    // legenda
    doc.setFontSize(8);
    [["Receitas", CYAN], ["Despesas", VIOLET_LIGHT]].forEach(([label, color], i) => {
      const x = MARGIN + i * 28;
      doc.setFillColor(...(color as RGB));
      doc.roundedRect(x, y - 2.6, 3, 3, 0.6, 0.6, "F");
      doc.setTextColor(...GRAY);
      doc.text(label as string, x + 5, y);
    });
    y += 9;

    /* ---------- resumo numérico por mês ---------- */
    ensure(14 + totals.months.length * 8);
    autoTable(doc, {
      ...tableDefaults(),
      startY: y,
      head: [["Mês", "Receitas", "Despesas", "Saldo"]],
      body: totals.months.map((m) => [formatMonth(m.month), formatBRL(m.totalIncome), formatBRL(m.totalExpense), formatBRL(m.balance)]),
      foot: multi ? [["Total", formatBRL(totals.income), formatBRL(totals.expense), formatBRL(totals.balance)]] : undefined,
      footStyles: { fontStyle: "bold", textColor: TEXT },
      showFoot: "lastPage",
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
      didParseCell: (c) => {
        if (c.section === "head" && c.column.index > 0) c.cell.styles.halign = "right";
        if (c.section === "foot" && c.column.index > 0) c.cell.styles.halign = "right";
        if (c.section === "body" && c.column.index === 3) c.cell.styles.textColor = totals.months[c.row.index].balance < 0 ? RED : GREEN;
      },
    });
    y = (doc as unknown as LastTable).lastAutoTable.finalY + 10;

    /* ---------- despesas por categoria ---------- */
    const cats = Object.entries(
      totals.months.reduce<Record<string, number>>((acc, m) => {
        for (const [c, v] of Object.entries(m.byCategory)) acc[c] = (acc[c] ?? 0) + (v ?? 0);
        return acc;
      }, {}),
    )
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    if (cats.length > 0) {
      ensure(18 + cats.length * 9); // o bloco inteiro cabe junto ou vai para a próxima página
      section("Despesas por categoria", `Total de ${formatBRL(totals.expense)} no período`);
      const labelW = 44;
      const valueW = 34;
      const barArea = CONTENT_W - labelW - valueW;
      const top = cats[0][1];
      for (const [name, value] of cats) {
        ensure(9);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...TEXT);
        doc.text(name, MARGIN, y + 3.2, { maxWidth: labelW - 2 });
        doc.setFillColor(...hex(name));
        doc.roundedRect(MARGIN + labelW, y, Math.max(1.5, (value / top) * barArea), 4.2, 2.1, 2.1, "F");
        doc.setFont("helvetica", "bold");
        doc.text(formatBRL(value), PAGE_W - MARGIN, y + 3.2, { align: "right" });
        y += 9;
      }
      y += 4;
    }
  }

  /* ---------- sugestão de distribuição (um mês só) ---------- */
  if (options.distribution && !multi) {
    const balance = totals.months[0].balance;
    if (balance > 0) {
      const parts = distributeBalance(balance, store.distribution ?? DEFAULT_DISTRIBUTION).filter((p) => p.item.percent > 0);
      ensure(24 + parts.length * 9);
      section("Sugestão de distribuição do saldo", `Saldo de ${formatMonth(months[0])}: ${formatBRL(balance)}`);
      let x = MARGIN;
      parts.forEach((p, i) => {
        const w = (CONTENT_W * p.item.percent) / 100;
        doc.setFillColor(...hexToRgb(DIST_COLORS[i % DIST_COLORS.length]));
        doc.rect(x, y, Math.max(w - 0.6, 0.6), 5, "F");
        x += w;
      });
      y += 11;
      parts.forEach((p, i) => {
        ensure(9);
        doc.setFillColor(...hexToRgb(DIST_COLORS[i % DIST_COLORS.length]));
        doc.roundedRect(MARGIN + 1, y - 2.6, 3, 3, 0.6, 0.6, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...TEXT);
        doc.text(p.item.label, MARGIN + 7, y);
        doc.setTextColor(...GRAY);
        doc.text(`${p.item.percent}%`, PAGE_W - MARGIN - 40, y, { align: "right" });
        doc.setTextColor(...TEXT);
        doc.setFont("helvetica", "bold");
        doc.text(formatBRL(p.value), PAGE_W - MARGIN, y, { align: "right" });
        y += 7.5;
      });
      y += 6;
    } else {
      ensure(12);
      doc.setFontSize(10);
      doc.setTextColor(...GRAY);
      doc.text("Sem saldo disponível para distribuição.", MARGIN, y);
      doc.setTextColor(...TEXT);
      y += 10;
    }
  }

  /* ---------- lançamentos ---------- */
  if (options.entries || options.credit) {
    const rows = getReportRows(data, months, options);
    if (rows.length > 0) {
      if (y > BODY_TOP + 2) newPage();
      section("Lançamentos", "Receitas em verde, despesas em vermelho");
      const dotCol = multi ? 2 : 1;
      autoTable(doc, {
        ...tableDefaults(),
        startY: y,
        head: [multi ? ["Mês", "Nome", "Categoria", "Valor"] : ["Nome", "Categoria", "Valor"]],
        body: rows.map((r) => {
          const name = r.note ? `${r.name} (${r.note})` : r.name;
          const cells = [name, r.category, formatBRL(r.amount)];
          return multi ? [formatMonth(r.month), ...cells] : cells;
        }),
        columnStyles: {
          [dotCol]: { cellPadding: { top: 2.6, bottom: 2.6, left: 6, right: 1.5 } },
          [multi ? 3 : 2]: { halign: "right", fontStyle: "bold" },
        },
        didParseCell: (c) => {
          const last = multi ? 3 : 2;
          if (c.section === "head" && c.column.index === last) c.cell.styles.halign = "right";
          if (c.section === "body" && c.column.index === last) c.cell.styles.textColor = rows[c.row.index].type === "Receita" ? GREEN : RED;
        },
        didDrawCell: (c) => {
          tableDefaults().didDrawCell(c);
          // quadradinho com a cor da categoria
          if (c.section === "body" && c.column.index === dotCol) {
            doc.setFillColor(...hex(rows[c.row.index].category));
            doc.roundedRect(c.cell.x + 1.5, c.cell.y + c.cell.height / 2 - 1.5, 3, 3, 0.6, 0.6, "F");
          }
        },
      });
    }
  }

  drawFooters();
  doc.save(`relatorio-${months[0]}${multi ? `_a_${months[months.length - 1]}` : ""}.pdf`);
}
