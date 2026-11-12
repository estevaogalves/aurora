import { describe, expect, it } from "vitest";
import { budgetAlertKey, budgetLevel, budgetLimitFor, getBudgetAlerts, getBudgetLines, pruneSeenAlerts, type Budgets, type Transaction } from "./index";

let n = 0;
const exp = (amount: number, month: string, category: string): Transaction => ({ id: `t${n++}`, name: `d${n}`, amount, type: "expense", category: category as Transaction["category"], month });
const data = (transactions: Transaction[]) => ({ transactions, creditTransactions: [] });

describe("orçamento por categoria", () => {
  const budgets: Budgets = { Alimentação: { "2026-10": 80000, "2027-01": 100000 }, Lazer: { "2026-11": 30000, "2026-12": 0 } };

  it("o limite herda para os meses seguintes até a próxima mudança", () => {
    expect(budgetLimitFor(budgets, "Alimentação", "2026-09")).toBe(0); // antes do primeiro limite
    expect(budgetLimitFor(budgets, "Alimentação", "2026-10")).toBe(80000);
    expect(budgetLimitFor(budgets, "Alimentação", "2026-12")).toBe(80000); // herdado
    expect(budgetLimitFor(budgets, "Alimentação", "2027-03")).toBe(100000); // mudou em janeiro
    expect(budgetLimitFor(budgets, "Lazer", "2026-12")).toBe(0); // 0 tira o limite desde o mês
    expect(budgetLimitFor(budgets, "Saúde", "2026-12")).toBe(0);
  });

  it("níveis: normal, atenção a partir de 80% e estourado a partir de 100%", () => {
    expect(budgetLevel(79.9)).toBe("ok");
    expect(budgetLevel(80)).toBe("warn");
    expect(budgetLevel(99.99)).toBe("warn");
    expect(budgetLevel(100)).toBe("over");
    expect(budgetLevel(150)).toBe("over");
  });

  it("gasto contra limite, da categoria mais perto de estourar à mais folgada; sem limite não aparece", () => {
    const t = [exp(70000, "2026-11", "Alimentação"), exp(35000, "2026-11", "Lazer"), exp(99999, "2026-11", "Saúde")];
    const lines = getBudgetLines(data(t), budgets, "2026-11");
    expect(lines.map((l) => [l.category, l.spent, l.limit, Math.round(l.percent), l.level])).toEqual([
      ["Lazer", 35000, 30000, 117, "over"],
      ["Alimentação", 70000, 80000, 88, "warn"],
    ]);
  });

  it("mês futuro herda o limite e alterar o limite não muda nenhum gasto", () => {
    const t = [exp(10000, "2026-12", "Alimentação")];
    const lines = getBudgetLines(data(t), budgets, "2026-12");
    expect(lines).toEqual([{ category: "Alimentação", spent: 10000, limit: 80000, percent: 12.5, level: "ok" }]);
    expect(getBudgetLines(data(t), { Alimentação: { "2026-12": 20000 } }, "2026-12")[0].spent).toBe(10000);
  });

  it("alertas do sino: só 80% ou mais, e a chave muda quando estoura", () => {
    const t = [exp(70000, "2026-11", "Alimentação"), exp(10000, "2026-11", "Lazer")];
    const alerts = getBudgetAlerts(data(t), budgets, "2026-11");
    expect(alerts.map((a) => [a.category, a.level])).toEqual([["Alimentação", "warn"]]);
    expect(budgetAlertKey(alerts[0])).toBe("budget:Alimentação:2026-11:warn");
    const over = getBudgetAlerts(data([exp(90000, "2026-11", "Alimentação")]), budgets, "2026-11");
    expect(budgetAlertKey(over[0])).toBe("budget:Alimentação:2026-11:over");
  });

  it("as chaves vistas de meses antigos são podadas (as de orçamento também)", () => {
    const keys = ["budget:Lazer:2026-01:over", "budget:Lazer:2026-11:warn", "due:tx:a:2026-01:overdue", "inv:x:2026-01-01:soon"];
    expect(pruneSeenAlerts(keys, "2026-11-12")).toEqual(["budget:Lazer:2026-11:warn", "inv:x:2026-01-01:soon"]);
  });
});
