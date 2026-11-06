import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMonth, getToday } from "../Utils/Date";
import { useFinanceStore } from "../Store/FinanceStore";

export function exportPDF(currentMonth: string) {
  const doc = new jsPDF();
  const store = useFinanceStore.getState();

  const monthTransactions = store.getTransactionsByMonth(currentMonth);
  const totals = store.getTotals();
  const distribution = store.getDistribuition();

  const { emergency, invest, leisure, education, costs } = distribution;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  // ================= HEADER =================
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("MEU BOLSO", 14, 20);

  doc.setFont("helvetica", "normal"); // reset
  doc.setFontSize(10);
  doc.text(`Relatório - ${formatMonth(currentMonth)}`, 14, 28);

  doc.setTextColor(0, 0, 0);

  // ================= CARDS =================
  const drawCard = (label: string, value: string, x: number) => {
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(x, 45, 55, 22, 3, 3, "F");

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(label, x + 3, 52);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(value, x + 3, 60);
  };

  drawCard("Receitas", formatCurrency(totals.totalIncome), 14);
  drawCard("Despesas", formatCurrency(totals.totalExpense), 74);
  drawCard("Saldo", formatCurrency(totals.balance), 134);

  let currentY = 80;

  // ================= DISTRIBUIÇÃO =================
  if (totals.balance > 0) {
    doc.setFontSize(13);
    doc.text("Sugestão de distribuição do saldo", 14, currentY);

    const totalDistribuido =
      emergency + invest + leisure + education + costs;

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Categoria", "%", "Valor"]],
      body: [
        ["Reserva de emergência", `${((emergency / totals.balance) * 100).toFixed(1)}%`, formatCurrency(emergency)],
        ["Investimentos", `${((invest / totals.balance) * 100).toFixed(1)}%`, formatCurrency(invest)],
        ["Lazer", `${((leisure / totals.balance) * 100).toFixed(1)}%`, formatCurrency(leisure)],
        ["Educação", `${((education / totals.balance) * 100).toFixed(1)}%`, formatCurrency(education)],
        ["Gastos pessoais", `${((costs / totals.balance) * 100).toFixed(1)}%`, formatCurrency(costs)],
      ],
      foot: [[
        "Total distribuído",
        `${((totalDistribuido / totals.balance) * 100).toFixed(1)}%`,
        formatCurrency(totalDistribuido),
      ]],
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
      },
      footStyles: {
        fillColor: [200, 230, 201],
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      showFoot: "last" as any,
      alternateRowStyles: {
        fillColor: [240, 253, 244],
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.setFont("helvetica", "bold")
    doc.text("Sem saldo disponível para distribuição", 14, currentY);
    doc.setFont("helvetica", "bold")
    currentY += 10;
    doc.setTextColor(0);
  }

  // ================= TRANSAÇÕES =================
  doc.setFontSize(13);
  doc.text("Transações do mês", 14, currentY);

  const sortedTransactions = [...monthTransactions].sort((a, b) => {
    if (a.type === "income" && b.type === "expense") return -1;
    if (a.type === "expense" && b.type === "income") return 1;
    return 0;
  });

  const body: any[] = [];
  let lastType = "";

  sortedTransactions.forEach((t) => {
    if (lastType && lastType !== t.type) {
      body.push(["", "", "", ""]); // espaço visual
    }

    body.push([
      t.name,
      t.category,
      t.type === "income" ? "Receita" : "Despesa",
      formatCurrency(t.amount),
    ]);

    lastType = t.type;
  });

  autoTable(doc, {
    startY: currentY + 5,
    head: [["Nome", "Categoria", "Tipo", "Valor"]],
    body,
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244],
    },
    columnStyles: {
      3: { halign: "right" },
    },
    didParseCell: (data) => {
      const row = data.row.raw as any[];

      // linha de separação
      if (row.every((cell) => cell === "")) {
        data.cell.styles.minCellHeight = 4;
        data.cell.styles.fillColor = [255, 255, 255];
        return;
      }

      // cor dos valores
      if (data.column.index === 3) {
        const isExpense = row[2] === "Despesa";

        data.cell.styles.textColor = isExpense
          ? [220, 38, 38]
          : [16, 185, 129];
      }
    },
  });

  // ================= FOOTER =================
  const pageHeight = doc.internal.pageSize.height;

  doc.setDrawColor(200);
  doc.line(14, pageHeight - 15, 196, pageHeight - 15);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${getToday()} • Meu Bolso`,
    14,
    pageHeight - 8
  );

  doc.save(`relatorio-${currentMonth}.pdf`);
}