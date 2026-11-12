import { formatWorkHours, hourlyRate, workHours } from "@/domain";
import { usePrefsStore } from "@/lib/preferences";
import { useMonthSummary } from "./selectors";

/** De onde vem o valor da hora: renda líquida base (informada), horas por mês e a conta feita. */
export function useHourInfo() {
  const { hoursPerMonth, netIncome } = usePrefsStore();
  const { totalIncome } = useMonthSummary();
  const income = netIncome ?? totalIncome;
  return { rate: hourlyRate(income, hoursPerMonth), income, hoursPerMonth, informed: netIncome !== null };
}

/** Valor da hora de trabalho (centavos): a renda líquida informada ou, sem ela, a renda do mês visto. 0 se não der para calcular. */
export function useHourRate(): number {
  return useHourInfo().rate;
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
