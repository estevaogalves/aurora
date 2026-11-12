import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => {
  const ok = () => vi.fn(() => Promise.resolve());
  return {
    addInvestment: ok(), updateInvestment: ok(), removeInvestment: ok(), addInvestmentMovement: ok(),
    updateInvestmentMovement: ok(), removeInvestmentMovement: ok(), setSeenAlerts: ok(),
  };
});
vi.mock("../repositories", () => ({ repository: repo }));

import { maturityAlertKey, type Investment } from "@/domain";
import { useFinanceStore } from "./FinanceStore";

const store = () => useFinanceStore.getState();
const cdb: Investment = { id: "i1", name: "CDB", family: "fixed", institution: "Banco A", appliedAt: "2026-01-01", currentValue: 0, maturityDate: "2026-12-01" };

beforeEach(() => {
  vi.clearAllMocks();
  useFinanceStore.setState({ investments: [], investmentMovements: [], seenAlerts: [] });
});

describe("investimentos na store: avisos de vencimento", () => {
  it("excluir o investimento apaga os avisos vistos dele e deixa os das metas e de outros investimentos", () => {
    const seen = [
      maturityAlertKey({ investment: cdb, level: "soon", days: 20 }),
      maturityAlertKey({ investment: cdb, level: "now", days: 3 }),
      maturityAlertKey({ investment: { ...cdb, id: "i2" }, level: "soon", days: 20 }),
      "goal-1:2026-12:soon",
    ];
    useFinanceStore.setState({ investments: [cdb, { ...cdb, id: "i2" }], seenAlerts: seen });

    store().removeInvestment("i1");

    expect(store().investments.map((i) => i.id)).toEqual(["i2"]);
    expect(store().seenAlerts).toEqual([seen[2], seen[3]]);
    expect(repo.removeInvestment).toHaveBeenCalledWith("i1");
    expect(repo.setSeenAlerts).toHaveBeenCalledWith([seen[2], seen[3]]);
  });

  it("sem avisos vistos do investimento, não regrava a lista de avisos", () => {
    useFinanceStore.setState({ investments: [cdb], seenAlerts: ["goal-1:2026-12:soon"] });
    store().removeInvestment("i1");
    expect(repo.setSeenAlerts).not.toHaveBeenCalled();
  });
});

describe("investimentos na store: movimentações", () => {
  it("cada movimentação refaz o valor atual e manda o resultado ao repositório", () => {
    useFinanceStore.setState({ investments: [cdb] });
    store().addInvestmentMovement({ id: "m1", investmentId: "i1", type: "contribution", date: "2026-03-01", amount: 100000 });
    store().addInvestmentMovement({ id: "m2", investmentId: "i1", type: "yield", date: "2026-03-02", amount: 5000 });

    expect(store().investments[0].currentValue).toBe(105000);
    expect(repo.addInvestmentMovement).toHaveBeenCalledTimes(2);
    expect(repo.updateInvestment).toHaveBeenLastCalledWith("i1", { currentValue: 105000, quantity: undefined, avgPrice: undefined });

    store().removeInvestmentMovement("m2");
    expect(store().investments[0].currentValue).toBe(100000);
    expect(repo.removeInvestmentMovement).toHaveBeenCalledWith("m2");
  });
});
