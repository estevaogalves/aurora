import { describe, expect, it } from "vitest";
import { getInvestmentTotals, getMaturityAlerts, getPortfolioSummary, getUpcomingMaturities, replayInvestment, todayISO } from "@/domain";
import { getDemoInvestments } from "./demo";

describe("investimentos de exemplo do tour", () => {
  const { investments, movements } = getDemoInvestments();

  it("o valor atual e as cotas saem das movimentações, pela mesma regra do app", () => {
    for (const inv of investments) expect(replayInvestment(inv, movements)).toEqual(inv);
    const cdb = investments.find((i) => i.id === "demo-cdb")!;
    const fii = investments.find((i) => i.id === "demo-fii")!;
    expect(cdb.currentValue).toBe(1052000);
    expect(fii).toMatchObject({ currentValue: 318000, quantity: 100, avgPrice: 3000 });
  });

  it("mostra todos os cartões da tela: lucro, vencimento próximo e as duas distribuições", () => {
    expect(getInvestmentTotals(investments[0], movements).profit).toBe(52000);
    expect(getInvestmentTotals(investments[1], movements).profit).toBe(18000);
    const summary = getPortfolioSummary(investments, movements);
    expect(summary.byFamily).toHaveLength(2);
    expect(summary.byInstitution).toHaveLength(2);
    const today = todayISO();
    expect(getUpcomingMaturities(investments, today).map((m) => m.investment.id)).toEqual(["demo-cdb"]);
    // o exemplo vence daqui a 45 dias: aparece na tela, mas ainda não no sino (30 dias)
    expect(getMaturityAlerts(investments, today)).toEqual([]);
  });

  it("os ids de exemplo não se misturam com os de verdade (uuid)", () => {
    for (const x of [...investments, ...movements]) expect(x.id.startsWith("demo-")).toBe(true);
  });
});
