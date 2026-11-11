import { truncatedMoneyCents } from "./money";
import { partsFromCents, partsFromCentsDigits, type MoneyParts } from "./moneyWords";

/**
 * Acha, num texto, o valor em dinheiro onde o mouse está ("R$ 1.234,56", "-R$ 10", "R$ 10.000.000.000.00…").
 * Serve ao tooltip global: ele lê o texto que o app já mostra, então vale para qualquer tela, frase ou gráfico
 * sem cada lugar precisar avisar.
 */

// "R$" (com espaço comum ou inseparável: \s casa os dois), dígitos com pontos de milhar, vírgula e 1 ou 2 casas, e o corte "…"
const MONEY = /[-−]?R\$\s*[-−]?\d[\d.]*(?:,\d{1,2})?…?/g;

export interface MoneyToken {
  start: number;
  end: number;
  text: string;
}

/** O valor que contém a posição `offset` do texto (inclusive as bordas), ou null. */
export function findMoneyToken(text: string, offset: number): MoneyToken | null {
  for (const m of text.matchAll(MONEY)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (offset >= start && offset <= end) return { start, end, text: m[0] };
  }
  return null;
}

/** Todos os valores de um texto (para testes e para quem precisar). */
export function allMoneyTokens(text: string): MoneyToken[] {
  return [...text.matchAll(MONEY)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] }));
}

/**
 * Lê o texto de um valor e devolve reais e centavos. Valor cortado com "…" volta ao número inteiro pelo registro
 * que `formatBRL` guarda; sem registro, não há como saber a grandeza e devolve null.
 */
export function parseMoneyToken(token: string): MoneyParts | null {
  const negative = /^[-−]/.test(token) || /R\$\s*[-−]/.test(token);
  if (token.endsWith("…")) {
    const cents = truncatedMoneyCents(token);
    if (cents === undefined) return null;
    const parts = partsFromCents(Math.abs(cents));
    return parts ? { ...parts, negative: negative || cents < 0 } : null;
  }
  const m = token.match(/(\d[\d.]*)(?:,(\d{1,2}))?$/);
  if (!m) return null;
  const reais = m[1].replace(/\./g, "");
  const cents = (m[2] ?? "").padEnd(2, "0");
  return partsFromCentsDigits(`${reais}${cents || "00"}`, negative);
}
