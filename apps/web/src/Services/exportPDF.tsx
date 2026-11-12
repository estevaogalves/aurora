import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { niceTicks, shortReais } from "../components/charts/scale";
import {
  DEFAULT_DISTRIBUTION,
  dayMonth,
  describePaidBadge,
  describePaidRow,
  distributeBalance,
  formatPaymentDate,
  getPeriodTotals,
  formatPeriodLabel,
  getReportInvoices,
  periodFileName,
  getReportRows,
  invoiceTitle,
  isScheduled,
  type Payment,
  type ReportInvoice,
  type ReportOptions,
  type ReportRow,
} from "../domain";
import { downloadBlob } from "./download";
import { formatBRL } from "../lib/money";
import { useFinanceStore } from "../Store/FinanceStore";
import { categoryHex, hexToRgb } from "../Utils/categoryHex";
import { formatMonth, formatMonthTitle, getToday } from "../Utils/Date";

export interface PdfOptions extends ReportOptions {
  distribution: boolean;
}

type RGB = [number, number, number];
type LastTable = { lastAutoTable: { finalY: number } };
/** Desenha um bloco inteiro em `d` a partir de `startY`, na escala dada, e devolve onde ele termina. */
type Draw = (d: jsPDF, startY: number, scale: number) => number;

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
/** Onde o conteúdo começa na 1ª página (abaixo do cabeçalho grande) e nas seguintes (abaixo do cabeçalho fino). */
const BODY_TOP = 46;
const CONTINUE_TOP = 22;
/** Toda página tem rodapé (faixa de 12 mm), então o conteúdo para um pouco antes dela. */
const BODY_BOTTOM = PAGE_H - 18;
/** Espaço útil de uma página inteira, sem o cabeçalho grande. */
const PAGE_ROOM = BODY_BOTTOM - CONTINUE_TOP;
/**
 * Escalas tentadas, da maior para a menor: um bloco que não cabe numa página reduz a letra e o espaçamento até caber.
 * Só se nem na menor couber é que ele continua na página seguinte (muitas centenas de linhas).
 */
const SCALES = [1, 0.94, 0.88, 0.82, 0.76, 0.7];

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
/** "2026-06" -> "Jun/26" */
const shortMonth = (month: string) => `${MONTH_ABBR[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`;

const tableDefaults = (d: jsPDF, scale = 1) => ({
  margin: { top: CONTINUE_TOP, bottom: 18, left: MARGIN, right: MARGIN },
  theme: "plain" as const,
  styles: { fontSize: 11 * scale, cellPadding: { top: 2.4 * scale, bottom: 2.4 * scale, left: 1.5, right: 1.5 }, textColor: TEXT, lineWidth: 0 },
  headStyles: { fontSize: 9.5 * scale, textColor: GRAY, fontStyle: "bold" as const },
  // linha fina embaixo de cada linha; mais grossa no cabeçalho
  didDrawCell: (c: CellHookData) => {
    const { x, y: cy, width, height } = c.cell;
    d.setDrawColor(...(c.section === "head" ? INK : LINE));
    d.setLineWidth(c.section === "head" ? 0.5 : 0.2);
    d.line(x, cy + height, x + width, cy + height);
  },
});

const finalY = (d: jsPDF) => (d as unknown as LastTable).lastAutoTable.finalY;

/**
 * Gera o PDF do período (lista de meses "YYYY-MM"). Cada parte do relatório ocupa páginas próprias, em sequência:
 * 1. Resumo (totais, gráfico e mês a mês), 2. Despesas por categoria (e a sugestão de distribuição, se couber),
 * 3. Lançamentos, 4. Faturas dos cartões (parcelas, recorrências, compras avulsas e ajuste de cada uma). Nenhum bloco é cortado ao meio: o que não cabe
 * no que sobrou da página vai inteiro para a seguinte, e um bloco maior que uma página reduz a letra até caber.
 */
export function exportPDF(months: string[], options: PdfOptions) {
  const doc = new jsPDF();
  const store = useFinanceStore.getState();
  const data = { transactions: store.transactions, creditTransactions: store.creditTransactions, creditCards: store.creditCards, extraExpenses: store.extraExpenses };
  const totals = getPeriodTotals(data, months);
  const multi = months.length > 1;
  const periodLabel = formatPeriodLabel(months);
  const hex = (category: string) => hexToRgb(categoryHex(category, store.customCategories));

  /* ---------- cabeçalhos e rodapé ---------- */
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

  /** Cabeçalho fino das páginas seguintes: de que relatório e de que período é a folha. */
  const drawRunningHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...VIOLET);
    doc.text("AURORA", MARGIN, 10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("Relatório financeiro", MARGIN + 17, 10);
    doc.text(periodLabel, PAGE_W - MARGIN, 10, { align: "right" });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 13, PAGE_W - MARGIN, 13);
    doc.setTextColor(...TEXT);
  };

  /** Rodapé em todas as páginas, com a numeração. */
  const drawFooter = (page: number, pages: number) => {
    doc.setFillColor(...INK);
    doc.rect(0, PAGE_H - 12, PAGE_W, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SOFT_TEXT);
    doc.text(`Gerado em ${getToday()} • Aurora`, MARGIN, PAGE_H - 4.5);
    doc.text(`Página ${page} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 4.5, { align: "right" });
  };

  drawHeader();
  let y = BODY_TOP;
  /** a página atual já tem conteúdo (então a próxima seção abre outra página) */
  let pageUsed = false;
  /** acabou de desenhar o título de uma seção: o primeiro bloco tem que caber no que sobrou dessa página */
  let titlePending = false;

  const newPage = () => {
    doc.addPage();
    y = CONTINUE_TOP;
    pageUsed = false;
    titlePending = false;
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
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
    y += 3;
  };

  /** Abre uma seção em página própria (na primeira página, se ainda estiver vazia). */
  const startSection = (title: string, subtitle?: string) => {
    if (pageUsed) newPage();
    drawSectionTitle(title, subtitle);
    pageUsed = true;
    titlePending = true;
  };

  /** Garante `h` mm livres na página atual; senão abre a próxima (sem deixar um título sozinho). */
  const needs = (h: number) => {
    if (pageUsed && y + h > BODY_BOTTOM) newPage();
  };

  /**
   * Põe um bloco inteiro: mede num PDF de rascunho, escolhe a maior escala em que ele cabe numa página e o desenha
   * na página atual se couber no que sobrou, ou na seguinte. Só continua em outra página se nem na menor escala couber.
   */
  const place = (draw: Draw, gap = 6) => {
    const room = titlePending ? BODY_BOTTOM - y : PAGE_ROOM;
    let chosen = SCALES[SCALES.length - 1];
    let height = Infinity;
    for (const scale of SCALES) {
      const scratch = new jsPDF();
      const end = draw(scratch, CONTINUE_TOP, scale);
      const h = end - CONTINUE_TOP;
      if (scratch.getNumberOfPages() === 1 && h <= room) {
        chosen = scale;
        height = h;
        break;
      }
    }
    if (!titlePending && pageUsed && (height === Infinity || y + height > BODY_BOTTOM)) newPage();
    y = draw(doc, y, chosen) + gap;
    pageUsed = true;
    titlePending = false;
  };

  /* ====================== 1. Resumo: totais, gráfico e mês a mês ====================== */
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
    pageUsed = true;

    /* gráfico: renda e despesas por mês */
    drawSectionTitle("Renda e despesas por mês", multi ? "Os meses do período, lado a lado" : "O mês escolhido");
    const chartH = 50;
    const chartTop = y;
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
    y += 9;

    /* resumo numérico por mês (a tabela vai inteira para a mesma página do gráfico, ou inteira para a seguinte) */
    place((d, startY, scale) => {
      autoTable(d, {
        ...tableDefaults(d, scale),
        startY,
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
      return finalY(d);
    });

    /* ====================== 2. Despesas por categoria ====================== */
    const cats = Object.entries(
      totals.months.reduce<Record<string, number>>((acc, m) => {
        for (const [c, v] of Object.entries(m.byCategory)) acc[c] = (acc[c] ?? 0) + (v ?? 0);
        return acc;
      }, {}),
    )
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    if (cats.length > 0) {
      startSection("Despesas por categoria", `Total de ${formatBRL(totals.expense)} no período`);
      const labelW = 46;
      const valueW = 38;
      const barArea = CONTENT_W - labelW - valueW;
      const top = cats[0][1];
      // com muitas categorias, as linhas se aproximam para a lista inteira caber na página
      const pitch = Math.max(6.2, Math.min(9.5, (BODY_BOTTOM - y) / cats.length));
      const barH = Math.min(4.6, pitch - 3);
      for (const [name, value] of cats) {
        needs(pitch);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(Math.min(10.5, pitch + 1));
        doc.setTextColor(...TEXT);
        doc.text(name, MARGIN, y + barH / 2 + 1.2, { maxWidth: labelW - 2 });
        doc.setFillColor(...hex(name));
        doc.roundedRect(MARGIN + labelW, y, Math.max(1.5, (value / top) * barArea), barH, barH / 2, barH / 2, "F");
        doc.setFont("helvetica", "bold");
        doc.text(formatBRL(value), PAGE_W - MARGIN, y + barH / 2 + 1.2, { align: "right" });
        y += pitch;
      }
      y += 3;
      titlePending = false;
    }
  }

  /* ====================== Sugestão de distribuição: do mês, ou do saldo somado do período ====================== */
  if (options.distribution) {
    const balance = multi ? totals.balance : totals.months[0].balance;
    if (balance > 0) {
      const parts = distributeBalance(balance, store.distribution ?? DEFAULT_DISTRIBUTION).filter((p) => p.item.percent > 0);
      // o bloco inteiro (título, barra e legenda) fica junto: cabe na página da categoria ou vai inteiro para a seguinte
      needs(30 + parts.length * 8);
      pageUsed = true;
      drawSectionTitle("Sugestão de distribuição do saldo", `${multi ? `Saldo de ${periodLabel}` : `Saldo de ${formatMonth(months[0])}`}: ${formatBRL(balance)}`);
      let x = MARGIN;
      parts.forEach((p, i) => {
        const w = (CONTENT_W * p.item.percent) / 100;
        doc.setFillColor(...hexToRgb(DIST_COLORS[i % DIST_COLORS.length]));
        doc.rect(x, y, Math.max(w - 0.6, 0.6), 5, "F");
        x += w;
      });
      y += 11;
      parts.forEach((p, i) => {
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
      titlePending = false;
    } else {
      needs(14);
      pageUsed = true;
      doc.setFontSize(10);
      doc.setTextColor(...GRAY);
      doc.text("Sem saldo disponível para distribuição.", MARGIN, y);
      doc.setTextColor(...TEXT);
      y += 10;
    }
  }

  /* ====================== lançamentos e parcelas: um bloco por mês, cada um inteiro numa página ====================== */

  /** Selo do pagamento na mesma linha do nome: arredondado e colorido (azul-petróleo = paga, laranja = agendada). */
  const pillWidth = (d: jsPDF, p: Payment, scale: number) => {
    d.setFont("helvetica", "bold");
    d.setFontSize(7.5 * scale);
    return d.getTextWidth(describePaidBadge(p)) + 5 * scale;
  };
  const drawPill = (d: jsPDF, p: Payment, x: number, centerY: number, scale: number) => {
    const scheduled = isScheduled(p);
    const w = pillWidth(d, p, scale);
    const h = 4.6 * scale;
    d.setFillColor(...(scheduled ? SCHEDULED_BG : PAID_BG));
    d.roundedRect(x, centerY - h / 2, w, h, h / 2, h / 2, "F");
    d.setTextColor(...(scheduled ? SCHEDULED_TEXT : PAID_TEXT));
    d.text(describePaidBadge(p), x + 2.5 * scale, centerY, { baseline: "middle" });
    return x + w;
  };

  type RowsBlock = { title?: string; rows: ReportRow[] };
  const drawRowsBlock = (block: RowsBlock): Draw => (d, startY, scale) => {
    const base = tableDefaults(d, scale);
    const pad = { top: 2.6 * scale, bottom: 2.6 * scale, left: 6, right: 1.5 };
    autoTable(d, {
      ...base,
      startY,
      // com vários meses, a faixa do mês é o cabeçalho do bloco; com um só, o cabeçalho é "Nome / Valor"
      head: [
        block.title
          ? [{ content: block.title, colSpan: 2, styles: { fillColor: MONTH_BAND, fontStyle: "bold" as const, fontSize: 11 * scale, textColor: VIOLET, cellPadding: { top: 3.2 * scale, bottom: 3.2 * scale, left: 3, right: 1.5 } } }]
          : ["Nome", "Valor"],
      ],
      body: block.rows.map((r) => [r.note ? `${r.name} (${r.note})` : r.name, formatBRL(r.amount)]),
      columnStyles: { 0: { cellPadding: pad }, 1: { halign: "right", fontStyle: "bold", cellWidth: 40 } },
      didParseCell: (c) => {
        if (c.section === "head" && c.column.index === 1 && !block.title) c.cell.styles.halign = "right";
        const row = c.section === "body" ? block.rows[c.row.index] : undefined;
        if (row && c.column.index === 1) c.cell.styles.textColor = row.type === "Receita" ? GREEN : RED;
        // reserva à direita o espaço do selo, para o nome quebrar antes dele em vez de passar por cima
        if (row?.payment && c.column.index === 0) c.cell.styles.cellPadding = { ...pad, right: pillWidth(d, row.payment, scale) + 4 };
      },
      didDrawCell: (c) => {
        if (c.section === "head" && block.title) {
          // traço forte no topo da faixa do mês
          d.setDrawColor(...VIOLET);
          d.setLineWidth(0.7);
          d.line(c.cell.x, c.cell.y, c.cell.x + c.cell.width, c.cell.y);
          return;
        }
        base.didDrawCell(c);
        const row = c.section === "body" ? block.rows[c.row.index] : undefined;
        if (!row || c.column.index !== 0) return;
        // quadradinho com a cor da categoria
        d.setFillColor(...hex(row.category));
        d.roundedRect(c.cell.x + 1.5, c.cell.y + c.cell.height / 2 - 1.5, 3, 3, 0.6, 0.6, "F");
        if (!row.payment) return;
        // o selo vem logo depois da última linha do nome, na altura dela
        const lines = c.cell.text;
        const fs = c.cell.styles.fontSize;
        d.setFont("helvetica", c.cell.styles.fontStyle === "bold" ? "bold" : "normal");
        d.setFontSize(fs);
        const pos = c.cell.getTextPos();
        const lineH = (fs * d.getLineHeightFactor()) / d.internal.scaleFactor;
        const centerY = pos.y + (lines.length - 1) * lineH + (fs * 0.3528 * 0.8) / 2;
        const x = pos.x + d.getTextWidth(lines[lines.length - 1] ?? "") + 2.5;
        const end = drawPill(d, row.payment, x, centerY, scale);
        // observação do pagamento, discreta, no espaço que sobrar na linha
        const note = row.payment.notes;
        const room = c.cell.x + c.cell.width - 1.5 - (end + 2);
        if (note && room > 14) {
          d.setFont("helvetica", "normal");
          d.setFontSize(8 * scale);
          let text = note;
          while (text.length > 1 && d.getTextWidth(text) > room) text = text.slice(0, -1);
          d.setTextColor(...GRAY);
          d.text(text === note ? text : `${text.trimEnd()}…`, end + 2, centerY, { baseline: "middle" });
        }
        d.setFont("helvetica", "normal");
        d.setTextColor(...TEXT);
      },
    });
    return finalY(d);
  };

  /** Seção em páginas próprias: um bloco por mês (vários meses) ou um bloco só, cada um inteiro numa página. */
  const rowsSection = (title: string, subtitle: string, rows: ReportRow[]) => {
    if (rows.length === 0) return;
    startSection(title, subtitle);
    const blocks: RowsBlock[] = multi
      ? months.filter((m) => rows.some((r) => r.month === m)).map((m) => ({ title: formatMonthTitle(m), rows: rows.filter((r) => r.month === m) }))
      : [{ rows }];
    for (const block of blocks) place(drawRowsBlock(block), 8);
  };

  /* ====================== 3. Lançamentos ====================== */
  // com as faturas no relatório, as compras no cartão e as parcelas aparecem só dentro delas
  if (options.entries) rowsSection("Lançamentos", "Receitas em verde, despesas em vermelho", getReportRows(data, months, { entries: true, credit: false, invoices: options.invoices }));

  /* ====================== 5. Faturas dos cartões: cada fatura, com o título, o total e a descrição, inteira numa página ====================== */
  const drawInvoice = (inv: ReportInvoice): Draw => (d, startY, scale) => {
    const paid = inv.payment;
    const sub = `${multi ? `${formatMonth(inv.month)}` : ""}${inv.dueDate ? `${multi ? " · " : ""}Fecha ${dayMonth(inv.closingDate)} · Vence ${formatPaymentDate(inv.dueDate)}` : ""}`;
    const base = tableDefaults(d, scale);
    const subPad = { top: 1.6 * scale, bottom: 1.6 * scale, left: 3, right: 1.5 };
    autoTable(d, {
      ...base,
      startY,
      head: [[invoiceTitle(inv), formatBRL(inv.total)]],
      headStyles: { fontSize: 12 * scale, fontStyle: "bold", textColor: VIOLET, fillColor: MONTH_BAND, cellPadding: { top: 3.2 * scale, bottom: 3.2 * scale, left: 3, right: 3 } },
      body: [
        ...(sub ? [[{ content: sub, colSpan: 2, styles: { fontSize: 9 * scale, textColor: GRAY, cellPadding: subPad } }]] : []),
        ...(paid ? [[{ content: describePaidRow(paid), colSpan: 2, styles: { fontSize: 9 * scale, fontStyle: "bold" as const, textColor: isScheduled(paid) ? SCHEDULED_TEXT : PAID_TEXT, cellPadding: subPad } }]] : []),
        // a Helvetica do PDF não tem o "−" (menos tipográfico): ele sairia como lixo; vale o hífen comum
        ...inv.items.map((it) => [it.description, it.kind === "adjustment" ? `${it.amount < 0 ? "-" : "+"}${formatBRL(Math.abs(it.amount))}` : formatBRL(it.amount)]),
      ],
      columnStyles: {
        0: { cellPadding: { top: 2.4 * scale, bottom: 2.4 * scale, left: 6, right: 1.5 } },
        1: { halign: "right", fontStyle: "bold", cellWidth: 40 },
      },
      didParseCell: (c) => {
        if (c.section === "head" && c.column.index === 1) c.cell.styles.halign = "right";
      },
    });
    return finalY(d);
  };

  if (options.invoices) {
    const invoices = getReportInvoices(data, months);
    if (invoices.length > 0) {
      startSection("Faturas dos cartões", "Parcelas, recorrências, compras avulsas e ajustes de cada cartão. Já estão nos totais: não são somadas de novo.");
      for (const inv of invoices) place(drawInvoice(inv), 7);
    }
  }

  /* ---------- cabeçalho fino e rodapé em todas as páginas ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (p > 1) drawRunningHeader();
    drawFooter(p, pages);
  }
  downloadBlob(`${periodFileName(months)}.pdf`, doc.output("blob"));
}
