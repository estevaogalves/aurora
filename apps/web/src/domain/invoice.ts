import { changeMonth, monthsDifference } from "../Utils/Date";
import { chargeDate } from "./credit";
import type { CreditCard, CreditTransaction, Month } from "./types";

/** Fatura em que uma cobrança cai. Datas "AAAA-MM-DD". */
export interface Invoice {
  /** dia em que a fatura fecha */
  closingDate: string;
  /** dia em que a fatura vence */
  dueDate: string;
  /** mês em que o valor é contabilizado: o do vencimento (quando o dinheiro sai) */
  month: Month;
}

const isDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;

/** Cartão com dias de fechamento e vencimento válidos (1 a 31) e nome. */
export const isValidCard = (card: Pick<CreditCard, "name" | "closingDay" | "dueDay">) =>
  card.name.trim().length > 0 && isDay(card.closingDay) && isDay(card.dueDay);

/**
 * Fatura de uma compra feita em `purchaseDate` ("AAAA-MM-DD"). Regra única do app:
 * - dia da compra maior que o fechamento: fecha no mês seguinte; senão, no mês da compra;
 * - vence no próximo dia de vencimento depois do fechamento (vencimento <= fechamento: mês seguinte);
 * - meses curtos usam o último dia do mês.
 * `installment` (1 = primeira) empurra a fatura um mês por parcela.
 */
export function getInvoice(card: Pick<CreditCard, "closingDay" | "dueDay">, purchaseDate: string, installment = 1): Invoice {
  const purchaseMonth = purchaseDate.slice(0, 7);
  const day = Number(purchaseDate.slice(8, 10));
  const closesThisMonth = day <= Number(chargeDate(card.closingDay, purchaseMonth).slice(8, 10));
  const closingMonth = changeMonth(purchaseMonth, (closesThisMonth ? 0 : 1) + installment - 1);
  const dueMonth = card.dueDay <= card.closingDay ? changeMonth(closingMonth, 1) : closingMonth;
  return {
    closingDate: chargeDate(card.closingDay, closingMonth),
    dueDate: chargeDate(card.dueDay, dueMonth),
    month: dueMonth,
  };
}

/** "DD/MM" de uma data "AAAA-MM-DD". */
export const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/**
 * Compras com cartão cadastrado passam a valer no mês do vencimento da fatura: `startMonth` (e `endMonth`)
 * são deslocados. Sem cartão, ou sem dia de cobrança, ficam como estão. Os dados salvos não mudam.
 */
export function resolveCredits(credits: CreditTransaction[], cards: CreditCard[] | undefined): CreditTransaction[] {
  if (!cards?.length) return credits;
  return credits.map((c) => {
    const card = c.cardId ? cards.find((k) => k.id === c.cardId) : undefined;
    if (!card || !c.billingDay) return c;
    const first = getInvoice(card, chargeDate(c.billingDay, c.startMonth)).month;
    if (first === c.startMonth) return c;
    const shift = (m: Month) => changeMonth(m, monthsDifference(first, c.startMonth));
    return { ...c, startMonth: first, ...(c.endMonth && { endMonth: shift(c.endMonth) }) };
  });
}

