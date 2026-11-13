import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ setPlanning: vi.fn(() => Promise.resolve()), setTransactionPayment: vi.fn(() => Promise.resolve()), load: vi.fn(), addTransaction: vi.fn(() => Promise.resolve()), updateTransaction: vi.fn(() => Promise.resolve()), removeTransaction: vi.fn(() => Promise.resolve()) }));
vi.mock("../repositories", () => ({ repository: repo }));

import { debtProgress, getTransactionsByMonth, withDebtTransactions } from "../domain";
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
  it("registrar a parcela guarda o que foi pago naquele mês (o valor da parcela, se não veio outro)", () => {
    store().addDebt({ id: "d1", name: "Consórcio", installmentValue: 69700, totalInstallments: 5, paidInstallments: 0, nextMonth: "2026-12" });
    store().payDebtInstallment("d1");
    // sem valor, guarda o valor da parcela (mudar o valor depois não reescreve o que já foi pago)
    expect(store().debts[0].paidValues).toEqual({ "2026-12": 69700 });
    store().payDebtInstallment("d1", 50000); // parcela de janeiro paga com desconto
    expect(store().debts[0]).toMatchObject({ paidInstallments: 2, nextMonth: "2027-02", paidValues: { "2026-12": 69700, "2027-01": 50000 } });
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

describe("dívidas independentes: lançamentos gerados e pagamento sincronizado", () => {
  const pay = { method: "boleto" as const, date: "2026-11-10" };
  const debt = { id: "d1", name: "Consórcio carro", kind: "consortium" as const, model: "progressive" as const, installmentValue: 10000, increment: 5000, totalInstallments: 5, paidInstallments: 0, nextMonth: "2026-11" };
  const effective = () => withDebtTransactions(store().transactions, store().debts);

  it("cadastrar não cria despesa fixa nem lançamento gravado: as parcelas são geradas", () => {
    store().addDebt(debt);
    expect(store().transactions).toHaveLength(1); // só a despesa fixa que já existia no teste, intacta
    expect(store().debts[0].trackedFrom).toBe("2026-11");
    const dec = getTransactionsByMonth(effective(), "2026-12").filter((t) => t.debtId === "d1");
    expect(dec).toHaveLength(1);
    expect(dec[0]).toMatchObject({ amount: 15000, category: "Consórcios", debtOrigin: "consortium" });
    expect(repo.addTransaction).not.toHaveBeenCalled();
  });

  it("pagar em Lançamentos paga a parcela da dívida (com a forma e o dia) e desmarcar desfaz", () => {
    store().addDebt(debt);
    store().setTransactionPayment("debt:d1", "2026-11", pay);
    expect(store().debts[0]).toMatchObject({ paidInstallments: 1, nextMonth: "2026-12", paidValues: { "2026-11": 10000 }, payments: { "2026-11": pay } });
    expect(getTransactionsByMonth(effective(), "2026-11").find((t) => t.debtId === "d1")?.payments?.["2026-11"]).toEqual(pay);
    store().setTransactionPayment("debt:d1", "2026-11", null);
    expect(store().debts[0]).toMatchObject({ paidInstallments: 0, nextMonth: "2026-11" });
    expect(store().debts[0].payments).toBeUndefined();
  });

  it("só se paga em ordem: pagar outro mês em Lançamentos não faz nada", () => {
    store().addDebt(debt);
    store().setTransactionPayment("debt:d1", "2027-01", pay);
    expect(store().debts[0].paidInstallments).toBe(0);
    store().setTransactionPayment("debt:d1", "2026-11", pay);
    store().setTransactionPayment("debt:d1", "2026-11", null);
    store().setTransactionPayment("debt:d1", "2026-12", null); // nada a desfazer neste mês
    expect(store().debts[0].paidInstallments).toBe(0);
  });

  it("registrar em Dívidas e pagar em Lançamentos dão o mesmo contador", () => {
    store().addDebt(debt);
    store().payDebtInstallment("d1"); // pelo botão de Dívidas
    store().setTransactionPayment("debt:d1", "2026-12", pay); // pela linha de Lançamentos
    expect(store().debts[0]).toMatchObject({ paidInstallments: 2, nextMonth: "2027-01" });
    expect(debtProgress(store().debts[0])).toMatchObject({ remaining: 3, nextValue: 20000 });
  });

  it("a última parcela paga quita: nada a gerar depois, o histórico continua", () => {
    store().addDebt({ ...debt, totalInstallments: 2 });
    store().setTransactionPayment("debt:d1", "2026-11", pay);
    store().setTransactionPayment("debt:d1", "2026-12", { ...pay, date: "2026-12-10" });
    expect(debtProgress(store().debts[0]).done).toBe(true);
    expect(getTransactionsByMonth(effective(), "2027-01").filter((t) => t.debtId)).toEqual([]);
    expect(getTransactionsByMonth(effective(), "2026-12").filter((t) => t.debtId)).toHaveLength(1);
  });

  it("editar valor/acréscimo muda só as parcelas futuras (a paga mantém o valor)", () => {
    store().addDebt(debt);
    store().setTransactionPayment("debt:d1", "2026-11", pay);
    store().updateDebt("d1", { increment: 10000 });
    const byMonth = (m: string) => getTransactionsByMonth(effective(), m).find((t) => t.debtId === "d1")!.amount;
    expect(byMonth("2026-11")).toBe(10000); // paga
    expect(byMonth("2026-12")).toBe(20000); // 10000 + 1 × 10000
    expect(store().debts[0].payments).toEqual({ "2026-11": pay });
  });

  it("mudar a posição (pagas ou próxima parcela) recomeça o acompanhamento", () => {
    store().addDebt(debt);
    store().setTransactionPayment("debt:d1", "2026-11", pay);
    store().updateDebt("d1", { paidInstallments: 3, nextMonth: "2027-01" });
    expect(store().debts[0]).toMatchObject({ trackedFrom: "2027-01", paidInstallments: 3 });
    expect(store().debts[0].payments).toBeUndefined();
  });

  it("excluir: as parcelas pagas pelo app viram despesas comuns já pagas; o futuro some", () => {
    store().addDebt(debt);
    store().setTransactionPayment("debt:d1", "2026-11", pay);
    store().setTransactionPayment("debt:d1", "2026-12", { ...pay, date: "2026-12-09" });
    store().removeDebt("d1");
    expect(store().debts).toEqual([]);
    const frozen = store().transactions.filter((t) => t.id !== "fx");
    expect(frozen.map((t) => [t.month, t.amount, t.category, t.fixed, t.payments?.[t.month]?.date])).toEqual([
      ["2026-11", 10000, "Consórcios", false, "2026-11-10"],
      ["2026-12", 15000, "Consórcios", false, "2026-12-09"],
    ]);
    expect(getTransactionsByMonth(store().transactions, "2027-01").filter((t) => t.name === "Consórcio carro")).toEqual([]);
  });

  it("excluir dívida sem nenhum pagamento pelo app não cria nada", () => {
    store().addDebt(debt);
    store().removeDebt("d1");
    expect(store().transactions).toHaveLength(1);
    expect(repo.addTransaction).not.toHaveBeenCalled();
  });
});

describe("compatibilidade com cadastros antigos", () => {
  it("dívida vinculada a uma despesa fixa (modelo antigo) é descartada ao carregar; as sem vínculo seguem como dívida comum", async () => {
    const old = { id: "a", name: "Antiga", installmentValue: 100, totalInstallments: 5, paidInstallments: 1, nextMonth: "2026-12", linkedTransactionId: "fx" };
    const plain = { id: "b", name: "Celular", installmentValue: 20000, totalInstallments: 10, paidInstallments: 8, nextMonth: "2026-11" };
    repo.load.mockResolvedValue({ transactions: [], creditTransactions: [], creditCards: [], notes: [], goals: [], extraExpenses: [], customCategories: [], debts: [old, plain] });
    await store().hydrate();
    expect(store().debts.map((d) => d.id)).toEqual(["b"]);
    // sem `kind`: dívida comum; sem `trackedFrom`: aparece a partir da próxima parcela
    expect(withDebtTransactions([], store().debts)[0]).toMatchObject({ debtOrigin: "debt", month: "2026-11", endMonth: "2026-12" });
  });
});
