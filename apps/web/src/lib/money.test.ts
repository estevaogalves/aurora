import { describe, expect, it } from "vitest";
import {
  centsToInput,
  formatBRL,
  formatBRLShort,
  MAX_MONEY_CHARS,
  parseBRL,
  sanitizeAmountInput,
  splitInstallments,
  toCents,
} from "./money";

describe("parseBRL", () => {
  it("lê valores com milhar e vírgula", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("1.234.567,89")).toBe(123456789);
  });

  it("lê valores simples", () => {
    expect(parseBRL("1234,56")).toBe(123456);
    expect(parseBRL("12,5")).toBe(1250);
    expect(parseBRL("10")).toBe(1000);
    expect(parseBRL("0,01")).toBe(1);
  });

  it("aceita ponto como decimal quando não há vírgula", () => {
    expect(parseBRL("12.5")).toBe(1250);
    expect(parseBRL("1234.56")).toBe(123456);
  });

  it("trata ponto sem vírgula como milhar quando tem 3 dígitos", () => {
    expect(parseBRL("1.234")).toBe(123400);
    expect(parseBRL("1.234.567")).toBe(123456700);
  });

  it("ignora símbolo e espaços", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(123456);
  });

  it("rejeita o que não é valor", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("   ")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("1,2,3")).toBeNull();
    expect(parseBRL("-5")).toBeNull();
    expect(parseBRL("10,999")).toBeNull();
    expect(parseBRL(null)).toBeNull();
    expect(parseBRL(undefined)).toBeNull();
  });

  it("aceita zero (a decisão de recusar zero é de quem chama)", () => {
    expect(parseBRL("0")).toBe(0);
    expect(parseBRL("0,00")).toBe(0);
  });
});

describe("formatBRL e centsToInput", () => {
  it("formata centavos como reais", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatBRL(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });

  it("monta o texto de um input", () => {
    expect(centsToInput(123456)).toBe("1234,56");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(1250)).toBe("12,50");
  });

  it("ida e volta sem perder centavos", () => {
    for (const cents of [1, 99, 100, 123456, 999999999]) {
      expect(parseBRL(centsToInput(cents))).toBe(cents);
    }
  });
});

describe("toCents", () => {
  it("evita erro de ponto flutuante", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1.005 * 100)).toBe(10050);
  });
});

describe("sanitizeAmountInput", () => {
  it("deixa só dígitos e uma vírgula com 2 casas", () => {
    expect(sanitizeAmountInput("12a3")).toBe("123");
    expect(sanitizeAmountInput("12,345")).toBe("12,34");
    expect(sanitizeAmountInput("1,2,3")).toBe("1,23");
    expect(sanitizeAmountInput("1.234")).toBe("1234");
    expect(sanitizeAmountInput("")).toBe("");
  });
});

describe("splitInstallments", () => {
  it("não perde centavos", () => {
    const parts = splitInstallments(1000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("divide exato quando dá", () => {
    expect(splitInstallments(480000, 10)).toEqual(Array(10).fill(48000));
  });

  it("uma parcela devolve o total", () => {
    expect(splitInstallments(12345, 1)).toEqual([12345]);
  });

  it("protege contra quantidade inválida", () => {
    expect(splitInstallments(500, 0)).toEqual([500]);
  });
});

describe("valores gigantes", () => {
  const nbsp = " ";

  it("valores normais saem por inteiro, até quase R$ 1 trilhão", () => {
    expect(formatBRL(123456)).toBe(`R$${nbsp}1.234,56`);
    expect(formatBRL(0)).toBe(`R$${nbsp}0,00`);
    const big = formatBRL(99_999_999_999_999); // R$ 999.999.999.999,99
    expect(big).toBe(`R$${nbsp}999.999.999.999,99`);
    expect(big.length).toBe(MAX_MONEY_CHARS);
    expect(formatBRLShort(99_999_999_999_999)).not.toContain("…");
  });

  it("acima disso o texto é cortado com reticências e nunca passa do limite", () => {
    const huge = Number("1e57"); // o valor que quebrava o layout
    for (const text of [formatBRL(huge), formatBRLShort(huge), formatBRL(1e20), formatBRLShort(1e20)]) {
      expect(text.endsWith("…")).toBe(true);
      expect(text.length).toBe(MAX_MONEY_CHARS);
      expect(text.startsWith(`R$${nbsp}`)).toBe(true);
    }
  });

  it("o corte não mexe em valores negativos nem em zero", () => {
    expect(formatBRL(-123456)).toContain("1.234,56");
    expect(formatBRL(-1e57).length).toBeLessThanOrEqual(MAX_MONEY_CHARS);
  });
});
