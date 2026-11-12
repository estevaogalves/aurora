import { changeMonth } from "../Utils/Date";
import { isBusiness } from "./investments";
import type { Investment, InvestmentMovement, Month } from "./types";

/**
 * Simulador de investimentos: juros compostos e renda passiva por dividendos. É uma conta ilustrativa, com a taxa
 * que o usuário digitar (nenhuma taxa é sugerida como promessa). Dinheiro em centavos; taxas em % ao ano.
 */

/** Limites aceitos pela tela: evitam números sem sentido. */
export const SIM_MAX_YEARS = 60;
export const SIM_MAX_RATE = 100;

export interface GrowthInput {
  /** centavos já investidos no início */
  initial: number;
  /** centavos aportados no fim de cada mês */
  monthly: number;
  years: number;
  /** % ao ano (ex.: 10 = 10% a.a.) */
  annualRate: number;
}

export interface GrowthPoint {
  /** 0 = hoje */
  year: number;
  invested: number;
  value: number;
}

export interface GrowthResult {
  invested: number;
  interest: number;
  final: number;
  /** um ponto por ano, do 0 ao último */
  points: GrowthPoint[];
}

/** Taxa mensal equivalente a uma taxa anual em % (juros compostos): (1 + a)^(1/12) − 1. */
export function monthlyRate(annualPercent: number): number {
  return (1 + annualPercent / 100) ** (1 / 12) - 1;
}

/** Evolução mês a mês com aporte no fim de cada mês. null se algum dado for inválido. */
export function simulateGrowth({ initial, monthly, years, annualRate }: GrowthInput): GrowthResult | null {
  const ok = Number.isFinite(initial) && initial >= 0 && Number.isFinite(monthly) && monthly >= 0 && Number.isInteger(years) && years >= 1 && years <= SIM_MAX_YEARS && Number.isFinite(annualRate) && annualRate >= 0 && annualRate <= SIM_MAX_RATE;
  if (!ok) return null;

  const r = monthlyRate(annualRate);
  let value = initial;
  let invested = initial;
  const points: GrowthPoint[] = [{ year: 0, invested: Math.round(invested), value: Math.round(value) }];
  for (let month = 1; month <= years * 12; month++) {
    value = value * (1 + r) + monthly;
    invested += monthly;
    if (month % 12 === 0) points.push({ year: month / 12, invested: Math.round(invested), value: Math.round(value) });
  }
  const last = points[points.length - 1];
  return { invested: last.invested, final: last.value, interest: last.value - last.invested, points };
}

/** Renda mensal passiva (centavos) de um valor investido com um yield anual em %: investido × yield ÷ 12. */
export function passiveIncome(invested: number, annualYield: number): number {
  if (!(invested > 0) || !(annualYield >= 0)) return 0;
  return Math.round((invested * (annualYield / 100)) / 12);
}

/** Quanto investir (centavos) para uma renda mensal desejada com um yield anual em %; null sem yield. */
export function investedForIncome(monthlyIncome: number, annualYield: number): number | null {
  if (!(monthlyIncome > 0) || !(annualYield > 0)) return null;
  return Math.round((monthlyIncome * 12) / (annualYield / 100));
}

/** Yield on cost em %: proventos de um mês × 12 ÷ valor investido. null sem valor investido. */
export function yieldOnCost(monthlyDividends: number, invested: number): number | null {
  if (!(invested > 0) || !(monthlyDividends >= 0)) return null;
  return ((monthlyDividends * 12) / invested) * 100;
}

/**
 * Aporte mensal médio dos investimentos de mercado nos últimos `window` meses (o mês `today` e os anteriores),
 * em centavos. É o valor inicial do simulador; 0 se não houve aporte. Negócio próprio não entra.
 */
export function averageMonthlyContribution(investments: Investment[], movements: InvestmentMovement[], today: Month, window = 3): number {
  const market = new Set(investments.filter((i) => !isBusiness(i)).map((i) => i.id));
  const start = changeMonth(today, -(window - 1));
  const total = movements
    .filter((m) => m.type === "contribution" && market.has(m.investmentId) && m.date.slice(0, 7) >= start && m.date.slice(0, 7) <= today)
    .reduce((sum, m) => sum + m.amount, 0);
  return Math.round(total / window);
}

/** "10,5" ou "10.5" ou "10,5%" -> 10.5; vazio ou inválido -> null. */
export function parsePercent(text: string): number | null {
  const t = text.trim().replace("%", "").replace(",", ".");
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
