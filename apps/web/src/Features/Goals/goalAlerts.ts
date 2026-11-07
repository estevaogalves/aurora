import { useMemo } from "react";
import { getGoalAlerts, type GoalAlert } from "@/domain";
import { formatBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { getCurrentMonth } from "@/Utils/Date";

/** Metas com prazo vencido ou chegando, da mais urgente para a menos urgente. */
export function useGoalAlerts(): GoalAlert[] {
  const goals = useFinanceStore((s) => s.goals);
  return useMemo(() => getGoalAlerts(goals, getCurrentMonth()), [goals]);
}

/** "Prazo vencido", "Vence neste mês", "Vence em 2 meses". */
export function deadlineStatus(alert: GoalAlert): string {
  if (alert.level === "overdue") {
    const late = -alert.monthsLeft;
    return `Prazo vencido há ${late} ${late === 1 ? "mês" : "meses"}`;
  }
  if (alert.level === "now") return "Vence neste mês";
  return `Vence em ${alert.monthsLeft} ${alert.monthsLeft === 1 ? "mês" : "meses"}`;
}

/** Quanto falta e o que fazer para chegar a tempo. */
export function paceHint(alert: GoalAlert): string {
  const left = formatBRL(alert.remaining);
  if (alert.level === "overdue") return `Faltam ${left}. Aporte o que puder ou edite o prazo da meta.`;
  if (alert.level === "now") return `Faltam ${left}. Para fechar neste mês, aporte o valor agora.`;
  if (alert.onTrack) return `Faltam ${left}. No ritmo do seu aporte mensal, você chega a tempo.`;
  return `Faltam ${left}: seriam ${formatBRL(alert.neededPerMonth)} por mês até o prazo.`;
}
