import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISTRIBUTION,
  distributeBalance,
  patchContribution,
  sumPercent,
  validateDistribution,
  type DistributionItem,
  type Goal,
} from "./index";

const goal: Goal = { id: "g", name: "Reserva", target: 100000, saved: 50000, monthly: 0, deadline: null };

describe("rendimento nas metas", () => {
  it("aporte e rendimento entram no guardado; só o rendimento entra no total de rendimentos", () => {
    expect(patchContribution(goal, 10000, 2500)).toEqual({ saved: 62500, yieldTotal: 2500 });
    expect(patchContribution({ ...goal, yieldTotal: 1000 }, 0, 500)).toEqual({ saved: 50500, yieldTotal: 1500 });
  });

  it("sem rendimento não mexe no total de rendimentos", () => {
    expect(patchContribution(goal, 10000)).toEqual({ saved: 60000 });
  });
});

describe("distribuição do saldo", () => {
  it("o padrão tem as cinco categorias e soma 100%", () => {
    expect(DEFAULT_DISTRIBUTION).toHaveLength(5);
    expect(sumPercent(DEFAULT_DISTRIBUTION)).toBe(100);
    expect(validateDistribution(DEFAULT_DISTRIBUTION)).toBeNull();
  });

  it("recusa soma diferente de 100%", () => {
    const items = DEFAULT_DISTRIBUTION.map((i, n) => (n === 0 ? { ...i, percent: 31 } : i));
    expect(validateDistribution(items)).toMatch(/somam 101%/);
  });

  it("aceita categoria nova se a soma fecha 100% e o percentual de 0 nas padrão", () => {
    const items: DistributionItem[] = [
      { id: "emergency", label: "Reserva", percent: 20 },
      { id: "invest", label: "Investimentos", percent: 20 },
      { id: "leisure", label: "Lazer", percent: 20 },
      { id: "education", label: "Educação", percent: 10 },
      { id: "costs", label: "Gastos pessoais", percent: 0 },
      { id: "x", label: "Viagem", percent: 30, custom: true },
    ];
    expect(validateDistribution(items)).toBeNull();
  });

  it("recusa remover uma das cinco padrão, nome repetido ou vazio e percentual quebrado", () => {
    expect(validateDistribution(DEFAULT_DISTRIBUTION.slice(1))).toMatch(/obrigatórias/);
    const dup = [...DEFAULT_DISTRIBUTION.map((i, n) => (n === 0 ? { ...i, percent: 20 } : i)), { id: "x", label: " lazer ", percent: 10, custom: true }];
    expect(validateDistribution(dup)).toMatch(/duas categorias/);
    const empty = [...DEFAULT_DISTRIBUTION.map((i, n) => (n === 0 ? { ...i, percent: 20 } : i)), { id: "x", label: "  ", percent: 10, custom: true }];
    expect(validateDistribution(empty)).toMatch(/nome/);
    const frac = DEFAULT_DISTRIBUTION.map((i, n) => (n === 0 ? { ...i, percent: 29.5 } : n === 1 ? { ...i, percent: 20.5 } : i));
    expect(validateDistribution(frac)).toMatch(/inteiro/);
  });

  it("a soma das partes é sempre o saldo, e o resto vai para a primeira fatia com percentual", () => {
    const items: DistributionItem[] = [
      ...DEFAULT_DISTRIBUTION.map((i, n) => ({ ...i, percent: n === 0 ? 0 : n === 1 ? 34 : n === 2 ? 33 : n === 3 ? 33 : 0 })),
      { id: "x", label: "Extra", percent: 0, custom: true },
    ];
    const parts = distributeBalance(1001, items);
    expect(parts.reduce((s, p) => s + p.value, 0)).toBe(1001);
    expect(parts[1].value).toBe(340 + 1); // 340 + 1 centavo que sobrou
    expect(parts[0].value).toBe(0);
  });

  it("saldo zero ou negativo não distribui", () => {
    expect(distributeBalance(0, DEFAULT_DISTRIBUTION).every((p) => p.value === 0)).toBe(true);
    expect(distributeBalance(-500, DEFAULT_DISTRIBUTION).every((p) => p.value === 0)).toBe(true);
  });
});

import { GOAL_ALERT_WINDOW_MONTHS, getGoalAlerts } from "./index";

describe("avisos de prazo das metas", () => {
  const base: Goal = { id: "g", name: "Viagem", target: 100000, saved: 40000, monthly: 0, deadline: null };
  const today = "2026-11";

  it("ignora meta sem prazo, concluída ou com prazo distante", () => {
    const goals = [
      base,
      { ...base, id: "a", deadline: "2026-12", saved: 100000 },
      { ...base, id: "b", deadline: "2027-03" },
    ];
    expect(getGoalAlerts(goals, today)).toEqual([]);
  });

  it("classifica vencida, vence neste mês e vence em breve, com a mais urgente primeiro", () => {
    const goals = [
      { ...base, id: "soon", deadline: "2027-02" },
      { ...base, id: "late", deadline: "2026-09" },
      { ...base, id: "now", deadline: "2026-11" },
    ];
    const alerts = getGoalAlerts(goals, today);
    expect(alerts.map((a) => [a.goal.id, a.level, a.monthsLeft])).toEqual([
      ["late", "overdue", -2],
      ["now", "now", 0],
      ["soon", "soon", 3],
    ]);
  });

  it("o limite é de GOAL_ALERT_WINDOW_MONTHS meses à frente", () => {
    expect(GOAL_ALERT_WINDOW_MONTHS).toBe(3);
    expect(getGoalAlerts([{ ...base, deadline: "2027-02" }], today)).toHaveLength(1);
    expect(getGoalAlerts([{ ...base, deadline: "2027-03" }], today)).toHaveLength(0);
  });

  it("calcula quanto guardar por mês e se o aporte previsto basta", () => {
    const [a] = getGoalAlerts([{ ...base, deadline: "2027-02", monthly: 20000 }], today);
    expect(a.remaining).toBe(60000);
    expect(a.neededPerMonth).toBe(20000); // 60000 / 3 meses
    expect(a.onTrack).toBe(true);

    const [b] = getGoalAlerts([{ ...base, deadline: "2027-02", monthly: 10000 }], today);
    expect(b.onTrack).toBe(false);

    const [c] = getGoalAlerts([{ ...base, deadline: "2026-11", monthly: 99999 }], today);
    expect(c.neededPerMonth).toBe(60000); // no mês do prazo é tudo de uma vez
    expect(c.onTrack).toBe(false);
  });

  it("virada de ano", () => {
    const [a] = getGoalAlerts([{ ...base, deadline: "2027-01" }], "2026-12");
    expect(a.monthsLeft).toBe(1);
  });
});

import { alertKey, goalAlertKey, splitSeenAlerts } from "./index";

describe("avisos vistos", () => {
  const goal: Goal = { id: "g", name: "Viagem", target: 100000, saved: 0, monthly: 0, deadline: "2026-12" };

  it("separa vistos de não vistos pela chave", () => {
    const [a] = getGoalAlerts([goal], "2026-11");
    expect(splitSeenAlerts([a], [])).toEqual({ unseen: [a], seen: [] });
    expect(splitSeenAlerts([a], [alertKey(a)])).toEqual({ unseen: [], seen: [a] });
  });

  it("o aviso volta quando a meta fica mais urgente ou o prazo muda", () => {
    const seenKeys = [alertKey(getGoalAlerts([goal], "2026-11")[0])]; // "vence em breve"
    expect(splitSeenAlerts(getGoalAlerts([goal], "2026-12"), seenKeys).unseen).toHaveLength(1); // virou "vence neste mês"
    expect(splitSeenAlerts(getGoalAlerts([{ ...goal, deadline: "2027-01" }], "2026-11"), seenKeys).unseen).toHaveLength(1);
    expect(goalAlertKey("g", "2026-12", "soon")).toBe("g:2026-12:soon");
  });
});
