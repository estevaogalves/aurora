import { describe, expect, it } from "vitest";
import { formatBRL, formatBRLShort } from "./money";
import { allMoneyTokens, findMoneyToken, parseMoneyToken } from "./moneyHover";
import { describeMoney, moneyCompact, moneyInWords, partsFromCents, partsFromCentsDigits, type MoneyParts } from "./moneyWords";

const words = (cents: number) => moneyInWords(partsFromCents(cents) as MoneyParts);
const compact = (cents: number) => moneyCompact(partsFromCents(cents) as MoneyParts);
const lines = (cents: number) => describeMoney(partsFromCents(cents) as MoneyParts);

describe("valor por extenso", () => {
  it("valores pequenos", () => {
    expect(words(0)).toBe("zero reais");
    expect(words(1)).toBe("um centavo");
    expect(words(50)).toBe("cinquenta centavos");
    expect(words(100)).toBe("um real");
    expect(words(200)).toBe("dois reais");
    expect(words(1900)).toBe("dezenove reais");
    expect(words(2100)).toBe("vinte e um reais");
    expect(words(10000)).toBe("cem reais");
    expect(words(11000)).toBe("cento e dez reais"); // o exemplo: R$ 110,00
    expect(words(12345)).toBe("cento e vinte e três reais e quarenta e cinco centavos");
    expect(words(100101)).toBe("mil e um reais e um centavo");
  });

  it("reais e centavos", () => {
    expect(words(101)).toBe("um real e um centavo");
    expect(words(15050)).toBe("cento e cinquenta reais e cinquenta centavos");
    expect(words(99999)).toBe("novecentos e noventa e nove reais e noventa e nove centavos");
  });

  it("milhares: o 'e' só aparece antes de um último grupo menor que 100 ou redondo", () => {
    expect(words(100000)).toBe("mil reais");
    expect(words(100100)).toBe("mil e um reais");
    expect(words(105000)).toBe("mil e cinquenta reais");
    expect(words(110000)).toBe("mil e cem reais");
    expect(words(150000)).toBe("mil e quinhentos reais");
    expect(words(123456)).toBe("mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
    expect(words(200000)).toBe("dois mil reais");
    expect(words(21_000_00)).toBe("vinte e um mil reais");
  });

  it("milhões e bilhões, com 'de' quando nada sobra abaixo dos milhões", () => {
    expect(words(1_000_000_00)).toBe("um milhão de reais");
    expect(words(2_000_000_00)).toBe("dois milhões de reais");
    expect(words(2_001_000_00)).toBe("dois milhões e mil reais");
    expect(words(1_000_001_00)).toBe("um milhão e um reais");
    expect(words(1_200_000_00)).toBe("um milhão e duzentos mil reais");
    expect(words(2_500_300_00)).toBe("dois milhões quinhentos mil e trezentos reais");
    expect(words(1_234_567_89)).toBe("um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete reais e oitenta e nove centavos");
    expect(words(1_000_000_000_00)).toBe("um bilhão de reais");
    expect(words(3_000_000_000_00)).toBe("três bilhões de reais");
    expect(words(2_001_000_000_00)).toBe("dois bilhões e um milhão de reais");
    expect(words(1_000_000_000_000_00)).toBe("um trilhão de reais");
  });

  it("negativos", () => {
    expect(words(-11000)).toBe("menos cento e dez reais");
    expect(words(-1)).toBe("menos um centavo");
  });

  it("números gigantes saem por extenso com o nome do grupo, sem perder nada", () => {
    // 10^33 cents = 10^31 reais = dez nonilhões
    expect(moneyInWords(partsFromCentsDigits("1" + "0".repeat(33)) as MoneyParts)).toBe("dez nonilhões de reais");
    // o valor que quebrava o layout: 10^57 centavos = 10^55 reais
    expect(words(1e57)).toBe("dez septendecilhões de reais");
    expect(words(1e57)).not.toContain("cerca");
  });

  it("acima de 15 dígitos significativos o valor é aproximado e diz isso", () => {
    const text = words(Number("3.3333333333333334e55"));
    expect(text?.startsWith("cerca de ")).toBe(true);
    expect(text).toContain("trezentos e trinta e três sexdecilhões");
    // zeros no fim não são aproximação
    expect(words(Number("2e30"))).not.toContain("cerca");
  });

  it("sem nome em português (acima de 10^66) devolve null e o abreviado vira científico", () => {
    const parts = partsFromCents(Number("1e100")) as MoneyParts;
    expect(moneyInWords(parts)).toBeNull();
    expect(moneyCompact(parts)).toBe("R$ 1,00 × 10^98");
    expect(describeMoney(parts)).toEqual(["R$ 1,00 × 10^98"]);
  });

  it("não é número", () => {
    expect(partsFromCents(Number.NaN)).toBeNull();
    expect(partsFromCents(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("valor abreviado", () => {
  it("o exemplo: 2 bi 1 mi", () => {
    expect(compact(2_001_000_000_00)).toBe("R$ 2 bi 1 mi");
  });

  it("abrevia por grupo e ignora os grupos zerados", () => {
    expect(compact(1_000_00)).toBe("R$ 1 mil");
    expect(compact(1_234_00)).toBe("R$ 1 mil 234");
    expect(compact(1_000_000_00)).toBe("R$ 1 mi");
    expect(compact(2_500_300_00)).toBe("R$ 2 mi 500 mil 300");
    expect(compact(1_000_000_000_000_00)).toBe("R$ 1 tri");
    expect(compact(-1_234_00)).toBe("-R$ 1 mil 234");
    expect(compact(1e57)).toBe("R$ 10 septendec");
  });

  it("abaixo de R$ 1.000 não há o que abreviar", () => {
    expect(compact(99_999)).toBeNull();
    expect(compact(0)).toBeNull();
  });
});

describe("o que o tooltip mostra", () => {
  it("abaixo de R$ 1.000: só o por extenso", () => {
    expect(lines(11000)).toEqual(["cento e dez reais"]);
    expect(lines(99_999)).toEqual(["novecentos e noventa e nove reais e noventa e nove centavos"]);
    expect(lines(50)).toEqual(["cinquenta centavos"]);
  });

  it("a partir de R$ 1.000: o por extenso e, embaixo, o abreviado", () => {
    expect(lines(100000)).toEqual(["mil reais", "R$ 1 mil"]);
    expect(lines(123456)).toEqual(["mil duzentos e trinta e quatro reais e cinquenta e seis centavos", "R$ 1 mil 234"]);
    expect(lines(99_999_999)).toEqual(["novecentos e noventa e nove mil novecentos e noventa e nove reais e noventa e nove centavos", "R$ 999 mil 999"]);
    expect(lines(1_000_000_00)).toEqual(["um milhão de reais", "R$ 1 mi"]);
    expect(lines(2_001_000_000_00)).toEqual(["dois bilhões e um milhão de reais", "R$ 2 bi 1 mi"]);
  });

  it("extenso demais: só o abreviado", () => {
    const messy = partsFromCentsDigits("123456789012345678901234567890123456789012345678901234567890") as MoneyParts;
    const out = describeMoney(messy);
    expect(out).toHaveLength(1);
    expect(out[0].startsWith("≈ R$ ") || out[0].startsWith("R$ ")).toBe(true);
    expect(out[0].length).toBeLessThan(140);
  });

  it("gigante redondo cabe por extenso", () => {
    expect(lines(1e57)).toEqual(["dez septendecilhões de reais", "R$ 10 septendec"]);
  });
});

describe("achar o valor no texto", () => {
  it("acha o valor pela posição do mouse, mesmo no meio de uma frase", () => {
    const text = "Faltam R$ 1.234,56 para a meta";
    const start = text.indexOf("R$");
    expect(findMoneyToken(text, start + 3)?.text).toBe("R$ 1.234,56");
    expect(findMoneyToken(text, 0)).toBeNull();
    expect(findMoneyToken(text, text.length)).toBeNull();
  });

  it("entende o espaço inseparável, o sinal e o corte", () => {
    const nbsp = " ";
    expect(allMoneyTokens(`R$${nbsp}110,00`).map((t) => t.text)).toEqual([`R$${nbsp}110,00`]);
    expect(allMoneyTokens(`-R$${nbsp}5,00 e R$${nbsp}10`).map((t) => t.text)).toEqual([`-R$${nbsp}5,00`, `R$${nbsp}10`]);
    expect(allMoneyTokens("R$ 10.000.000.000.00…").map((t) => t.text)).toEqual(["R$ 10.000.000.000.00…"]);
  });

  it("lê reais e centavos do texto que o app mostra", () => {
    const p = (t: string) => parseMoneyToken(t) as MoneyParts;
    expect(p(formatBRL(11000))).toMatchObject({ reais: "110", cents: 0, negative: false });
    expect(p(formatBRL(123456))).toMatchObject({ reais: "1234", cents: 56 });
    expect(p(formatBRL(-5))).toMatchObject({ reais: "0", cents: 5, negative: true });
    // formatBRLShort arredonda: o tooltip descreve o que está na tela
    expect(p(formatBRLShort(123456))).toMatchObject({ reais: "1235", cents: 0 });
    expect(moneyInWords(p(formatBRL(11000)))).toBe("cento e dez reais");
  });

  it("valor cortado com reticências volta à grandeza original pelo registro", () => {
    const text = formatBRL(1e57);
    expect(text.endsWith("…")).toBe(true);
    const parts = parseMoneyToken(text) as MoneyParts;
    expect(moneyInWords(parts)).toBe("dez septendecilhões de reais");
    const negative = parseMoneyToken(formatBRL(-1e57)) as MoneyParts;
    expect(negative.negative).toBe(true);
    expect(moneyInWords(negative)).toBe("menos dez septendecilhões de reais");
    // sem registro não há como saber a grandeza
    expect(parseMoneyToken("R$ 7.777.777.777.777.7…")).toBeNull();
  });
});
