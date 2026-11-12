import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, isFilterActive, matchesFilter, summarizeFiltered, type Filterable, type LaunchFilter } from "./index";

const item = (extra: Partial<Filterable> = {}): Filterable => ({ name: "Pão de Açúcar", category: "Alimentação", amount: 12000, ...extra });
const f = (extra: Partial<LaunchFilter>): LaunchFilter => ({ ...EMPTY_FILTER, ...extra });

describe("busca e filtros de Lançamentos", () => {
  it("sem filtro, tudo passa", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(matchesFilter(item(), EMPTY_FILTER, "expense")).toBe(true);
  });

  it("busca por texto ignora acento e maiúscula e olha nome, observação, categoria e tags", () => {
    expect(matchesFilter(item(), f({ text: "pao de acucar" }), "expense")).toBe(true);
    expect(matchesFilter(item({ notes: "Compra do mês" }), f({ text: "MES" }), "expense")).toBe(true);
    expect(matchesFilter(item(), f({ text: "alimentacao" }), "expense")).toBe(true);
    expect(matchesFilter(item({ tags: ["Viagem"] }), f({ text: "viagem" }), "expense")).toBe(true);
    expect(matchesFilter(item(), f({ text: "farmácia" }), "expense")).toBe(false);
  });

  it("categoria, faixa de valor (inclusive nas pontas) e tag", () => {
    expect(matchesFilter(item(), f({ category: "Lazer" }), "expense")).toBe(false);
    expect(matchesFilter(item(), f({ min: 12000, max: 12000 }), "expense")).toBe(true);
    expect(matchesFilter(item(), f({ min: 12001 }), "expense")).toBe(false);
    expect(matchesFilter(item(), f({ max: 11999 }), "expense")).toBe(false);
    expect(matchesFilter(item({ tags: ["Heitor", "viagem"] }), f({ tag: "VIAGEM" }), "expense")).toBe(true);
    expect(matchesFilter(item(), f({ tag: "viagem" }), "expense")).toBe(false);
  });

  it("status e forma de pagamento só valem para despesas", () => {
    const paid = item({ payment: { method: "pix", date: "2026-11-02" } });
    expect(matchesFilter(paid, f({ status: "paid" }), "expense")).toBe(true);
    expect(matchesFilter(paid, f({ status: "pending" }), "expense")).toBe(false);
    expect(matchesFilter(item(), f({ status: "pending" }), "expense")).toBe(true);
    expect(matchesFilter(paid, f({ method: "boleto" }), "expense")).toBe(false);
    expect(matchesFilter(paid, f({ method: "pix" }), "expense")).toBe(true);
    // renda não tem pagamento: os dois filtros são ignorados
    expect(matchesFilter(item(), f({ status: "paid", method: "pix" }), "income")).toBe(true);
  });

  it("o resumo conta e soma o que passou, sem mexer em nenhum total oficial", () => {
    expect(summarizeFiltered([item(), item({ amount: 3000 })], [item({ amount: 500000 })])).toEqual({ count: 3, expense: 15000, income: 500000 });
    expect(isFilterActive(f({ tag: "x" }))).toBe(true);
  });
});
