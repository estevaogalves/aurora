import type { Investment, InvestmentFamily, InvestmentMovement } from "./types";

export const FAMILY_LABEL: Record<InvestmentFamily, string> = {
  fixed: "Renda fixa",
  treasury: "Tesouro Direto",
  liquid: "Liquidez diária",
  equity: "Ações, FIIs e ETFs",
  fund: "Fundos",
  other: "Outros",
};

/** Totais de um investimento, calculados a partir das movimentações. */
export interface InvestmentTotals {
  /** soma dos aportes (centavos) */
  contributed: number;
  /** soma dos resgates (centavos) */
  redeemed: number;
  /** lucro (ou prejuízo): valor atual + resgates − aportes */
  profit: number;
  /** lucro ÷ aportes, ou null se nunca houve aporte */
  returnRate: number | null;
}

export function getInvestmentTotals(inv: Investment, movements: InvestmentMovement[]): InvestmentTotals {
  let contributed = 0;
  let redeemed = 0;
  for (const m of movements) {
    if (m.investmentId !== inv.id) continue;
    if (m.type === "contribution") contributed += m.amount;
    else if (m.type === "redemption") redeemed += m.amount;
  }
  const profit = inv.currentValue + redeemed - contributed;
  return { contributed, redeemed, profit, returnRate: contributed > 0 ? profit / contributed : null };
}

/** Movimentações de um investimento em ordem cronológica (mesma data: a registrada primeiro vem antes). */
export function sortMovements(movements: InvestmentMovement[]): InvestmentMovement[] {
  return movements.map((m, i) => ({ m, i })).sort((a, b) => a.m.date.localeCompare(b.m.date) || a.i - b.i).map((x) => x.m);
}

/**
 * Recalcula valor atual, cotas e preço médio refazendo as movimentações em ordem de data.
 * O valor nunca fica negativo. Cotas e preço médio só mudam se alguma movimentação trouxer quantidade.
 */
export function replayInvestment(inv: Investment, movements: InvestmentMovement[]): Investment {
  const own = sortMovements(movements.filter((m) => m.investmentId === inv.id));
  let value = 0;
  let qty = 0;
  let cost = 0;
  let hasQty = false;

  for (const m of own) {
    if (m.type === "contribution") {
      value += m.amount;
      if (m.quantity) {
        hasQty = true;
        qty += m.quantity;
        cost += m.unitPrice ? m.quantity * m.unitPrice : m.amount;
      }
    } else if (m.type === "redemption") {
      value = Math.max(0, value - m.amount);
      if (m.quantity) {
        hasQty = true;
        const left = Math.max(0, qty - m.quantity);
        cost = qty > 0 ? cost * (left / qty) : 0;
        qty = left;
      }
    } else if (m.type === "yield") {
      value += m.amount;
    } else {
      value = m.amount;
    }
  }

  const next: Investment = { ...inv, currentValue: Math.max(0, value) };
  if (hasQty) {
    next.quantity = qty;
    next.avgPrice = qty > 0 ? Math.round(cost / qty) : undefined;
  }
  return next;
}

/** Texto da taxa para o card, sem repetir o indexador quando a taxa já o cita ("IPCA + 6%"). */
export function rateLabel(inv: Pick<Investment, "indexer" | "rate">): string {
  const { indexer, rate } = inv;
  if (!rate) return indexer ?? "";
  if (!indexer || rate.toLowerCase().includes(indexer.toLowerCase())) return rate;
  return `${indexer} · ${rate}`;
}

export interface PortfolioSummary {
  netWorth: number;
  contributed: number;
  redeemed: number;
  profit: number;
  returnRate: number | null;
  byFamily: { key: InvestmentFamily; value: number }[];
  byInstitution: { key: string; value: number }[];
}

const toSortedList = <K extends string>(map: Map<K, number>) =>
  [...map.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);

/** Resumo da carteira inteira. */
export function getPortfolioSummary(investments: Investment[], movements: InvestmentMovement[]): PortfolioSummary {
  const family = new Map<InvestmentFamily, number>();
  const institution = new Map<string, number>();
  let netWorth = 0;
  let contributed = 0;
  let redeemed = 0;
  let profit = 0;

  for (const inv of investments) {
    const t = getInvestmentTotals(inv, movements);
    netWorth += inv.currentValue;
    contributed += t.contributed;
    redeemed += t.redeemed;
    profit += t.profit;
    if (inv.currentValue > 0) {
      family.set(inv.family, (family.get(inv.family) ?? 0) + inv.currentValue);
      institution.set(inv.institution, (institution.get(inv.institution) ?? 0) + inv.currentValue);
    }
  }

  return {
    netWorth,
    contributed,
    redeemed,
    profit,
    returnRate: contributed > 0 ? profit / contributed : null,
    byFamily: toSortedList(family),
    byInstitution: toSortedList(institution),
  };
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** Dias até a data (0 = hoje, negativo = já passou). */
export function daysUntil(date: string, today: string): number {
  return dayNumber(date) - dayNumber(today);
}

export interface MaturityItem {
  investment: Investment;
  days: number;
}

/** Investimentos que vencem nos próximos `windowDays` dias (ou já venceram e ainda têm valor), do mais próximo ao mais distante. */
export function getUpcomingMaturities(investments: Investment[], today: string, windowDays = 90): MaturityItem[] {
  return investments
    .filter((i) => i.maturityDate && i.currentValue > 0)
    .map((investment) => ({ investment, days: daysUntil(investment.maturityDate as string, today) }))
    .filter((x) => x.days <= windowDays)
    .sort((a, b) => a.days - b.days);
}

/** "2026-12-01" -> "01/12/2026". */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Mensagem depois de registrar, com a concordância certa. */
export const MOVEMENT_DONE = {
  contribution: "Aporte registrado",
  redemption: "Resgate registrado",
  yield: "Rendimento registrado",
  adjustment: "Valor atualizado",
} as const;

export const MOVEMENT_LABEL = {
  contribution: "Aporte",
  redemption: "Resgate",
  yield: "Rendimento",
  adjustment: "Atualização de valor",
} as const;

/** Os produtos mais usados de cada família, que aparecem no select de tipo. */
export const PRODUCT_SUGGESTIONS: Record<InvestmentFamily, string[]> = {
  fixed: ["CDB", "LCI", "LCA"],
  treasury: ["Tesouro Selic", "Tesouro IPCA+"],
  liquid: ["Poupança", "Conta remunerada"],
  equity: ["Ação", "FII", "ETF"],
  fund: ["Fundo de renda fixa", "Fundo multimercado", "Fundo de ações"],
  other: ["Criptomoeda", "Outro"],
};

export interface FamilyFields {
  maturity: boolean;
  /** o usuário escolhe o indexador (no Tesouro ele vem do produto) */
  indexer: boolean;
  rate: boolean;
  liquidity: boolean;
  quantity: boolean;
  ticker: boolean;
  redeemDays: boolean;
}

const FAMILY_FIELDS: Record<InvestmentFamily, FamilyFields> = {
  fixed: { maturity: true, indexer: true, rate: true, liquidity: true, quantity: false, ticker: false, redeemDays: false },
  treasury: { maturity: true, indexer: false, rate: true, liquidity: false, quantity: true, ticker: false, redeemDays: false },
  liquid: { maturity: false, indexer: false, rate: true, liquidity: false, quantity: false, ticker: false, redeemDays: false },
  equity: { maturity: false, indexer: false, rate: false, liquidity: false, quantity: true, ticker: true, redeemDays: false },
  fund: { maturity: false, indexer: false, rate: false, liquidity: false, quantity: true, ticker: true, redeemDays: true },
  other: { maturity: true, indexer: false, rate: false, liquidity: false, quantity: true, ticker: true, redeemDays: false },
};

/** Quais campos o cadastro mostra para o tipo escolhido. A poupança tem regra própria: sem taxa nem indexador. */
export function getFields(family: InvestmentFamily, product?: string): FamilyFields {
  const base = FAMILY_FIELDS[family];
  return product === "Poupança" ? { ...base, rate: false, indexer: false } : base;
}

/** Indexador do Tesouro, deduzido do produto. */
export function treasuryIndexer(product?: string): string | undefined {
  if (product?.includes("IPCA")) return "IPCA";
  if (product?.includes("Selic")) return "Selic";
  return undefined;
}

const NAME_PLACEHOLDER: Record<string, string> = {
  CDB: "CDB 110% CDI",
  LCI: "LCI Banco A 2027",
  LCA: "LCA Banco A 2027",
  "Tesouro Selic": "Tesouro Selic 2029",
  "Tesouro IPCA+": "Tesouro IPCA+ 2035",
  Poupança: "Poupança Banco A",
  "Conta remunerada": "Conta remunerada Banco A",
  Ação: "ITSA4",
  FII: "HGLG11",
  ETF: "IVVB11",
  Criptomoeda: "Bitcoin",
};

export const namePlaceholder = (product?: string) => `Ex.: ${(product && NAME_PLACEHOLDER[product]) || "Nome do investimento"}`;

const RATE_PLACEHOLDER: Record<string, string> = {
  CDB: "110% do CDI",
  LCI: "95% do CDI",
  LCA: "95% do CDI",
  "Tesouro Selic": "Selic + 0,1%",
  "Tesouro IPCA+": "IPCA + 6%",
  "Conta remunerada": "100% do CDI",
};

export const ratePlaceholder = (product?: string) => (product && RATE_PLACEHOLDER[product]) || "Ex.: 10% ao ano";

/** Maior valor aceito num campo de dinheiro: R$ 1 bilhão. */
export const MAX_CENTS = 100_000_000_000;
