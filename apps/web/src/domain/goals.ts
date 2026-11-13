import { changeMonth, monthsDifference } from "../Utils/Date";
import type { Goal, GoalMovement, Month } from "./types";

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

/**
 * Quanto o porquinho terá no prazo guardando o aporte mensal (centavos), ou null sem prazo, sem aporte
 * ou com o prazo já no mês atual ou passado. Não conta rendimento.
 */
export function piggyAtDeadline(goal: Goal, today: Month): number | null {
  if (!goal.deadline || goal.monthly <= 0) return null;
  const monthsLeft = monthsDifference(goal.deadline, today);
  return monthsLeft > 0 ? goal.saved + goal.monthly * monthsLeft : null;
}

/** Meses de despesa fixa que a reserva sugerida cobre por padrão (o usuário pode escolher outro). */
export const RESERVE_SUGGESTED_MONTHS = 6;

const plainName = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Metas e porquinhos que já "são" o nome de uma linha da sugestão do saldo, sem ligar para acento, maiúscula ou
 * espaço: nome igual, ou um contido no outro ("Reserva" casa com "Reserva de emergência"). Serve para não pedir
 * para criar uma meta que já existe.
 */
export function findGoalsByName(goals: Goal[], label: string): Goal[] {
  const wanted = plainName(label);
  if (!wanted) return [];
  return goals.filter((g) => {
    const name = plainName(g.name);
    return name === wanted || name.includes(wanted) || wanted.includes(name);
  });
}

export interface ReserveSuggestion {
  /** centavos: 6 meses da despesa fixa mensal */
  suggested: number;
  /** a meta informada é menor que 1 mês de despesa fixa */
  belowOneMonth: boolean;
}

/**
 * Tamanho sugerido para a reserva de emergência: 6 meses da despesa fixa mensal. null se não há despesa fixa
 * cadastrada (sem dado, não sugere). `target` é o valor que o usuário digitou (0 ou vazio = ainda sem valor).
 */
export function reserveSuggestion(fixedMonthly: number, target = 0, months = RESERVE_SUGGESTED_MONTHS): ReserveSuggestion | null {
  if (!(fixedMonthly > 0) || !(months > 0)) return null;
  return { suggested: fixedMonthly * months, belowOneMonth: target > 0 && target < fixedMonthly };
}

export interface GoalForecast {
  /** meses até concluir, a partir de `today` */
  months: number;
  /** mês previsto para a conclusão */
  month: Month;
  /** centavos por mês usados na conta */
  perMonth: number;
  /** "history": média dos últimos aportes; "planned": aporte mensal definido na meta (sem aportes recentes) */
  basis: "history" | "planned";
}

/** Janela (em meses) da média dos últimos aportes. */
export const FORECAST_WINDOW_MONTHS = 3;

/**
 * Previsão de conclusão no ritmo atual: média mensal dos aportes líquidos (aportes − retiradas) dos últimos
 * `FORECAST_WINDOW_MONTHS` meses fechados (o mês de hoje só entra se já teve aporte; só conta os meses desde o primeiro
 * movimento da janela). Sem aportes recentes,
 * usa o aporte mensal definido na meta; sem nenhum dos dois, null. Meta concluída, sem valor-alvo ou porquinho: null.
 */
export function goalForecast(goal: Goal, movements: GoalMovement[], today: Month, window = FORECAST_WINDOW_MONTHS): GoalForecast | null {
  if (goal.piggy || goal.target <= 0 || isGoalDone(goal)) return null;
  const remaining = goalRemaining(goal);
  const own = movements.filter((m) => m.goalId === goal.id && (m.type === "contribution" || m.type === "withdrawal"));
  // o mês de hoje só entra na média se já teve movimento: um mês ainda sem aporte não pode puxar a média para baixo
  const end = own.some((m) => m.date.slice(0, 7) === today) ? today : changeMonth(today, -1);
  const start = changeMonth(end, -(window - 1));
  const recent = own.filter((m) => m.date.slice(0, 7) >= start && m.date.slice(0, 7) <= end);

  if (recent.length > 0) {
    const first = recent.reduce((min, m) => (m.date.slice(0, 7) < min ? m.date.slice(0, 7) : min), end);
    const span = Math.min(window, monthsDifference(end, first) + 1);
    const net = recent.reduce((sum, m) => sum + (m.type === "contribution" ? m.amount : -m.amount), 0);
    const perMonth = Math.round(net / span);
    if (perMonth > 0) {
      const months = Math.ceil(remaining / perMonth);
      return { months, month: changeMonth(today, months), perMonth, basis: "history" };
    }
  }
  if (goal.monthly > 0) {
    const months = Math.ceil(remaining / goal.monthly);
    return { months, month: changeMonth(today, months), perMonth: goal.monthly, basis: "planned" };
  }
  return null;
}

/** Totais para o resumo da tela de metas. */
export function getGoalsSummary(allGoals: Goal[]) {
  // porquinhos não têm meta: ficam fora destes totais
  const goals = allGoals.filter((g) => !g.piggy);
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
    if (goal.piggy || !goal.deadline || isGoalDone(goal)) continue;

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

/* ---------- histórico (movimentações) ---------- */

/** Movimentações em ordem cronológica (mesma data: a registrada primeiro vem antes). */
export function sortGoalMovements(movements: GoalMovement[]): GoalMovement[] {
  return movements.map((m, i) => ({ m, i })).sort((a, b) => a.m.date.localeCompare(b.m.date) || a.i - b.i).map((x) => x.m);
}

/**
 * Recalcula o guardado e o total de rendimentos refazendo as movimentações da meta em ordem de data. É a versão
 * em TypeScript de `ReplayGoal` (apps/api/internal/domain/goal.go) e as duas têm que dar o mesmo resultado.
 * O guardado nunca fica negativo; `yieldTotal` só aparece quando há rendimento.
 */
export function replayGoal(goal: Goal, movements: GoalMovement[]): Goal {
  let saved = 0;
  let yieldTotal = 0;
  for (const m of sortGoalMovements(movements.filter((x) => x.goalId === goal.id))) {
    if (m.type === "contribution") saved += m.amount;
    else if (m.type === "withdrawal") saved = Math.max(0, saved - m.amount);
    else if (m.type === "yield") {
      saved += m.amount;
      yieldTotal += m.amount;
    } else saved = m.amount;
  }
  const { yieldTotal: _old, ...rest } = goal;
  void _old;
  return { ...rest, saved: Math.max(0, saved), ...(yieldTotal > 0 && { yieldTotal }) };
}

export const GOAL_MOVEMENT_LABEL: Record<GoalMovement["type"], string> = {
  contribution: "Aporte",
  withdrawal: "Retirada",
  yield: "Rendimento",
  adjustment: "Ajuste de valor",
};

/**
 * Começo de histórico para metas que já tinham valor guardado e ainda não têm movimentação (dados antigos):
 * primeiro os rendimentos, depois um ajuste que define o guardado. Refazer a conta devolve os mesmos valores.
 * Os ids são fixos, então repetir a migração não cria nada duplicado.
 */
export function goalOpeningMovements(goals: Goal[], movements: GoalMovement[], date: string): GoalMovement[] {
  const withHistory = new Set(movements.map((m) => m.goalId));
  const out: GoalMovement[] = [];
  for (const g of goals) {
    if (withHistory.has(g.id)) continue;
    const yieldTotal = g.yieldTotal ?? 0;
    if (g.saved <= 0 && yieldTotal <= 0) continue;
    if (yieldTotal > 0) out.push({ id: `inicio-rendimento-${g.id}`, goalId: g.id, type: "yield", date, amount: yieldTotal, note: "Rendimentos até aqui" });
    out.push({ id: `inicio-saldo-${g.id}`, goalId: g.id, type: "adjustment", date, amount: Math.max(0, g.saved), note: "Saldo inicial" });
  }
  return out;
}
