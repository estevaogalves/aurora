import { describe, expect, it } from "vitest";
import { debtProgress, detectedPayment, earlyPayoff, getDebtRelief, getDebtTotals, getPaidInstallments, paidMonths, splitDebts, type Debt, type Transaction } from "./index";

const consorcio: Debt = { id: "d1", name: "Consórcio moto", installmentValue: 69700, totalInstallments: 60, paidInstallments: 12, nextMonth: "2026-12", linkedTransactionId: "fx" };
const emprestimo: Debt = { id: "d2", name: "Empréstimo", installmentValue: 30000, totalInstallments: 6, paidInstallments: 6, nextMonth: "2027-01" };
const celular: Debt = { id: "d3", name: "Celular", installmentValue: 20000, totalInstallments: 10, paidInstallments: 8, nextMonth: "2026-11" };

describe("dívidas e consórcios", () => {
  it("restantes, pago, saldo e mês da quitação", () => {
    expect(debtProgress(consorcio)).toEqual({ remaining: 48, paidTotal: 836400, balance: 3345600, payoffMonth: "2030-11", done: false, percent: 20, nextValue: 69700 });
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
    expect(detectedPayment(consorcio, [fixa])).toEqual({ month: "2026-12", date: "2026-12-05", value: 69700 });
    expect(detectedPayment(consorcio, [{ ...fixa, payments: {} }])).toBeNull();
    expect(detectedPayment(celular, [fixa])).toBeNull(); // sem vínculo
  });
});

describe("o valor da parcela acompanha a despesa fixa vinculada e o que foi pago", () => {
  const fixa = (over: Partial<Transaction> = {}): Transaction => ({ id: "fx", name: "Consórcio", amount: 69700, type: "expense", category: "Outros", month: "2026-01", fixed: true, ...over });
  const d: Debt = { id: "d", name: "Consórcio", installmentValue: 69700, totalInstallments: 12, paidInstallments: 2, nextMonth: "2026-12", linkedTransactionId: "fx" };

  it("sem alteração, vale o valor da dívida (e da despesa, que é igual)", () => {
    expect(debtProgress(d, [fixa()])).toMatchObject({ nextValue: 69700, balance: 10 * 69700, paidTotal: 2 * 69700 });
  });

  it("um desconto lançado só naquele mês na despesa fixa muda a parcela daquele mês", () => {
    const tx = [fixa({ monthlyValues: { "2026-12": 60000 } })];
    const p = debtProgress(d, tx);
    expect(p.nextValue).toBe(60000);
    expect(p.balance).toBe(60000 + 9 * 69700); // só dezembro tem o desconto
  });

  it("sem vínculo, a despesa não interfere", () => {
    const solto = { ...d, linkedTransactionId: undefined };
    expect(debtProgress(solto, [fixa({ monthlyValues: { "2026-12": 1000 } })]).nextValue).toBe(69700);
  });

  it("o valor pago registrado de uma parcela vale no lugar do valor-base, e entra no total pago", () => {
    // as duas parcelas pagas são outubro e novembro; a de novembro teve desconto
    expect(paidMonths(d)).toEqual(["2026-10", "2026-11"]);
    const corrected = { ...d, paidValues: { "2026-11": 50000 } };
    expect(debtProgress(corrected, [fixa()]).paidTotal).toBe(69700 + 50000);
    expect(getPaidInstallments(corrected, [fixa()]).map((x) => [x.number, x.month, x.value, x.adjusted])).toEqual([[2, "2026-11", 50000, true], [1, "2026-10", 69700, false]]);
  });

  it("a detecção do pagamento sugere o valor do mês", () => {
    const tx = [fixa({ monthlyValues: { "2026-12": 60000 }, payments: { "2026-12": { method: "pix", date: "2026-12-05" } } })];
    expect(detectedPayment(d, tx)).toEqual({ month: "2026-12", date: "2026-12-05", value: 60000 });
  });

  it("o alívio na Projeção usa o valor da última parcela", () => {
    expect(getDebtRelief([d], [fixa()])[0]).toMatchObject({ from: "2027-10", amount: 69700 });
  });
});
