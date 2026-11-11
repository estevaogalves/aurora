import { useMemo } from "react";
import { getMaturityAlerts, maturityAlertKey, splitSeenMaturities, todayISO, type MaturityAlert } from "@/domain";
import { formatBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";

/**
 * Avisos de vencimento dos investimentos, no mesmo molde dos avisos de prazo das metas:
 * `unseen` é o que ainda não foi marcado como visto (conta no sino), `seen` fica em "Já vistos".
 * As chaves ficam em `seenAlerts`, junto com as das metas, com o prefixo `inv:`.
 */
export function useMaturityAlerts() {
  const investments = useFinanceStore((s) => s.investments);
  const seenKeys = useFinanceStore((s) => s.seenAlerts);
  const markAlertsSeen = useFinanceStore((s) => s.markAlertsSeen);
  const markAlertUnseen = useFinanceStore((s) => s.markAlertUnseen);

  const all = useMemo(() => getMaturityAlerts(investments, todayISO()), [investments]);
  const { unseen, seen } = useMemo(() => splitSeenMaturities(all, seenKeys), [all, seenKeys]);

  return {
    all,
    unseen,
    seen,
    markSeen: (alerts: MaturityAlert[]) => markAlertsSeen(alerts.map(maturityAlertKey)),
    markUnseen: (alert: MaturityAlert) => markAlertUnseen(maturityAlertKey(alert)),
  };
}

/** "Vence hoje", "Vence amanhã", "Vence em 12 dias", "Venceu há 3 dias". */
export function maturityStatus(alert: MaturityAlert): string {
  const { days } = alert;
  if (days < 0) return `Venceu há ${-days} ${days === -1 ? "dia" : "dias"}`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

/** O que fazer: o valor está registrado, resta resgatar ou reaplicar e anotar. */
export function maturityHint(alert: MaturityAlert): string {
  const value = formatBRL(alert.investment.currentValue);
  const where = alert.investment.institution;
  if (alert.level === "overdue") return `${value} em ${where}. Resgate ou reaplique e registre o resgate para sair deste aviso.`;
  return `${value} em ${where}. Registre o resgate quando o dinheiro cair.`;
}
