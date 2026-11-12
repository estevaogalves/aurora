import { describe, expect, it } from "vitest";
import { averageMonthlyContribution, investedForIncome, monthlyRate, parsePercent, passiveIncome, simulateGrowth, yieldOnCost, type Investment, type InvestmentMovement } from "./index";

describe("simulador: juros compostos (conferidos à mão)", () => {
  it("sem juros, o final é só o que foi investido", () => {
    const r = simulateGrowth({ initial: 0, monthly: 100000, years: 1, annualRate: 0 })!;
    expect(r).toMatchObject({ invested: 1200000, final: 1200000, interest: 0 });
    expect(r.points).toHaveLength(2);
  });

  it("só valor inicial: R$ 10.000 a 10% a.a. por 2 anos = R$ 12.100", () => {
    const r = simulateGrowth({ initial: 1000000, monthly: 0, years: 2, annualRate: 10 })!;
    expect(r.final).toBe(1210000);
    expect(r.interest).toBe(210000);
    expect(r.points.map((p) => p.value)).toEqual([1000000, 1100000, 1210000]);
  });

  it("R$ 1.000 por mês a 12% a.a. por 1 ano ≈ R$ 12.646,90 (1000 × ((1+r)^12 − 1) / r, com r = 1,12^(1/12) − 1)", () => {
    const r = simulateGrowth({ initial: 0, monthly: 100000, years: 1, annualRate: 12 })!;
    expect(r.invested).toBe(1200000);
    expect(Math.abs(r.final - 1264690)).toBeLessThan(200);
    expect(monthlyRate(12)).toBeCloseTo(0.0094888, 6);
  });

  it("dados inválidos devolvem null", () => {
    expect(simulateGrowth({ initial: 0, monthly: -1, years: 1, annualRate: 5 })).toBeNull();
    expect(simulateGrowth({ initial: 0, monthly: 1, years: 0, annualRate: 5 })).toBeNull();
    expect(simulateGrowth({ initial: 0, monthly: 1, years: 61, annualRate: 5 })).toBeNull();
    expect(simulateGrowth({ initial: 0, monthly: 1, years: 1, annualRate: 101 })).toBeNull();
    expect(simulateGrowth({ initial: 0, monthly: 1, years: 1, annualRate: Number.NaN })).toBeNull();
  });
});

describe("simulador: dividendos", () => {
  it("R$ 100.000 a 6% ao ano rendem R$ 500 por mês", () => {
    expect(passiveIncome(10000000, 6)).toBe(50000);
    expect(passiveIncome(0, 6)).toBe(0);
  });
  it("quanto investir para R$ 500 por mês a 6% ao ano: R$ 100.000", () => {
    expect(investedForIncome(50000, 6)).toBe(10000000);
    expect(investedForIncome(50000, 0)).toBeNull();
  });
  it("yield on cost: R$ 400 por mês sobre R$ 80.000 = 6% ao ano", () => {
    expect(yieldOnCost(40000, 8000000)).toBeCloseTo(6, 10);
    expect(yieldOnCost(40000, 0)).toBeNull();
  });
});

describe("aporte médio e leitura de %", () => {
  const inv = (id: string, family: Investment["family"]): Investment => ({ id, name: id, family, institution: "X", appliedAt: "2026-01-01", currentValue: 0 });
  const mv = (investmentId: string, date: string, amount: number, type: InvestmentMovement["type"] = "contribution"): InvestmentMovement => ({ id: `${investmentId}${date}${type}`, investmentId, type, date, amount });

  it("média dos aportes de mercado dos últimos 3 meses; ignora negócio, resgates e meses antigos", () => {
    const investments = [inv("a", "fixed"), inv("b", "business")];
    const movs = [mv("a", "2026-09-10", 30000), mv("a", "2026-11-10", 60000), mv("a", "2026-11-12", 3000, "redemption"), mv("b", "2026-11-10", 999999), mv("a", "2026-06-10", 999999)];
    expect(averageMonthlyContribution(investments, movs, "2026-11")).toBe(30000);
    expect(averageMonthlyContribution(investments, [], "2026-11")).toBe(0);
  });

  it("parsePercent", () => {
    expect(parsePercent("10,5")).toBe(10.5);
    expect(parsePercent("6%")).toBe(6);
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("abc")).toBeNull();
    expect(parsePercent("-3")).toBeNull();
  });
});
