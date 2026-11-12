import { formatWorkHours, hourlyRate, workHours } from "@/domain";
import { usePrefsStore } from "@/lib/preferences";
import { useMonthSummary } from "./selectors";

/** Valor da hora de trabalho (centavos): a renda líquida informada ou, sem ela, a renda do mês visto. 0 se não der para calcular. */
export function useHourRate(): number {
  const { hoursPerMonth, netIncome } = usePrefsStore();
  const { totalIncome } = useMonthSummary();
  return hourlyRate(netIncome ?? totalIncome, hoursPerMonth);
}

/** Texto "≈ 3 h 30 min" de um valor, ou null quando o recurso está desligado ou falta a renda. */
export function useHoursText(): (cents: number) => string | null {
  const show = usePrefsStore((s) => s.showHours);
  const rate = useHourRate();
  return (cents) => {
    if (!show) return null;
    const h = workHours(cents, rate);
    return h === null ? null : formatWorkHours(h);
  };
}
