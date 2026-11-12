import { describe, expect, it } from "vitest";
import { buildClosing, compareWithPrevious, getClosingPending, getMonthSummary, isMonthClosed, type CreditCard, type Transaction } from "./index";

let n = 0;
const tx = (type: Transaction["type"], amount: number, month: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${n++}`, name: `${type}${n}`, amount, type, category: type === "income" ? "Renda" : "Moradia", month, ...extra });

const data = {
  transactions: [
    tx("income", 300000, "2026-10", { fixed: true }),
    tx("expense", 100000, "2026-10", { fixed: true, category: "Moradia" }),
    tx("expense", 40000, "2026-10", { category: "Alimentação" }),
    tx("expense", 80000, "2026-11", { category: "Alimentação", name: "Mercado" }),
    tx("expense", 20000, "2026-11", { category: "Lazer", name: "Cinema", payments: { "2026-11": { method: "pix", date: "2026-11-02" } } }),
  ],
  creditTransactions: [],
};

describe("fechamento do mês", () => {
  it("o retrato guarda renda, despesas, saldo, categorias e a anotação, sem tocar nos lançamentos", () => {
    const before = JSON.stringify(data.transactions);
    const c = buildClosing(data, "2026-11", "2026-12-01", "  gastei mais com mercado  ");
    expect(c).toEqual({ closedAt: "2026-12-01", income: 300000, expense: 200000, balance: 100000, byCategory: { Moradia: 100000, Alimentação: 80000, Lazer: 20000 }, note: "gastei mais com mercado" });
    expect(JSON.stringify(data.transactions)).toBe(before);
    expect(buildClosing(data, "2026-11", "2026-12-01", "  ")).not.toHaveProperty("note");
  });

  it("pendências: o que ainda não foi marcado como pago (o pago não entra)", () => {
    const pending = getClosingPending(data, "2026-11");
    expect(pending.map((p) => p.amount)).toEqual([100000, 80000]); // a fixa de moradia e o mercado; o cinema está pago
  });

  it("pendências incluem a fatura do cartão não paga, uma vez", () => {
    const card: CreditCard = { id: "c1", name: "Nubank", closingDay: 2, dueDay: 9 };
    const withCard = { ...data, creditCards: [card], transactions: [...data.transactions, tx("expense", 15000, "2026-11", { cardId: "c1", purchaseDate: "2026-10-20", name: "Loja" })] };
    const items = getClosingPending(withCard, "2026-11");
    expect(items.filter((p) => p.kind === "invoice")).toEqual([{ kind: "invoice", name: "Fatura Nubank", amount: 15000 }]);
    const paid = { ...withCard, creditCards: [{ ...card, payments: { "2026-11": { method: "pix" as const, date: "2026-11-09" } } }] };
    expect(getClosingPending(paid, "2026-11").some((p) => p.kind === "invoice")).toBe(false);
  });

  it("comparação com o mês anterior: diferenças e as categorias que mais mudaram", () => {
    const c = compareWithPrevious(data, "2026-11");
    expect(c).toMatchObject({ previous: "2026-10", hadData: true, incomeDelta: 0, expenseDelta: 60000, balanceDelta: -60000 });
    expect(c.categories[0]).toEqual({ category: "Alimentação", from: 40000, to: 80000 });
    expect(compareWithPrevious(data, "2026-09").hadData).toBe(false);
  });

  it("estado aberto ou fechado", () => {
    expect(isMonthClosed({ "2026-10": buildClosing(data, "2026-10", "2026-11-01", "") }, "2026-10")).toBe(true);
    expect(isMonthClosed({}, "2026-10")).toBe(false);
    // o resumo do mês continua o mesmo depois de fechado
    expect(getMonthSummary(data, "2026-10").balance).toBe(160000);
  });
});
