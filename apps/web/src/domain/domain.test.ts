import { describe, expect, it } from "vitest";
import {
  getAvailableMonths,
  getCreditByMonth,
  getDistribution,
  getExpensesByCategory,
  getHiddenTransactionsByMonth,
  getMonthSummary,
  getProjection,
  getTransactionsByMonth,
  patchAmountForMonth,
  patchHideInMonth,
  patchRestoreInMonth,
  patchToggleFixed,
  type CreditTransaction,
  type ExtraExpense,
  type Transaction,
} from "./index";

const tx = (over: Partial<Transaction>): Transaction => ({
  id: "t",
  name: "x",
  amount: 0,
  type: "expense",
  category: "Outros",
  month: "2026-03",
  ...over,
});

const credit = (over: Partial<CreditTransaction> = {}): CreditTransaction => ({
  id: "c",
  name: "Notebook",
  totalAmount: 100000,
  installments: 4,
  startMonth: "2026-03",
  category: "Outros",
  ...over,
});

describe("getTransactionsByMonth", () => {
  it("mostra transação comum só no mês dela", () => {
    const list = [tx({ id: "a", month: "2026-03" })];
    expect(getTransactionsByMonth(list, "2026-03")).toHaveLength(1);
    expect(getTransactionsByMonth(list, "2026-02")).toHaveLength(0);
    expect(getTransactionsByMonth(list, "2026-04")).toHaveLength(0);
  });

  it("fixa vale do mês de criação em diante, não antes", () => {
    const list = [tx({ id: "a", fixed: true, month: "2026-03" })];
    expect(getTransactionsByMonth(list, "2026-02")).toHaveLength(0);
    expect(getTransactionsByMonth(list, "2026-03")).toHaveLength(1);
    expect(getTransactionsByMonth(list, "2027-01")).toHaveLength(1);
  });

  it("fixa some nos meses ocultados", () => {
    const list = [
      tx({ id: "a", fixed: true, month: "2026-03", hiddenMonths: ["2026-05"] }),
    ];
    expect(getTransactionsByMonth(list, "2026-04")).toHaveLength(1);
    expect(getTransactionsByMonth(list, "2026-05")).toHaveLength(0);
    expect(getTransactionsByMonth(list, "2026-06")).toHaveLength(1);
  });

  it("aplica o valor do mês, inclusive quando ele é zero", () => {
    const list = [
      tx({
        id: "a",
        fixed: true,
        amount: 5000,
        month: "2026-03",
        monthlyValues: { "2026-04": 7000, "2026-05": 0 },
      }),
    ];
    expect(getTransactionsByMonth(list, "2026-03")[0].amount).toBe(5000);
    expect(getTransactionsByMonth(list, "2026-04")[0].amount).toBe(7000);
    expect(getTransactionsByMonth(list, "2026-05")[0].amount).toBe(0);
  });

  it("não altera o objeto original", () => {
    const original = tx({
      fixed: true,
      amount: 5000,
      monthlyValues: { "2026-03": 9000 },
    });
    getTransactionsByMonth([original], "2026-03");
    expect(original.amount).toBe(5000);
  });
});

describe("getHiddenTransactionsByMonth", () => {
  it("lista só fixas ocultas naquele mês", () => {
    const list = [
      tx({ id: "a", fixed: true, hiddenMonths: ["2026-04"] }),
      tx({ id: "b", fixed: true }),
      tx({ id: "c", hiddenMonths: ["2026-04"] }),
    ];
    expect(getHiddenTransactionsByMonth(list, "2026-04").map((t) => t.id)).toEqual(["a"]);
  });
});

describe("patches de transação", () => {
  it("fixa guarda o valor por mês; normal troca o valor", () => {
    const fixa = tx({ fixed: true, amount: 100 });
    expect(patchAmountForMonth(fixa, "2026-04", 250)).toEqual({
      monthlyValues: { "2026-04": 250 },
    });
    expect(patchAmountForMonth(tx({ amount: 100 }), "2026-04", 250)).toEqual({
      amount: 250,
    });
  });

  it("preserva os outros meses ao alterar um", () => {
    const fixa = tx({ fixed: true, monthlyValues: { "2026-03": 1 } });
    expect(patchAmountForMonth(fixa, "2026-04", 2).monthlyValues).toEqual({
      "2026-03": 1,
      "2026-04": 2,
    });
  });

  it("oculta e restaura um mês", () => {
    const fixa = tx({ fixed: true });
    const oculta = { ...fixa, ...patchHideInMonth(fixa, "2026-04") };
    expect(oculta.hiddenMonths).toEqual(["2026-04"]);
    // ocultar duas vezes não duplica
    expect(patchHideInMonth(oculta, "2026-04")).toEqual({});
    const restaurada = { ...oculta, ...patchRestoreInMonth(oculta, "2026-04") };
    expect(restaurada.hiddenMonths).toEqual([]);
  });

  it("ocultar uma transação comum não gera patch (quem chama remove)", () => {
    expect(patchHideInMonth(tx({}), "2026-04")).toBeNull();
  });

  it("alterna fixa e limpa o que era por mês", () => {
    const comum = tx({});
    expect(patchToggleFixed(comum)).toEqual({ fixed: true, hiddenMonths: [] });
    const fixa = tx({
      fixed: true,
      hiddenMonths: ["2026-04"],
      monthlyValues: { "2026-04": 1 },
    });
    expect(patchToggleFixed(fixa)).toEqual({
      fixed: false,
      hiddenMonths: undefined,
      monthlyValues: undefined,
    });
  });
});

describe("getCreditByMonth", () => {
  it("cobra do mês inicial até a última parcela", () => {
    const c = [credit({ startMonth: "2026-03", installments: 4 })];
    expect(getCreditByMonth(c, "2026-02")).toHaveLength(0);
    expect(getCreditByMonth(c, "2026-03")[0].currentInstallment).toBe(1);
    expect(getCreditByMonth(c, "2026-06")[0].currentInstallment).toBe(4);
    expect(getCreditByMonth(c, "2026-07")).toHaveLength(0);
  });

  it("atravessa a virada de ano", () => {
    const c = [credit({ startMonth: "2026-11", installments: 3 })];
    expect(getCreditByMonth(c, "2027-01")[0].currentInstallment).toBe(3);
  });

  it("não perde centavos entre as parcelas", () => {
    const c = [credit({ totalAmount: 1000, installments: 3, startMonth: "2026-01" })];
    const values = ["2026-01", "2026-02", "2026-03"].map(
      (m) => getCreditByMonth(c, m)[0].installmentValue,
    );
    expect(values).toEqual([334, 333, 333]);
    expect(values.reduce((a, b) => a + b, 0)).toBe(1000);
  });
});

describe("getMonthSummary", () => {
  const data = {
    transactions: [
      tx({ id: "r", type: "income", category: "Renda", amount: 500000, fixed: true }),
      tx({ id: "d1", amount: 120000, category: "Moradia" }),
      tx({ id: "d2", amount: 30000, category: "Lazer" }),
    ],
    creditTransactions: [credit({ totalAmount: 100000, installments: 4 })],
  };

  it("inclui o crédito nas despesas e no saldo", () => {
    const s = getMonthSummary(data, "2026-03");
    expect(s.totalIncome).toBe(500000);
    expect(s.creditExpense).toBe(25000);
    expect(s.totalExpense).toBe(120000 + 30000 + 25000);
    expect(s.balance).toBe(500000 - 175000);
  });

  it("agrupa por categoria e põe o crédito na própria categoria", () => {
    const s = getMonthSummary(data, "2026-03");
    expect(s.byCategory.Moradia).toBe(120000);
    expect(s.byCategory["Crédito/Parcelado"]).toBe(25000);
  });

  it("mês sem a transação comum não conta ela, mas conta a fixa", () => {
    const s = getMonthSummary(data, "2026-04");
    expect(s.totalIncome).toBe(500000);
    expect(s.totalExpense).toBe(25000);
  });

  it("percentual é 0 quando não há renda", () => {
    const s = getMonthSummary({ transactions: [], creditTransactions: [] }, "2026-03");
    expect(s.expensePercentage).toBe(0);
    expect(s.balance).toBe(0);
  });

  it("ordena as categorias da maior para a menor", () => {
    const s = getMonthSummary(data, "2026-03");
    expect(getExpensesByCategory(s).map((c) => c.category)).toEqual([
      "Moradia",
      "Lazer",
      "Crédito/Parcelado",
    ]);
  });
});

describe("getDistribution", () => {
  it("a soma das partes é sempre igual ao saldo", () => {
    for (const balance of [1, 7, 100, 12345, 168600, 999999]) {
      const d = getDistribution(balance);
      const sum = d.emergency + d.invest + d.leisure + d.education + d.costs;
      expect(sum).toBe(balance);
    }
  });

  it("não distribui saldo zero ou negativo", () => {
    expect(getDistribution(0).emergency).toBe(0);
    expect(getDistribution(-500).invest).toBe(0);
  });

  it("respeita os percentuais", () => {
    const d = getDistribution(10000);
    expect(d).toEqual({
      emergency: 3000,
      invest: 2000,
      leisure: 2000,
      education: 1500,
      costs: 1500,
    });
  });
});

describe("getAvailableMonths", () => {
  it("vazio quando não há dados", () => {
    expect(
      getAvailableMonths({ transactions: [], creditTransactions: [], notes: [] }, "2026-03"),
    ).toEqual([]);
  });

  it("vai do primeiro dado até o mês atual, sem buracos", () => {
    const months = getAvailableMonths(
      {
        transactions: [tx({ month: "2026-01" })],
        creditTransactions: [],
        notes: [],
      },
      "2026-04",
    );
    expect(months).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("estende até o fim de um crédito em curso", () => {
    const months = getAvailableMonths(
      {
        transactions: [tx({ month: "2026-03" })],
        creditTransactions: [credit({ startMonth: "2026-03", installments: 4 })],
        notes: [],
      },
      "2026-03",
    );
    expect(months[months.length - 1]).toBe("2026-06");
  });
});

describe("getProjection", () => {
  const data = {
    transactions: [
      tx({ id: "sal", type: "income", category: "Renda", amount: 500000, fixed: true, month: "2026-01" }),
      tx({ id: "alu", amount: 150000, category: "Moradia", fixed: true, month: "2026-01" }),
      tx({ id: "var", amount: 99999, month: "2026-03" }), // variável não entra
    ],
    creditTransactions: [credit({ totalAmount: 40000, installments: 2, startMonth: "2026-04" })],
  };
  const extras: ExtraExpense[] = [
    { id: "e", name: "IPVA", amount: 80000, month: "2026-05" },
  ];

  it("soma fixas, parcelas e extras mês a mês", () => {
    const p = getProjection(data, extras, "2026-04", 3);
    expect(p.map((m) => m.month)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(p[0]).toMatchObject({ income: 500000, expense: 150000 + 20000, creditExpense: 20000 });
    expect(p[1].extraExpense).toBe(80000);
    expect(p[1].expense).toBe(150000 + 20000 + 80000);
    expect(p[2].creditExpense).toBe(0);
  });

  it("acumula o saldo", () => {
    const p = getProjection(data, extras, "2026-04", 3);
    expect(p[2].accumulated).toBe(p[0].balance + p[1].balance + p[2].balance);
  });

  it("devolve lista vazia para 0 meses", () => {
    expect(getProjection(data, extras, "2026-04", 0)).toEqual([]);
  });
});
