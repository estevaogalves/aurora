import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ updateCategory: vi.fn(() => Promise.resolve()) }));
vi.mock("../repositories", () => ({ repository: repo }));

import { useFinanceStore } from "./FinanceStore";

const store = () => useFinanceStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useFinanceStore.setState({
    customCategories: [{ id: "k1", name: "Pets", color: "#FF8800" }, { id: "k2", name: "Casa", color: "#00FF88" }],
    transactions: [
      { id: "t1", name: "Ração", amount: 5000, type: "expense", category: "Pets", month: "2026-11" },
      { id: "t2", name: "Mercado", amount: 3000, type: "expense", category: "Alimentação", month: "2026-11" },
    ],
    creditTransactions: [{ id: "c1", name: "Caminha", totalAmount: 30000, installments: 3, startMonth: "2026-11", category: "Pets" }],
  });
});

describe("editar categoria na store", () => {
  it("renomear leva as despesas e as compras no crédito que usavam o nome antigo e avisa o repositório", () => {
    store().updateCategory("k1", { name: "Bichos" });
    expect(store().customCategories[0]).toEqual({ id: "k1", name: "Bichos", color: "#FF8800" });
    expect(store().transactions.map((t) => t.category)).toEqual(["Bichos", "Alimentação"]);
    expect(store().creditTransactions[0].category).toBe("Bichos");
    expect(repo.updateCategory).toHaveBeenCalledWith("k1", { name: "Bichos" });
  });

  it("trocar só a cor não mexe em nenhum lançamento (a mesma lista, sem refazer)", () => {
    const before = { tx: store().transactions, cr: store().creditTransactions };
    store().updateCategory("k1", { color: "#123ABC" });
    expect(store().customCategories[0].color).toBe("#123ABC");
    expect(store().transactions).toBe(before.tx);
    expect(store().creditTransactions).toBe(before.cr);
  });

  it("trocar só a caixa das letras também propaga, e as outras categorias ficam como estão", () => {
    store().updateCategory("k1", { name: "pets" });
    expect(store().transactions[0].category).toBe("pets");
    expect(store().customCategories[1].name).toBe("Casa");
  });

  it("categoria que não existe é ignorada", () => {
    store().updateCategory("fantasma", { name: "X" });
    expect(repo.updateCategory).not.toHaveBeenCalled();
  });
});
