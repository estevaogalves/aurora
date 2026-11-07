import type { Goal } from "./types";

/** Percentual guardado (0 a 100). Meta sem valor-alvo conta como 0. */
export function goalPercent(goal: Goal): number {
  if (goal.target <= 0) return 0;
  return Math.min(100, Math.round((goal.saved / goal.target) * 100));
}

/** Quanto falta para a meta (nunca negativo). */
export function goalRemaining(goal: Goal): number {
  return Math.max(0, goal.target - goal.saved);
}

export function isGoalDone(goal: Goal): boolean {
  return goal.target > 0 && goal.saved >= goal.target;
}

/**
 * Meses até concluir guardando o aporte mensal.
 * 0 se já concluiu, null se não há aporte mensal para prever.
 */
export function goalMonthsLeft(goal: Goal): number | null {
  const remaining = goalRemaining(goal);
  if (remaining === 0) return 0;
  if (goal.monthly <= 0) return null;
  return Math.ceil(remaining / goal.monthly);
}

/** Soma um aporte (centavos, pode ser negativo para retirada) sem deixar o guardado ficar negativo. */
export function patchContribution(goal: Goal, cents: number): Partial<Goal> {
  return { saved: Math.max(0, goal.saved + cents) };
}

/** Totais para o resumo da tela de metas. */
export function getGoalsSummary(goals: Goal[]) {
  return {
    active: goals.filter((g) => !isGoalDone(g)).length,
    nearlyDone: goals.filter((g) => !isGoalDone(g) && goalPercent(g) >= 80).length,
    saved: goals.reduce((s, g) => s + g.saved, 0),
    target: goals.reduce((s, g) => s + g.target, 0),
    monthly: goals.filter((g) => !isGoalDone(g)).reduce((s, g) => s + g.monthly, 0),
  };
}
