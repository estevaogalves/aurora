import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ removeCreditCard: vi.fn(() => Promise.resolve()) }));
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
