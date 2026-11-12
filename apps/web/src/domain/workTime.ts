import type { Goal, Investment } from "./types";
import { isBusiness } from "./investments";

/** Horas de trabalho por mês, se o usuário não informar. */
export const DEFAULT_HOURS_PER_MONTH = 176;

/** Valor da hora de trabalho em centavos (renda líquida ÷ horas do mês). 0 se faltar renda ou horas. */
export function hourlyRate(netIncome: number, hoursPerMonth: number): number {
  if (!(netIncome > 0) || !(hoursPerMonth > 0)) return 0;
  return netIncome / hoursPerMonth;
}

/** Quantas horas de trabalho um valor (centavos) custa; null se não há valor da hora. */
export function workHours(amount: number, rate: number): number | null {
  if (!(rate > 0) || !Number.isFinite(amount)) return null;
  return amount / rate;
}

/** 3.5 -> "≈ 3 h 30 min"; menos de 1 h -> "≈ 20 min"; 12 -> "≈ 12 h"; 0 -> "≈ 0 min". */
export function formatWorkHours(hours: number): string {
  const totalMin = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  // acima de 20 h os minutos não importam
  if (h >= 20) return `≈ ${Math.round(totalMin / 60)} h`;
  if (h === 0) return `≈ ${m} min`;
  return m === 0 ? `≈ ${h} h` : `≈ ${h} h ${m} min`;
}

/** Dias de fôlego: quantos dias a reserva cobre a despesa média diária (despesa do mês ÷ dias). null se não der para calcular. */
export function breathingDays(reserve: number, monthExpense: number, daysInMonth = 30): number | null {
  if (!(reserve > 0) || !(monthExpense > 0) || !(daysInMonth > 0)) return null;
  return Math.floor(reserve / (monthExpense / daysInMonth));
}

/** Palavras que marcam uma meta ou porquinho como reserva (sem acento, minúsculas). */
const RESERVE_WORDS = ["reserva", "emergencia"];
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O nome indica uma reserva ("Reserva de emergência", "Reserva pra moto", "Emergência")? */
export const isReserveName = (name: string) => RESERVE_WORDS.some((w) => plain(name).includes(w));

/**
 * Reserva atual: o guardado nas metas e porquinhos com "reserva" ou "emergência" no nome, mais os investimentos
 * de liquidez diária (negócios próprios ficam de fora). Só usa o que o usuário cadastrou.
 */
export function reserveTotal(goals: Goal[], investments: Investment[]): number {
  const fromGoals = goals.filter((g) => isReserveName(g.name)).reduce((sum, g) => sum + g.saved, 0);
  const fromInvestments = investments.filter((i) => i.family === "liquid" && !isBusiness(i)).reduce((sum, i) => sum + i.currentValue, 0);
  return fromGoals + fromInvestments;
}

/**
 * "Dia da liberdade de gastos": a partir de que dia do mês a renda cobre as despesas fixas
 * (despesa fixa ÷ renda × dias do mês, arredondado para cima). null sem renda ou sem despesa fixa;
 * acima do último dia do mês, a renda não cobre as fixas (devolve null também).
 */
export function freedomDay(income: number, fixedExpense: number, daysInMonth = 30): number | null {
  if (!(income > 0) || !(fixedExpense > 0)) return null;
  const day = Math.ceil((fixedExpense / income) * daysInMonth);
  return day > daysInMonth ? null : Math.max(1, day);
}
