import { describe, expect, it } from "vitest";
import {
  getAvailableMonths,
  getCardInvoice,
  getCategoryDetail,
  getInvoice,
  getMonthSummary,
  getProjection,
  getReportRows,
  cardPaymentOf,
  invoiceDates,
  patchCardPayment,
  resolveCardExpenses,
  type CreditCard,
  type CreditTransaction,
  type ExtraExpense,
  type Transaction,
} from "./index";

const nubank: CreditCard = { id: "nu", name: "Nubank", closingDay: 2, dueDay: 9 };
const inter: CreditCard = { id: "in", name: "Inter", closingDay: 25, dueDay: 5, limit: 30000 };

const expense = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, name: id, amount, type: "expense", category: "Alimentação", month: "2026-11", ...extra,
});
const onCard = (id: string, amount: number, cardId: string, purchaseDate: string, extra: Partial<Transaction> = {}) =>
  expense(id, amount, { cardId, purchaseDate, month: purchaseDate.slice(0, 7), ...extra });
const extra = (id: string, amount: number, extras: Partial<ExtraExpense> = {}): ExtraExpense => ({ id, name: id, amount, month: "2026-12", ...extras });

describe("despesa avulsa no cartão: mês da fatura", () => {
  it("compra até o fechamento vale no mês; depois do fechamento, no mês seguinte", () => {
    const [a, b, c] = resolveCardExpenses(
      [onCard("a", 5000, "nu", "2026-11-01"), onCard("b", 3000, "nu", "2026-11-02"), onCard("c", 2000, "nu", "2026-11-07")],
      [nubank],
    );
    expect([a.month, b.month, c.month]).toEqual(["2026-11", "2026-11", "2026-12"]);
  });

  it("guarda a data original e não altera o que foi salvo", () => {
    const saved = [onCard("a", 2000, "nu", "2026-11-07")];
    const [shown] = resolveCardExpenses(saved, [nubank]);
    expect(shown).toMatchObject({ month: "2026-12", purchaseDate: "2026-11-07", cardId: "nu" });
    expect(saved[0].month).toBe("2026-11");
  });

  it("vale também para despesa extra, e a virada de ano acompanha o vencimento", () => {
    const [e] = resolveCardExpenses([extra("e", 9000, { month: "2026-12", cardId: "in", purchaseDate: "2026-12-26" })], [inter]);
    expect(e.month).toBe("2027-02");
  });

  it("fixa, renda, despesa sem cartão e cartão que não existe mais ficam como estão", () => {
    const list: Transaction[] = [
      expense("fixa", 1000, { fixed: true, cardId: "nu", purchaseDate: "2026-11-07" }),
      expense("renda", 1000, { type: "income", cardId: "nu", purchaseDate: "2026-11-07" }),
      expense("comum", 1000),
      onCard("orfa", 1000, "apagado", "2026-11-07"),
      expense("sem-data", 1000, { cardId: "nu" }),
    ];
    expect(resolveCardExpenses(list, [nubank]).map((t) => t.month)).toEqual(["2026-11", "2026-11", "2026-11", "2026-11", "2026-11"]);
  });

  it("sem cartões cadastrados devolve a mesma lista", () => {
    const list = [onCard("a", 1, "nu", "2026-11-07")];
    expect(resolveCardExpenses(list, undefined)).toBe(list);
    expect(resolveCardExpenses(list, [])).toBe(list);
  });

  it("o total do mês, a projeção, a categoria, o relatório e os meses com dados seguem a fatura", () => {
    const data = {
      transactions: [onCard("mercado", 5000, "nu", "2026-11-07"), expense("aluguel", 100000, { category: "Moradia" })],
      creditTransactions: [] as CreditTransaction[],
      extraExpenses: [extra("viagem", 8000, { month: "2026-11", cardId: "nu", purchaseDate: "2026-11-20" })],
      creditCards: [nubank],
    };
    // novembro: só o aluguel; as duas compras fecharam depois do dia 2 e vencem em dezembro
    expect(getMonthSummary(data, "2026-11").totalExpense).toBe(100000);
    expect(getMonthSummary(data, "2026-12").totalExpense).toBe(5000 + 8000);
    expect(getMonthSummary(data, "2026-12").byCategory["Alimentação"]).toBe(5000);
    expect(getCategoryDetail(data, "2026-12", "Alimentação").map((l) => l.amount)).toEqual([5000]);
    expect(getProjection(data, data.extraExpenses, "2026-11", 2).map((m) => m.extraExpense)).toEqual([0, 8000]);
    expect(getReportRows(data, ["2026-12"], { entries: true, credit: true }).map((r) => r.name).sort()).toEqual(["mercado", "viagem"]);
    expect(getAvailableMonths({ ...data, notes: [] }, "2026-11")).toContain("2026-12");
  });

  it("sem cartão cadastrado, o cálculo é o de sempre (nada muda para quem não usa)", () => {
    const base = { transactions: [expense("a", 4000), expense("b", 1500, { month: "2026-12" })], creditTransactions: [] as CreditTransaction[], extraExpenses: [extra("e", 700)] };
    const withCards = { ...base, creditCards: [nubank, inter] };
    for (const m of ["2026-11", "2026-12"]) expect(getMonthSummary(withCards, m)).toEqual(getMonthSummary(base, m));
  });
});

describe("datas da fatura", () => {
  it("fechamento e vencimento da fatura que vence no mês", () => {
    expect(invoiceDates(nubank, "2026-12")).toEqual({ closingDate: "2026-12-02", dueDate: "2026-12-09" });
    // vencimento <= fechamento: a fatura fecha no mês anterior ao vencimento
    expect(invoiceDates(inter, "2026-12")).toEqual({ closingDate: "2026-11-25", dueDate: "2026-12-05" });
    // mês curto usa o último dia
    expect(invoiceDates({ closingDay: 31, dueDay: 31 }, "2027-02")).toEqual({ closingDate: "2027-01-31", dueDate: "2027-02-28" });
  });

  it("concorda com getInvoice (a data da compra leva às mesmas datas)", () => {
    const cards = [nubank, inter, { closingDay: 31, dueDay: 10 }, { closingDay: 15, dueDay: 15 }, { closingDay: 1, dueDay: 28 }];
    for (const card of cards) {
      for (const date of ["2026-01-01", "2026-02-28", "2026-03-15", "2026-05-31", "2026-12-26", "2027-02-14"]) {
        const inv = getInvoice(card, date);
        expect(invoiceDates(card, inv.month)).toEqual({ closingDate: inv.closingDate, dueDate: inv.dueDate });
      }
    }
  });
});

describe("fatura do cartão no mês", () => {
  const installments: CreditTransaction = { id: "tv", name: "TV", totalAmount: 30000, installments: 3, startMonth: "2026-11", category: "Crédito/Parcelado", billingDay: 10, cardId: "nu" };
  const subscription: CreditTransaction = { id: "assin", name: "Streaming", totalAmount: 2000, installments: 1, startMonth: "2026-11", category: "Outros", recurring: true, billingDay: 1, cardId: "nu" };
  const other: CreditTransaction = { id: "outro", name: "Outro cartão", totalAmount: 9900, installments: 1, startMonth: "2026-12", category: "Outros", billingDay: 28, cardId: "in" };
  const data = {
    transactions: [
      onCard("padaria", 5000, "nu", "2026-11-01"),
      onCard("mercado", 3000, "nu", "2026-11-07"),
      onCard("outro-cartao", 777, "in", "2026-11-07"),
      expense("aluguel", 100000, { category: "Moradia" }),
    ],
    creditTransactions: [installments, subscription, other],
    extraExpenses: [extra("presente", 1200, { month: "2026-12", cardId: "nu", purchaseDate: "2026-12-01" })],
    creditCards: [nubank, inter],
  };

  it("junta parcelas, recorrências e compras avulsas do cartão, só as dele", () => {
    const dec = getCardInvoice(data, nubank, "2026-12");
    expect(dec.installments.map((c) => [c.name, c.installmentValue, c.currentInstallment])).toEqual([["TV", 10000, 1]]);
    expect(dec.recurring.map((c) => [c.name, c.installmentValue])).toEqual([["Streaming", 2000]]);
    expect(dec.purchases.map((p) => [p.name, p.amount, p.source])).toEqual([["mercado", 3000, "expense"], ["presente", 1200, "extra"]]);
    expect([dec.installmentsTotal, dec.recurringTotal, dec.purchasesTotal, dec.total]).toEqual([10000, 2000, 4200, 16200]);
    expect([dec.closingDate, dec.dueDate]).toEqual(["2026-12-02", "2026-12-09"]);
  });

  it("a mesma compra não aparece em duas faturas, e um mês sem nada dá fatura vazia", () => {
    const nov = getCardInvoice(data, nubank, "2026-11");
    expect(nov.purchases.map((p) => p.name)).toEqual(["padaria"]);
    expect(nov.installments).toEqual([]);
    const empty = getCardInvoice(data, nubank, "2026-06");
    expect([empty.total, empty.installments.length, empty.recurring.length, empty.purchases.length]).toEqual([0, 0, 0, 0]);
  });

  it("compras avulsas saem ordenadas pela data da compra", () => {
    const d = { ...data, extraExpenses: [], transactions: [onCard("b", 10, "nu", "2026-11-20"), onCard("a", 10, "nu", "2026-11-03"), onCard("c", 10, "nu", "2026-11-03")] };
    expect(getCardInvoice(d, nubank, "2026-12").purchases.map((p) => p.name)).toEqual(["a", "c", "b"]);
  });

  it("teto: sem teto não mede; com teto mostra o quanto usa e se estourou", () => {
    expect(getCardInvoice(data, nubank, "2026-12")).toMatchObject({ limit: null, limitUsed: null, overLimit: false });
    const tight = { ...nubank, limit: 16200 };
    expect(getCardInvoice({ ...data, creditCards: [tight, inter] }, tight, "2026-12")).toMatchObject({ limit: 16200, limitUsed: 100, overLimit: false });
    const small = { ...nubank, limit: 10000 };
    const over = getCardInvoice({ ...data, creditCards: [small, inter] }, small, "2026-12");
    expect(over.overLimit).toBe(true);
    expect(over.limitUsed).toBeCloseTo(162, 5);
    // teto 0 ou ausente = sem teto
    expect(getCardInvoice(data, { ...nubank, limit: 0 }, "2026-12").limit).toBeNull();
  });

  it("consistência: despesas do mês = despesas sem cartão + soma das faturas (a fatura nunca é somada por cima)", () => {
    for (const month of ["2026-11", "2026-12", "2027-01", "2027-02"]) {
      const summary = getMonthSummary(data, month);
      const invoices = [nubank, inter].reduce((s, card) => s + getCardInvoice(data, card, month).total, 0);
      const withoutCard = data.transactions.filter((t) => !t.cardId && t.month === month).reduce((s, t) => s + t.amount, 0);
      expect(summary.totalExpense, month).toBe(withoutCard + invoices);
    }
  });

  it("cartão removido: as despesas ligadas a ele voltam a valer no mês em que foram lançadas e nada some", () => {
    const before = getMonthSummary(data, "2026-12").totalExpense;
    const detached = {
      ...data,
      creditCards: [inter],
      transactions: data.transactions.map((t) => (t.cardId === "nu" ? { ...t, cardId: undefined } : t)),
      extraExpenses: data.extraExpenses.map((e) => ({ ...e, cardId: undefined })),
      creditTransactions: data.creditTransactions.map((c) => (c.cardId === "nu" ? { ...c, cardId: undefined } : c)),
    };
    const all = ["2026-11", "2026-12", "2027-01", "2027-02"].reduce((s, m) => s + getMonthSummary(detached, m).totalExpense, 0);
    const allBefore = ["2026-11", "2026-12", "2027-01", "2027-02"].reduce((s, m) => s + getMonthSummary(data, m).totalExpense, 0);
    expect(all).toBe(allBefore);
    expect(before).toBeGreaterThan(0);
  });
});

describe("pagamento da fatura (só registro)", () => {
  const pix = { method: "pix" as const, date: "2026-12-09" };
  const boleto = { method: "boleto" as const, date: "2026-12-10", notes: "agendado" };

  it("marca por mês de vencimento, troca e desmarca, sem tocar nos outros meses", () => {
    const paid = patchCardPayment({}, "2026-12", pix);
    expect(paid.payments).toEqual({ "2026-12": pix });
    const both = patchCardPayment(paid, "2027-01", boleto);
    expect(both.payments).toEqual({ "2026-12": pix, "2027-01": boleto });
    expect(patchCardPayment(both, "2026-12", { ...pix, method: "debit" }).payments?.["2026-12"].method).toBe("debit");
    expect(patchCardPayment(both, "2026-12", null).payments).toEqual({ "2027-01": boleto });
  });

  it("sem nenhum pagamento sobrando, `payments` some", () => {
    expect(patchCardPayment({ payments: { "2026-12": pix } }, "2026-12", null).payments).toBeUndefined();
    expect(patchCardPayment({}, "2026-12", null).payments).toBeUndefined();
  });

  it("não altera o objeto recebido e não muda nenhum valor do mês", () => {
    const card = { ...nubank, payments: { "2026-12": pix } };
    patchCardPayment(card, "2026-12", null);
    expect(card.payments).toEqual({ "2026-12": pix });
    const data = { transactions: [onCard("a", 5000, "nu", "2026-11-07")], creditTransactions: [] as CreditTransaction[], creditCards: [nubank] };
    const paidData = { ...data, creditCards: [{ ...nubank, ...patchCardPayment(nubank, "2026-12", pix) }] };
    expect(getMonthSummary(paidData, "2026-12")).toEqual(getMonthSummary(data, "2026-12"));
    expect(getCardInvoice(paidData, paidData.creditCards[0], "2026-12").total).toBe(5000);
  });

  it("cardPaymentOf lê o pagamento do mês", () => {
    const card = { ...nubank, payments: { "2026-12": pix } };
    expect(cardPaymentOf(card, "2026-12")).toEqual(pix);
    expect(cardPaymentOf(card, "2026-11")).toBeUndefined();
    expect(cardPaymentOf(nubank, "2026-12")).toBeUndefined();
  });
});
