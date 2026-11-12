import { describe, expect, it } from "vitest";
import { findGoalsByName, goalForecast, goalOpeningMovements, makeDistributionOrigin, parseDistributionOrigin, replayGoal, reserveSuggestion, type Goal, type GoalMovement } from "./index";

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

describe("reserveSuggestion e goalForecast", () => {
  const g: Goal = { id: "g", name: "Reserva de emergência", target: 600000, saved: 100000, monthly: 0, deadline: null };

  it("sugere 6 meses da despesa fixa e avisa se a meta é menor que 1 mês", () => {
    expect(reserveSuggestion(200000, 0)).toEqual({ suggested: 1200000, belowOneMonth: false });
    expect(reserveSuggestion(200000, 150000)).toEqual({ suggested: 1200000, belowOneMonth: true });
    expect(reserveSuggestion(200000, 200000)?.belowOneMonth).toBe(false);
    expect(reserveSuggestion(0, 100000)).toBeNull();
  });

  it("previsão pela média dos últimos aportes", () => {
    // falta R$ 5.000; aportou R$ 300 + R$ 300 + R$ 300 em 3 meses = R$ 300 por mês -> 17 meses
    const movs = [gm("contribution", "2026-09-10", 30000), gm("contribution", "2026-10-10", 30000), gm("contribution", "2026-11-10", 30000)];
    expect(goalForecast(g, movs, "2026-11")).toEqual({ months: 17, month: "2028-04", perMonth: 30000, basis: "history" });
  });

  it("só conta os meses desde o primeiro aporte da janela e desconta retiradas", () => {
    const movs = [gm("contribution", "2026-10-05", 100000), gm("withdrawal", "2026-11-05", 20000)];
    // líquido 800 em 2 meses = 400/mês; faltam 5.000 -> 13 meses
    expect(goalForecast(g, movs, "2026-11")).toMatchObject({ perMonth: 40000, months: 13, basis: "history" });
  });

  it("aportes antigos (fora da janela) não contam; usa o aporte mensal definido", () => {
    const movs = [gm("contribution", "2026-01-10", 500000)];
    expect(goalForecast({ ...g, monthly: 50000 }, movs, "2026-11")).toMatchObject({ months: 10, perMonth: 50000, basis: "planned" });
    expect(goalForecast(g, movs, "2026-11")).toBeNull();
  });

  it("meta concluída, porquinho e meta sem valor não têm previsão", () => {
    expect(goalForecast({ ...g, saved: 600000 }, [], "2026-11")).toBeNull();
    expect(goalForecast({ ...g, piggy: true, target: 0 }, [], "2026-11")).toBeNull();
  });
});

describe("findGoalsByName e reserva com N meses", () => {
  const goals: Goal[] = [
    { id: "1", name: "Reserva de Emergência", target: 1, saved: 0, monthly: 0, deadline: null },
    { id: "2", name: "  viagem  ", target: 1, saved: 0, monthly: 0, deadline: null },
    { id: "3", name: "Porquinho", target: 0, saved: 0, monthly: 0, deadline: null, piggy: true },
  ];
  it("ignora acento, maiúscula e espaço, e aceita nome contido", () => {
    expect(findGoalsByName(goals, "reserva").map((g) => g.id)).toEqual(["1"]);
    expect(findGoalsByName(goals, "RESERVA DE EMERGENCIA").map((g) => g.id)).toEqual(["1"]);
    expect(findGoalsByName(goals, "Viagem").map((g) => g.id)).toEqual(["2"]);
    expect(findGoalsByName(goals, "Lazer")).toEqual([]);
    expect(findGoalsByName(goals, "  ")).toEqual([]);
  });
  it("a reserva pode ser de 3, 6 ou 12 meses", () => {
    expect(reserveSuggestion(100000, 0, 3)?.suggested).toBe(300000);
    expect(reserveSuggestion(100000, 0, 12)?.suggested).toBe(1200000);
    expect(reserveSuggestion(100000)?.suggested).toBe(600000);
  });
});
