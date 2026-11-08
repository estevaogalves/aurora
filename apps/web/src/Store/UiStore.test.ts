import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./UiStore";

const ui = () => useUiStore.getState();

describe("calculadora e Lançar", () => {
  beforeEach(() => useUiStore.setState({ launchOpen: false, calcOpen: false }));

  it("fechar a calculadora limpa a conta e não fecha o Lançar", () => {
    ui().openLaunch();
    ui().toggleCalc();
    ui().pressCalc("7");
    expect(ui().calc.entry).toBe("7");
    ui().closeCalc();
    expect(ui().calcOpen).toBe(false);
    expect(ui().calc.entry).toBe("0");
    expect(ui().launchOpen).toBe(true);
  });

  it("alternar pelo botão também limpa ao fechar", () => {
    ui().toggleCalc();
    ui().pressCalc("9");
    ui().toggleCalc();
    expect(ui().calc.entry).toBe("0");
  });

  it("fechar o Lançar leva a calculadora junto", () => {
    ui().openLaunch();
    ui().toggleCalc();
    ui().pressCalc("5");
    ui().closeLaunch();
    expect(ui().launchOpen).toBe(false);
    expect(ui().calcOpen).toBe(false);
    expect(ui().calc.entry).toBe("0");
  });

  it("a conta sobrevive enquanto a calculadora fica aberta", () => {
    ui().toggleCalc();
    ui().pressCalc("1");
    ui().pressCalc("+");
    ui().openLaunch();
    expect(ui().calc.history).toBe("1 +");
  });

  it("guarda a posição da calculadora arrastada e volta ao canto com null", () => {
    ui().setCalcPos({ x: 120, y: 80 });
    expect(ui().calcPos).toEqual({ x: 120, y: 80 });
    ui().setCalcPos(null);
    expect(ui().calcPos).toBeNull();
  });
});
