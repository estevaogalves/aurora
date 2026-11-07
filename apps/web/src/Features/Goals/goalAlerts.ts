import { useMemo } from "react";
import { alertKey, getGoalAlerts, splitSeenAlerts, type GoalAlert } from "@/domain";
import { formatBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { getCurrentMonth } from "@/Utils/Date";

/**
 * Avisos de prazo das metas. `all` mostra tudo (usado nos selos da tela de Metas);
 * `unseen` é o que ainda não foi marcado como visto (sino e Painel).
 */
export function useGoalAlerts() {
  const goals = useFinanceStore((s) => s.goals);
  const seenKeys = useFinanceStore((s) => s.seenAlerts);
  const markAlertsSeen = useFinanceStore((s) => s.markAlertsSeen);
  const markAlertUnseen = useFinanceStore((s) => s.markAlertUnseen);

  const all = useMemo(() => getGoalAlerts(goals, getCurrentMonth()), [goals]);
  const { unseen, seen } = useMemo(() => splitSeenAlerts(all, seenKeys), [all, seenKeys]);

  return {
    all,
    unseen,
    seen,
    markSeen: (alerts: GoalAlert[]) => markAlertsSeen(alerts.map(alertKey)),
    markUnseen: (alert: GoalAlert) => markAlertUnseen(alertKey(alert)),
  };
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
