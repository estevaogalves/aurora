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
  it("o formato antigo de uma só última parcela paga (prepaidLast) vira a lista ao carregar", async () => {
    const pre = { value: 20000, payment: { method: "pix", date: "2026-11-10" } };
    repo.load.mockResolvedValue({ transactions: [], creditTransactions: [], creditCards: [], notes: [], goals: [], extraExpenses: [], customCategories: [], debts: [{ id: "k", name: "Antigo", kind: "consortium", model: "linear", installmentValue: 70000, totalInstallments: 6, paidInstallments: 1, nextMonth: "2026-12", prepaidLast: pre }] });
    await store().hydrate();
    expect(store().debts[0].prepaidTail).toEqual([pre]);
    expect(store().debts[0]).not.toHaveProperty("prepaidLast");
  });

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

describe("consórcio linear: pagar a última parcela junto com a atual", () => {
  const pay = { method: "pix" as const, date: "2026-11-10" };
  const linear = { id: "c1", name: "Consórcio moto", kind: "consortium" as const, model: "linear" as const, installmentValue: 70000, totalInstallments: 6, paidInstallments: 0, nextMonth: "2026-11" };
  const effective = () => withDebtTransactions(store().transactions, store().debts);

  it("paga a atual (R$ 700) e a última (R$ 200 negociado): a última fica paga e o consórcio termina um mês antes", () => {
    store().addDebt(linear);
    store().payDebtInstallment("c1", 70000, pay, 20000);
    const d = store().debts[0];
    expect(d).toMatchObject({ paidInstallments: 1, nextMonth: "2026-12", prepaidTail: [{ value: 20000, payment: pay }] });
    expect(debtProgress(d)).toMatchObject({ remaining: 4, paidTotal: 90000, balance: 4 * 70000, payoffMonth: "2027-03", percent: 33 });
    // Lançamentos: nov = R$ 700 (parcela) + R$ 200 (última, linha própria, já paga); abr/2027 (a última) já não tem parcela
    const nov = getTransactionsByMonth(effective(), "2026-11").filter((t) => t.debtId === "c1");
    expect(nov.map((t) => [t.name, t.amount]).sort((a, b) => Number(b[1]) - Number(a[1]))).toEqual([["Consórcio moto", 70000], ["Consórcio moto (última parcela)", 20000]]);
    expect(nov.every((t) => t.category === "Consórcios" && t.debtOrigin === "consortium")).toBe(true);
    expect(getTransactionsByMonth(effective(), "2027-03").filter((t) => t.debtId === "c1").map((t) => t.amount)).toEqual([70000]);
    expect(getTransactionsByMonth(effective(), "2027-04").filter((t) => t.debtId === "c1")).toEqual([]);
  });

  it("os valores são editáveis: atual com reajuste e última com desconto", () => {
    store().addDebt(linear);
    store().payDebtInstallment("c1", 72000, pay, 15000);
    expect(store().debts[0].paidValues).toEqual({ "2026-11": 72000 });
    expect(store().debts[0].prepaidTail?.[0].value).toBe(15000);
  });

  it("não vale para dívida comum, consórcio progressivo, nem sobrando uma só parcela em aberto", () => {
    store().addDebt({ ...linear, kind: undefined, model: undefined, id: "x" });
    store().payDebtInstallment("x", 70000, pay, 20000);
    expect(store().debts[0].prepaidTail).toBeUndefined();
    store().addDebt({ ...linear, id: "p", model: "progressive", increment: 100 });
    store().payDebtInstallment("p", 70000, pay, 20000);
    expect(store().debts[1].prepaidTail).toBeUndefined();
    store().addDebt({ ...linear, id: "u", totalInstallments: 1 });
    store().payDebtInstallment("u", 70000, pay, 20000);
    expect(store().debts[2].prepaidTail).toBeUndefined();
    store().addDebt({ ...linear, id: "l" });
    store().payDebtInstallment("l", 70000, pay, 20000);
    store().payDebtInstallment("l", 70000, pay, 20000); // pode repetir: a seguinte é a penúltima
    expect(store().debts[3].prepaidTail).toHaveLength(2);
  });

  it("pode repetir todo mês: cada vez paga a atual e a última parcela em aberto, e o consórcio acaba mais cedo", () => {
    store().addDebt({ ...linear, totalInstallments: 10 }); // nov/2026 a ago/2027
    store().payDebtInstallment("c1", 70000, pay, 20000); // nov + a 10ª (ago)
    store().payDebtInstallment("c1", 70000, { ...pay, date: "2026-12-10" }, 21000); // dez + a 9ª (jul)
    store().payDebtInstallment("c1", 70000, { ...pay, date: "2027-01-10" }, 22000); // jan + a 8ª (jun)
    const d = store().debts[0];
    expect(d.prepaidTail?.map((p) => p.value)).toEqual([20000, 21000, 22000]);
    expect(d.paidInstallments).toBe(3);
    // 10 − 3 pagas − 3 finais = 4 em aberto: fev, mar, abr, mai de 2027; a quitação é maio/2027
    expect(debtProgress(d)).toMatchObject({ remaining: 4, payoffMonth: "2027-05", percent: 60, paidTotal: 3 * 70000 + 63000 });
    const months = (m: string) => getTransactionsByMonth(effective(), m).filter((t) => t.debtId === "c1").length;
    expect([months("2027-05"), months("2027-06"), months("2027-07"), months("2027-08")]).toEqual([1, 0, 0, 0]);
    // cada pagamento vira uma linha no mês em que saiu
    expect(getTransactionsByMonth(effective(), "2026-12").filter((t) => t.id.includes(":last:")).map((t) => t.amount)).toEqual([21000]);
    // desfazer é sempre o mais recente
    store().undoPrepaidLast("c1");
    expect(store().debts[0].prepaidTail?.map((p) => p.value)).toEqual([20000, 21000]);
    expect(debtProgress(store().debts[0])).toMatchObject({ remaining: 5, payoffMonth: "2027-06" });
  });

  it("pagar as parcelas até o fim quita sem gerar a última de novo; desfazer devolve a última", () => {
    store().addDebt({ ...linear, totalInstallments: 3 });
    store().payDebtInstallment("c1", 70000, pay, 20000); // paga nov + a última (jan)
    store().payDebtInstallment("c1", 70000); // dez
    expect(debtProgress(store().debts[0])).toMatchObject({ remaining: 0, done: true, percent: 100 });
    expect(getTransactionsByMonth(effective(), "2027-01").filter((t) => t.debtId === "c1" && !t.id.includes(":last:"))).toEqual([]);
    store().undoPrepaidLast("c1");
    expect(store().debts[0].prepaidTail).toBeUndefined();
    expect(debtProgress(store().debts[0])).toMatchObject({ remaining: 1, payoffMonth: "2027-01" });
  });

  it("mudar o total ou a posição descarta a última paga; excluir congela as pagas, inclusive a última", () => {
    store().addDebt(linear);
    store().payDebtInstallment("c1", 70000, pay, 20000);
    store().updateDebt("c1", { totalInstallments: 8 });
    expect(store().debts[0].prepaidTail).toBeUndefined();
    store().payDebtInstallment("c1", 70000, { ...pay, date: "2026-12-10" }, 21000);
    store().removeDebt("c1");
    const frozen = store().transactions.filter((t) => t.id !== "fx").map((t) => [t.name, t.amount, t.month]).sort((a, b) => Number(b[1]) - Number(a[1]) || String(a[2]).localeCompare(String(b[2])));
    expect(frozen).toEqual([["Consórcio moto", 70000, "2026-11"], ["Consórcio moto", 70000, "2026-12"], ["Consórcio moto (última parcela)", 21000, "2026-12"]]);
  });
});
