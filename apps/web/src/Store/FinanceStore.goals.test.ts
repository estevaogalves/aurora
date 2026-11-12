import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  addGoal: vi.fn(() => Promise.resolve()),
  updateGoal: vi.fn(() => Promise.resolve()),
  removeGoal: vi.fn(() => Promise.resolve()),
  addGoalMovement: vi.fn(() => Promise.resolve()),
  updateGoalMovement: vi.fn(() => Promise.resolve()),
  removeGoalMovement: vi.fn(() => Promise.resolve()),
  setSeenAlerts: vi.fn(() => Promise.resolve()),
}));
vi.mock("../repositories", () => ({ repository: repo }));

import { useFinanceStore } from "./FinanceStore";

const store = () => useFinanceStore.getState();
const goalOf = (id: string) => store().goals.find((g) => g.id === id)!;
const movementsOf = (id: string) => store().goalMovements.filter((m) => m.goalId === id);

beforeEach(() => {
  vi.clearAllMocks();
  useFinanceStore.setState({
    goals: [{ id: "g1", name: "Viagem", target: 500000, saved: 0, monthly: 0, deadline: null }],
    goalMovements: [],
    seenAlerts: [],
  });
});

describe("histórico de metas e porquinhos na store", () => {
  it("aporte, retirada e rendimento refazem o guardado e vão para o repositório", () => {
    store().addGoalMovement({ id: "m1", goalId: "g1", type: "contribution", date: "2026-11-01", amount: 10000 });
    store().addGoalMovement({ id: "m2", goalId: "g1", type: "yield", date: "2026-11-30", amount: 300 });
    store().addGoalMovement({ id: "m3", goalId: "g1", type: "withdrawal", date: "2026-11-15", amount: 2000 });
    expect(goalOf("g1").saved).toBe(8300);
    expect(goalOf("g1").yieldTotal).toBe(300);
    expect(repo.addGoalMovement).toHaveBeenCalledTimes(3);
  });

  it("corrigir e apagar uma movimentação refaz a meta", () => {
    store().addGoalMovement({ id: "m1", goalId: "g1", type: "contribution", date: "2026-11-01", amount: 10000 });
    store().updateGoalMovement("m1", { amount: 4000, note: "corrigido" });
    expect(goalOf("g1").saved).toBe(4000);
    expect(repo.updateGoalMovement).toHaveBeenCalledWith("m1", { amount: 4000, note: "corrigido" });
    store().removeGoalMovement("m1");
    expect(goalOf("g1").saved).toBe(0);
    expect(repo.removeGoalMovement).toHaveBeenCalledWith("m1");
  });

  it("contributeToGoal vira movimentação (aporte, retirada ou rendimento) com data, nota e origem", () => {
    store().contributeToGoal("g1", 5000, 100, { date: "2026-11-20", note: "sobra do mês", origin: "distribution|2026-11|balance|emergency" });
    const [contribution, yieldMove] = movementsOf("g1");
    expect(contribution).toMatchObject({ type: "contribution", amount: 5000, date: "2026-11-20", note: "sobra do mês", origin: "distribution|2026-11|balance|emergency" });
    expect(yieldMove).toMatchObject({ type: "yield", amount: 100 });
    expect(goalOf("g1").saved).toBe(5100);
    store().contributeToGoal("g1", -1000, 0, { date: "2026-11-25" });
    expect(movementsOf("g1")[2]).toMatchObject({ type: "withdrawal", amount: 1000 });
    expect(goalOf("g1").saved).toBe(4100);
  });

  it("meta que não existe é ignorada", () => {
    store().contributeToGoal("fantasma", 100);
    store().addGoalMovement({ id: "x", goalId: "fantasma", type: "contribution", date: "2026-11-01", amount: 1 });
    expect(store().goalMovements).toEqual([]);
    expect(repo.addGoalMovement).not.toHaveBeenCalled();
  });

  it("criar meta com valor guardado cria a meta zerada e o 'Saldo inicial' no histórico", () => {
    store().addGoal({ id: "g2", name: "Reserva", target: 100000, saved: 7000, yieldTotal: 200, monthly: 0, deadline: null });
    expect(repo.addGoal).toHaveBeenCalledWith(expect.objectContaining({ id: "g2", saved: 0 }));
    expect(movementsOf("g2").map((m) => [m.type, m.amount, m.note])).toEqual([["yield", 200, "Rendimentos até aqui"], ["adjustment", 7000, "Saldo inicial"]]);
    expect(goalOf("g2").saved).toBe(7000);
    expect(goalOf("g2").yieldTotal).toBe(200);
    // meta sem valor inicial não cria histórico
    store().addGoal({ id: "g3", name: "Vazia", target: 1000, saved: 0, monthly: 0, deadline: null });
    expect(movementsOf("g3")).toEqual([]);
  });

  it("editar o guardado vira um ajuste no histórico (e o resto do PATCH segue normal)", () => {
    store().addGoalMovement({ id: "m1", goalId: "g1", type: "contribution", date: "2026-11-01", amount: 10000 });
    store().updateGoal("g1", { name: "Viagem nova", saved: 25000, yieldTotal: 999 });
    expect(goalOf("g1")).toMatchObject({ name: "Viagem nova", saved: 25000 });
    expect(goalOf("g1").yieldTotal ?? 0).toBe(0);
    expect(movementsOf("g1").at(-1)).toMatchObject({ type: "adjustment", amount: 25000 });
    // o PATCH do repositório não leva guardado nem rendimentos
    expect(repo.updateGoal).toHaveBeenCalledWith("g1", { name: "Viagem nova" });
    // mesmo valor: nada de movimentação nova
    const n = store().goalMovements.length;
    store().updateGoal("g1", { saved: 25000 });
    expect(store().goalMovements.length).toBe(n);
  });

  it("apagar a meta apaga o histórico dela", () => {
    store().addGoalMovement({ id: "m1", goalId: "g1", type: "contribution", date: "2026-11-01", amount: 10000 });
    store().removeGoal("g1");
    expect(store().goals).toEqual([]);
    expect(store().goalMovements).toEqual([]);
  });
});
