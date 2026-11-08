import { describe, expect, it } from "vitest";
import {
  canAdvanceInstallment,
  getCreditByMonth,
  getCreditProgress,
  getCreditTotalByMonth,
  getLastOpenInstallment,
  getMonthSummary,
  getProjection,
  getReportRows,
  patchAdvanceInstallment,
  patchEditAll,
  patchEditInstallment,
  patchRemoveInstallment,
  validateDiscount,
  type CreditTransaction,
  type PatchResult,
} from "./index";

const TODAY = "2026-11";
/** 3x de R$ 100 em nov, dez e jan */
const buy3: CreditTransaction = { id: "c", name: "Fone", totalAmount: 30000, installments: 3, startMonth: "2026-11", category: "Outros" };
/** 2x de R$ 100 em nov e dez */
const buy2: CreditTransaction = { id: "d", name: "Cadeira", totalAmount: 20000, installments: 2, startMonth: "2026-11", category: "Outros" };

const apply = (c: CreditTransaction, r: PatchResult): CreditTransaction => {
  if (!r.ok) throw new Error(r.error);
  return { ...c, ...r.patch };
};

describe("adiantar parcela", () => {
  it("só a última parcela futura tem a opção", () => {
    expect(canAdvanceInstallment(buy3, 3, TODAY)).toBe(true);
    expect(canAdvanceInstallment(buy3, 2, TODAY)).toBe(false);
    expect(canAdvanceInstallment(buy3, 1, TODAY)).toBe(false);
  });

  it("não aparece quando a última é a do mês atual ou de um mês passado", () => {
    expect(canAdvanceInstallment(buy3, 3, "2027-01")).toBe(false);
    expect(canAdvanceInstallment(buy3, 3, "2027-02")).toBe(false);
    expect(canAdvanceInstallment({ ...buy3, installments: 1 }, 1, TODAY)).toBe(false);
  });

  it("exemplo do enunciado: 2x de R$ 100, desconto de R$ 8 => R$ 92 neste mês e nada em dezembro", () => {
    const c = apply(buy2, patchAdvanceInstallment(buy2, 2, 800, TODAY));
    expect(getCreditTotalByMonth([buy2], "2026-11")).toBe(10000);
    expect(getCreditTotalByMonth([c], "2026-11")).toBe(10000 + 9200);
    expect(getCreditTotalByMonth([c], "2026-12")).toBe(0);
    const adv = getCreditByMonth([c], "2026-11").find((i) => i.advanced)!;
    expect(adv.currentInstallment).toBe(2);
    expect(adv.installmentValue).toBe(9200);
    expect(adv.advanced).toEqual({ originalMonth: "2026-12", discount: 800, originalValue: 10000 });
  });

  it("as demais parcelas não mudam de mês", () => {
    const c = apply(buy3, patchAdvanceInstallment(buy3, 3, 0, TODAY));
    const month = (m: string) => getCreditByMonth([c], m).map((i) => [i.currentInstallment, i.installmentValue, !!i.advanced]);
    expect(month("2026-11")).toEqual([[1, 10000, false], [3, 10000, true]]);
    expect(month("2026-12")).toEqual([[2, 10000, false]]);
    expect(month("2027-01")).toEqual([]);
  });

  it("não adianta de novo; a anterior vira a última e ganha a opção se for futura", () => {
    const c = apply(buy3, patchAdvanceInstallment(buy3, 3, 0, TODAY));
    expect(getLastOpenInstallment(c)).toBe(2);
    expect(canAdvanceInstallment(c, 3, TODAY)).toBe(false);
    expect(patchAdvanceInstallment(c, 3, 0, TODAY).ok).toBe(false);
    expect(canAdvanceInstallment(c, 2, TODAY)).toBe(true);
    // a 1 é do mês atual: depois de adiantar a 2, ninguém mais tem a opção
    const d = apply(c, patchAdvanceInstallment(c, 2, 500, TODAY));
    expect(getLastOpenInstallment(d)).toBe(1);
    expect(canAdvanceInstallment(d, 1, TODAY)).toBe(false);
  });

  it("rejeita adiantar parcela que não é a última, a atual ou passada", () => {
    expect(patchAdvanceInstallment(buy3, 2, 0, TODAY).ok).toBe(false);
    expect(patchAdvanceInstallment(buy3, 1, 0, TODAY).ok).toBe(false);
    expect(patchAdvanceInstallment(buy3, 3, 0, "2027-01").ok).toBe(false);
  });

  it("desconto: zero vale; negativo, igual ou maior que a parcela não", () => {
    expect(validateDiscount(10000, 0)).toBeNull();
    expect(validateDiscount(10000, 9999)).toBeNull();
    expect(validateDiscount(10000, -1)).not.toBeNull();
    expect(validateDiscount(10000, 10000)).not.toBeNull();
    expect(validateDiscount(10000, 12000)).not.toBeNull();
    expect(patchAdvanceInstallment(buy3, 3, 10000, TODAY).ok).toBe(false);
    expect(patchAdvanceInstallment(buy3, 3, -100, TODAY).ok).toBe(false);
  });

  it("os totais mensais, a projeção e os relatórios refletem o adiantamento", () => {
    const c = apply(buy2, patchAdvanceInstallment(buy2, 2, 800, TODAY));
    const data = { transactions: [], creditTransactions: [c] };
    expect(getMonthSummary(data, "2026-11").creditExpense).toBe(10000 + 9200);
    expect(getMonthSummary(data, "2026-12").totalExpense).toBe(0);
    const [nov, dec] = getProjection(data, [], "2026-11", 2);
    expect([nov.creditExpense, dec.creditExpense]).toEqual([19200, 0]);
    const rows = getReportRows(data, ["2026-11"], { entries: false, credit: true });
    expect(rows.map((r) => r.amount)).toEqual([10000, 9200]);
    expect(rows[1].note).toContain("adiantada");
  });

  it("andamento ignora parcelas adiantadas", () => {
    const c = apply(buy3, patchAdvanceInstallment(buy3, 3, 0, TODAY));
    expect(getCreditProgress(c, "2026-11")).toEqual({ done: 1, remaining: 1, endMonth: "2026-12" });
  });
});

describe("editar e excluir parcela", () => {
  it("só este mês: muda o valor de uma parcela e as outras ficam iguais", () => {
    const c = apply(buy3, patchEditInstallment(buy3, 2, 15000));
    expect(getCreditTotalByMonth([c], "2026-11")).toBe(10000);
    expect(getCreditTotalByMonth([c], "2026-12")).toBe(15000);
    expect(getCreditTotalByMonth([c], "2027-01")).toBe(10000);
    expect(getCreditByMonth([c], "2026-12")[0].adjusted).toBe(true);
  });

  it("só este mês: excluir remove a cobrança e mantém numeração e meses das demais", () => {
    const c = apply(buy3, patchRemoveInstallment(buy3, 2));
    expect(getCreditByMonth([c], "2026-12")).toEqual([]);
    expect(getCreditByMonth([c], "2027-01")[0].currentInstallment).toBe(3);
    expect(getCreditTotalByMonth([c], "2026-11")).toBe(10000);
  });

  it("parcela excluída não conta como última nem pode ser editada de novo", () => {
    const c = apply(buy3, patchRemoveInstallment(buy3, 3));
    expect(getLastOpenInstallment(c)).toBe(2);
    expect(patchEditInstallment(c, 3, 5000).ok).toBe(false);
    expect(patchRemoveInstallment(c, 3).ok).toBe(false);
  });

  it("parcela adiantada não pode ser editada nem excluída individualmente", () => {
    const c = apply(buy3, patchAdvanceInstallment(buy3, 3, 0, TODAY));
    expect(patchEditInstallment(c, 3, 5000).ok).toBe(false);
    expect(patchRemoveInstallment(c, 3).ok).toBe(false);
  });

  it("todas: muda o total sem tocar nas adiantadas nem nas ajustadas", () => {
    let c = apply(buy3, patchAdvanceInstallment(buy3, 3, 2000, TODAY));
    c = apply(c, patchEditInstallment(c, 2, 15000));
    const r = patchEditAll(c, { name: "Fone novo", totalAmount: 60000 });
    if (!r.ok) throw new Error(r.error);
    const next = { ...c, ...r.patch };
    expect(next.name).toBe("Fone novo");
    expect(getCreditTotalByMonth([next], "2026-11")).toBe(20000 + 8000);
    expect(getCreditTotalByMonth([next], "2026-12")).toBe(15000);
  });

  it("todas: não troca o número de parcelas quando há ajustes", () => {
    const c = apply(buy3, patchRemoveInstallment(buy3, 2));
    expect(patchEditAll(c, { installments: 5 }).ok).toBe(false);
    expect(patchEditAll(buy3, { installments: 5 }).ok).toBe(true);
  });
});
