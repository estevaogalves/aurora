import { describe, expect, it } from "vitest";
import { billingDayOf, chargeDate, chargeDay } from "./credit";

describe("dia da cobrança", () => {
  it("tira o dia da data de início", () => {
    expect(billingDayOf("2026-01-31")).toBe(31);
    expect(billingDayOf("2026-01-05")).toBe(5);
    expect(billingDayOf("")).toBeUndefined();
  });

  it("mantém o dia nos meses seguintes", () => {
    expect(chargeDate(15, "2026-03")).toBe("2026-03-15");
  });

  it("cai no último dia nos meses mais curtos", () => {
    expect(chargeDay(31, "2026-02")).toBe(28);
    expect(chargeDay(31, "2028-02")).toBe(29);
    expect(chargeDay(31, "2026-04")).toBe(30);
    expect(chargeDate(30, "2026-02")).toBe("2026-02-28");
  });
});
