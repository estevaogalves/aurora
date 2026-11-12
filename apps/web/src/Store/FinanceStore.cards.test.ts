import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  removeCreditCard: vi.fn(() => Promise.resolve()),
  setCardPayment: vi.fn(() => Promise.resolve()),
  setCardAdjustments: vi.fn(() => Promise.resolve()),
  setTransactionPayment: vi.fn(() => Promise.resolve()),
  setExtraPayment: vi.fn(() => Promise.resolve()),
  updateTransaction: vi.fn(() => Promise.resolve()),
}));
vi.mock("../repositories", () => ({ repository: repo }));

import { useFinanceStore } from "./FinanceStore";

const store = () => useFinanceStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useFinanceStore.setState({
    creditCards: [
      { id: "nu", name: "Nubank", closingDay: 2, dueDay: 9 },
      { id: "in", name: "Inter", closingDay: 25, dueDay: 5 },
    ],
    transactions: [
      { id: "t1", name: "Mercado", amount: 5000, type: "expense", category: "Alimentação", month: "2026-11", cardId: "nu", purchaseDate: "2026-11-07" },
      { id: "t2", name: "Farmácia", amount: 3000, type: "expense", category: "Saúde", month: "2026-11", cardId: "in", purchaseDate: "2026-11-08" },
      { id: "t3", name: "Aluguel", amount: 100000, type: "expense", category: "Moradia", month: "2026-11" },
    ],
    extraExpenses: [{ id: "e1", name: "Presente", amount: 9000, month: "2026-12", cardId: "nu", purchaseDate: "2026-12-01" }],
    creditTransactions: [{ id: "c1", name: "TV", totalAmount: 30000, installments: 3, startMonth: "2026-11", category: "Outros", billingDay: 10, cardId: "nu" }],
  });
});

describe("remover um cartão", () => {
  it("solta compras, despesas avulsas e extras dele, sem apagar nenhuma, e não mexe nas dos outros cartões", () => {
    store().removeCreditCard("nu");

    expect(store().creditCards.map((k) => k.id)).toEqual(["in"]);
    expect(store().transactions.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(store().transactions.map((t) => t.cardId)).toEqual([undefined, "in", undefined]);
    // a data da compra fica no histórico
    expect(store().transactions[0].purchaseDate).toBe("2026-11-07");
    expect(store().extraExpenses).toHaveLength(1);
    expect(store().extraExpenses[0].cardId).toBeUndefined();
    expect(store().creditTransactions[0].cardId).toBeUndefined();
    expect(repo.removeCreditCard).toHaveBeenCalledWith("nu");
  });
});

describe("pagamento da fatura na store", () => {
  const pix = { method: "pix" as const, date: "2026-12-09" };

  it("marca e desmarca o pagamento do mês no cartão certo e avisa o repositório", () => {
    store().setCardPayment("nu", "2026-12", pix);
    expect(store().creditCards.find((k) => k.id === "nu")?.payments).toEqual({ "2026-12": pix });
    expect(store().creditCards.find((k) => k.id === "in")?.payments).toBeUndefined();
    expect(repo.setCardPayment).toHaveBeenCalledWith("nu", "2026-12", pix);

    store().setCardPayment("nu", "2026-12", null);
    expect(store().creditCards.find((k) => k.id === "nu")?.payments).toBeUndefined();
    expect(repo.setCardPayment).toHaveBeenLastCalledWith("nu", "2026-12", null);
  });

  it("cartão que não existe é ignorado", () => {
    store().setCardPayment("fantasma", "2026-12", pix);
    expect(repo.setCardPayment).not.toHaveBeenCalled();
  });

  it("o pagamento não muda nenhuma despesa", () => {
    const before = store().transactions;
    store().setCardPayment("nu", "2026-12", pix);
    expect(store().transactions).toBe(before);
  });
});

describe("ligar e soltar o cartão de uma despesa", () => {
  it("liga com o dia da compra e solta mantendo o dia no histórico", () => {
    store().setTransactionCard("t3", "nu", "2026-11-15");
    expect(store().transactions.find((t) => t.id === "t3")).toMatchObject({ cardId: "nu", purchaseDate: "2026-11-15" });
    expect(repo.updateTransaction).toHaveBeenLastCalledWith("t3", { cardId: "nu", purchaseDate: "2026-11-15" });

    store().setTransactionCard("t3", "");
    expect(store().transactions.find((t) => t.id === "t3")).toMatchObject({ cardId: undefined, purchaseDate: "2026-11-15" });
    // cardId undefined no patch: o ApiRepository o transforma em "" (soltar)
    expect(repo.updateTransaction).toHaveBeenLastCalledWith("t3", { cardId: undefined });
  });
});

describe("despesa no cartão só edita e exclui", () => {
  const pix = { method: "pix" as const, date: "2026-11-01" };

  it("não vira fixa (fixa no cartão é recorrência), mas a despesa comum continua podendo", () => {
    store().toggleTransactionFixed("t1"); // t1 está no cartão
    expect(store().transactions.find((t) => t.id === "t1")?.fixed).toBeFalsy();
    expect(repo.updateTransaction).not.toHaveBeenCalled();

    store().toggleTransactionFixed("t3"); // t3 não tem cartão
    expect(store().transactions.find((t) => t.id === "t3")?.fixed).toBe(true);
  });

  it("não é paga sozinha: o pagamento é da fatura", () => {
    store().setTransactionPayment("t1", "2026-11", pix);
    expect(store().transactions.find((t) => t.id === "t1")?.payments).toBeUndefined();
    expect(repo.setTransactionPayment).not.toHaveBeenCalled();
    store().setExtraPayment("e1", pix); // extra no cartão
    expect(store().extraExpenses[0].payment).toBeUndefined();
    expect(repo.setExtraPayment).not.toHaveBeenCalled();

    // sem cartão, continua pagando normalmente
    store().setTransactionPayment("t3", "2026-11", pix);
    expect(store().transactions.find((t) => t.id === "t3")?.payments?.["2026-11"]).toEqual(pix);
  });

  it("desmarcar um pagamento antigo continua permitido", () => {
    useFinanceStore.setState({
      transactions: store().transactions.map((t) => (t.id === "t1" ? { ...t, payments: { "2026-11": pix } } : t)),
    });
    store().setTransactionPayment("t1", "2026-11", null);
    expect(store().transactions.find((t) => t.id === "t1")?.payments).toBeUndefined();
    expect(repo.setTransactionPayment).toHaveBeenCalledWith("t1", "2026-11", null);
  });
});

describe("encerrar uma despesa fixa", () => {
  beforeEach(() => {
    useFinanceStore.setState({
      transactions: [
        { id: "f", name: "Cartão", amount: 30000, type: "expense", category: "Outros", fixed: true, month: "2026-06" },
        { id: "n", name: "Mercado", amount: 5000, type: "expense", category: "Alimentação", month: "2026-11" },
      ],
    });
  });

  it("encerra a partir do mês, grava o último mês em que vale e avisa o repositório", () => {
    expect(store().endTransactionFromMonth("f", "2026-12")).toBeNull();
    expect(store().transactions.find((t) => t.id === "f")?.endMonth).toBe("2026-11");
    expect(repo.updateTransaction).toHaveBeenLastCalledWith("f", { endMonth: "2026-11" });
  });

  it("recusa no mês em que a fixa começa, em despesa comum e em lançamento que não existe", () => {
    expect(store().endTransactionFromMonth("f", "2026-06")).toMatch(/Excluir/);
    expect(store().endTransactionFromMonth("n", "2026-12")).toMatch(/fixas/);
    expect(store().endTransactionFromMonth("nada", "2026-12")).toMatch(/não encontrado/);
    expect(repo.updateTransaction).not.toHaveBeenCalled();
  });

  it("reativar no mês seguinte ao fim só tira o fim", () => {
    store().endTransactionFromMonth("f", "2026-12");
    store().resumeTransaction("f", "2026-12");
    expect(store().transactions.find((t) => t.id === "f")?.endMonth).toBeUndefined();
    expect(repo.updateTransaction).toHaveBeenLastCalledWith("f", { endMonth: undefined });
  });

  it("reativar depois do fim deixa os meses do intervalo desativados e avisa o repositório", () => {
    store().endTransactionFromMonth("f", "2026-12");
    store().resumeTransaction("f", "2027-02");
    const f = store().transactions.find((t) => t.id === "f");
    expect(f?.endMonth).toBeUndefined();
    expect(f?.hiddenMonths).toEqual(["2026-12", "2027-01"]);
    expect(repo.updateTransaction).toHaveBeenLastCalledWith("f", { endMonth: undefined, hiddenMonths: ["2026-12", "2027-01"] });
  });
});

describe("ajustes da fatura na store", () => {
  const desconto = { id: "d1", amount: -37, note: "desconto" };
  const juros = { id: "j1", amount: 120, note: "juros" };

  it("troca a lista do mês no cartão certo e avisa o repositório", () => {
    store().setCardAdjustments("nu", "2026-12", [desconto, juros]);
    expect(store().creditCards.find((k) => k.id === "nu")?.adjustments).toEqual({ "2026-12": [desconto, juros] });
    expect(store().creditCards.find((k) => k.id === "in")?.adjustments).toBeUndefined();
    expect(repo.setCardAdjustments).toHaveBeenCalledWith("nu", "2026-12", [desconto, juros]);

    store().setCardAdjustments("nu", "2026-12", [juros]);
    expect(store().creditCards.find((k) => k.id === "nu")?.adjustments).toEqual({ "2026-12": [juros] });

    store().setCardAdjustments("nu", "2026-12", []);
    expect(store().creditCards.find((k) => k.id === "nu")?.adjustments).toBeUndefined();
  });

  it("cartão que não existe é ignorado e nenhuma despesa muda", () => {
    const before = store().transactions;
    store().setCardAdjustments("fantasma", "2026-12", [desconto]);
    expect(repo.setCardAdjustments).not.toHaveBeenCalled();
    store().setCardAdjustments("nu", "2026-12", [desconto]);
    expect(store().transactions).toBe(before);
  });
});
