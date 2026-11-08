import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { niceTicks, shortReais } from "../components/charts/scale";
import { DEFAULT_DISTRIBUTION, describePaidBadge, distributeBalance, isScheduled, getPeriodTotals, getReportRows, type Payment, type ReportOptions } from "../domain";
import { formatBRL } from "../lib/money";
import { useFinanceStore } from "../Store/FinanceStore";
import { categoryHex, hexToRgb } from "../Utils/categoryHex";
import { formatMonth, formatMonthTitle, getToday } from "../Utils/Date";

export interface PdfOptions extends ReportOptions {
  distribution: boolean;
}

type RGB = [number, number, number];
type LastTable = { lastAutoTable: { finalY: number } };

/* Visual "Painel": cabeçalho escuro, cartões coloridos, barras e as cores das categorias. */
const INK: RGB = [13, 16, 23];
const MONTH_BAND: RGB = [238, 236, 255];
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
/** Pagamento feito: azul-petróleo sobre fundo claro; agendado: laranja sobre fundo claro. */
const PAID_TEXT: RGB = [10, 106, 128];
const PAID_BG: RGB = [221, 242, 247];
const SCHEDULED_TEXT: RGB = [191, 87, 14];
const SCHEDULED_BG: RGB = [253, 236, 220];
const DIST_COLORS = ["#5B48E8", "#0F8AA0", "#D69A12", "#D6335A", "#0E8F73", "#E0732A", "#3D74E8", "#B24BC4", "#8189A3"];

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
/** Onde o conteúdo começa na 1ª página (abaixo do cabeçalho) e nas seguintes (sem cabeçalho). */
const BODY_TOP = 46;
const CONTINUE_TOP = 16;
/** O rodapé só existe na última página (faixa de 12 mm), então o conteúdo para um pouco antes dela. */
const BODY_BOTTOM = PAGE_H - 18;

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
/** "2026-06" -> "Jun/26" */
const shortMonth = (month: string) => `${MONTH_ABBR[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`;

/** Gera o PDF do período (lista de meses "YYYY-MM"). Com um só mês, mostra a sugestão de distribuição se pedida. */
export function exportPDF(months: string[], options: PdfOptions) {
  const doc = new jsPDF();
  const store = useFinanceStore.getState();
  const data = { transactions: store.transactions, creditTransactions: store.creditTransactions, extraExpenses: store.extraExpenses };
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

  /** Rodapé só na última página. */
  const drawFooter = () => {
    const pages = doc.getNumberOfPages();
    doc.setPage(pages);
    doc.setFillColor(...INK);
    doc.rect(0, PAGE_H - 12, PAGE_W, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SOFT_TEXT);
    doc.text(`Gerado em ${getToday()} • Aurora`, MARGIN, PAGE_H - 4.5);
    doc.text(`${pages} ${pages === 1 ? "página" : "páginas"}`, PAGE_W - MARGIN, PAGE_H - 4.5, { align: "right" });
  };

  // cabeçalho só na primeira página
  drawHeader();
  let y = BODY_TOP;

  const newPage = () => {
    doc.addPage();
    y = CONTINUE_TOP;
  };
  /** Garante `h` mm livres; senão começa outra página. */
  const ensure = (h: number) => {
    if (y + h > BODY_BOTTOM) newPage();
  };

  const section = (title: string, subtitle?: string) => {
    ensure(subtitle ? 18 : 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...TEXT);
    doc.text(title, MARGIN, y);
    y += 5.5;
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...GRAY);
      doc.text(subtitle, MARGIN, y);
      y += 5.5;
    }
    doc.setTextColor(...TEXT);
  };

  const tableDefaults = () => ({
    margin: { top: CONTINUE_TOP, bottom: 18, left: MARGIN, right: MARGIN },
    theme: "plain" as const,
    styles: { fontSize: 11, cellPadding: { top: 2.4, bottom: 2.4, left: 1.5, right: 1.5 }, textColor: TEXT, lineWidth: 0 },
    headStyles: { fontSize: 9.5, textColor: GRAY, fontStyle: "bold" as const },
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
      doc.roundedRect(x, y, w, 24, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(label, x + 4, y + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13.5);
      doc.text(formatBRL(value), x + 4, y + 17.5);
    });
    doc.setTextColor(...TEXT);
    y += 24 + 8;

    /* ---------- gráfico: renda e despesas por mês ---------- */
    section("Renda e despesas por mês", multi ? "Os meses do período, lado a lado" : "O mês escolhido");
    const chartH = 50;
    const chartTop = y + 3;
    const axisW = 14;
    const plotX = MARGIN + axisW;
    const plotW = CONTENT_W - axisW;
    const maxReais = Math.max(...totals.months.flatMap((m) => [m.totalIncome, m.totalExpense]), 100) / 100;
    const ticks = niceTicks(maxReais);
    const yOf = (reais: number) => chartTop + chartH - (reais / ticks.top) * chartH;

    doc.setFontSize(8.5);
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
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(shortMonth(m.month), center, chartTop + chartH + 5, { align: "center" });
    });
    y = chartTop + chartH + 11;

    // legenda
    doc.setFontSize(9);
    [["Receitas", CYAN], ["Despesas", VIOLET_LIGHT]].forEach(([label, color], i) => {
      const x = MARGIN + i * 32;
      doc.setFillColor(...(color as RGB));
      doc.roundedRect(x, y - 2.6, 3, 3, 0.6, 0.6, "F");
      doc.setTextColor(...GRAY);
      doc.text(label as string, x + 5, y);
    });
    y += 7;

    /* ---------- resumo numérico por mês ---------- */
    ensure(16 + totals.months.length * 10);
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
    y = (doc as unknown as LastTable).lastAutoTable.finalY + 8;

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
      ensure(18 + Math.min(cats.length, 2) * 9.5); // título com pelo menos 2 barras; o resto segue na página seguinte se precisar
      section("Despesas por categoria", `Total de ${formatBRL(totals.expense)} no período`);
      const labelW = 46;
      const valueW = 38;
      const barArea = CONTENT_W - labelW - valueW;
      const top = cats[0][1];
      for (const [name, value] of cats) {
        ensure(9.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(...TEXT);
        doc.text(name, MARGIN, y + 3.4, { maxWidth: labelW - 2 });
        doc.setFillColor(...hex(name));
        doc.roundedRect(MARGIN + labelW, y, Math.max(1.5, (value / top) * barArea), 4.6, 2.3, 2.3, "F");
        doc.setFont("helvetica", "bold");
        doc.text(formatBRL(value), PAGE_W - MARGIN, y + 3.4, { align: "right" });
        y += 9.5;
      }
      y += 3;
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
        doc.setFontSize(10.5);
        doc.setTextColor(...TEXT);
        doc.text(p.item.label, MARGIN + 7, y);
        doc.setTextColor(...GRAY);
        doc.text(`${p.item.percent}%`, PAGE_W - MARGIN - 40, y, { align: "right" });
        doc.setTextColor(...TEXT);
        doc.setFont("helvetica", "bold");
        doc.text(formatBRL(p.value), PAGE_W - MARGIN, y, { align: "right" });
        y += 8;
      });
      y += 4;
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
      // segue na mesma página se couber o título e algumas linhas; a tabela continua sozinha nas seguintes
      ensure(36);
      section("Lançamentos", "Receitas em verde, despesas em vermelho");
      // com vários meses, cada mês ganha uma faixa de título (em vez de repetir o mês em cada linha)
      type Line = { kind: "month"; month: string } | { kind: "row"; row: (typeof rows)[number] };
      const lines: Line[] = [];
      let lastMonth = "";
      for (const r of rows) {
        if (multi && r.month !== lastMonth) {
          lines.push({ kind: "month", month: r.month });
          lastMonth = r.month;
        }
        lines.push({ kind: "row", row: r });
      }
      /** Selo do pagamento na mesma linha do nome: arredondado e colorido (azul-petróleo = paga, laranja = agendada). */
      const PILL_FONT = 7.5;
      const pillWidth = (p: Payment) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(PILL_FONT);
        return doc.getTextWidth(describePaidBadge(p)) + 5;
      };
      const drawPill = (p: Payment, x: number, centerY: number) => {
        const scheduled = isScheduled(p);
        const w = pillWidth(p);
        const h = 4.6;
        doc.setFillColor(...(scheduled ? SCHEDULED_BG : PAID_BG));
        doc.roundedRect(x, centerY - h / 2, w, h, h / 2, h / 2, "F");
        doc.setTextColor(...(scheduled ? SCHEDULED_TEXT : PAID_TEXT));
        doc.text(describePaidBadge(p), x + 2.5, centerY, { baseline: "middle" });
        return x + w;
      };
      // quando a tabela quebra de página no meio de um mês, o topo da nova página repete o mês
      let drawnUpTo = -1; // maior linha já desenhada
      let previousEnd = -1; // última linha da página anterior
      autoTable(doc, {
        ...tableDefaults(),
        margin: { ...tableDefaults().margin, top: CONTINUE_TOP + (multi ? 8 : 0) },
        startY: y,
        head: [["Nome", "Valor"]],
        body: lines.map((l) =>
          l.kind === "month"
            ? [{ content: formatMonthTitle(l.month), colSpan: 2, styles: { fillColor: MONTH_BAND, fontStyle: "bold" as const, textColor: VIOLET, cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 1.5 } } }]
            : [l.row.note ? `${l.row.name} (${l.row.note})` : l.row.name, formatBRL(l.row.amount)],
        ),
        columnStyles: {
          0: { cellPadding: { top: 2.6, bottom: 2.6, left: 6, right: 1.5 } },
          1: { halign: "right", fontStyle: "bold", cellWidth: 40 },
        },
        willDrawCell: (c) => {
          if (c.section === "body") drawnUpTo = Math.max(drawnUpTo, c.row.index);
        },
        didDrawPage: () => {
          // a primeira linha desta página vem logo depois da última da anterior
          const first = lines[previousEnd + 1];
          previousEnd = drawnUpTo;
          if (!multi || !first || first.kind === "month") return;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(...VIOLET);
          doc.text(`${formatMonthTitle(first.row.month)} (continuação)`, MARGIN + 3, CONTINUE_TOP + 3);
          doc.setTextColor(...TEXT);
        },
        didParseCell: (c) => {
          if (c.section === "head" && c.column.index === 1) c.cell.styles.halign = "right";
          const line = c.section === "body" ? lines[c.row.index] : undefined;
          if (line?.kind === "row" && c.column.index === 1) c.cell.styles.textColor = line.row.type === "Receita" ? GREEN : RED;
          // reserva à direita o espaço do selo, para o nome quebrar antes dele em vez de passar por cima
          if (line?.kind === "row" && line.row.payment && c.column.index === 0) {
            c.cell.styles.cellPadding = { top: 2.6, bottom: 2.6, left: 6, right: pillWidth(line.row.payment) + 4 };
          }
        },
        didDrawCell: (c) => {
          tableDefaults().didDrawCell(c);
          const line = c.section === "body" ? lines[c.row.index] : undefined;
          if (line?.kind === "month") {
            // traço forte no topo da faixa do mês
            doc.setDrawColor(...VIOLET);
            doc.setLineWidth(0.7);
            doc.line(c.cell.x, c.cell.y, c.cell.x + c.cell.width, c.cell.y);
          } else if (line?.kind === "row" && c.column.index === 0) {
            // quadradinho com a cor da categoria
            doc.setFillColor(...hex(line.row.category));
            doc.roundedRect(c.cell.x + 1.5, c.cell.y + c.cell.height / 2 - 1.5, 3, 3, 0.6, 0.6, "F");
            if (line.row.payment) {
              // o selo vem logo depois da última linha do nome, na altura dela
              const lines = c.cell.text;
              const fs = c.cell.styles.fontSize;
              doc.setFont("helvetica", c.cell.styles.fontStyle === "bold" ? "bold" : "normal");
              doc.setFontSize(fs);
              const pos = c.cell.getTextPos();
              const lineH = (fs * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
              const centerY = pos.y + (lines.length - 1) * lineH + (fs * 0.3528 * 0.8) / 2;
              const x = pos.x + doc.getTextWidth(lines[lines.length - 1] ?? "") + 2.5;
              const end = drawPill(line.row.payment, x, centerY);
              // observação do pagamento, discreta, no espaço que sobrar na linha
              const note = line.row.payment.notes;
              const room = c.cell.x + c.cell.width - 1.5 - (end + 2);
              if (note && room > 14) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                let text = note;
                while (text.length > 1 && doc.getTextWidth(text) > room) text = text.slice(0, -1);
                doc.setTextColor(...GRAY);
                doc.text(text === note ? text : `${text.trimEnd()}…`, end + 2, centerY, { baseline: "middle" });
              }
              doc.setFont("helvetica", "normal");
              doc.setTextColor(...TEXT);
            }
          }
        },
      });
    }
  }

  drawFooter();
  doc.save(`relatorio-${months[0]}${multi ? `_a_${months[months.length - 1]}` : ""}.pdf`);
}
