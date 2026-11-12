import { describe, expect, it } from "vitest";
import { axisPadding, niceTicks, shortReais } from "./scale";

describe("rótulo curto do eixo", () => {
  it("valores pequenos ficam como estão", () => {
    expect(shortReais(0)).toBe("0");
    expect(shortReais(950)).toBe("950");
    expect(shortReais(-250)).toBe("-250");
  });

  it("abrevia por escala, com no máximo uma casa decimal", () => {
    expect(shortReais(1000)).toBe("1 mil");
    expect(shortReais(1500)).toBe("1,5 mil");
    expect(shortReais(15000)).toBe("15 mil");
    expect(shortReais(250000)).toBe("250 mil");
    expect(shortReais(1_500_000)).toBe("1,5 mi");
    expect(shortReais(15_000_000)).toBe("15 mi");
    expect(shortReais(2e9)).toBe("2 bi");
    expect(shortReais(3e12)).toBe("3 tri");
    expect(shortReais(-1_500_000)).toBe("-1,5 mi");
  });

  it("não deixa o arredondamento virar '1.000 mil'", () => {
    expect(shortReais(999_960)).toBe("1 mi");
    expect(shortReais(999_940)).toBe("999,9 mil");
  });

  it("acima de 10^15 usa notação científica curta", () => {
    expect(shortReais(1e15)).toBe("1e15");
    expect(shortReais(1.5e18)).toBe("1,5e18");
    expect(shortReais(3.33333e53)).toBe("3,3e53");
    expect(shortReais(Number.NaN)).toBe("");
  });

  it("nenhum rótulo passa de 8 caracteres, de zero a 10^300", () => {
    for (let e = 0; e <= 300; e += 3) for (const m of [1, 1.5, 2.5, 7, 9.99]) expect(shortReais(m * 10 ** e).length).toBeLessThanOrEqual(8);
  });

  it("os rótulos de uma escala 'bonita' são curtos para qualquer grandeza", () => {
    for (const max of [800, 52_300, 1_800_000, 4.2e9, 9e14, 1e20, 1e55]) {
      const tk = niceTicks(max);
      for (let i = 0; i <= tk.n; i++) expect(shortReais(i * tk.step).length).toBeLessThanOrEqual(8);
    }
  });
});

describe("margem esquerda do gráfico", () => {
  it("gráficos com valores pequenos mantêm a margem de sempre (44 px)", () => {
    expect(axisPadding(["0", "250", "500", "750"])).toBe(44);
    expect(axisPadding(["0", "5 mil"])).toBe(44);
    // "1,5 mil" é o rótulo curto mais largo de uma escala pequena: a margem só cresce o pouco que ele precisa
    expect(axisPadding(["0", "1,5 mil"])).toBeLessThanOrEqual(48);
  });

  it("cresce para caber o maior rótulo, que termina 8 px antes da grade", () => {
    for (const label of ["15 mil", "250 mil", "999,9 mil", "1,5 mi", "-250 mil", "1,5e18", "3,3e53"]) {
      const pad = axisPadding(["0", label]);
      // o rótulo (no máximo ~8 caracteres de ~6,4 px) cabe entre a borda do gráfico e a grade
      expect(pad).toBeGreaterThanOrEqual(44);
      expect(pad).toBeLessThanOrEqual(72);
    }
    expect(axisPadding(["0", "999,9 mil"])).toBeGreaterThan(44);
    expect(axisPadding(["0", "999,9 mil"])).toBeGreaterThan(axisPadding(["0", "15 mil"]));
  });
});
