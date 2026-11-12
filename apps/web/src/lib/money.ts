/**
 * Dinheiro sempre em CENTAVOS inteiros (number). Nunca use float para valores.
 * Esta é a única porta de entrada e saída de texto <-> centavos do app.
 */

import { isPrivate, MASK } from "./privacy";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlNoDecimals = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** Reais (com ou sem casas) para centavos inteiros. */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

/** Centavos para reais. Use só para eixos de gráfico, nunca para somar. */
export function toReais(cents: number): number {
  return cents / 100;
}

/**
 * Maior texto de valor que a tela mostra por inteiro: "R$ 999.999.999.999,99" (21 caracteres, quase R$ 1 trilhão).
 * Acima disso o texto é cortado com "…", para um valor absurdo não empurrar o layout de nenhuma tela.
 */
export const MAX_MONEY_CHARS = 21;

/**
 * Textos cortados -> valor original. O tooltip lê o texto da tela, e um valor cortado com "…" perderia a grandeza;
 * este registro devolve o número inteiro. Fica limitado para não crescer sem fim.
 */
const truncated = new Map<string, number>();
const MAX_TRUNCATED = 500;

/** O valor (centavos) de um texto que `formatBRL` cortou com "…", se ele ainda estiver no registro. */
export function truncatedMoneyCents(text: string): number | undefined {
  return truncated.get(text);
}

/** Corta um texto de valor grande demais, terminando em "…". Com `cents`, guarda o valor original no registro. */
export function ellipsizeMoney(text: string, cents?: number): string {
  if (text.length <= MAX_MONEY_CHARS) return text;
  const cut = `${text.slice(0, MAX_MONEY_CHARS - 1)}…`;
  if (cents !== undefined) {
    if (truncated.size >= MAX_TRUNCATED) truncated.clear();
    truncated.set(cut, cents);
  }
  return cut;
}

/**
 * 123456 -> "R$ 1.234,56" (valores gigantes saem cortados com "…", veja `MAX_MONEY_CHARS`).
 * Sem mascarar: é o que vai para relatórios exportados (PDF, TXT, CSV).
 */
export function formatBRLExact(cents: number): string {
  return ellipsizeMoney(brl.format((cents ?? 0) / 100), cents ?? 0);
}

/** Como `formatBRLExact`, mas "R$ ••••" com o modo privacidade ligado. É o que as telas usam. */
export function formatBRL(cents: number): string {
  return isPrivate() ? MASK : formatBRLExact(cents);
}

/** 123456 -> "R$ 1.235" (para rótulos compactos; valores gigantes saem cortados com "…") */
export function formatBRLShort(cents: number): string {
  return isPrivate() ? MASK : ellipsizeMoney(brlNoDecimals.format((cents ?? 0) / 100), cents ?? 0);
}

/** 123456 -> "1234,56" (valor para preencher um input, sem símbolo nem milhar) */
export function centsToInput(cents: number): string {
  const value = (cents ?? 0) / 100;
  return value.toFixed(2).replace(".", ",");
}

/**
 * Texto digitado -> centavos. Devolve null se não for um valor válido.
 * Aceita "1.234,56", "1234,56", "1234.56", "12,5", "R$ 10", "10".
 * Não aceita negativos.
 */
export function parseBRL(input: string | null | undefined): number | null {
  if (input == null) return null;

  let text = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (text === "") return null;

  if (text.includes(",")) {
    // vírgula é o decimal; pontos são separador de milhar
    if (text.split(",").length > 2) return null;
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(".")) {
    // sem vírgula: "1.234.567" é milhar, "12.5" ou "12.50" é decimal
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, "");
    } else if (!/^\d+\.\d{1,2}$/.test(text)) {
      return null;
    }
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  const cents = Math.round(Number(text) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/**
 * Limpa o que o usuário digita num campo de valor: só dígitos e uma vírgula,
 * com no máximo 2 casas decimais. Use no onChange.
 */
export function sanitizeAmountInput(raw: string): string {
  const value = raw.replace(/[^0-9,]/g, "");

  const [integer, ...rest] = value.split(",");
  if (rest.length === 0) return integer;

  return `${integer},${rest.join("").slice(0, 2)}`;
}

/**
 * Divide um total em parcelas inteiras sem perder centavos.
 * Os centavos que sobram vão uma a uma para as primeiras parcelas.
 * 1000 em 3 -> [334, 333, 333]
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count));
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;

  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
