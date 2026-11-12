import { afterEach, describe, expect, it, vi } from "vitest";
import { shortReais } from "@/components/charts/scale";
import { buildCsv } from "@/domain/report";
import { formatBRL, formatBRLExact, formatBRLShort } from "./money";
import { MASK, PRIVACY_KEY, usePrivacyStore } from "./privacy";

afterEach(() => usePrivacyStore.getState().setHidden(false));

describe("modo privacidade", () => {
  it("desligado, os valores aparecem normalmente", () => {
    expect(formatBRL(123456)).toContain("1.234,56");
    expect(formatBRLShort(123456)).toContain("1.235");
    expect(shortReais(1500)).toBe("1,5 mil");
  });

  it("ligado, esconde valores, rótulos curtos e eixos dos gráficos", () => {
    usePrivacyStore.getState().setHidden(true);
    expect(formatBRL(123456)).toBe(MASK);
    expect(formatBRLShort(123456)).toBe(MASK);
    expect(shortReais(1500)).toBe("••");
  });

  it("o valor exato (usado nos relatórios exportados) nunca é mascarado", () => {
    usePrivacyStore.getState().setHidden(true);
    expect(formatBRLExact(123456)).toContain("1.234,56");
    expect(typeof buildCsv).toBe("function");
  });

  it("lembra a escolha neste navegador", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    usePrivacyStore.getState().setHidden(true);
    expect(localStorage.getItem(PRIVACY_KEY)).toBe("1");
    usePrivacyStore.getState().toggle();
    expect(localStorage.getItem(PRIVACY_KEY)).toBe("0");
    vi.unstubAllGlobals();
  });
});
