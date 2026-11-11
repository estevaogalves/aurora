import { changeMonth, monthsDifference } from "../Utils/Date";
import { chargeDate, getCreditByMonth } from "./credit";
import type { CreditCard, CreditInstallment, CreditTransaction, FinanceData, Month, Payment } from "./types";

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

/* ---------- despesas avulsas no cartão ---------- */

/** Despesa avulsa (comum ou extra) com cartão e dia da compra: só essas valem no mês da fatura. */
type CardExpense = { month: Month; cardId?: string; purchaseDate?: string; fixed?: boolean; type?: "income" | "expense" };

const isCardPurchase = (x: CardExpense) => !x.fixed && x.type !== "income" && !!x.cardId && !!x.purchaseDate;

/**
 * Despesas avulsas com cartão passam a valer no mês do vencimento da fatura, a partir do dia da compra, igual
 * às parcelas do crédito (`resolveCredits`). `month` é deslocado; `purchaseDate` e o resto ficam como estão.
 * Sem cartão (ou com um cartão que não existe mais), fixas e rendas ficam como estão. Os dados salvos não mudam.
 */
export function resolveCardExpenses<T extends CardExpense>(items: T[], cards: CreditCard[] | undefined): T[] {
  if (!cards?.length) return items;
  return items.map((x) => {
    if (!isCardPurchase(x)) return x;
    const card = cards.find((k) => k.id === x.cardId);
    if (!card) return x;
    const month = getInvoice(card, x.purchaseDate as string).month;
    return month === x.month ? x : { ...x, month };
  });
}

/* ---------- fatura de um cartão em um mês ---------- */

/** Datas da fatura que vence em `month` (o mês em que o valor é contabilizado). */
export function invoiceDates(card: Pick<CreditCard, "closingDay" | "dueDay">, month: Month): { closingDate: string; dueDate: string } {
  // vencimento <= fechamento: a fatura fecha no mês anterior ao vencimento
  const closingMonth = card.dueDay <= card.closingDay ? changeMonth(month, -1) : month;
  return { closingDate: chargeDate(card.closingDay, closingMonth), dueDate: chargeDate(card.dueDay, month) };
}

/** Uma compra avulsa dentro da fatura. */
export interface InvoicePurchase {
  id: string;
  name: string;
  /** centavos */
  amount: number;
  /** dia da compra, "YYYY-MM-DD" */
  purchaseDate: string;
  /** "expense" = despesa comum; "extra" = despesa extra */
  source: "expense" | "extra";
}

/** Fatura de um cartão no mês em que vence: o que entra nela, o total, o teto e as datas. */
export interface CardInvoice {
  card: CreditCard;
  /** mês do vencimento */
  month: Month;
  closingDate: string;
  dueDate: string;
  installments: CreditInstallment[];
  recurring: CreditInstallment[];
  purchases: InvoicePurchase[];
  installmentsTotal: number;
  recurringTotal: number;
  purchasesTotal: number;
  /** soma das três partes (centavos) */
  total: number;
  /** teto do cartão, ou null se não tem */
  limit: number | null;
  /** quanto do teto a fatura usa, em %, ou null se não há teto (passa de 100 quando estoura) */
  limitUsed: number | null;
  overLimit: boolean;
}

type InvoiceSource = Pick<FinanceData, "transactions" | "creditTransactions"> & Partial<Pick<FinanceData, "extraExpenses" | "creditCards">>;

/**
 * Fatura de um cartão no mês `month` (o do vencimento): parcelas, recorrências e compras avulsas ligadas a ele.
 * É só uma visão agrupada dos lançamentos que já existem: nunca é somada por cima dos totais do mês, porque cada
 * lançamento já conta uma vez, na própria categoria (`getMonthSummary`).
 */
export function getCardInvoice(data: InvoiceSource, card: CreditCard, month: Month): CardInvoice {
  const cards = data.creditCards?.some((k) => k.id === card.id) ? data.creditCards : [...(data.creditCards ?? []), card];
  const ofCard = new Set(data.creditTransactions.filter((c) => c.cardId === card.id).map((c) => c.id));
  const charges = getCreditByMonth(resolveCredits(data.creditTransactions, cards), month).filter((c) => ofCard.has(c.id));
  const installments = charges.filter((c) => !c.recurring);
  const recurring = charges.filter((c) => c.recurring);

  const purchases: InvoicePurchase[] = [
    ...resolveCardExpenses(data.transactions, cards)
      .filter((t) => isCardPurchase(t) && t.type === "expense" && t.cardId === card.id && t.month === month)
      .map((t): InvoicePurchase => ({ id: t.id, name: t.name, amount: t.amount, purchaseDate: t.purchaseDate as string, source: "expense" })),
    ...resolveCardExpenses(data.extraExpenses ?? [], cards)
      .filter((e) => isCardPurchase(e) && e.cardId === card.id && e.month === month)
      .map((e): InvoicePurchase => ({ id: e.id, name: e.name, amount: e.amount, purchaseDate: e.purchaseDate as string, source: "extra" })),
  ].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate) || a.name.localeCompare(b.name));

  const sum = (list: { amount?: number; installmentValue?: number }[]) => list.reduce((s, x) => s + (x.amount ?? x.installmentValue ?? 0), 0);
  const installmentsTotal = sum(installments);
  const recurringTotal = sum(recurring);
  const purchasesTotal = sum(purchases);
  const total = installmentsTotal + recurringTotal + purchasesTotal;
  const limit = card.limit && card.limit > 0 ? card.limit : null;

  return {
    card,
    month,
    ...invoiceDates(card, month),
    installments,
    recurring,
    purchases,
    installmentsTotal,
    recurringTotal,
    purchasesTotal,
    total,
    limit,
    limitUsed: limit ? (total / limit) * 100 : null,
    overLimit: limit !== null && total > limit,
  };
}

/**
 * Marca ou desmarca o pagamento da fatura que vence em `month`. Devolve o patch do cartão: só registro, não mexe
 * em nenhum valor. Sem nenhum pagamento restante, `payments` some.
 */
export function patchCardPayment(card: Pick<CreditCard, "payments">, month: Month, payment: Payment | null): Pick<CreditCard, "payments"> {
  const payments = { ...card.payments };
  if (payment) payments[month] = payment;
  else delete payments[month];
  return { payments: Object.keys(payments).length > 0 ? payments : undefined };
}

/** Pagamento da fatura do cartão que vence em `month`, se houver. */
export const cardPaymentOf = (card: Pick<CreditCard, "payments">, month: Month): Payment | undefined => card.payments?.[month];
