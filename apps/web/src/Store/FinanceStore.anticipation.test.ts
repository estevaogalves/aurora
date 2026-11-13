import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  setPlanning: vi.fn(() => Promise.resolve()),
  setTransactionPayment: vi.fn(() => Promise.resolve()),
  addTransaction: vi.fn(() => Promise.resolve()),
  updateTransaction: vi.fn(() => Promise.resolve()),
  removeTransaction: vi.fn(() => Promise.resolve()),
}));
vi.mock("../repositories", () => ({ repository: repo }));

import { debtProgress, getPaidInstallments, getTransactionsByMonth, type Debt } from "../domain";
import { useFinanceStore } from "./FinanceStore";

const store = () => useFinanceStore.getState();
const pay = { method: "pix" as const, date: "2026-11-10" };
// consórcio de 40 parcelas de R$ 700 (nov/2026 a fev/2030), vinculado à despesa fixa
const debt: Debt = { id: "d1", name: "Consórcio da moto", installmentValue: 70000, totalInstallments: 40, paidInstallments: 0, nextMonth: "2026-11", linkedTransactionId: "fx" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 12));
  useFinanceStore.setState({ budgets: {}, debts: [], closings: {}, dividendAssets: [], transactions: [{ id: "fx", name: "Consórcio", amount: 70000, type: "expense", category: "Outros", month: "2026-11", fixed: true, endMonth: "2030-02" }] });
});
afterEach(() => vi.useRealTimers());

describe("antecipação de parcelas (dívida vinculada)", () => {
  it("R$ 700 do mês + R$ 200 antecipando fev/2030: parcela do mês paga, fev/2030 antecipada, outros meses intactos", () => {
    store().addDebt(debt);
    store().setTransactionPayment("fx", "2026-11", pay); // parcela de nov paga em Lançamentos
    expect(store().anticipateInstallments("d1", [{ month: "2030-02", paidValue: 20000 }])).toBeNull();

    const d = store().debts[0];
    expect(d.anticipations?.["2030-02"]).toMatchObject({ originalValue: 70000, paidValue: 20000 });
    expect(d.startMonth).toBe("2026-11");
    const p = debtProgress(d, store().transactions);
    expect(p).toMatchObject({ remaining: 38, done: false, nextValue: 70000, payoffMonth: "2030-01", paidTotal: 70000 + 20000 });
    expect(d.nextMonth).toBe("2026-12");

    // Lançamentos: nov = R$ 700 (fixa) + R$ 200 (avulsa); fev/2030 da fixa vira zero
    const nov = getTransactionsByMonth(store().transactions, "2026-11");
    expect(nov.reduce((s, t) => s + t.amount, 0)).toBe(90000);
    expect(nov.find((t) => t.name === "Consórcio da moto: antecipação da parcela 02/2030")).toMatchObject({ amount: 20000, tags: ["consórcio"] });
    expect(getTransactionsByMonth(store().transactions, "2030-02").find((t) => t.id === "fx")?.amount).toBe(0);
    expect(getTransactionsByMonth(store().transactions, "2030-01").find((t) => t.id === "fx")?.amount).toBe(70000);

    // histórico: antecipada com original × pago
    const ant = getPaidInstallments(d, store().transactions).find((x) => x.anticipated);
    expect(ant).toMatchObject({ month: "2030-02", number: 40, value: 20000, originalValue: 70000 });
  });

  it("exige a parcela do mês paga primeiro e recusa mês que não está em aberto", () => {
    store().addDebt(debt);
    expect(store().anticipateInstallments("d1", [{ month: "2030-02", paidValue: 20000 }])).toMatch(/Pague primeiro/);
    store().setTransactionPayment("fx", "2026-11", pay);
    expect(store().anticipateInstallments("d1", [{ month: "2026-11", paidValue: 20000 }])).toMatch(/não está em aberto/);
    expect(store().anticipateInstallments("d1", [{ month: "2030-02", paidValue: 0 }])).toMatch(/maior que zero/);
    expect(store().anticipateInstallments("d1", [])).toMatch(/ao menos uma/);
    expect(store().debts[0].anticipations).toBeUndefined();
  });

  it("os pagamentos seguintes pulam a parcela antecipada e a última parcela em aberto vira a anterior", () => {
    store().addDebt({ ...debt, totalInstallments: 4 }); // nov, dez, jan, fev
    store().setTransactionPayment("fx", "2026-11", pay);
    store().anticipateInstallments("d1", [{ month: "2027-01", paidValue: 30000 }]);
    store().setTransactionPayment("fx", "2026-12", pay);
    expect(store().debts[0]).toMatchObject({ paidInstallments: 2, nextMonth: "2027-02" }); // pulou jan
    store().setTransactionPayment("fx", "2027-02", pay);
    expect(debtProgress(store().debts[0], store().transactions)).toMatchObject({ remaining: 0, done: true, percent: 100 });
    // desmarcar fev volta a próxima para fev
    store().setTransactionPayment("fx", "2027-02", null);
    expect(store().debts[0]).toMatchObject({ paidInstallments: 2, nextMonth: "2027-02" });
  });

  it("desfazer apaga a avulsa, devolve o valor do mês e tira a antecipação", () => {
    store().addDebt(debt);
    store().setTransactionPayment("fx", "2026-11", pay);
    store().anticipateInstallments("d1", [{ month: "2030-02", paidValue: 20000 }]);
    store().undoAnticipation("d1", "2030-02");
    expect(store().debts[0].anticipations).toBeUndefined();
    expect(store().transactions).toHaveLength(1);
    expect(getTransactionsByMonth(store().transactions, "2030-02").find((t) => t.id === "fx")?.amount).toBe(70000);
    expect(debtProgress(store().debts[0], store().transactions)).toMatchObject({ remaining: 39, payoffMonth: "2030-02" });
  });

  it("desconto num mês da despesa fixa vale só para aquele mês; antecipar guarda esse valor como original", () => {
    store().addDebt(debt);
    store().updateTransactionAmountForMonth("fx", "2027-03", 65000);
    store().setTransactionPayment("fx", "2026-11", pay);
    store().anticipateInstallments("d1", [{ month: "2027-03", paidValue: 40000 }]);
    expect(store().debts[0].anticipations?.["2027-03"]).toMatchObject({ originalValue: 65000, paidValue: 40000 });
    store().undoAnticipation("d1", "2027-03");
    expect(getTransactionsByMonth(store().transactions, "2027-03").find((t) => t.id === "fx")?.amount).toBe(65000);
  });

  it("dívida sem vínculo não antecipa", () => {
    store().addDebt({ ...debt, linkedTransactionId: undefined });
    expect(store().anticipateInstallments("d1", [{ month: "2030-02", paidValue: 20000 }])).toMatch(/despesa fixa/);
  });
});
