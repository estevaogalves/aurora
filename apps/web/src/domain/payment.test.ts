import { describe, expect, it } from "vitest";
import {
  buildCsv,
  buildTxt,
  getMonthSummary,
  getProjection,
  getReportRows,
  isScheduled,
  isWeekend,
  paymentStatusLabel,
  validatePaymentTiming,
  getTransactionsByMonth,
  paymentOf,
  patchClearPayment,
  patchSetPayment,
  type ExtraExpense,
  type Payment,
  type Transaction,
} from "./index";

const pix: Payment = { method: "pix", date: "2026-11-08", notes: "no app" };
const rent: Transaction = { id: "r", name: "Aluguel", amount: 90000, type: "expense", category: "Moradia", fixed: true, month: "2026-10" };
const market: Transaction = { id: "m", name: "Mercado", amount: 15000, type: "expense", category: "Alimentação", month: "2026-11" };
const salary: Transaction = { id: "s", name: "Salário", amount: 500000, type: "income", category: "Renda", month: "2026-11" };
const trip: ExtraExpense = { id: "e", name: "IPVA", amount: 20000, month: "2026-11" };

describe("pagamento de despesas", () => {
  it("fixa paga em um mês não fica paga nos outros", () => {
    const paid = { ...rent, ...patchSetPayment(rent, "2026-11", pix) };
    expect(paymentOf(paid, "2026-11")).toEqual(pix);
    expect(paymentOf(paid, "2026-12")).toBeUndefined();
    // o valor do mês e a lista do mês seguem iguais
    expect(getTransactionsByMonth([paid], "2026-11")[0].amount).toBe(90000);
  });

  it("desmarcar tira só o mês pedido", () => {
    const two = { ...rent, ...patchSetPayment({ ...rent, ...patchSetPayment(rent, "2026-11", pix) }, "2026-12", pix) };
    const one = { ...two, ...patchClearPayment(two, "2026-11") };
    expect(Object.keys(one.payments ?? {})).toEqual(["2026-12"]);
    expect(patchClearPayment(one, "2026-12").payments).toBeUndefined();
  });

  it("não muda resumo, projeção nem totais", () => {
    const plain = { transactions: [rent, market, salary], creditTransactions: [], extraExpenses: [trip] };
    const paid = {
      transactions: [{ ...rent, ...patchSetPayment(rent, "2026-11", pix) }, { ...market, ...patchSetPayment(market, "2026-11", pix) }, salary],
      creditTransactions: [],
      extraExpenses: [{ ...trip, payment: pix }],
    };
    expect(getMonthSummary(paid, "2026-11")).toEqual(getMonthSummary(plain, "2026-11"));
    expect(getProjection(paid, paid.extraExpenses, "2026-11", 6)).toEqual(getProjection(plain, plain.extraExpenses, "2026-11", 6));
  });

  it("os relatórios ganham o pagamento, só nas despesas pagas", () => {
    const data = {
      transactions: [{ ...market, ...patchSetPayment(market, "2026-11", pix) }, salary],
      creditTransactions: [],
      extraExpenses: [{ ...trip, payment: { method: "boleto", date: "2026-11-02" } as Payment }],
    };
    const rows = getReportRows(data, ["2026-11"], { entries: true, credit: false });
    expect(rows.find((r) => r.name === "Mercado")?.payment).toEqual(pix);
    expect(rows.find((r) => r.name === "IPVA")?.payment?.method).toBe("boleto");
    expect(rows.find((r) => r.name === "Salário")?.payment).toBeUndefined();

    const options = { summary: false, entries: true, credit: false } as never;
    const csv = buildCsv(data, ["2026-11"], options).split("\n");
    expect(csv[1]).toContain("Situação;Pagamento;Data do pagamento;Obs. do pagamento");
    expect(csv.find((l) => l.includes("Mercado"))).toMatch(/;Paga;Pix;08\/11\/2026;no app$/);
    expect(csv.find((l) => l.includes("Salário"))).toMatch(/;;;;$/);
    expect(buildTxt(data, ["2026-11"], options)).toContain("[Paga · Pix · 08/11/2026 — no app]");
  });

  it("pagamento com data de hoje ou passada conta como feito; só boleto futuro fica agendado", () => {
    const today = "2026-11-08";
    expect(isScheduled({ method: "boleto", date: "2026-11-08" }, today)).toBe(false);
    expect(isScheduled({ method: "boleto", date: "2026-11-07" }, today)).toBe(false);
    expect(isScheduled({ method: "boleto", date: "2026-11-09" }, today)).toBe(true);
    expect(paymentStatusLabel({ method: "boleto", date: "2026-11-09" }, today)).toBe("Agendada");
    expect(paymentStatusLabel({ method: "pix", date: "2026-11-08" }, today)).toBe("Paga");
    // pix e cartão nunca ficam agendados (e a data futura é recusada)
    expect(isScheduled({ method: "pix", date: "2999-01-01" }, today)).toBe(false);
    expect(validatePaymentTiming("pix", "2026-11-09", today)).toMatch(/Só boleto/);
    expect(validatePaymentTiming("credit", "2026-11-09", today)).not.toBeNull();
    expect(validatePaymentTiming("boleto", "2026-11-09", today)).toBeNull();
    expect(validatePaymentTiming("pix", "2026-11-08", today)).toBeNull();
  });

  it("o relatório diz Agendada para boleto futuro", () => {
    const data = {
      transactions: [{ ...market, ...patchSetPayment(market, "2026-11", { method: "boleto", date: "2999-01-01" }) }],
      creditTransactions: [],
      extraExpenses: [],
    };
    const options = { summary: false, entries: true, credit: false } as never;
    expect(buildTxt(data, ["2026-11"], options)).toContain("[Agendada · Boleto · 01/01/2999]");
    expect(buildCsv(data, ["2026-11"], options)).toContain(";Agendada;Boleto;01/01/2999;");
  });

  it("identifica fim de semana", () => {
    expect(isWeekend("2026-11-07")).toBe(true); // sábado
    expect(isWeekend("2026-11-08")).toBe(true); // domingo
    expect(isWeekend("2026-11-09")).toBe(false); // segunda
  });
});
