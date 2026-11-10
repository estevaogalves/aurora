import { describe, expect, it } from "vitest";
import {
  getCreditTotalByMonth,
  getInvoice,
  getMonthSummary,
  patchEditInstallment,
  resolveCredits,
  type CreditCard,
  type CreditTransaction,
  type Transaction,
} from "./index";

const card: CreditCard = { id: "k", name: "Nubank", closingDay: 2, dueDay: 9 };
const inv = (date: string, c: Pick<CreditCard, "closingDay" | "dueDay"> = card, n = 1) => getInvoice(c, date, n);

describe("fatura do cartão", () => {
  it("compra depois do fechamento cai na fatura do mês seguinte", () => {
    expect(inv("2026-11-07")).toEqual({ closingDate: "2026-12-02", dueDate: "2026-12-09", month: "2026-12" });
  });

  it("compra até o dia do fechamento cai na fatura do mês", () => {
    expect(inv("2026-11-01")).toEqual({ closingDate: "2026-11-02", dueDate: "2026-11-09", month: "2026-11" });
    expect(inv("2026-11-02").month).toBe("2026-11");
    expect(inv("2026-11-03").month).toBe("2026-12");
  });

  it("vencimento menor ou igual ao fechamento vence no mês seguinte", () => {
    const c = { closingDay: 25, dueDay: 5 };
    expect(inv("2026-11-10", c)).toEqual({ closingDate: "2026-11-25", dueDate: "2026-12-05", month: "2026-12" });
    expect(inv("2026-11-26", c)).toEqual({ closingDate: "2026-12-25", dueDate: "2027-01-05", month: "2027-01" });
    expect(inv("2026-11-10", { closingDay: 10, dueDay: 10 }).month).toBe("2026-12");
  });

  it("vira o ano", () => {
    expect(inv("2026-12-20")).toEqual({ closingDate: "2027-01-02", dueDate: "2027-01-09", month: "2027-01" });
    expect(inv("2026-12-20", { closingDay: 25, dueDay: 5 }).month).toBe("2027-01");
    expect(inv("2026-12-28", { closingDay: 25, dueDay: 5 }).month).toBe("2027-02");
  });

  it("meses curtos usam o último dia do mês", () => {
    const c = { closingDay: 31, dueDay: 30 };
    expect(inv("2027-02-28", c).closingDate).toBe("2027-02-28"); // fechamento 31 vira 28: compra no 28 ainda entra
    expect(inv("2027-02-28", c)).toEqual({ closingDate: "2027-02-28", dueDate: "2027-03-30", month: "2027-03" });
    expect(inv("2028-02-29", c).closingDate).toBe("2028-02-29");
    expect(inv("2027-04-30", c).closingDate).toBe("2027-04-30");
    expect(inv("2027-01-31", { closingDay: 5, dueDay: 31 }).closingDate).toBe("2027-02-05");
    expect(inv("2027-01-31", { closingDay: 5, dueDay: 31 }).dueDate).toBe("2027-02-28");
  });

  it("cada parcela cai na fatura do mês seguinte, uma por mês", () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => inv("2026-11-07", card, n).month)).toEqual(["2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05"]);
    expect(inv("2026-11-07", card, 3).dueDate).toBe("2027-02-09");
    expect(inv("2026-01-30", { closingDay: 31, dueDay: 31 }, 2).dueDate).toBe("2026-03-31");
  });
});

const wellhub: CreditTransaction = { id: "w", name: "WellHub", totalAmount: 9999, installments: 1, startMonth: "2026-11", billingDay: 6, category: "Lazer", recurring: true, cardId: "k" };
const claude: CreditTransaction = { id: "c", name: "Claude", totalAmount: 11850, installments: 1, startMonth: "2026-11", billingDay: 11, category: "Outros", recurring: true, variableAmount: true, cardId: "k" };
const income: Transaction = { id: "i", name: "Salário", amount: 349597, type: "income", category: "Salário", fixed: false, month: "2026-11" } as Transaction;
const bills: Transaction = { id: "e", name: "Contas + fatura", amount: 329737, type: "expense", category: "Outros", fixed: false, month: "2026-11" } as Transaction;

describe("crédito contabilizado no mês do vencimento", () => {
  const data = { transactions: [income, bills], creditTransactions: [wellhub, claude], creditCards: [card] };

  it("sai de novembro e entra em dezembro, repetindo nos meses seguintes", () => {
    expect(getCreditTotalByMonth(resolveCredits(data.creditTransactions, data.creditCards), "2026-11")).toBe(0);
    for (const m of ["2026-12", "2027-01", "2027-06"]) expect(getCreditTotalByMonth(resolveCredits(data.creditTransactions, data.creditCards), m)).toBe(9999 + 11850);
  });

  it("saldo de novembro volta a 198,60", () => {
    const s = getMonthSummary(data, "2026-11");
    expect(s.totalIncome - s.totalExpense).toBe(19860);
    expect(s.creditExpense).toBe(0);
    expect(getMonthSummary(data, "2026-12").creditExpense).toBe(21849);
  });

  it("sem cartão (ou cartão ausente) continua como antes", () => {
    const old = { ...wellhub, cardId: undefined };
    expect(resolveCredits([old], [card])[0]).toBe(old);
    expect(getMonthSummary({ ...data, creditTransactions: [old], creditCards: [] }, "2026-11").creditExpense).toBe(9999);
  });

  it("compra de 01/11 fica em novembro", () => {
    const c = { ...wellhub, billingDay: 1 };
    expect(getCreditTotalByMonth(resolveCredits([c], [card]), "2026-11")).toBe(9999);
  });

  it("cancelar recorrência desloca o último mês junto", () => {
    expect(resolveCredits([{ ...wellhub, endMonth: "2027-02" }], [card])[0].endMonth).toBe("2027-03");
  });

  it("parcelado: 1ª parcela segue a regra e as outras uma por mês", () => {
    const buy: CreditTransaction = { id: "p", name: "TV", totalAmount: 30000, installments: 3, startMonth: "2026-11", billingDay: 7, category: "Outros", cardId: "k" };
    const r = resolveCredits([buy], [card]);
    expect(["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"].map((m) => getCreditTotalByMonth(r, m))).toEqual([0, 10000, 10000, 10000, 0]);
  });
});

describe("recorrência de valor variável", () => {
  const resolved = resolveCredits([claude], [card]);
  const real = (n: number, cents: number) => {
    const r = patchEditInstallment(resolved[0], n, cents);
    if (!r.ok) throw new Error(r.error);
    return { ...claude, ...r.patch };
  };

  it("ajusta só um mês e marca estimado/valor real", () => {
    const adjusted = [real(2, 11809)];
    const month = (m: string) => getMonthSummary({ transactions: [], creditTransactions: adjusted, creditCards: [card] }, m);
    expect(month("2026-12").creditExpense).toBe(11850);
    expect(month("2027-01").creditExpense).toBe(11809);
    expect(month("2027-02").creditExpense).toBe(11850);
  });

  it("recorrente comum não aceita valor por mês", () => {
    expect(patchEditInstallment({ ...wellhub }, 1, 5000).ok).toBe(false);
  });
});
