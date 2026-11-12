import { replayInvestment, todayISO, type Investment, type InvestmentMovement } from "@/domain";

const DAY_MS = 86_400_000;
const daysFromNow = (days: number) => todayISO(new Date(Date.now() + days * DAY_MS));

/**
 * Investimentos de exemplo, só para o tour mostrar os gráficos, os vencimentos e o cartão quando o usuário
 * ainda não cadastrou nenhum. Nunca são gravados nem entram nos totais dele. O valor atual e as cotas saem
 * das movimentações, pela mesma regra do app (`replayInvestment`).
 */
export function getDemoInvestments(): { investments: Investment[]; movements: InvestmentMovement[] } {
  const cdb: Investment = {
    id: "demo-cdb", name: "CDB 110% do CDI (exemplo)", family: "fixed", product: "CDB", institution: "Banco Exemplo",
    appliedAt: daysFromNow(-150), currentValue: 0, maturityDate: daysFromNow(45), rate: "110% do CDI", liquidity: "No vencimento",
  };
  const fii: Investment = {
    id: "demo-fii", name: "HGLG11 (exemplo)", family: "equity", product: "FII", institution: "Corretora Exemplo",
    appliedAt: daysFromNow(-120), currentValue: 0, ticker: "HGLG11",
  };
  // negócio próprio de exemplo: investido, recebido das vendas e já sacado (o valor atual é o saldo a sacar)
  const biz: Investment = { id: "demo-biz", name: "Revenda de cosméticos (exemplo)", family: "business", product: "Revenda de produtos", institution: "Negócio próprio", appliedAt: daysFromNow(-90), currentValue: 0 };
  const movements: InvestmentMovement[] = [
    { id: "demo-b1", investmentId: biz.id, type: "contribution", date: daysFromNow(-90), amount: 100000 },
    { id: "demo-b2", investmentId: biz.id, type: "contribution", date: daysFromNow(-50), amount: 50000 },
    { id: "demo-b3", investmentId: biz.id, type: "income", date: daysFromNow(-40), amount: 80000 },
    { id: "demo-b4", investmentId: biz.id, type: "income", date: daysFromNow(-15), amount: 100000 },
    { id: "demo-b5", investmentId: biz.id, type: "redemption", date: daysFromNow(-10), amount: 30000 },
    { id: "demo-m1", investmentId: cdb.id, type: "contribution", date: daysFromNow(-150), amount: 1000000 },
    { id: "demo-m2", investmentId: cdb.id, type: "yield", date: daysFromNow(-30), amount: 52000 },
    { id: "demo-m3", investmentId: fii.id, type: "contribution", date: daysFromNow(-120), amount: 300000, quantity: 100, unitPrice: 3000 },
    { id: "demo-m4", investmentId: fii.id, type: "adjustment", date: daysFromNow(-5), amount: 318000 },
  ];
  return { investments: [replayInvestment(cdb, movements), replayInvestment(fii, movements), replayInvestment(biz, movements)], movements };
}
