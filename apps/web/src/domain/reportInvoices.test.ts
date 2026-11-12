import { describe, expect, it } from "vitest";
import {
  buildCsv,
  buildTxt,
  getCardInvoice,
  getPeriodTotals,
  getReportInvoices,
  getReportRows,
  invoiceTitle,
  patchCardPayment,
  type CreditCard,
  type CreditTransaction,
  type ExtraExpense,
  type Transaction,
} from "./index";

const nubank: CreditCard = { id: "nu", name: "Nubank", closingDay: 2, dueDay: 9, limit: 30000 };
const inter: CreditCard = { id: "in", name: "Inter", closingDay: 25, dueDay: 5 };

const avulsa = (id: string, name: string, amount: number, cardId: string, purchaseDate: string): Transaction => ({
  id, name, amount, type: "expense", category: "Alimentação", month: purchaseDate.slice(0, 7), cardId, purchaseDate,
});
const tv: CreditTransaction = { id: "tv", name: "TV", totalAmount: 30000, installments: 3, startMonth: "2026-11", category: "Crédito/Parcelado", billingDay: 10, cardId: "nu" };
const streaming: CreditTransaction = { id: "st", name: "Streaming", totalAmount: 2000, installments: 1, startMonth: "2026-11", category: "Outros", recurring: true, billingDay: 1, cardId: "nu" };
const viagem: ExtraExpense = { id: "v", name: "Viagem", amount: 1200, month: "2026-12", cardId: "nu", purchaseDate: "2026-12-01" };

const data = {
  transactions: [avulsa("a", "Padaria", 5000, "nu", "2026-11-01"), avulsa("b", "Mercado", 3000, "nu", "2026-11-07"), avulsa("c", "Outro", 777, "in", "2026-11-07")],
  creditTransactions: [tv, streaming],
  extraExpenses: [viagem],
  creditCards: [nubank, inter],
};
const MONTHS = ["2026-11", "2026-12"];
const all = { summary: true, entries: true, credit: true, invoices: true };

describe("faturas no relatório", () => {
  const invoices = getReportInvoices(data, MONTHS);
  const dec = invoices.find((i) => i.cardName === "Nubank" && i.month === "2026-12")!;
  const nov = invoices.find((i) => i.cardName === "Nubank" && i.month === "2026-11")!;

  it("uma fatura por cartão e mês com movimento, em ordem de mês", () => {
    expect(invoices.map((i) => `${i.month} ${i.cardName}`)).toEqual(["2026-11 Nubank", "2026-12 Nubank", "2026-12 Inter"]);
  });

  it("título com o nome do cartão, total e datas", () => {
    expect(invoiceTitle(dec)).toBe("Fatura Nubank");
    expect(dec.total).toBe(10000 + 2000 + 3000 + 1200); // parcela + recorrente + compra avulsa + despesa extra
    expect([dec.closingDate, dec.dueDate]).toEqual(["2026-12-02", "2026-12-09"]);
    expect(nov.total).toBe(5000 + 2000);
  });

  it("abaixo, a descrição dos gastos: parcelas, depois recorrências, depois compras avulsas pelo dia", () => {
    expect(dec.items.map((i) => [i.kind, i.description, i.amount])).toEqual([
      ["installment", "TV (parcela 1/3)", 10000],
      ["recurring", "Streaming (recorrente)", 2000],
      ["purchase", "07/11 · Mercado", 3000],
      ["purchase", "01/12 · Viagem (despesa extra)", 1200],
    ]);
    expect(dec.items.reduce((s, i) => s + i.amount, 0)).toBe(dec.total);
  });

  it("concorda com a fatura da tela (getCardInvoice) e mostra o teto", () => {
    expect(dec.total).toBe(getCardInvoice(data, nubank, "2026-12").total);
    expect(dec.limit).toBe(30000);
    expect(dec.overLimit).toBe(false);
    expect(invoices.find((i) => i.cardName === "Inter")?.limit).toBeNull();
  });

  it("mostra o pagamento da fatura, e uma fatura só paga (sem movimento) também aparece", () => {
    const paid = { ...data, creditCards: [{ ...nubank, ...patchCardPayment(nubank, "2026-12", { method: "pix", date: "2026-12-09" }) }, inter] };
    expect(getReportInvoices(paid, MONTHS).find((i) => i.cardName === "Nubank" && i.month === "2026-12")?.payment).toEqual({ method: "pix", date: "2026-12-09" });
    expect(getReportInvoices(paid, ["2026-11"]).find((i) => i.month === "2026-11")?.payment).toBeUndefined();
  });

  it("sem cartões, sem faturas (nada muda para quem não usa)", () => {
    expect(getReportInvoices({ transactions: data.transactions, creditTransactions: [], extraExpenses: [], creditCards: [] }, MONTHS)).toEqual([]);
    expect(getReportInvoices({ transactions: [], creditTransactions: [] }, MONTHS)).toEqual([]);
  });

  it("consistência: as faturas só reagrupam o que já está nos lançamentos e nos totais do período", () => {
    // tudo o que entra em faturas aparece uma vez em "Lançamentos" (avulsas, extras) ou em "Parcelas do crédito"
    const rows = getReportRows(data, MONTHS, { entries: true, credit: true });
    const invoicedTotal = invoices.reduce((s, i) => s + i.total, 0);
    const withCard = rows.filter((r) => /Padaria|Mercado|Outro|Viagem|TV|Streaming/.test(r.name)).reduce((s, r) => s + r.amount, 0);
    expect(invoicedTotal).toBe(withCard);
    // e as despesas do período são as sem cartão (nenhuma) mais as faturas
    expect(getPeriodTotals(data, MONTHS).expense).toBe(invoicedTotal);
  });
});

describe("faturas no CSV e no TXT", () => {
  it("CSV: seção própria, com o total da fatura e depois cada gasto", () => {
    const csv = buildCsv(data, MONTHS, all);
    const lines = csv.split("\n");
    const start = lines.indexOf("Faturas dos cartões");
    expect(start).toBeGreaterThan(0);
    expect(lines[start - 1]).toBe(""); // separada da seção anterior
    expect(lines[start + 1]).toContain("Mês;Cartão;Fechamento;Vencimento;Tipo;Descrição;Data da compra;Valor");
    const dec = lines.slice(start + 2).filter((l) => l.startsWith("2026-12;Nubank"));
    expect(dec[0]).toContain(";Fatura;Fatura Nubank;;162,00"); // total
    expect(dec.slice(1).map((l) => l.split(";").slice(4, 8))).toEqual([
      ["Parcela", "TV (parcela 1/3)", "", "100,00"],
      ["Recorrente", "Streaming (recorrente)", "", "20,00"],
      ["Compra avulsa", "07/11 · Mercado", "2026-11-07", "30,00"],
      ["Compra avulsa", "01/12 · Viagem (despesa extra)", "2026-12-01", "12,00"],
    ]);
  });

  it("CSV: o pagamento da fatura vai na linha do total", () => {
    const paid = { ...data, creditCards: [{ ...nubank, ...patchCardPayment(nubank, "2026-12", { method: "pix", date: "2026-12-09", notes: "no app" }) }, inter] };
    const line = buildCsv(paid, MONTHS, all).split("\n").find((l) => l.startsWith("2026-12;Nubank") && l.includes(";Fatura;"))!;
    expect(line).toContain(";Paga;Pix;09/12/2026;no app");
  });

  it("TXT: título com o cartão e o total, e embaixo os gastos", () => {
    const txt = buildTxt(data, MONTHS, all);
    const lines = txt.split("\n");
    const start = lines.indexOf("FATURAS DOS CARTÕES");
    expect(start).toBeGreaterThan(0);
    expect(lines[start + 1]).toMatch(/^Fatura Nubank · .*2026 · fecha 02\/11 · vence 09\/11\/2026: R\$\s?70,00$/);
    const dezAt = lines.findIndex((l) => l.startsWith("Fatura Nubank") && l.includes("fecha 02/12"));
    expect(lines.slice(dezAt + 1, dezAt + 5)).toEqual([
      expect.stringMatching(/^ {2}- TV \(parcela 1\/3\): R\$\s?100,00$/),
      expect.stringMatching(/^ {2}- Streaming \(recorrente\): R\$\s?20,00$/),
      expect.stringMatching(/^ {2}- 07\/11 · Mercado: R\$\s?30,00$/),
      expect.stringMatching(/^ {2}- 01\/12 · Viagem \(despesa extra\): R\$\s?12,00$/),
    ]);
  });

  it("TXT: fatura paga leva o selo de pagamento", () => {
    // data passada: o boleto já foi pago (com data futura apareceria como "Agendada")
    const paid = { ...data, creditCards: [{ ...nubank, ...patchCardPayment(nubank, "2026-12", { method: "boleto", date: "2025-01-09" }) }, inter] };
    expect(buildTxt(paid, MONTHS, all)).toMatch(/Fatura Nubank · .*vence 09\/12\/2026: R\$\s?162,00 \[Paga · Boleto · 09\/01\/2025\]/);
    const scheduled = { ...data, creditCards: [{ ...nubank, ...patchCardPayment(nubank, "2026-12", { method: "boleto", date: "2099-01-09" }) }, inter] };
    expect(buildTxt(scheduled, MONTHS, all)).toContain("[Agendada · Boleto · 09/01/2099]");
  });

  it("sem marcar 'faturas', o relatório sai exatamente como antes", () => {
    const without = { summary: true, entries: true, credit: true };
    expect(buildCsv(data, MONTHS, { ...without, invoices: false })).toBe(buildCsv(data, MONTHS, without));
    expect(buildCsv(data, MONTHS, without)).not.toContain("Faturas");
    expect(buildTxt(data, MONTHS, without)).not.toContain("FATURAS");
  });

  it("sem faturas no período, a seção não aparece (e sem cartões nada muda)", () => {
    expect(buildCsv(data, ["2026-05"], all)).not.toContain("Faturas");
    const plain = { transactions: [avulsa("x", "Aluguel", 100000, "nenhum", "2026-11-01")], creditTransactions: [] as CreditTransaction[], extraExpenses: [] as ExtraExpense[], creditCards: [] as CreditCard[] };
    expect(buildTxt(plain, ["2026-11"], all)).not.toContain("FATURAS");
  });

  it("nome de cartão com fórmula é neutralizado no CSV", () => {
    const evil = { ...data, creditCards: [{ ...nubank, name: "=HYPERLINK(1)" }, inter] };
    const csv = buildCsv(evil, MONTHS, all);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).not.toMatch(/;=HYPERLINK/);
  });
});

describe("fatura única: ajuste e parcelas dentro dela", () => {
  const card = { id: "nu", name: "Nubank", closingDay: 2, dueDay: 9, adjustments: { "2026-12": [{ id: "d", amount: -37, note: "desconto" }, { id: "j", amount: 12, note: "juros" }] } };
  const tv: CreditTransaction = { id: "tv", name: "TV", category: "Crédito/Parcelado", totalAmount: 30000, installments: 3, startMonth: "2026-12", cardId: "nu" } as CreditTransaction;
  const loose: CreditTransaction = { id: "sofa", name: "Sofá", category: "Crédito/Parcelado", totalAmount: 20000, installments: 2, startMonth: "2026-12" } as CreditTransaction;
  const d = { transactions: [], creditTransactions: [tv, loose], extraExpenses: [], creditCards: [card] };

  it("o total da fatura é o total a pagar e a soma dos itens (com o desconto) bate com ele", () => {
    const inv = getReportInvoices(d, ["2026-12"]).find((i) => i.cardName === "Nubank")!;
    expect(inv.items.map((i) => i.kind)).toEqual(["installment", "adjustment", "adjustment"]);
    expect(inv.items.reduce((s, i) => s + i.amount, 0)).toBe(inv.total);
    expect(inv.total).toBe(10000 - 37 + 12);
  });

  it("parcelas sem cartão não somem: ficam num grupo à parte, e os totais do relatório batem", () => {
    const all = getReportInvoices(d, ["2026-12"]);
    expect(all.map((i) => i.cardName)).toEqual(["Nubank", "Sem cartão"]);
    expect(all.reduce((s, i) => s + i.total, 0)).toBe(getPeriodTotals(d, ["2026-12"]).expense);
  });

  it("com as faturas no relatório, os lançamentos não repetem parcelas nem compras no cartão", () => {
    const rows = getReportRows(d, ["2026-12"], { entries: true, credit: false, invoices: true });
    expect(rows).toEqual([]);
  });

  it("CSV e TXT trazem o ajuste dentro da fatura", () => {
    const csv = buildCsv(d, ["2026-12"], { summary: false, entries: false, invoices: true });
    expect(csv).toContain(";Ajuste;Desconto · desconto;");
    expect(csv).toContain(";Ajuste;Acréscimo · juros;");
    expect(buildTxt(d, ["2026-12"], { summary: false, entries: false, invoices: true })).toContain("Desconto · desconto");
  });
});
