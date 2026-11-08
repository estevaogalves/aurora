import { monthsDifference } from "../Utils/Date";
import type { Goal, Month } from "./types";

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

export interface GoalDeadlinePlan {
  /** meses até o prazo, contando o mês do prazo: 0 = vence neste mês, negativo = já passou */
  monthsLeft: number;
  /** centavos por mês para chegar ao valor da meta no prazo (no mês do prazo ou depois, é o que falta todo) */
  recommended: number;
  /** o aporte mensal informado cobre o prazo; null se não há aporte informado */
  covered: boolean | null;
}

/**
 * Quanto juntar por mês para cumprir o prazo, a partir do que falta e dos meses restantes.
 * Vale mesmo quando o usuário informou um aporte: ele só diz se o aporte basta.
 * null se a meta não tem prazo ou já foi concluída.
 */
export function goalDeadlinePlan(goal: Goal, today: Month): GoalDeadlinePlan | null {
  if (!goal.deadline || isGoalDone(goal)) return null;
  const remaining = goalRemaining(goal);
  const monthsLeft = monthsDifference(goal.deadline, today);
  const recommended = monthsLeft <= 0 ? remaining : Math.ceil(remaining / monthsLeft);
  const covered = goal.monthly > 0 ? monthsLeft > 0 && goal.monthly * monthsLeft >= remaining : null;
  return { monthsLeft, recommended, covered };
}

/**
 * Registra um aporte (centavos, pode ser negativo para retirada) e, opcionalmente,
 * o rendimento do que já estava guardado. O rendimento entra no guardado e também
 * no total de rendimentos da meta. O guardado nunca fica negativo.
 */
export function patchContribution(goal: Goal, cents: number, yieldCents = 0): Partial<Goal> {
  const patch: Partial<Goal> = { saved: Math.max(0, goal.saved + cents + yieldCents) };
  if (yieldCents !== 0) patch.yieldTotal = (goal.yieldTotal ?? 0) + yieldCents;
  return patch;
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

/* ---------- avisos de prazo ---------- */

/** Com quantos meses de antecedência a meta começa a avisar. */
export const GOAL_ALERT_WINDOW_MONTHS = 3;

export type GoalAlertLevel = "overdue" | "now" | "soon";

export interface GoalAlert {
  goal: Goal;
  level: GoalAlertLevel;
  /** meses até o prazo: 0 = vence neste mês, negativo = já passou */
  monthsLeft: number;
  /** centavos que ainda faltam */
  remaining: number;
  /** centavos por mês para chegar a tempo (no prazo vencido ou no mês do prazo, é o que falta todo) */
  neededPerMonth: number;
  /** o aporte mensal previsto cobre o que falta até o prazo */
  onTrack: boolean;
}

/**
 * Identifica um aviso. Muda quando a meta passa de "vence em breve" para "vence neste mês" ou
 * "vencida", e quando o prazo é alterado, então o aviso volta a aparecer nesses casos.
 */
export const goalAlertKey = (goalId: string, deadline: Month | null, level: GoalAlertLevel) =>
  `${goalId}:${deadline ?? ""}:${level}`;

export const alertKey = (a: GoalAlert) => goalAlertKey(a.goal.id, a.goal.deadline, a.level);

/** Separa os avisos em ainda não vistos e já vistos. */
export function splitSeenAlerts(alerts: GoalAlert[], seen: string[]) {
  const set = new Set(seen);
  return {
    unseen: alerts.filter((a) => !set.has(alertKey(a))),
    seen: alerts.filter((a) => set.has(alertKey(a))),
  };
}

/**
 * Metas ainda não concluídas com prazo vencido, vencendo neste mês ou nos próximos
 * `GOAL_ALERT_WINDOW_MONTHS` meses. Da mais urgente para a menos urgente.
 * O prazo é um mês: a meta vale até o fim dele.
 */
export function getGoalAlerts(goals: Goal[], today: Month): GoalAlert[] {
  const alerts: GoalAlert[] = [];

  for (const goal of goals) {
    if (!goal.deadline || isGoalDone(goal)) continue;

    const monthsLeft = monthsDifference(goal.deadline, today);
    if (monthsLeft > GOAL_ALERT_WINDOW_MONTHS) continue;

    const remaining = goalRemaining(goal);
    const level: GoalAlertLevel = monthsLeft < 0 ? "overdue" : monthsLeft === 0 ? "now" : "soon";
    const neededPerMonth = monthsLeft <= 0 ? remaining : Math.ceil(remaining / monthsLeft);
    const onTrack = monthsLeft > 0 && goal.monthly > 0 && goal.monthly * monthsLeft >= remaining;

    alerts.push({ goal, level, monthsLeft, remaining, neededPerMonth, onTrack });
  }

  return alerts.sort((a, b) => a.monthsLeft - b.monthsLeft || b.remaining - a.remaining);
}
