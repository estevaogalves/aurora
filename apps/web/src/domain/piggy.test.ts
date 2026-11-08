import { describe, expect, it } from "vitest";
import { getGoalAlerts, getGoalsSummary, piggyAtDeadline, type Goal } from "./index";

const main: Goal = { id: "m", name: "Viagem", target: 100000, saved: 20000, monthly: 5000, deadline: "2026-12" };
const piggy: Goal = { id: "p", name: "Porquinho", target: 0, saved: 3000, monthly: 1000, deadline: "2027-03", piggy: true };

describe("porquinho", () => {
  it("fica fora dos totais e dos avisos de prazo das metas", () => {
    const s = getGoalsSummary([main, piggy]);
    expect(s).toMatchObject({ active: 1, saved: 20000, target: 100000, monthly: 5000 });
    expect(getGoalAlerts([piggy], "2027-03")).toEqual([]);
    expect(getGoalAlerts([main], "2026-11")).toHaveLength(1);
  });

  it("projeta o guardado no prazo pelo aporte mensal", () => {
    expect(piggyAtDeadline(piggy, "2026-11")).toBe(3000 + 1000 * 4);
    expect(piggyAtDeadline({ ...piggy, monthly: 0 }, "2026-11")).toBeNull();
    expect(piggyAtDeadline({ ...piggy, deadline: null }, "2026-11")).toBeNull();
    expect(piggyAtDeadline(piggy, "2027-03")).toBeNull();
  });
});
