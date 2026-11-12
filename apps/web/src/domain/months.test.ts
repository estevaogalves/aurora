import { describe, expect, it } from "vitest";
import { buildCsv, buildTxt, formatPeriodLabel, getAdjacentMonth, getCreditByMonth, getCreditProgress, getMonthSummary, getPeriodTotals, getProjection, periodFileName, sortMonths } from "./index";
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

describe("período do relatório: meses escolhidos", () => {
  it("ordena e tira repetidos", () => {
    expect(sortMonths(["2026-11", "2026-09", "2026-11", "2026-10"])).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("rótulo: um mês, meses seguidos, meses soltos e muitos meses soltos", () => {
    expect(formatPeriodLabel(["2026-11"])).toBe("novembro de 2026");
    expect(formatPeriodLabel(["2026-10", "2026-09", "2026-11"])).toBe("setembro de 2026 a novembro de 2026");
    expect(formatPeriodLabel(["2026-09", "2026-11", "2026-12"])).toBe("Set/26, Nov/26 e Dez/26");
    expect(formatPeriodLabel(["2026-01", "2026-03", "2026-05", "2026-07", "2026-09", "2026-11", "2026-12"])).toBe("Jan/26 a Dez/26 (7 meses escolhidos)");
    // virada de ano ainda conta como seguido
    expect(formatPeriodLabel(["2026-12", "2027-01"])).toBe("dezembro de 2026 a janeiro de 2027");
  });

  it("nome do arquivo", () => {
    expect(periodFileName(["2026-11"])).toBe("relatorio-2026-11");
    expect(periodFileName(["2026-09", "2026-10", "2026-11"])).toBe("relatorio-2026-09_a_2026-11");
    expect(periodFileName(["2026-09", "2026-11"])).toBe("relatorio-2026-09_2026-11");
    expect(periodFileName(["2026-01", "2026-03", "2026-05", "2026-07", "2026-09"])).toBe("relatorio-2026-01_a_2026-09_5-meses");
  });

  it("totais, CSV e TXT aceitam meses que não são seguidos", () => {
    const tx = (id: string, month: string, amount: number, type: "income" | "expense" = "expense") =>
      ({ id, name: id, amount, type, category: type === "income" ? "Renda" : "Lazer", month }) as const;
    const data = { transactions: [tx("a", "2026-09", 1000), tx("b", "2026-10", 5000), tx("c", "2026-11", 2000), tx("s", "2026-09", 9000, "income")], creditTransactions: [] };
    const months = ["2026-09", "2026-11"];
    const totals = getPeriodTotals(data, months);
    expect(totals.months.map((m) => m.month)).toEqual(months);
    expect(totals.expense).toBe(3000);
    expect(totals.income).toBe(9000);
    const csv = buildCsv(data, months, { summary: true, entries: true });
    expect(csv).toContain("2026-09;");
    expect(csv).toContain("2026-11;");
    expect(csv).not.toContain("2026-10;");
    expect(buildTxt(data, months, { summary: true, entries: false })).toContain("Período: Set/26 e Nov/26");
  });
});
