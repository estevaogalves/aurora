import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ setPlanning: vi.fn(() => Promise.resolve()), setTransactionPayment: vi.fn(() => Promise.resolve()) }));
vi.mock("../repositories", () => ({ repository: repo }));

import { useFinanceStore } from "./FinanceStore";

const store = () => useFinanceStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useFinanceStore.setState({ budgets: {}, debts: [], closings: {}, dividendAssets: [], transactions: [{ id: "fx", name: "Consórcio", amount: 69700, type: "expense", category: "Outros", month: "2026-01", fixed: true }] });
});

describe("planejamento na store", () => {
  it("orçamento: define, muda e tira o limite, e manda o planejamento inteiro ao repositório", () => {
    store().setBudget("Alimentação", "2026-11", 80000);
    store().setBudget("Alimentação", "2027-01", 90000);
    expect(store().budgets).toEqual({ Alimentação: { "2026-11": 80000, "2027-01": 90000 } });
    expect(repo.setPlanning).toHaveBeenLastCalledWith({ budgets: store().budgets, debts: [], closings: {}, dividendAssets: [] });
    store().clearBudget("Alimentação");
    expect(store().budgets).toEqual({});
  });

  it("orçamento recusa valor inválido", () => {
    store().setBudget("Lazer", "2026-11", -5);
    store().setBudget("Lazer", "2026-11", 1.5);
    store().setBudget("", "2026-11", 100);
    expect(store().budgets).toEqual({});
    expect(repo.setPlanning).not.toHaveBeenCalled();
  });

  it("dívida: pagar uma parcela avança a próxima e para no total", () => {
    store().addDebt({ id: "d1", name: "Consórcio", installmentValue: 69700, totalInstallments: 2, paidInstallments: 0, nextMonth: "2026-12" });
    store().payDebtInstallment("d1");
    expect(store().debts[0]).toMatchObject({ paidInstallments: 1, nextMonth: "2027-01" });
    store().payDebtInstallment("d1");
    store().payDebtInstallment("d1");
    expect(store().debts[0]).toMatchObject({ paidInstallments: 2, nextMonth: "2027-02" });
    store().removeDebt("d1");
    expect(store().debts).toEqual([]);
  });

  it("fechar e reabrir o mês; carteira de dividendos", () => {
    store().closeMonth("2026-10", { closedAt: "2026-11-01", income: 1, expense: 1, balance: 0, byCategory: {} });
    expect(Object.keys(store().closings)).toEqual(["2026-10"]);
    store().reopenMonth("2026-10");
    expect(store().closings).toEqual({});
    store().addDividendAsset({ id: "a1", name: "HGLG11", invested: 100000, monthlyDividends: 800 });
    store().updateDividendAsset("a1", { monthlyDividends: 900 });
    expect(store().dividendAssets[0].monthlyDividends).toBe(900);
    store().removeDividendAsset("a1");
    expect(store().dividendAssets).toEqual([]);
  });
});

describe("dívida: valor realmente pago em cada parcela", () => {
  it("registrar a parcela com valor guarda o que foi pago naquele mês; sem valor, não guarda nada", () => {
    store().addDebt({ id: "d1", name: "Consórcio", installmentValue: 69700, totalInstallments: 5, paidInstallments: 0, nextMonth: "2026-12" });
    store().payDebtInstallment("d1");
    expect(store().debts[0].paidValues).toBeUndefined();
    store().payDebtInstallment("d1", 50000); // parcela de janeiro paga com desconto
    expect(store().debts[0]).toMatchObject({ paidInstallments: 2, nextMonth: "2027-02", paidValues: { "2027-01": 50000 } });
  });

  it("corrigir o valor de uma parcela já paga (só de meses pagos, só valores válidos)", () => {
    store().addDebt({ id: "d1", name: "Consórcio", installmentValue: 69700, totalInstallments: 5, paidInstallments: 2, nextMonth: "2026-12" });
    store().setDebtPaidValue("d1", "2026-11", 60000);
    expect(store().debts[0].paidValues).toEqual({ "2026-11": 60000 });
    store().setDebtPaidValue("d1", "2026-12", 1); // ainda não paga
    store().setDebtPaidValue("d1", "2026-10", -5);
    store().setDebtPaidValue("d1", "2026-10", 1.5);
    expect(store().debts[0].paidValues).toEqual({ "2026-11": 60000 });
    store().setDebtPaidValue("d1", "2026-10", 0); // 0 é um valor válido (parcela abonada)
    expect(store().debts[0].paidValues).toEqual({ "2026-11": 60000, "2026-10": 0 });
  });
});

describe("dívida vinculada a uma despesa fixa: pagar a despesa registra a parcela", () => {
  const debt = { id: "d1", name: "Consórcio", installmentValue: 69700, totalInstallments: 5, paidInstallments: 1, nextMonth: "2026-11", linkedTransactionId: "fx" };
  const pay = { method: "pix" as const, date: "2026-11-10" };

  it("pagar a despesa no mês da próxima parcela avança a dívida, sem guardar valor próprio (o valor segue Lançamentos)", () => {
    store().addDebt(debt);
    store().setTransactionPayment("fx", "2026-11", pay);
    expect(store().debts[0]).toMatchObject({ paidInstallments: 2, nextMonth: "2026-12" });
    expect(store().debts[0].paidValues).toBeUndefined();
  });

  it("pagar um mês que não é o da próxima parcela não mexe na dívida", () => {
    store().addDebt(debt);
    store().setTransactionPayment("fx", "2027-03", pay);
    expect(store().debts[0]).toMatchObject({ paidInstallments: 1, nextMonth: "2026-11" });
  });

  it("desmarcar o pagamento da última parcela paga desfaz o registro", () => {
    store().addDebt(debt);
    store().setTransactionPayment("fx", "2026-11", pay);
    store().setTransactionPayment("fx", "2026-11", null);
    expect(store().debts[0]).toMatchObject({ paidInstallments: 1, nextMonth: "2026-11" });
  });

  it("dívida sem vínculo não é afetada pelo pagamento da despesa", () => {
    store().addDebt({ ...debt, linkedTransactionId: undefined });
    store().setTransactionPayment("fx", "2026-11", pay);
    expect(store().debts[0]).toMatchObject({ paidInstallments: 1, nextMonth: "2026-11" });
  });
});
