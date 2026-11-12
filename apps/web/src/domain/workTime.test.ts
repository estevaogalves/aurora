import { describe, expect, it } from "vitest";
import { breathingDays, formatWorkHours, freedomDay, hourlyRate, reserveTotal, workHours, type Goal, type Investment } from "./index";

const goal = (name: string, saved: number): Goal => ({ id: name, name, target: 100000, saved, monthly: 0, deadline: null });
const inv = (family: Investment["family"], currentValue: number): Investment => ({ id: family, name: family, family, institution: "X", appliedAt: "2026-01-01", currentValue });

describe("horas de trabalho", () => {
  it("valor da hora = renda líquida ÷ horas do mês", () => {
    expect(hourlyRate(352000, 176)).toBe(2000); // R$ 3.520 / 176 h = R$ 20/h
    expect(hourlyRate(0, 176)).toBe(0);
    expect(hourlyRate(352000, 0)).toBe(0);
  });

  it("um valor em horas: R$ 100 com hora de R$ 20 = 5 h", () => {
    expect(workHours(10000, 2000)).toBe(5);
    expect(workHours(10000, 0)).toBeNull();
  });

  it("texto das horas", () => {
    expect(formatWorkHours(3.5)).toBe("≈ 3 h 30 min");
    expect(formatWorkHours(12)).toBe("≈ 12 h");
    expect(formatWorkHours(1 / 3)).toBe("≈ 20 min");
    expect(formatWorkHours(0)).toBe("≈ 0 min");
    expect(formatWorkHours(40.4)).toBe("≈ 40 h");
  });
});

describe("dias de fôlego", () => {
  it("reserva ÷ despesa média diária", () => {
    expect(breathingDays(300000, 300000)).toBe(30); // R$ 3.000 de reserva, R$ 3.000/mês = 30 dias
    expect(breathingDays(180000, 300000)).toBe(18);
  });
  it("sem reserva ou sem despesa, não calcula", () => {
    expect(breathingDays(0, 300000)).toBeNull();
    expect(breathingDays(300000, 0)).toBeNull();
  });
  it("a reserva vem de metas com reserva/emergência no nome e de liquidez diária (sem negócios)", () => {
    const total = reserveTotal(
      [goal("Reserva de emergência", 100000), goal("Reserva pra moto", 5000), goal("Viagem", 999999), goal("EMERGÊNCIA", 1000)],
      [inv("liquid", 20000), inv("fixed", 777777), inv("business", 555555)],
    );
    expect(total).toBe(100000 + 5000 + 1000 + 20000);
  });
});

describe("dia da liberdade de gastos", () => {
  it("renda R$ 3.000, fixas R$ 1.000: a partir do dia 10", () => {
    expect(freedomDay(300000, 100000)).toBe(10);
  });
  it("sem renda, sem fixas ou fixas acima da renda: null", () => {
    expect(freedomDay(0, 100000)).toBeNull();
    expect(freedomDay(300000, 0)).toBeNull();
    expect(freedomDay(300000, 400000)).toBeNull();
  });
});
