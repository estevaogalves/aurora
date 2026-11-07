import { describe, expect, it } from "vitest";
import {
  buildCsv,
  buildTxt,
  getGoalsSummary,
  getPeriodTotals,
  getProjection,
  getReportRows,
  goalMonthsLeft,
  goalPercent,
  goalRemaining,
  isGoalDone,
  lastMonths,
  patchContribution,
  type CreditTransaction,
  type Goal,
  type Transaction,
} from "./index";

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "g",
  name: "Viagem",
  target: 100000,
  saved: 25000,
  monthly: 10000,
  deadline: null,
  ...over,
});

describe("metas", () => {
  it("calcula percentual, falta e meses restantes", () => {
    expect(goalPercent(goal())).toBe(25);
    expect(goalRemaining(goal())).toBe(75000);
    expect(goalMonthsLeft(goal())).toBe(8); // 75000 / 10000 = 7,5 -> 8
  });

  it("meta sem aporte mensal não tem previsão", () => {
    expect(goalMonthsLeft(goal({ monthly: 0 }))).toBeNull();
  });

  it("meta concluída e meta sem valor", () => {
    const done = goal({ saved: 120000 });
    expect(goalPercent(done)).toBe(100);
    expect(goalRemaining(done)).toBe(0);
    expect(isGoalDone(done)).toBe(true);
    expect(goalMonthsLeft(done)).toBe(0);
    expect(goalPercent(goal({ target: 0 }))).toBe(0);
  });

  it("aporte soma e retirada nunca deixa negativo", () => {
    expect(patchContribution(goal(), 5000)).toEqual({ saved: 30000 });
    expect(patchContribution(goal(), -99999)).toEqual({ saved: 0 });
  });

  it("resumo ignora metas concluídas no aporte e nas ativas", () => {
    const s = getGoalsSummary([goal(), goal({ id: "b", saved: 90000 }), goal({ id: "c", saved: 100000 })]);
    expect(s).toMatchObject({ active: 2, nearlyDone: 1, saved: 215000, target: 300000, monthly: 20000 });
  });
});

const income: Transaction = { id: "i", name: "Salário", amount: 500000, type: "income", category: "Renda", month: "2026-01", fixed: true };
const rent: Transaction = { id: "r", name: "Aluguel", amount: 150000, type: "expense", category: "Moradia", month: "2026-01", fixed: true };
const market: Transaction = { id: "m", name: "Mercado", amount: 80000, type: "expense", category: "Alimentação", month: "2026-02" };
const tv: CreditTransaction = { id: "c", name: "TV", totalAmount: 30000, installments: 3, startMonth: "2026-02", category: "Outros" };
const data = { transactions: [income, rent, market], creditTransactions: [tv] };

describe("projeção com despesas extras", () => {
  it("soma fixas, parcelas e extras do mês e acumula o saldo", () => {
    const p = getProjection(data, [{ id: "e", name: "IPVA", amount: 50000, month: "2026-03" }], "2026-03", 3);
    expect(p.map((m) => m.month)).toEqual(["2026-03", "2026-04", "2026-05"]);
    // março: 500000 - (150000 fixa + 10000 parcela 2/3 + 50000 extra)
    expect(p[0]).toMatchObject({ income: 500000, expense: 210000, extraExpense: 50000, balance: 290000 });
    expect(p[1].balance).toBe(500000 - 150000 - 10000); // parcela 3/3
    expect(p[2].creditExpense).toBe(0);
    expect(p[2].accumulated).toBe(p[0].balance + p[1].balance + p[2].balance);
  });
});

describe("relatórios", () => {
  it("lastMonths devolve os meses terminando no informado", () => {
    expect(lastMonths("2026-03", 3)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(lastMonths("2026-01", 2)).toEqual(["2025-12", "2026-01"]);
  });

  it("totais do período e maior categoria incluem o crédito", () => {
    const t = getPeriodTotals(data, ["2026-01", "2026-02"]);
    expect(t.income).toBe(1000000);
    // jan: 150000 | fev: 150000 + 80000 + 10000
    expect(t.expense).toBe(390000);
    expect(t.balance).toBe(610000);
    expect(t.topCategory).toEqual({ category: "Moradia", value: 300000 });
  });

  it("período sem despesas não tem maior categoria", () => {
    expect(getPeriodTotals({ transactions: [], creditTransactions: [] }, ["2026-01"]).topCategory).toBeNull();
  });

  it("linhas do relatório respeitam as opções", () => {
    const all = getReportRows(data, ["2026-02"], { entries: true, credit: true });
    expect(all.map((r) => r.name)).toEqual(["Salário", "Aluguel", "Mercado", "TV"]);
    expect(getReportRows(data, ["2026-02"], { entries: false, credit: true })).toHaveLength(1);
    expect(getReportRows(data, ["2026-02"], { entries: true, credit: false })).toHaveLength(3);
  });

  it("CSV usa ponto e vírgula, vírgula decimal e escapa texto", () => {
    const csv = buildCsv(
      { transactions: [{ ...market, name: 'Mercado; "grande"' }], creditTransactions: [] },
      ["2026-02"],
      { summary: true, entries: true, credit: false },
    );
    expect(csv).toContain("Mês;Renda;Despesas;Saldo");
    expect(csv).toContain("2026-02;0,00;800,00;-800,00");
    expect(csv).toContain('"Mercado; ""grande"""');
    expect(csv).toContain(";Despesa;800,00;");
  });

  it("TXT traz resumo e lançamentos", () => {
    const txt = buildTxt(data, ["2026-02"], { summary: true, entries: true, credit: true });
    expect(txt).toContain("RESUMO");
    expect(txt).toContain("LANÇAMENTOS");
    expect(txt).toContain("TV");
    expect(buildTxt(data, ["2026-02"], { summary: false, entries: false, credit: false })).not.toContain("RESUMO");
  });
});
