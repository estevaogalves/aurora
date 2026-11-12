import { describe, expect, it } from "vitest";
import { getDistributionSources, getSentByDistribution, makeDistributionOrigin, sentKey, type Goal, type GoalMovement, type Investment, type InvestmentMovement, type Transaction } from "./index";

const income = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, name: id, amount, type: "income", category: "Renda", month: "2026-12", ...extra });
const expense = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, name: id, amount, type: "expense", category: "Moradia", month: "2026-12", ...extra });
const data = (transactions: Transaction[]) => ({ transactions, creditTransactions: [] });

describe("fontes da sugestão do saldo", () => {
  it("sem renda separada, é uma fonte só: o saldo do mês (como sempre foi)", () => {
    const s = getDistributionSources(data([income("salário", 500000, { fixed: true }), expense("aluguel", 150000, { fixed: true })]), "2026-12");
    expect(s).toEqual([{ id: "balance", label: "Saldo do mês", amount: 350000, separate: false }]);
  });

  it("13º marcado vira uma fonte à parte com o valor cheio, e o saldo do mês fica só com o resto", () => {
    const s = getDistributionSources(
      data([income("salário", 500000, { fixed: true }), income("13º salário", 500000, { separate: true }), expense("aluguel", 150000, { fixed: true })]),
      "2026-12",
    );
    expect(s).toEqual([
      { id: "balance", label: "Saldo do mês", amount: 350000, separate: false },
      { id: "13º salário", label: "13º salário", amount: 500000, separate: true },
    ]);
    // a soma das fontes é o saldo do mês de sempre
    expect(s.reduce((a, x) => a + x.amount, 0)).toBe(850000);
  });

  it("não soma meses anteriores: o 13º de dezembro não aparece em janeiro", () => {
    const tx = [income("13º salário", 500000, { separate: true }), income("salário", 400000, { fixed: true, month: "2026-11" })];
    expect(getDistributionSources(data(tx), "2027-01").map((x) => x.id)).toEqual(["balance"]);
    expect(getDistributionSources(data(tx), "2027-01")[0].amount).toBe(400000);
  });

  it("saldo base negativo (as contas passaram da renda normal) continua separado da renda à parte", () => {
    const s = getDistributionSources(data([income("salário", 100000, { fixed: true }), income("bônus", 300000, { separate: true }), expense("aluguel", 150000, { fixed: true })]), "2026-12");
    expect(s.map((x) => x.amount)).toEqual([-50000, 300000]);
  });

  it("só renda variável conta: marca em renda fixa ou em despesa é ignorada", () => {
    const s = getDistributionSources(data([income("fixa", 100000, { fixed: true, separate: true }), expense("x", 100, { separate: true })]), "2026-12");
    expect(s.map((x) => x.id)).toEqual(["balance"]);
  });
});

describe("o que já foi enviado de cada fatia", () => {
  const goals: Goal[] = [
    { id: "g1", name: "Reserva", target: 0, saved: 0, monthly: 0, deadline: null, piggy: true },
    { id: "g2", name: "Viagem", target: 500000, saved: 0, monthly: 0, deadline: null },
  ];
  const investments: Investment[] = [{ id: "i1", name: "CDB", family: "fixed", institution: "Banco", appliedAt: "2026-01-01", currentValue: 0 }];
  const origin = (slice: string, source = "balance", month = "2026-12") => makeDistributionOrigin({ month, source, slice });
  const gm = (id: string, goalId: string, amount: number, o?: string, type: GoalMovement["type"] = "contribution"): GoalMovement => ({ id, goalId, type, date: "2026-12-10", amount, origin: o });
  const im = (id: string, amount: number, o?: string): InvestmentMovement => ({ id, investmentId: "i1", type: "contribution", date: "2026-12-10", amount, origin: o });

  it("soma por fonte e fatia, com os destinos, só do mês pedido", () => {
    const sent = getSentByDistribution(
      {
        goals,
        goalMovements: [gm("a", "g1", 30000, origin("emergency")), gm("b", "g1", 5000, origin("emergency")), gm("c", "g2", 10000, origin("emergency")), gm("d", "g1", 999, origin("emergency", "balance", "2026-11"))],
        investments,
        investmentMovements: [im("e", 20000, origin("invest")), im("f", 700, origin("invest", "t13"))],
      },
      "2026-12",
    );
    expect(sent[sentKey("balance", "emergency")]).toEqual({
      total: 45000,
      targets: [{ kind: "piggy", name: "Reserva", amount: 35000 }, { kind: "goal", name: "Viagem", amount: 10000 }],
    });
    expect(sent[sentKey("balance", "invest")]).toEqual({ total: 20000, targets: [{ kind: "investment", name: "CDB", amount: 20000 }] });
    expect(sent[sentKey("t13", "invest")]?.total).toBe(700);
  });

  it("lançado à mão, retirada e rendimento não contam como enviado", () => {
    const sent = getSentByDistribution(
      { goals, goalMovements: [gm("a", "g1", 100), gm("b", "g1", 50, origin("emergency"), "withdrawal"), gm("c", "g1", 7, origin("emergency"), "yield")], investments, investmentMovements: [im("d", 100)] },
      "2026-12",
    );
    expect(sent).toEqual({});
  });
});
