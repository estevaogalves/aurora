import { describe, expect, it } from "vitest";
import { basisLabel, estimateVariableIncome, getProjection, getProjectionDetail, type Transaction } from "./index";

let n = 0;
const tx = (type: Transaction["type"], amount: number, month: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${n++}`, name: `${type}${n}`, amount, type, category: type === "income" ? "Renda" : "Moradia", month, ...extra });
const TODAY = "2026-11";

// salário fixo de R$ 3.000; renda variável: set R$ 500, out R$ 1.500, nov R$ 1.000
const data = {
  transactions: [
    tx("income", 300000, "2026-09", { fixed: true }),
    tx("expense", 100000, "2026-09", { fixed: true }),
    tx("income", 50000, "2026-09"),
    tx("income", 150000, "2026-10"),
    tx("income", 100000, "2026-11"),
  ],
  creditTransactions: [],
};

describe("cenários da renda variável", () => {
  it("conservador não estima nada; médio é a média; otimista é o maior", () => {
    expect(estimateVariableIncome(data, "conservative", TODAY).perMonth).toBe(0);
    expect(estimateVariableIncome(data, "average", TODAY)).toMatchObject({ perMonth: 100000, basis: ["2026-09", "2026-10", "2026-11"], noHistory: false });
    expect(estimateVariableIncome(data, "optimistic", TODAY).perMonth).toBe(150000);
  });

  it("histórico curto usa o que houver; sem nenhum mês, avisa", () => {
    const short = { transactions: [tx("income", 80000, "2026-11")], creditTransactions: [] };
    expect(estimateVariableIncome(short, "average", TODAY)).toMatchObject({ perMonth: 80000, basis: ["2026-11"] });
    expect(estimateVariableIncome({ transactions: [], creditTransactions: [] }, "average", TODAY)).toMatchObject({ perMonth: 0, noHistory: true });
  });

  it("mês sem movimento não puxa a média para baixo", () => {
    const gap = { transactions: [tx("income", 100000, "2026-09"), tx("income", 100000, "2026-11")], creditTransactions: [] };
    expect(estimateVariableIncome(gap, "average", TODAY).perMonth).toBe(100000);
  });

  it("a Projeção soma a estimativa só depois do mês atual, e o conservador reproduz o comportamento de antes", () => {
    const base = getProjection(data, [], "2026-12", 3);
    const conservative = getProjection(data, [], "2026-12", 3, { perMonth: 0, after: TODAY });
    expect(conservative).toEqual(base);
    const average = getProjection(data, [], "2026-11", 3, { perMonth: 100000, after: TODAY });
    // novembro é o mês atual: não recebe estimativa; dezembro e janeiro recebem
    expect(average.map((p) => p.income)).toEqual([300000, 400000, 400000]);
    expect(average[1].balance - base[0].balance).toBe(100000);
  });

  it("o detalhe do mês mostra a linha 'Renda variável estimada'", () => {
    const d = getProjectionDetail(data, [], "2026-12", { perMonth: 100000, after: TODAY });
    expect(d.incomes.at(-1)).toEqual({ name: "Renda variável estimada", amount: 100000, kind: "estimate" });
    expect(getProjectionDetail(data, [], "2026-11", { perMonth: 100000, after: TODAY }).incomes.some((l) => l.kind === "estimate")).toBe(false);
  });

  it("rótulo da base", () => {
    expect(basisLabel(["2026-09", "2026-10", "2026-11"])).toBe("Set–Nov");
    expect(basisLabel(["2026-11"])).toBe("Nov");
    expect(basisLabel([])).toBe("");
  });
});
