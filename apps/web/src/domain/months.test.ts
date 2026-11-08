import { describe, expect, it } from "vitest";
import { getAdjacentMonth, getCreditByMonth, getCreditProgress, getMonthSummary, getProjection } from "./index";
import type { CreditTransaction, ExtraExpense } from "./types";

const notebook: CreditTransaction = { id: "c1", name: "Notebook", totalAmount: 300000, installments: 6, startMonth: "2026-11", category: "Outros" };
const empty = { transactions: [], creditTransactions: [notebook], extraExpenses: [] as ExtraExpense[], notes: [], goals: [] };
const TODAY = "2026-11";

describe("compras parceladas por mês", () => {
  it("novembro: parcela 1/6, faltam 5, termina em abril", () => {
    const [c] = getCreditByMonth([notebook], "2026-11");
    expect([c.currentInstallment, c.installmentValue]).toEqual([1, 50000]);
    expect(getCreditProgress(notebook, "2026-11")).toEqual({ done: 1, remaining: 5, endMonth: "2027-04" });
  });

  it("janeiro/2027: parcela 3/6 e resumo igual à projeção", () => {
    expect(getCreditByMonth([notebook], "2027-01")[0].currentInstallment).toBe(3);
    const extras: ExtraExpense[] = [{ id: "e", name: "IPVA", amount: 10000, month: "2027-01" }];
    const s = getMonthSummary({ transactions: [], creditTransactions: [notebook], extraExpenses: extras }, "2027-01");
    const p = getProjection({ transactions: [], creditTransactions: [notebook] }, extras, "2027-01", 1)[0];
    expect(s.totalExpense).toBe(p.expense);
    expect(s.balance).toBe(p.balance);
  });
});

describe("navegação entre meses", () => {
  it("mês anterior fica desativado quando o passado não tem movimento", () => {
    expect(getAdjacentMonth(empty, "2026-11", TODAY, -1)).toBeNull();
  });

  it("próximo mês nunca é bloqueado", () => {
    expect(getAdjacentMonth(empty, "2026-11", TODAY, 1)).toBe("2026-12");
    expect(getAdjacentMonth(empty, "2040-05", TODAY, 1)).toBe("2040-06");
  });

  it("do futuro volta ao mês atual mesmo sem movimento", () => {
    expect(getAdjacentMonth(empty, "2026-12", TODAY, -1)).toBe("2026-11");
  });

  it("pula meses passados sem movimento", () => {
    const data = { ...empty, notes: [{ id: "n", content: "x", date: "", pinned: false, month: "2026-05" }] };
    expect(getAdjacentMonth(data, "2026-11", TODAY, -1)).toBe("2026-05");
    expect(getAdjacentMonth(data, "2026-05", TODAY, 1)).toBe("2026-11");
    expect(getAdjacentMonth(data, "2026-05", TODAY, -1)).toBeNull();
  });
});
