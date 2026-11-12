import { describe, expect, it } from "vitest";
import {
  getAvailableMonths,
  getCreditByMonth,
  getCreditTotalByMonth,
  getMonthSummary,
  getProjection,
  getReportRows,
  patchAdvanceInstallment,
  patchCancelRecurrence,
  patchEditInstallment,
  patchRemoveInstallment,
  recurringCharges,
  type CreditTransaction,
  type PatchResult,
} from "./index";

const TODAY = "2026-11";
/** Assinatura de R$ 39,90 por mês, desde setembro */
const stream: CreditTransaction = { id: "s", name: "Streaming", totalAmount: 3990, installments: 1, startMonth: "2026-09", category: "Lazer", recurring: true };
/** 2x de R$ 100 em nov e dez, para conferir que o parcelado segue igual ao lado de uma recorrente */
const buy2: CreditTransaction = { id: "d", name: "Cadeira", totalAmount: 20000, installments: 2, startMonth: "2026-11", category: "Outros" };

const apply = (c: CreditTransaction, r: PatchResult): CreditTransaction => {
  if (!r.ok) throw new Error(r.error);
  return { ...c, ...r.patch };
};

describe("compra recorrente no cartão", () => {
  it("cobra o mesmo valor todo mês, do início em diante, sem fim", () => {
    expect(getCreditTotalByMonth([stream], "2026-08")).toBe(0);
    for (const m of ["2026-09", "2026-11", "2027-06", "2035-01"]) expect(getCreditTotalByMonth([stream], m)).toBe(3990);
  });

  it("aparece como recorrente, sem parcelas", () => {
    const [item] = getCreditByMonth([stream], "2027-01");
    expect(item).toMatchObject({ id: "s", recurring: true, installments: 0, installmentValue: 3990, totalAmount: 3990 });
    expect(item.advanced).toBeUndefined();
  });

  it("entra no resumo do mês e na projeção como crédito", () => {
    const summary = getMonthSummary({ transactions: [], creditTransactions: [stream, buy2], extraExpenses: [] }, "2026-11");
    expect(summary.creditExpense).toBe(3990 + 10000);
    // cada compra conta na própria categoria: o streaming é "Lazer" e a cadeira, "Outros"
    expect(summary.byCategory).toEqual({ Lazer: 3990, Outros: 10000 });

    const projection = getProjection({ transactions: [], creditTransactions: [stream, buy2] }, [], "2026-11", 4);
    expect(projection.map((p) => p.creditExpense)).toEqual([13990, 13990, 3990, 3990]);
  });

  it("vai para o relatório com a observação de recorrente", () => {
    const rows = getReportRows({ transactions: [], creditTransactions: [stream], extraExpenses: [], notes: [] } as never, ["2026-11"], { credit: true } as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 3990, note: "Recorrente no cartão" });
  });

  it("não cria meses futuros na lista de meses com dados enquanto não for cancelada", () => {
    const months = getAvailableMonths({ transactions: [], creditTransactions: [stream], notes: [] }, TODAY);
    expect(months[0]).toBe("2026-09");
    expect(months[months.length - 1]).toBe(TODAY);
  });

  it("parcela de recorrente não pode ser editada, excluída nem adiantada", () => {
    expect(patchEditInstallment(stream, 1, 100).ok).toBe(false);
    expect(patchRemoveInstallment(stream, 1).ok).toBe(false);
    expect(patchAdvanceInstallment(stream, 1, 0, "2026-01").ok).toBe(false);
  });
});

describe("cancelar recorrência", () => {
  it("mantém o que já foi cobrado e remove as cobranças depois do mês final", () => {
    const canceled = apply(stream, patchCancelRecurrence(stream, "2027-02", TODAY));
    expect(canceled.endMonth).toBe("2027-02");
    expect(recurringCharges(canceled, "2026-09")).toBe(true);
    expect(recurringCharges(canceled, "2027-02")).toBe(true);
    expect(recurringCharges(canceled, "2027-03")).toBe(false);
    expect(getCreditTotalByMonth([canceled], "2026-10")).toBe(3990);
    expect(getCreditTotalByMonth([canceled], "2030-01")).toBe(0);
  });

  it("cancelar olhando um mês passado nunca apaga o mês atual nem os anteriores", () => {
    const r = patchCancelRecurrence(stream, "2026-09", TODAY);
    expect(r.ok && r.patch.endMonth).toBe(TODAY);
  });

  it("recusa compra parcelada e recorrência já cancelada", () => {
    expect(patchCancelRecurrence(buy2, "2027-01", TODAY).ok).toBe(false);
    expect(patchCancelRecurrence({ ...stream, endMonth: "2027-02" }, "2027-01", TODAY).ok).toBe(false);
  });

  it("a recorrente cancelada passa a contar o mês final nos meses com dados", () => {
    const canceled = apply(stream, patchCancelRecurrence(stream, "2027-03", TODAY));
    const months = getAvailableMonths({ transactions: [], creditTransactions: [canceled], notes: [] }, TODAY);
    expect(months[months.length - 1]).toBe("2027-03");
  });
});
