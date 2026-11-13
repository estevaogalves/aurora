import { describe, expect, it } from "vitest";
import { baseValueOf, debtProgress, debtTransaction, debtTransactions, earlyPayoff, getDebtRelief, getDebtTotals, getPaidInstallments, getTransactionsByMonth, installmentValueFor, paidMonths, splitDebts, validateDebtFields, withDebtTransactions, type Debt, type Transaction } from "./index";

const consorcio: Debt = { id: "d1", name: "Consórcio moto", kind: "consortium", model: "linear", installmentValue: 69700, totalInstallments: 60, paidInstallments: 12, nextMonth: "2026-12" };
const progressivo: Debt = { id: "d4", name: "Consórcio carro", kind: "consortium", model: "progressive", installmentValue: 10000, increment: 5000, totalInstallments: 5, paidInstallments: 0, nextMonth: "2026-11" };
const emprestimo: Debt = { id: "d2", name: "Empréstimo", installmentValue: 30000, totalInstallments: 6, paidInstallments: 6, nextMonth: "2027-01" };
const celular: Debt = { id: "d3", name: "Celular", installmentValue: 20000, totalInstallments: 10, paidInstallments: 8, nextMonth: "2026-11" };

describe("dívidas e consórcios", () => {
  it("restantes, pago, saldo e mês da quitação", () => {
    expect(debtProgress(consorcio)).toEqual({ remaining: 48, paidTotal: 836400, balance: 3345600, payoffMonth: "2030-11", done: false, percent: 20, nextValue: 69700 });
    expect(debtProgress(celular).payoffMonth).toBe("2026-12");
  });

  it("consórcio progressivo: valor = primeira + (n − 1) × acréscimo (100, 150, 200, 250, 300)", () => {
    expect([1, 2, 3, 4, 5].map((n) => baseValueOf(progressivo, n))).toEqual([10000, 15000, 20000, 25000, 30000]);
    expect(["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"].map((m) => installmentValueFor(progressivo, m))).toEqual([10000, 15000, 20000, 25000, 30000]);
    expect(debtProgress(progressivo)).toMatchObject({ remaining: 5, balance: 100000, payoffMonth: "2027-03", nextValue: 10000 });
  });

  it("progressivo já andado: a próxima parcela tem o valor da posição dela", () => {
    const d: Debt = { ...progressivo, paidInstallments: 2, nextMonth: "2027-01" };
    expect(debtProgress(d)).toMatchObject({ nextValue: 20000, paidTotal: 25000, balance: 75000, remaining: 3 });
    expect(getPaidInstallments(d).map((x) => [x.number, x.month, x.value])).toEqual([[2, "2026-12", 15000], [1, "2026-11", 10000]]);
  });

  it("dívida quitada vai para o histórico e não tem mês de quitação", () => {
    expect(debtProgress(emprestimo)).toMatchObject({ remaining: 0, balance: 0, payoffMonth: null, done: true, percent: 100 });
    const { active, paidOff } = splitDebts([consorcio, emprestimo, celular]);
    expect(active.map((d) => d.name)).toEqual(["Celular", "Consórcio moto"]);
    expect(paidOff.map((d) => d.name)).toEqual(["Empréstimo"]);
  });

  it("quitação antecipada com desconto informado, sem passar do saldo", () => {
    expect(earlyPayoff(celular, 5000)).toEqual({ toPay: 35000, saved: 5000 });
    expect(earlyPayoff(celular, 999999)).toEqual({ toPay: 0, saved: 40000 });
    expect(earlyPayoff(celular, -10)).toEqual({ toPay: 40000, saved: 0 });
  });

  it("totais só do que está em andamento", () => {
    expect(getDebtTotals([consorcio, emprestimo, celular])).toEqual({ count: 2, monthly: 89700, balance: 3345600 + 40000, lastPayoff: "2030-11" });
    expect(getDebtTotals([emprestimo])).toEqual({ count: 0, monthly: 0, balance: 0, lastPayoff: null });
  });

  it("quando termina: a partir do mês seguinte à última parcela, com o valor dela", () => {
    expect(getDebtRelief([consorcio, progressivo])).toEqual([
      { debt: progressivo, from: "2027-04", amount: 30000 },
      { debt: consorcio, from: "2030-12", amount: 69700 },
    ]);
  });

  it("paidValues vale para o mês pago; o resto segue a posição", () => {
    const d: Debt = { ...celular, paidValues: { "2026-10": 15000 } };
    expect(installmentValueFor(d, "2026-10")).toBe(15000);
    expect(paidMonths(d)).toHaveLength(8);
    expect(getPaidInstallments(d)[0]).toMatchObject({ month: "2026-10", value: 15000, adjusted: true });
  });
});

describe("lançamentos gerados pelas dívidas (sem despesa fixa)", () => {
  it("uma despesa por dívida, do primeiro mês à última parcela, com o valor de cada mês e a origem", () => {
    const t = debtTransaction(progressivo)!;
    expect(t).toMatchObject({ id: "debt:d4", name: "Consórcio carro", type: "expense", category: "Consórcios", fixed: true, month: "2026-11", endMonth: "2027-03", debtOrigin: "consortium", debtId: "d4" });
    const nov = getTransactionsByMonth([t], "2026-11")[0];
    const fev = getTransactionsByMonth([t], "2027-02")[0];
    expect([nov.amount, fev.amount]).toEqual([10000, 25000]);
    expect(getTransactionsByMonth([t], "2027-04")).toEqual([]); // depois da última parcela, nada
    expect(getTransactionsByMonth([t], "2026-10")).toEqual([]); // antes do cadastro, nada
  });

  it("dívida comum usa a categoria Dívidas; linear repete o valor", () => {
    const t = debtTransaction({ ...celular, nextMonth: "2026-11", paidInstallments: 0 })!;
    expect(t.category).toBe("Dívidas");
    expect(t.debtOrigin).toBe("debt");
    expect(getTransactionsByMonth([t], "2026-11")[0].amount).toBe(20000);
    expect(getTransactionsByMonth([t], "2027-08")[0].amount).toBe(20000);
  });

  it("o que foi pago antes do cadastro não vira lançamento; as pagas pelo app ficam nos meses delas", () => {
    // cadastrada em 2026-12 com 12 pagas (sem registro): só a partir de dez/2026
    expect(debtTransaction(consorcio)!.month).toBe("2026-12");
    // depois de pagar dez e jan pelo app: o histórico continua nesses meses, com o pagamento
    const pago: Debt = { ...consorcio, paidInstallments: 14, nextMonth: "2027-02", trackedFrom: "2026-12", payments: { "2026-12": { method: "pix", date: "2026-12-05" }, "2027-01": { method: "boleto", date: "2027-01-08" } } };
    const t = debtTransaction(pago)!;
    expect(t.month).toBe("2026-12");
    expect(getTransactionsByMonth([t], "2026-12")[0].payments?.["2026-12"]).toEqual({ method: "pix", date: "2026-12-05" });
    expect(getTransactionsByMonth([t], "2027-02")[0].payments?.["2027-02"]).toBeUndefined(); // próxima: em aberto
  });

  it("idempotente: calcular de novo dá o mesmo resultado, sem duplicar", () => {
    const debts = [consorcio, progressivo, celular];
    expect(debtTransactions(debts)).toEqual(debtTransactions(debts));
    const all = withDebtTransactions([], debts);
    expect(all.map((t) => t.id).sort()).toEqual(["debt:d1", "debt:d3", "debt:d4"]);
    expect(getTransactionsByMonth(all, "2026-12").filter((t) => t.debtId === "d4")).toHaveLength(1);
  });

  it("quitada (todas pagas) não gera obrigação nos meses seguintes, mas mantém o que foi pago", () => {
    expect(debtTransaction(emprestimo)).toBeNull(); // quitada antes do cadastro: nada
    const quitada: Debt = { ...progressivo, paidInstallments: 5, nextMonth: "2027-04", trackedFrom: "2026-11" };
    const t = debtTransaction(quitada)!;
    expect(t.endMonth).toBe("2027-03");
    expect(getTransactionsByMonth([t], "2027-04")).toEqual([]);
    expect(getTransactionsByMonth([t], "2027-03")[0].amount).toBe(30000);
  });

  it("parcela atrasada aparece no mês em que venceu", () => {
    const d: Debt = { ...celular, paidInstallments: 0, nextMonth: "2026-09" };
    expect(getTransactionsByMonth(debtTransactions([d]), "2026-09")).toHaveLength(1);
  });

  it("sem dívidas, a lista é a mesma (mesma referência)", () => {
    const base: Transaction[] = [];
    expect(withDebtTransactions(base, [])).toBe(base);
  });
});

describe("validação do cadastro", () => {
  const ok = { name: "X", kind: "debt" as const, installmentValue: 100, total: 10, paid: 2, nextMonth: "2026-11" };
  it("aceita um cadastro correto", () => expect(validateDebtFields(ok)).toBeNull());
  it("nome, valor, total e pagas", () => {
    expect(validateDebtFields({ ...ok, name: " " })).toMatch(/nome/);
    expect(validateDebtFields({ ...ok, installmentValue: 0 })).toMatch(/maior que zero/);
    expect(validateDebtFields({ ...ok, installmentValue: null })).toMatch(/valor/);
    expect(validateDebtFields({ ...ok, total: 0 })).toMatch(/1 a 600/);
    expect(validateDebtFields({ ...ok, total: 601 })).toMatch(/1 a 600/);
    expect(validateDebtFields({ ...ok, paid: -1 })).toMatch(/pagas/);
    expect(validateDebtFields({ ...ok, paid: 11 })).toMatch(/pagas/);
    expect(validateDebtFields({ ...ok, paid: 10 })).toBeNull(); // tudo pago: quitada
    expect(validateDebtFields({ ...ok, nextMonth: "" })).toMatch(/próxima/);
  });
  it("progressivo exige acréscimo maior que zero", () => {
    const prog = { ...ok, kind: "consortium" as const, model: "progressive" as const };
    expect(validateDebtFields({ ...prog, increment: null })).toMatch(/acréscimo/);
    expect(validateDebtFields({ ...prog, increment: 0 })).toMatch(/acréscimo/);
    expect(validateDebtFields({ ...prog, increment: 5000 })).toBeNull();
    expect(validateDebtFields({ ...prog, increment: 5000_000_000_000 })).toMatch(/bilhão/);
  });
});
