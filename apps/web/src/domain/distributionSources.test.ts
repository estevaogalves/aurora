import { describe, expect, it } from "vitest";
import { DEFAULT_DISTRIBUTION, distGroupChoices, distGroupOf, distGroupOfSource, distLabel, distSourceId, distributionItemsFor, findSentMovements, getMonthDistributions, getSentByDistribution, makeDistributionOrigin, overrideKey, sentKey, type Goal, type GoalMovement, type Investment, type InvestmentMovement, type Transaction } from "./index";

const income = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, name: id, amount, type: "income", category: "Renda", month: "2026-12", ...extra });
const expense = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, name: id, amount, type: "expense", category: "Moradia", month: "2026-12", ...extra });
const data = (transactions: Transaction[]) => ({ transactions, creditTransactions: [] });

describe("distribuições do saldo do mês", () => {
  const dists = (tx: Transaction[], month = "2026-12") => getMonthDistributions(data(tx), month);

  it("sem distribuição própria, é a Dist 1 só: o saldo do mês (como sempre foi)", () => {
    const d = dists([income("salário", 500000, { fixed: true }), expense("aluguel", 150000, { fixed: true })]);
    expect(d).toEqual([{ group: 1, id: "balance", label: "Dist 1", amount: 350000, incomes: [] }]);
  });

  it("13º que escolheu uma distribuição própria vira a Dist 2 com o valor cheio, e a Dist 1 fica só com o resto", () => {
    const d = dists([income("salário", 500000, { fixed: true }), income("13º salário", 500000, { distGroup: 2 }), expense("aluguel", 150000, { fixed: true })]);
    expect(d.map((x) => [x.label, x.id, x.amount])).toEqual([["Dist 1", "balance", 350000], ["Dist 2", "d2", 500000]]);
    expect(d[1].incomes).toEqual([{ id: "13º salário", name: "13º salário", amount: 500000 }]);
    // a soma das distribuições é o saldo do mês de sempre
    expect(d.reduce((a, x) => a + x.amount, 0)).toBe(850000);
  });

  it("várias rendas na mesma Dist somam; cada número vira a sua própria página, em ordem", () => {
    const d = dists([
      income("salário", 500000, { fixed: true }),
      income("bônus", 100000, { distGroup: 3 }),
      income("13º 1ª parcela", 250000, { distGroup: 2 }),
      income("13º 2ª parcela", 250000, { distGroup: 2 }),
    ]);
    expect(d.map((x) => [x.label, x.amount])).toEqual([["Dist 1", 500000], ["Dist 2", 500000], ["Dist 3", 100000]]);
    expect(d[1].incomes.map((i) => i.name)).toEqual(["13º 1ª parcela", "13º 2ª parcela"]);
  });

  it("não soma meses anteriores: a Dist 2 de dezembro não aparece em janeiro", () => {
    const tx = [income("13º salário", 500000, { distGroup: 2 }), income("salário", 400000, { fixed: true, month: "2026-11" })];
    expect(dists(tx, "2027-01").map((x) => x.label)).toEqual(["Dist 1"]);
    expect(dists(tx, "2027-01")[0].amount).toBe(400000);
  });

  it("Dist 1 negativa (as contas passaram da renda normal) continua separada da Dist 2", () => {
    const d = dists([income("salário", 100000, { fixed: true }), income("bônus", 300000, { distGroup: 2 }), expense("aluguel", 150000, { fixed: true })]);
    expect(d.map((x) => x.amount)).toEqual([-50000, 300000]);
  });

  it("só renda variável conta: número em renda fixa, em despesa ou fora de 2 a 20 é ignorado", () => {
    const d = dists([income("fixa", 100000, { fixed: true, distGroup: 2 }), expense("x", 100, { distGroup: 2 } as Partial<Transaction>), income("estranha", 100, { distGroup: 1 }), income("enorme", 100, { distGroup: 99 })]);
    expect(d.map((x) => x.label)).toEqual(["Dist 1"]);
  });

  it("lê a marca antiga \"distribuir separado\" como Dist 2", () => {
    const old = { ...income("13º", 500000), separate: true } as unknown as Transaction;
    expect(distGroupOf(old)).toBe(2);
    expect(dists([old]).map((x) => x.label)).toEqual(["Dist 1", "Dist 2"]);
  });
});

describe("escolher a distribuição ao lançar uma renda", () => {
  it("o próximo número é o menor livre a partir de 2: os nomes ficam seguidos", () => {
    expect(distGroupChoices([], "2026-12")).toEqual({ existing: [], next: 2 });
    const one = [income("a", 1, { distGroup: 2 })];
    expect(distGroupChoices(one, "2026-12")).toEqual({ existing: [2], next: 3 });
    // sem a Dist 2 no meio, a próxima ocupa o buraco
    const gap = [income("a", 1, { distGroup: 3 }), income("b", 1, { distGroup: 4 })];
    expect(distGroupChoices(gap, "2026-12")).toEqual({ existing: [3, 4], next: 2 });
  });

  it("só olha as rendas do mês, e a renda em edição não conta como já usada", () => {
    const tx = [income("a", 1, { distGroup: 2 }), income("b", 1, { distGroup: 2, month: "2026-11" })];
    expect(distGroupChoices(tx, "2026-11").existing).toEqual([2]);
    expect(distGroupChoices(tx, "2026-12", "a")).toEqual({ existing: [], next: 2 });
  });

  it("nomes e ids das distribuições", () => {
    expect([distLabel(1), distLabel(4)]).toEqual(["Dist 1", "Dist 4"]);
    expect([distSourceId(1), distSourceId(3)]).toEqual(["balance", "d3"]);
    expect([distGroupOfSource("balance"), distGroupOfSource("d12"), distGroupOfSource("d1"), distGroupOfSource("d99"), distGroupOfSource("abc")]).toEqual([1, 12, null, null, null]);
  });
});

describe("percentuais de cada distribuição", () => {
  const custom = [{ id: "emergency", label: "Reserva", percent: 100 }];
  const own = [{ id: "emergency", label: "Reserva", percent: 50 }];

  it("a Dist 1 e as outras seguem o padrão; a própria do mês vale só para ela, naquele mês", () => {
    const settings = { distribution: custom, distributionOverrides: { [overrideKey("2026-12", 2)]: own } };
    expect(distributionItemsFor(settings, "2026-12", 1)).toBe(custom);
    expect(distributionItemsFor(settings, "2026-12", 2)).toBe(own);
    // outro mês e outra distribuição seguem o padrão
    expect(distributionItemsFor(settings, "2027-01", 2)).toBe(custom);
    expect(distributionItemsFor(settings, "2026-12", 3)).toBe(custom);
  });

  it("sem padrão do usuário, vale o do app; e a Dist 1 nunca usa percentual próprio", () => {
    expect(distributionItemsFor({ distribution: null }, "2026-12", 2)).toBe(DEFAULT_DISTRIBUTION);
    const settings = { distribution: null, distributionOverrides: { [overrideKey("2026-12", 1)]: own } };
    expect(distributionItemsFor(settings, "2026-12", 1)).toBe(DEFAULT_DISTRIBUTION);
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

describe("desfazer o envio de uma fatia", () => {
  const origin = (slice: string, source = "balance", month = "2026-12") => makeDistributionOrigin({ month, source, slice });
  const goalMoves: GoalMovement[] = [
    { id: "a", goalId: "g", type: "contribution", date: "2026-12-10", amount: 300, origin: origin("emergency") },
    { id: "b", goalId: "g", type: "contribution", date: "2026-12-10", amount: 100, origin: origin("invest") },
    { id: "c", goalId: "g", type: "contribution", date: "2026-12-10", amount: 50, origin: origin("emergency", "d2") },
    { id: "d", goalId: "g", type: "contribution", date: "2026-12-10", amount: 70 },
    { id: "e", goalId: "g", type: "withdrawal", date: "2026-12-10", amount: 5, origin: origin("emergency") },
  ];
  const invMoves: InvestmentMovement[] = [{ id: "i", investmentId: "i1", type: "contribution", date: "2026-12-10", amount: 200, origin: origin("emergency") }];

  it("acha só os aportes daquela fatia, daquela distribuição e daquele mês", () => {
    const found = findSentMovements({ goalMovements: goalMoves, investmentMovements: invMoves }, "2026-12", "balance", "emergency");
    expect(found.goalMovements.map((m) => m.id)).toEqual(["a"]);
    expect(found.investmentMovements.map((m) => m.id)).toEqual(["i"]);
    expect(findSentMovements({ goalMovements: goalMoves, investmentMovements: invMoves }, "2026-12", "d2", "emergency").goalMovements.map((m) => m.id)).toEqual(["c"]);
    expect(findSentMovements({ goalMovements: goalMoves, investmentMovements: invMoves }, "2027-01", "balance", "emergency").goalMovements).toEqual([]);
  });
});
