import { describe, expect, it } from "vitest";
import { comparisonAvailable, getInsights, visibleInsights, type Goal, type Transaction } from "./index";

let n = 0;
const tx = (type: Transaction["type"], amount: number, month: string, category = "Outros", extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${n++}`, name: `${type}-${n}`, amount, type, category: category as Transaction["category"], month, ...extra });
const salary = (month: string, amount = 300000) => tx("income", amount, month, "Salário", { name: "Salário" });
const data = (transactions: Transaction[], goals: Goal[] = []) => ({ transactions, creditTransactions: [], goals });
const TODAY = "2026-11";

describe("insights automáticos", () => {
  it("sem 2 meses de dados, não mostra nada", () => {
    expect(getInsights(data([salary("2026-11"), tx("expense", 100000, "2026-11", "Alimentação")]), "2026-11", TODAY)).toEqual([]);
    expect(getInsights(data([]), "2026-11", TODAY)).toEqual([]);
  });

  it("categoria que subiu mais de 20% vs mês anterior", () => {
    const t = [
      salary("2026-10"), tx("expense", 50000, "2026-10", "Alimentação"),
      salary("2026-11"), tx("expense", 80000, "2026-11", "Alimentação"),
    ];
    const ins = getInsights(data(t), "2026-11", TODAY);
    const cat = ins.find((i) => i.id.startsWith("cat:"));
    expect(cat?.text).toMatch(/Alimentação subiu 60% em relação a outubro/);
    expect(cat?.to).toBe("/comparacao");
  });

  it("variação pequena (menos de 20% ou menos de R$ 50) não vira insight", () => {
    const small = [salary("2026-10"), tx("expense", 50000, "2026-10", "Alimentação"), salary("2026-11"), tx("expense", 55000, "2026-11", "Alimentação")];
    expect(getInsights(data(small), "2026-11", TODAY).some((i) => i.id.startsWith("cat:"))).toBe(false);
    const noise = [salary("2026-10"), tx("expense", 1000, "2026-10", "Lazer"), salary("2026-11"), tx("expense", 3000, "2026-11", "Lazer")];
    expect(getInsights(data(noise), "2026-11", TODAY).some((i) => i.id.startsWith("cat:"))).toBe(false);
  });

  it("saldo do mês vs média dos anteriores (diferença de 5 pontos ou mais)", () => {
    const t = [
      salary("2026-09"), tx("expense", 60000, "2026-09", "Moradia"), // 80%
      salary("2026-10"), tx("expense", 60000, "2026-10", "Moradia"), // 80%
      salary("2026-11"), tx("expense", 210000, "2026-11", "Moradia"), // 30%
    ];
    const rate = getInsights(data(t), "2026-11", TODAY).find((i) => i.id.startsWith("rate:"));
    expect(rate?.text).toBe("O saldo do mês equivale a 30% da renda; a média dos 2 meses anteriores foi 80%.");
  });

  it("despesa nova que passa de 10% da renda", () => {
    const t = [
      salary("2026-10"), tx("expense", 10000, "2026-10", "Moradia", { name: "Aluguel" }),
      salary("2026-11"), tx("expense", 10000, "2026-11", "Moradia", { name: "Aluguel" }), tx("expense", 60000, "2026-11", "Saúde", { name: "Dentista" }),
    ];
    const ins = getInsights(data(t), "2026-11", TODAY).find((i) => i.id.startsWith("new:"));
    expect(ins?.text).toMatch(/“Dentista” é uma despesa nova neste mês e equivale a 20% da renda/);
    // a que já existia no mês anterior não conta
    expect(getInsights(data(t), "2026-11", TODAY).some((i) => i.text.includes("Aluguel") && i.id.startsWith("new:"))).toBe(false);
  });

  it("meta atrasada e em dia", () => {
    const base = [salary("2026-10"), tx("expense", 100000, "2026-10"), salary("2026-11"), tx("expense", 100000, "2026-11")];
    const slow: Goal = { id: "g1", name: "Moto", target: 1000000, saved: 0, monthly: 10000, deadline: "2027-01" };
    const ok: Goal = { id: "g2", name: "Viagem", target: 100000, saved: 0, monthly: 60000, deadline: "2027-01" };
    const ins = getInsights(data(base, [slow, ok]), "2026-11", TODAY);
    expect(ins.find((i) => i.id.startsWith("goal-slow:"))?.text).toMatch(/Moto/);
    expect(ins.find((i) => i.id.startsWith("goal-ok:"))?.text).toMatch(/Viagem/);
  });

  it("mês futuro com saldo negativo na projeção", () => {
    const t = [
      salary("2026-10"), tx("expense", 100000, "2026-10"),
      salary("2026-11", 300000, ), 
      { ...salary("2026-11"), fixed: true },
      tx("expense", 400000, "2026-12", "Moradia", { fixed: true, name: "Parcela da obra" }),
    ];
    const ins = getInsights(data(t), "2026-11", TODAY);
    expect(ins.find((i) => i.id === "tight:2026-12")?.text).toMatch(/projeção de dezembro mostra saldo negativo/);
  });

  it("dispensar tira o insight e o limite é de 3", () => {
    const all = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, text: `t${i}`, to: "/metas" as const }));
    expect(visibleInsights(all, []).map((i) => i.id)).toEqual(["x0", "x1", "x2"]);
    expect(visibleInsights(all, ["x0", "x1"]).map((i) => i.id)).toEqual(["x2", "x3", "x4"]);
  });
});

describe("comparisonAvailable (a tela Comparação só existe com 2+ meses até hoje)", () => {
  const base = (t: Transaction[]) => ({ transactions: t, creditTransactions: [], notes: [] });
  it("só um mês com movimento, mesmo com gastos futuros: não", () => {
    const t = [salary("2026-11"), tx("expense", 50000, "2026-11"), tx("expense", 70000, "2026-12", "Moradia", { fixed: true })];
    expect(comparisonAvailable(base(t), TODAY)).toBe(false);
  });
  it("dois meses até hoje: sim", () => {
    const t = [salary("2026-10"), tx("expense", 50000, "2026-10"), salary("2026-11"), tx("expense", 50000, "2026-11")];
    expect(comparisonAvailable(base(t), TODAY)).toBe(true);
  });
});
