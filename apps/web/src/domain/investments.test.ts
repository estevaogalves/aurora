import { describe, expect, it } from "vitest";
import {
  getBusinessSummary,
  getFields,
  getInvestmentTotals,
  getMaturityAlerts,
  maturityAlertKey,
  maturityAlertPrefix,
  splitSeenMaturities,
  getMonthSummary,
  getPortfolioSummary,
  getUpcomingMaturities,
  namePlaceholder,
  rateLabel,
  replayInvestment,
  sortMovements,
  treasuryIndexer,
  type Investment,
  type InvestmentMovement,
} from "./index";

const cdb: Investment = {
  id: "i1", name: "CDB 110%", family: "fixed", institution: "Banco A",
  appliedAt: "2026-01-01", currentValue: 0, maturityDate: "2026-12-01",
};
const fii: Investment = { id: "i2", name: "HGLG11", family: "equity", institution: "Corretora B", appliedAt: "2026-01-01", currentValue: 0 };

let seq = 0;
const mov = (investmentId: string, type: InvestmentMovement["type"], amount: number, date = "2026-03-01", extra: Partial<InvestmentMovement> = {}): InvestmentMovement => ({
  id: `m${seq++}`, investmentId, type, date, amount, ...extra,
});

describe("investimentos: valor e lucro", () => {
  it("aporte novo não aparece como lucro, rendimento sim", () => {
    const movs = [mov("i1", "contribution", 100000), mov("i1", "yield", 5000, "2026-03-02"), mov("i1", "contribution", 50000, "2026-03-03")];
    const inv = replayInvestment(cdb, movs);
    expect(inv.currentValue).toBe(155000);
    expect(getInvestmentTotals(inv, movs)).toMatchObject({ contributed: 150000, profit: 5000 });
  });

  it("resgate parcial e total não distorcem o lucro", () => {
    const base = [mov("i1", "contribution", 100000), mov("i1", "yield", 10000, "2026-03-02")];
    const partial = [...base, mov("i1", "redemption", 40000, "2026-03-03")];
    expect(replayInvestment(cdb, partial).currentValue).toBe(70000);
    expect(getInvestmentTotals(replayInvestment(cdb, partial), partial).profit).toBe(10000);
    const total = [...base, mov("i1", "redemption", 110000, "2026-03-03")];
    expect(replayInvestment(cdb, total).currentValue).toBe(0);
    expect(getInvestmentTotals(replayInvestment(cdb, total), total).profit).toBe(10000);
  });

  it("atualização de valor define o valor e o lucro acompanha", () => {
    const movs = [mov("i1", "contribution", 90000), mov("i1", "adjustment", 95000, "2026-03-02")];
    const inv = replayInvestment(cdb, movs);
    expect(inv.currentValue).toBe(95000);
    expect(getInvestmentTotals(inv, movs).profit).toBe(5000);
  });

  it("o valor nunca fica negativo", () => {
    expect(replayInvestment(cdb, [mov("i1", "contribution", 1000), mov("i1", "redemption", 5000, "2026-03-02")]).currentValue).toBe(0);
  });

  it("segue a data, não a ordem de cadastro, e excluir uma movimentação recalcula", () => {
    const late = mov("i1", "contribution", 10000, "2026-03-10");
    const early = mov("i1", "contribution", 20000, "2026-01-05");
    expect(sortMovements([late, early]).map((m) => m.date)).toEqual(["2026-01-05", "2026-03-10"]);
    expect(replayInvestment(cdb, [late, early]).currentValue).toBe(30000);
    expect(replayInvestment(cdb, [late]).currentValue).toBe(10000);
    // o ajuste do meio vale pela data: o aporte posterior soma depois dele
    const adjust = mov("i1", "adjustment", 50000, "2026-02-01");
    expect(replayInvestment(cdb, [late, early, adjust]).currentValue).toBe(60000);
  });
});

describe("investimentos: cotas e preço médio", () => {
  it("aporte e resgate atualizam cotas e preço médio", () => {
    const movs = [
      mov("i2", "contribution", 300000, "2026-01-01", { quantity: 100, unitPrice: 3000 }),
      mov("i2", "contribution", 50000, "2026-02-01", { quantity: 10, unitPrice: 5000 }),
    ];
    const inv = replayInvestment(fii, movs);
    expect(inv.quantity).toBe(110);
    expect(inv.avgPrice).toBe(Math.round(350000 / 110));
    const sold = replayInvestment(fii, [...movs, mov("i2", "redemption", 100000, "2026-03-01", { quantity: 20, unitPrice: 5000 })]);
    expect(sold.quantity).toBe(90);
    expect(sold.avgPrice).toBe(Math.round(350000 / 110));
  });

  it("sem quantidade nas movimentações, cotas ficam como estão", () => {
    const inv = replayInvestment({ ...cdb, quantity: 5 }, [mov("i1", "contribution", 1000)]);
    expect(inv.quantity).toBe(5);
  });
});

describe("investimentos: campos e textos", () => {
  it("poupança não tem taxa nem indexador, e o Tesouro deduz o indexador", () => {
    expect(getFields("liquid", "Poupança")).toMatchObject({ rate: false, indexer: false });
    expect(getFields("liquid", "Conta remunerada").rate).toBe(true);
    expect(getFields("treasury", "Tesouro IPCA+").indexer).toBe(false);
    expect(treasuryIndexer("Tesouro IPCA+")).toBe("IPCA");
    expect(treasuryIndexer("Tesouro Selic")).toBe("Selic");
    expect(getFields("other", "Criptomoeda").ticker).toBe(true);
  });

  it("a taxa não repete o indexador", () => {
    expect(rateLabel({ indexer: "IPCA", rate: "IPCA + 6,2%" })).toBe("IPCA + 6,2%");
    expect(rateLabel({ indexer: "CDI", rate: "110%" })).toBe("CDI · 110%");
    expect(rateLabel({ indexer: "Selic" })).toBe("Selic");
  });

  it("o exemplo do nome muda conforme o produto", () => {
    expect(namePlaceholder("Ação")).toContain("ITSA4");
    expect(namePlaceholder("Criptomoeda")).toContain("Bitcoin");
    expect(namePlaceholder()).toContain("Nome do investimento");
  });
});

describe("investimentos: carteira", () => {
  it("resumo soma e distribui", () => {
    const movs = [mov("i1", "contribution", 100000), mov("i2", "contribution", 50000)];
    const a = { ...cdb, currentValue: 105000 };
    const b = { ...fii, currentValue: 45000 };
    const s = getPortfolioSummary([a, b], movs);
    expect(s).toMatchObject({ netWorth: 150000, contributed: 150000, profit: 0 });
    expect(s.byFamily[0]).toEqual({ key: "fixed", value: 105000 });
    expect(s.byInstitution.map((x) => x.key)).toEqual(["Banco A", "Corretora B"]);
  });

  it("lista vencimentos dentro da janela", () => {
    const a = { ...cdb, currentValue: 1000 };
    expect(getUpcomingMaturities([a], "2026-11-10")).toEqual([{ investment: a, days: 21 }]);
    expect(getUpcomingMaturities([a], "2026-05-01")).toEqual([]);
    expect(getUpcomingMaturities([{ ...a, currentValue: 0 }], "2026-11-10")).toEqual([]);
  });

  it("não altera o resumo do mês", () => {
    const data = { transactions: [], creditTransactions: [], extraExpenses: [], investments: [{ ...cdb, currentValue: 100000 }] };
    expect(getMonthSummary(data, "2026-03")).toMatchObject({ totalIncome: 0, totalExpense: 0, balance: 0 });
  });
});

describe("investimentos: avisos de vencimento", () => {
  const due = (id: string, maturityDate: string | undefined, currentValue = 100000): Investment => ({ ...cdb, id, maturityDate, currentValue });

  it("só avisa quem vence em até 30 dias ou já venceu, e só com valor", () => {
    const list = [
      due("longe", "2026-12-20"),
      due("limite", "2026-12-10"),
      due("passou", "2026-11-01"),
      due("sem-venc", undefined),
      due("resgatado", "2026-11-15", 0),
    ];
    expect(getMaturityAlerts(list, "2026-11-10").map((a) => a.investment.id)).toEqual(["passou", "limite"]);
  });

  it("nível: vencido, esta semana (até 7 dias, incluindo hoje) e em breve", () => {
    const list = [due("a", "2026-11-09"), due("b", "2026-11-10"), due("c", "2026-11-17"), due("d", "2026-11-18")];
    expect(getMaturityAlerts(list, "2026-11-10").map((a) => [a.investment.id, a.level, a.days])).toEqual([
      ["a", "overdue", -1],
      ["b", "now", 0],
      ["c", "now", 7],
      ["d", "soon", 8],
    ]);
  });

  it("a chave muda com o nível e com o vencimento, e não se mistura com a das metas", () => {
    const [soon] = getMaturityAlerts([due("x", "2026-11-25")], "2026-11-10");
    const [now] = getMaturityAlerts([due("x", "2026-11-25")], "2026-11-20");
    const [moved] = getMaturityAlerts([due("x", "2026-11-28")], "2026-11-10");
    expect(maturityAlertKey(soon)).toBe("inv:x:2026-11-25:soon");
    expect(new Set([maturityAlertKey(soon), maturityAlertKey(now), maturityAlertKey(moved)]).size).toBe(3);
    expect(maturityAlertKey(soon).startsWith(maturityAlertPrefix("x"))).toBe(true);
  });

  it("marcar como visto esconde só aquele nível; ao escalar, avisa de novo", () => {
    const early = getMaturityAlerts([due("x", "2026-11-25")], "2026-11-10");
    const seen = early.map(maturityAlertKey);
    expect(splitSeenMaturities(early, seen)).toMatchObject({ unseen: [], seen: [{ level: "soon" }] });
    const later = getMaturityAlerts([due("x", "2026-11-25")], "2026-11-20");
    expect(splitSeenMaturities(later, seen).unseen).toHaveLength(1);
  });
});

describe("negócio próprio", () => {
  const biz: Investment = { id: "b1", name: "Revenda", family: "business", institution: "Negócio próprio", appliedAt: "2026-01-01", currentValue: 0 };

  it("investimentos consecutivos, vendas e saque: lucro = recebido − investido, valor atual = saldo a sacar", () => {
    const movs = [
      mov("b1", "contribution", 100000, "2026-01-01"), mov("b1", "contribution", 50000, "2026-02-01"),
      mov("b1", "income", 80000, "2026-02-10"), mov("b1", "income", 100000, "2026-03-10"), mov("b1", "redemption", 30000, "2026-03-15"),
    ];
    const inv = replayInvestment(biz, movs);
    expect(inv.currentValue).toBe(150000);
    expect(getInvestmentTotals(inv, movs)).toMatchObject({ contributed: 150000, received: 180000, redeemed: 30000, profit: 30000 });
  });

  it("em prejuízo enquanto recebeu menos do que investiu; saque maior que o saldo não fica negativo", () => {
    const movs = [mov("b1", "contribution", 100000), mov("b1", "income", 40000, "2026-03-02")];
    const inv = replayInvestment(biz, movs);
    expect(getInvestmentTotals(inv, movs).profit).toBe(-60000);
    expect(replayInvestment(biz, [...movs, mov("b1", "redemption", 999999, "2026-03-03")]).currentValue).toBe(0);
  });

  it("não entra no resumo da carteira; tem resumo próprio", () => {
    const movs = [mov("b1", "contribution", 100000), mov("b1", "income", 130000, "2026-03-02"), mov("b1", "redemption", 50000, "2026-03-03"), mov("i1", "contribution", 70000)];
    const invs = [replayInvestment(biz, movs), replayInvestment(cdb, movs)];
    expect(getPortfolioSummary(invs, movs)).toMatchObject({ netWorth: 70000, contributed: 70000 });
    expect(getBusinessSummary(invs, movs)).toMatchObject({ count: 1, invested: 100000, received: 130000, withdrawn: 50000, available: 80000, profit: 30000 });
  });
});
