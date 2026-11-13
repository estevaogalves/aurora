import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, parsePrefs, toggleSection, usePrefsStore } from "./preferences";

describe("preferências", () => {
  it("tudo desligado por padrão", () => {
    expect(DEFAULT_PREFS).toMatchObject({ showHours: false, showBreathing: false, hoursPerMonth: 176, netIncome: null, dueWindow: 14, scenario: "conservative", clearedAlerts: [] });
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
  });
  it("seções de Lançamentos: abrir e fechar fica guardado", () => {
    toggleSection("expense-fixed");
    expect(usePrefsStore.getState().collapsedSections).toEqual(["expense-fixed"]);
    toggleSection("expense-fixed");
    expect(usePrefsStore.getState().collapsedSections).toEqual([]);
  });
  it("aceita só valores do tipo certo", () => {
    expect(parsePrefs(JSON.stringify({ showHours: true, hoursPerMonth: 160, netIncome: 300000, showBreathing: true, dismissedInsights: ["a", 5, "b"], dueWindow: 30, scenario: "average", clearedAlerts: ["k", 3], collapsedSections: ["expense-fixed", 7] }))).toEqual({ showHours: true, hoursPerMonth: 160, netIncome: 300000, showBreathing: true, dismissedInsights: ["a", "b"], dueWindow: 30, scenario: "average", clearedAlerts: ["k"], collapsedSections: ["expense-fixed"] });
    expect(parsePrefs(JSON.stringify({ scenario: "xyz" })).scenario).toBe("conservative");
    expect(parsePrefs(JSON.stringify({ dueWindow: 9 })).dueWindow).toBe(14);
    expect(parsePrefs(JSON.stringify({ showHours: "sim", hoursPerMonth: -5, netIncome: "x", showBreathing: 1 }))).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("{quebrado")).toEqual(DEFAULT_PREFS);
  });
});
