import type { Month } from "./types";

/**
 * De onde veio uma movimentação de meta, porquinho ou investimento que nasceu da sugestão do saldo:
 * o mês do saldo, a fonte (o saldo do mês ou uma renda "distribuir separado") e a fatia da sugestão.
 * Vira texto "distribution|AAAA-MM|fonte|fatia"; vazio quer dizer "lançado à mão".
 */
export interface DistributionOrigin {
  month: Month;
  /** "balance" (saldo do mês) ou o id da renda marcada para distribuir separado */
  source: string;
  /** id da fatia da distribuição (ex.: "emergency") */
  slice: string;
}

export const BALANCE_SOURCE = "balance";

const ORIGIN = /^distribution\|(\d{4}-(?:0[1-9]|1[0-2]))\|([A-Za-z0-9_-]{1,64})\|([A-Za-z0-9_-]{1,64})$/;

export const makeDistributionOrigin = (o: DistributionOrigin): string => `distribution|${o.month}|${o.source}|${o.slice}`;

/** Lê a origem de uma movimentação; null se foi lançada à mão (ou o texto não for de uma sugestão do saldo). */
export function parseDistributionOrigin(origin: string | undefined): DistributionOrigin | null {
  const m = origin ? ORIGIN.exec(origin) : null;
  return m ? { month: m[1], source: m[2], slice: m[3] } : null;
}
