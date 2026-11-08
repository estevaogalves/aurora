import { describe, expect, it } from "vitest";
import { calcReduce, formatEntry, initialCalc, keyFromEvent, type CalcKey } from "./calc";

const press = (keys: CalcKey[]) => keys.reduce(calcReduce, initialCalc);

describe("calculadora", () => {
  it("soma, subtrai, multiplica e divide", () => {
    expect(press(["1", "2", "+", "3", "="]).entry).toBe("15");
    expect(press(["9", "-", "4", "="]).entry).toBe("5");
    expect(press(["6", "*", "7", "="]).entry).toBe("42");
    expect(press(["8", "/", "4", "="]).entry).toBe("2");
  });

  it("encadeia operações da esquerda para a direita", () => {
    const s = press(["2", "+", "3", "*", "4"]);
    expect(s.entry).toBe("4");
    expect(calcReduce(s, "=").entry).toBe("20");
  });

  it("não deixa o erro de ponto flutuante aparecer", () => {
    expect(press(["0", ",", "1", "+", "0", ",", "2", "="]).entry).toBe("0,3");
  });

  it("divisão por zero dá erro e a próxima tecla recomeça", () => {
    const s = press(["5", "/", "0", "="]);
    expect(s.error).toBe(true);
    expect(s.entry).toBe("Erro");
    expect(calcReduce(s, "7").entry).toBe("7");
  });

  it("digita decimais, ignora segunda vírgula e zero à esquerda", () => {
    expect(press(["0", "0", "5"]).entry).toBe("5");
    expect(press(["1", ",", "5", ",", "2"]).entry).toBe("1,52");
    expect(press([","]).entry).toBe("0,");
  });

  it("apaga o último dígito, troca o sinal e limpa", () => {
    expect(press(["1", "2", "3", "back"]).entry).toBe("12");
    expect(press(["5", "back"]).entry).toBe("0");
    expect(press(["5", "neg"]).entry).toBe("-5");
    expect(press(["5", "neg", "neg"]).entry).toBe("5");
    expect(press(["5", "+", "C"])).toEqual(initialCalc);
  });

  it("troca a operação se for apertada de novo", () => {
    expect(press(["5", "+", "-", "2", "="]).entry).toBe("3");
  });

  it("porcentagem: de um número e sobre a operação pendente", () => {
    expect(press(["5", "0", "%"]).entry).toBe("0,5");
    expect(press(["2", "0", "0", "+", "1", "0", "%"]).entry).toBe("20");
    expect(press(["2", "0", "0", "+", "1", "0", "%", "="]).entry).toBe("220");
  });

  it("usa o resultado como primeiro número da próxima conta", () => {
    expect(press(["2", "+", "3", "=", "*", "4", "="]).entry).toBe("20");
  });

  it("limita os dígitos e recusa resultados que não cabem", () => {
    expect(press(Array(20).fill("9") as CalcKey[]).entry).toHaveLength(15);
    const big = press([...(Array(15).fill("9") as CalcKey[]), "*", "9", "9", "="]);
    expect(big.error).toBe(true);
  });

  it("formata o visor com milhar e mapeia o teclado", () => {
    expect(formatEntry("1234567,5")).toBe("1.234.567,5");
    expect(formatEntry("-1000")).toBe("-1.000");
    expect(formatEntry("12")).toBe("12");
    expect(keyFromEvent(".")).toBe(",");
    expect(keyFromEvent("Enter")).toBe("=");
    expect(keyFromEvent("a")).toBeNull();
  });
});
