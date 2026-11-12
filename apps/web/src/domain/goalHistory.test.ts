import { describe, expect, it } from "vitest";
import { goalOpeningMovements, makeDistributionOrigin, parseDistributionOrigin, replayGoal, type Goal, type GoalMovement } from "./index";

const goal: Goal = { id: "g", name: "Viagem", target: 500000, saved: 0, monthly: 0, deadline: null };
const gm = (type: GoalMovement["type"], date: string, amount: number): GoalMovement => ({ id: `${type}${date}`, goalId: "g", type, date, amount });

// os mesmos casos de TestReplayGoal (apps/api/internal/domain/goal_test.go): as duas contas têm que bater
describe("replayGoal (paridade com ReplayGoal em Go)", () => {
  const cases: [string, GoalMovement[], number, number][] = [
    ["sem movimentações", [], 0, 0],
    ["aportes somam", [gm("contribution", "2026-01-05", 10000), gm("contribution", "2026-02-05", 2500)], 12500, 0],
    ["retirada subtrai e nunca passa de zero", [gm("contribution", "2026-01-05", 1000), gm("withdrawal", "2026-01-06", 5000)], 0, 0],
    ["rendimento soma ao guardado e ao total de rendimentos", [gm("contribution", "2026-01-05", 10000), gm("yield", "2026-01-31", 300)], 10300, 300],
    ["ajuste define o guardado e não mexe nos rendimentos", [gm("yield", "2026-01-01", 300), gm("adjustment", "2026-01-02", 50000), gm("contribution", "2026-01-03", 100)], 50100, 300],
    ["ordena por data, não pela ordem de cadastro", [gm("withdrawal", "2026-03-01", 4000), gm("contribution", "2026-01-01", 10000)], 6000, 0],
    ["mesma data: vale a ordem de cadastro", [gm("adjustment", "2026-01-01", 700), gm("contribution", "2026-01-01", 100)], 800, 0],
    ["saldo inicial de meta antiga com rendimentos", [gm("yield", "2026-01-01", 300), gm("adjustment", "2026-01-01", 10300)], 10300, 300],
    ["saldo inicial com guardado abaixo dos rendimentos", [gm("yield", "2026-01-01", 300), gm("adjustment", "2026-01-01", 100)], 100, 300],
  ];
  for (const [name, movements, saved, yieldTotal] of cases) {
    it(name, () => {
      const got = replayGoal(goal, movements);
      expect(got.saved).toBe(saved);
      expect(got.yieldTotal ?? 0).toBe(yieldTotal);
      expect(got).toMatchObject({ name: "Viagem", target: 500000 });
    });
  }

  it("só as movimentações da própria meta contam", () => {
    const other: GoalMovement = { id: "x", goalId: "outra", type: "contribution", date: "2026-01-01", amount: 999 };
    expect(replayGoal(goal, [other, gm("contribution", "2026-01-01", 10)]).saved).toBe(10);
  });
});

describe("começo de histórico das metas antigas", () => {
  it("reproduz o que estava guardado (guardado e rendimentos)", () => {
    const old: Goal = { ...goal, saved: 10300, yieldTotal: 300 };
    const opening = goalOpeningMovements([old], [], "2026-11-12");
    expect(opening.map((m) => m.type)).toEqual(["yield", "adjustment"]);
    expect(opening.map((m) => m.note)).toEqual(["Rendimentos até aqui", "Saldo inicial"]);
    const back = replayGoal({ ...old, saved: 0 }, opening);
    expect([back.saved, back.yieldTotal]).toEqual([10300, 300]);
  });

  it("guardado abaixo dos rendimentos também fecha", () => {
    const old: Goal = { ...goal, saved: 100, yieldTotal: 300 };
    const back = replayGoal({ ...old, saved: 0 }, goalOpeningMovements([old], [], "2026-11-12"));
    expect([back.saved, back.yieldTotal]).toEqual([100, 300]);
  });

  it("meta vazia ou que já tem histórico não ganha nada, e os ids são fixos", () => {
    expect(goalOpeningMovements([goal], [], "2026-11-12")).toEqual([]);
    const old: Goal = { ...goal, saved: 500 };
    expect(goalOpeningMovements([old], [gm("contribution", "2026-01-01", 1)], "2026-11-12")).toEqual([]);
    expect(goalOpeningMovements([old], [], "2026-11-12")[0].id).toBe(goalOpeningMovements([old], [], "2027-01-01")[0].id);
  });
});

describe("origem vinda da sugestão do saldo", () => {
  it("monta e lê o texto", () => {
    const text = makeDistributionOrigin({ month: "2026-11", source: "balance", slice: "emergency" });
    expect(text).toBe("distribution|2026-11|balance|emergency");
    expect(parseDistributionOrigin(text)).toEqual({ month: "2026-11", source: "balance", slice: "emergency" });
  });

  it("lançado à mão ou texto estranho não tem origem", () => {
    for (const x of [undefined, "", "manual", "distribution|2026-13|balance|x", "distribution|2026-11|balance"]) expect(parseDistributionOrigin(x)).toBeNull();
  });
});
