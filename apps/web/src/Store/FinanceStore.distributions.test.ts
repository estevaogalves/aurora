import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  setDistributionOverride: vi.fn(() => Promise.resolve()),
  setDistribution: vi.fn(() => Promise.resolve()),
  addGoalMovement: vi.fn(() => Promise.resolve()),
  removeGoalMovement: vi.fn(() => Promise.resolve()),
  addInvestmentMovement: vi.fn(() => Promise.resolve()),
  removeInvestmentMovement: vi.fn(() => Promise.resolve()),
  updateInvestment: vi.fn(() => Promise.resolve()),
  updateTransaction: vi.fn(() => Promise.resolve()),
}));
vi.mock("../repositories", () => ({ repository: repo }));

import { useFinanceStore } from "./FinanceStore";

const store = () => useFinanceStore.getState();
const itemsOf = (invest: number) => [
  { id: "emergency", label: "Reserva", percent: 100 - invest - 40 },
  { id: "invest", label: "Investir", percent: invest },
  { id: "leisure", label: "Lazer", percent: 20 },
  { id: "education", label: "Educação", percent: 10 },
  { id: "costs", label: "Gastos", percent: 10 },
];
const origin = (slice: string, source = "balance", month = "2026-12") => `distribution|${month}|${source}|${slice}`;

beforeEach(() => {
  vi.clearAllMocks();
  useFinanceStore.setState({
    distribution: null,
    distributionOverrides: {},
    transactions: [
      { id: "sal", name: "Salário", amount: 500000, type: "income", category: "Renda", month: "2026-12", fixed: true },
      { id: "t13", name: "13º", amount: 500000, type: "income", category: "Renda", month: "2026-12" },
      { id: "cin", name: "Cinema", amount: 100, type: "expense", category: "Lazer", month: "2026-12" },
    ],
    goals: [{ id: "g1", name: "Reserva", target: 0, saved: 0, monthly: 0, deadline: null, piggy: true }],
    goalMovements: [],
    investments: [{ id: "i1", name: "CDB", family: "fixed", institution: "Banco", appliedAt: "2026-01-01", currentValue: 0 }],
    investmentMovements: [],
  });
});

describe("percentuais próprios de uma distribuição na store", () => {
  it("grava só a chave daquela distribuição e daquele mês, e limpa só ela", () => {
    store().setDistributionOverride("2026-12", 2, itemsOf(30));
    store().setDistributionOverride("2026-12", 3, itemsOf(10));
    store().setDistributionOverride("2027-01", 2, itemsOf(20));
    expect(Object.keys(store().distributionOverrides).sort()).toEqual(["2026-12|2", "2026-12|3", "2027-01|2"]);
    expect(repo.setDistributionOverride).toHaveBeenCalledWith("2026-12", 2, itemsOf(30));
    // o padrão (Dist 1) não mudou
    expect(store().distribution).toBeNull();

    store().setDistributionOverride("2026-12", 2, null);
    expect(Object.keys(store().distributionOverrides).sort()).toEqual(["2026-12|3", "2027-01|2"]);
    expect(repo.setDistributionOverride).toHaveBeenLastCalledWith("2026-12", 2, null);
  });

  it("a Dist 1 não tem percentual próprio: usa o padrão", () => {
    store().setDistributionOverride("2026-12", 1, itemsOf(30));
    expect(store().distributionOverrides).toEqual({});
    expect(repo.setDistributionOverride).not.toHaveBeenCalled();
  });
});

describe("em qual distribuição a renda entra", () => {
  it("renda variável escolhe a Dist; voltar para a Dist 1 tira a marca", () => {
    store().setTransactionDistGroup("t13", 2);
    expect(store().transactions.find((t) => t.id === "t13")?.distGroup).toBe(2);
    expect(repo.updateTransaction).toHaveBeenCalledWith("t13", { distGroup: 2 });
    store().setTransactionDistGroup("t13", 1);
    expect(store().transactions.find((t) => t.id === "t13")?.distGroup).toBeUndefined();
  });

  it("renda fixa e despesa não entram numa distribuição própria", () => {
    store().setTransactionDistGroup("sal", 2);
    store().setTransactionDistGroup("cin", 2);
    expect(store().transactions.map((t) => t.distGroup)).toEqual([undefined, undefined, undefined]);
    expect(repo.updateTransaction).not.toHaveBeenCalled();
  });
});

describe("desfazer o envio de uma fatia", () => {
  it("apaga os aportes daquela fatia (meta e investimento), devolve o valor dos destinos e não mexe no resto", () => {
    store().contributeToGoal("g1", 30000, 0, { date: "2026-12-10", origin: origin("emergency") });
    store().contributeToGoal("g1", 5000, 0, { date: "2026-12-11", origin: origin("invest") });
    store().contributeToGoal("g1", 700, 0, { date: "2026-12-12" }); // à mão
    store().addInvestmentMovement({ id: "m-i", investmentId: "i1", type: "contribution", date: "2026-12-10", amount: 20000, origin: origin("emergency") });
    expect(store().goals[0].saved).toBe(35700);
    expect(store().investments[0].currentValue).toBe(20000);

    const removed = store().undoDistributionSend("2026-12", "balance", "emergency");
    expect(removed).toBe(2);
    // só o que veio daquela fatia saiu: a meta volta ao valor sem os 300 e o investimento zera
    expect(store().goals[0].saved).toBe(5700);
    expect(store().investments[0].currentValue).toBe(0);
    expect(store().goalMovements.map((m) => m.amount).sort((a, b) => a - b)).toEqual([700, 5000]);
    expect(repo.removeGoalMovement).toHaveBeenCalledTimes(1);
    expect(repo.removeInvestmentMovement).toHaveBeenCalledTimes(1);
  });

  it("não desfaz o que não é da fatia (outra distribuição, outro mês) e devolve 0 quando não há nada", () => {
    store().contributeToGoal("g1", 100, 0, { date: "2026-12-10", origin: origin("emergency", "d2") });
    store().contributeToGoal("g1", 200, 0, { date: "2026-11-10", origin: origin("emergency", "balance", "2026-11") });
    expect(store().undoDistributionSend("2026-12", "balance", "emergency")).toBe(0);
    expect(store().goals[0].saved).toBe(300);
    expect(store().undoDistributionSend("2026-12", "d2", "emergency")).toBe(1);
    expect(store().goals[0].saved).toBe(200);
  });
});
