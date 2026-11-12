import { describe, expect, it } from "vitest";
import { debtProgress, detectedPayment, earlyPayoff, getDebtRelief, getDebtTotals, splitDebts, type Debt, type Transaction } from "./index";

const consorcio: Debt = { id: "d1", name: "Consórcio moto", installmentValue: 69700, totalInstallments: 60, paidInstallments: 12, nextMonth: "2026-12", linkedTransactionId: "fx" };
const emprestimo: Debt = { id: "d2", name: "Empréstimo", installmentValue: 30000, totalInstallments: 6, paidInstallments: 6, nextMonth: "2027-01" };
const celular: Debt = { id: "d3", name: "Celular", installmentValue: 20000, totalInstallments: 10, paidInstallments: 8, nextMonth: "2026-11" };

describe("dívidas e consórcios", () => {
  it("restantes, pago, saldo e mês da quitação", () => {
    expect(debtProgress(consorcio)).toEqual({ remaining: 48, paidTotal: 836400, balance: 3345600, payoffMonth: "2030-11", done: false, percent: 20 });
    // última parcela = próxima + (restantes − 1) meses: 2026-11 + 1 = 2026-12
    expect(debtProgress(celular).payoffMonth).toBe("2026-12");
  });

  it("dívida quitada vai para o histórico e não tem mês de quitação", () => {
    const p = debtProgress(emprestimo);
    expect(p).toMatchObject({ remaining: 0, balance: 0, payoffMonth: null, done: true, percent: 100 });
    const { active, paidOff } = splitDebts([consorcio, emprestimo, celular]);
    expect(active.map((d) => d.name)).toEqual(["Celular", "Consórcio moto"]); // quita antes primeiro
    expect(paidOff.map((d) => d.name)).toEqual(["Empréstimo"]);
  });

  it("quitação antecipada com desconto informado, sem passar do saldo", () => {
    expect(earlyPayoff(celular, 5000)).toEqual({ toPay: 35000, saved: 5000 }); // saldo 2 × 200 = 400
    expect(earlyPayoff(celular, 999999)).toEqual({ toPay: 0, saved: 40000 });
    expect(earlyPayoff(celular, -10)).toEqual({ toPay: 40000, saved: 0 });
  });

  it("totais só do que está em andamento", () => {
    expect(getDebtTotals([consorcio, emprestimo, celular])).toEqual({ count: 2, monthly: 89700, balance: 3345600 + 40000, lastPayoff: "2030-11" });
    expect(getDebtTotals([emprestimo])).toEqual({ count: 0, monthly: 0, balance: 0, lastPayoff: null });
  });

  it("a despesa fixa vinculada cai a partir do mês seguinte à última parcela; sem vínculo não entra", () => {
    const relief = getDebtRelief([consorcio, celular]);
    expect(relief).toEqual([{ debt: consorcio, from: "2030-12", amount: 69700 }]);
  });

  it("detecta o pagamento da parcela na despesa fixa vinculada", () => {
    const fixa: Transaction = { id: "fx", name: "Consórcio", amount: 69700, type: "expense", category: "Outros", month: "2026-01", fixed: true, payments: { "2026-12": { method: "pix", date: "2026-12-05" } } };
    expect(detectedPayment(consorcio, [fixa])).toEqual({ month: "2026-12", date: "2026-12-05" });
    expect(detectedPayment(consorcio, [{ ...fixa, payments: {} }])).toBeNull();
    expect(detectedPayment(celular, [fixa])).toBeNull(); // sem vínculo
  });
});
