import { changeMonth, compareMonths } from "../Utils/Date";
import { paymentOf } from "./payment";
import { getTransactionsByMonth } from "./transactions";
import type { Debt, Month, Transaction } from "./types";

/**
 * Dívidas e consórcios em parcelas fixas. É só um acompanhamento: não cria nem muda despesas. Para não somar a parcela
 * duas vezes, a dívida pode ser vinculada à despesa fixa que já a traz no orçamento. Com o vínculo, o valor de cada
 * parcela acompanha o valor daquele lançamento no mês (um desconto num mês muda a parcela daquele mês).
 */

/**
 * Valor de uma parcela, pelo mês dela: o que foi pago e registrado (`paidValues`); senão o valor da despesa fixa vinculada
 * naquele mês (que já vem com o ajuste do mês); senão o valor cadastrado na dívida.
 */
export function installmentValueFor(d: Debt, month: Month, transactions: Transaction[] = []): number {
  const anticipated = d.anticipations?.[month];
  if (anticipated) return anticipated.paidValue;
  const paid = d.paidValues?.[month];
  if (paid !== undefined) return paid;
  if (d.linkedTransactionId) {
    const linked = getTransactionsByMonth(transactions, month).find((t) => t.id === d.linkedTransactionId);
    if (linked) return linked.amount;
  }
  return d.installmentValue;
}

/** Usa o calendário próprio (há ou houve parcelas antecipadas)? */
export const hasAnticipations = (d: Debt) => !!d.startMonth || Object.keys(d.anticipations ?? {}).length > 0;

/** O calendário de parcelas: um mês por parcela, da primeira à última. */
export function debtCalendar(d: Debt): Month[] {
  const start = d.startMonth ?? changeMonth(d.nextMonth, -d.paidInstallments);
  return Array.from({ length: d.totalInstallments }, (_, i) => changeMonth(start, i));
}

/** Os meses das parcelas pagas em ordem (sem as antecipadas), da mais antiga para a mais recente. */
export function paidMonths(d: Debt): Month[] {
  const n = Math.min(d.paidInstallments, d.totalInstallments);
  if (!hasAnticipations(d)) return Array.from({ length: n }, (_, i) => changeMonth(d.nextMonth, i - n));
  return debtCalendar(d).filter((m) => !d.anticipations?.[m]).slice(0, n);
}

/** Os meses das parcelas antecipadas, em ordem. */
export function anticipatedMonths(d: Debt): Month[] {
  return Object.keys(d.anticipations ?? {}).sort(compareMonths);
}

/** Meses das parcelas ainda em aberto (nem pagas em ordem, nem antecipadas), em ordem. */
export function openMonths(d: Debt): Month[] {
  if (!hasAnticipations(d)) return Array.from({ length: Math.max(0, d.totalInstallments - d.paidInstallments) }, (_, i) => changeMonth(d.nextMonth, i));
  const paid = new Set(paidMonths(d));
  return debtCalendar(d).filter((m) => !paid.has(m) && !d.anticipations?.[m]);
}

/** O mês seguinte a `month` que ainda não foi antecipado (para onde a próxima parcela vai ao pagar `month`). */
export function nextOpenAfter(d: Debt, month: Month): Month {
  let next = changeMonth(month, 1);
  while (d.anticipations?.[next]) next = changeMonth(next, 1);
  return next;
}

export interface DebtProgress {
  /** parcelas que faltam */
  remaining: number;
  /** centavos já pagos (somando o valor real de cada parcela paga) */
  paidTotal: number;
  /** centavos que faltam pagar (cada parcela restante pelo valor do mês dela; estimativa, sem juros nem correção) */
  balance: number;
  /** mês da última parcela, ou null se já foi quitada */
  payoffMonth: Month | null;
  done: boolean;
  /** 0 a 100 */
  percent: number;
  /** valor da próxima parcela (segue a despesa fixa vinculada, se houver) */
  nextValue: number;
}

export function debtProgress(d: Debt, transactions: Transaction[] = []): DebtProgress {
  const open = openMonths(d);
  const remaining = open.length;
  const done = remaining === 0;
  const paidTotal = [...paidMonths(d), ...anticipatedMonths(d)].reduce((s, m) => s + installmentValueFor(d, m, transactions), 0);
  const balance = open.reduce((s, m) => s + installmentValueFor(d, m, transactions), 0);
  const doneCount = d.totalInstallments - remaining;
  return {
    remaining,
    paidTotal,
    balance,
    payoffMonth: done ? null : open[open.length - 1],
    done,
    percent: d.totalInstallments > 0 ? Math.round((doneCount / d.totalInstallments) * 100) : 0,
    nextValue: installmentValueFor(d, d.nextMonth, transactions),
  };
}

export interface PaidInstallment {
  /** número da parcela (1 = a primeira) */
  number: number;
  month: Month;
  /** centavos realmente pagos nela */
  value: number;
  /** o valor foi registrado ou corrigido (difere do valor-base da parcela naquele mês) */
  adjusted: boolean;
  /** parcela antecipada: paga antes da hora, com o valor negociado */
  anticipated?: boolean;
  /** antecipada: o valor que a parcela valia antes da antecipação */
  originalValue?: number;
  /** antecipada: a operação a que pertence e o lançamento avulso do desembolso */
  batchId?: string;
  transactionId?: string;
  /** antecipada: dia do pagamento */
  paidOn?: string;
}

/** As parcelas já pagas, da mais recente para a mais antiga, com o valor de cada uma. */
export function getPaidInstallments(d: Debt, transactions: Transaction[] = []): PaidInstallment[] {
  if (!hasAnticipations(d)) {
    return paidMonths(d)
      .map((month, i) => ({ number: i + 1, month, value: installmentValueFor(d, month, transactions), adjusted: d.paidValues?.[month] !== undefined }))
      .reverse();
  }
  const calendar = debtCalendar(d);
  const numberOf = (m: Month) => calendar.indexOf(m) + 1;
  const regular: PaidInstallment[] = paidMonths(d).map((month) => ({ number: numberOf(month), month, value: installmentValueFor(d, month, transactions), adjusted: d.paidValues?.[month] !== undefined }));
  const anticipated: PaidInstallment[] = anticipatedMonths(d).map((month) => {
    const a = d.anticipations![month];
    return { number: numberOf(month), month, value: a.paidValue, adjusted: false, anticipated: true, originalValue: a.originalValue, batchId: a.batchId, transactionId: a.transactionId, paidOn: a.paidOn };
  });
  return [...regular, ...anticipated].sort((a, b) => compareMonths(b.month, a.month));
}

/** O que dá para antecipar agora: meses em aberto depois da próxima parcela, com o valor original de cada um. */
export function anticipableInstallments(d: Debt, transactions: Transaction[] = []): { month: Month; number: number; value: number }[] {
  const calendar = debtCalendar(d);
  return openMonths(d)
    .filter((m) => m !== d.nextMonth)
    .map((month) => ({ month, number: calendar.indexOf(month) + 1, value: installmentValueFor(d, month, transactions) }));
}

/** Quitação antecipada: quanto pagar hoje com o desconto que o usuário informou (nunca abaixo de zero) e quanto economiza. */
export function earlyPayoff(d: Debt, discount: number, transactions: Transaction[] = []): { toPay: number; saved: number } {
  const { balance } = debtProgress(d, transactions);
  const applied = Math.min(Math.max(0, discount), balance);
  return { toPay: balance - applied, saved: applied };
}

/** Em andamento (da que quita antes para a que quita depois) e quitadas (por nome). */
export function splitDebts(debts: Debt[]): { active: Debt[]; paidOff: Debt[] } {
  const active = debts.filter((d) => !debtProgress(d).done).sort((a, b) => compareMonths(debtProgress(a).payoffMonth!, debtProgress(b).payoffMonth!) || a.name.localeCompare(b.name));
  const paidOff = debts.filter((d) => debtProgress(d).done).sort((a, b) => a.name.localeCompare(b.name));
  return { active, paidOff };
}

/** Totais do que está em andamento: parcela mensal somada, saldo restante e a quitação mais distante. */
export function getDebtTotals(debts: Debt[], transactions: Transaction[] = []) {
  const { active } = splitDebts(debts);
  const last = active.length > 0 ? debtProgress(active[active.length - 1]).payoffMonth : null;
  return {
    count: active.length,
    monthly: active.reduce((s, d) => s + debtProgress(d, transactions).nextValue, 0),
    balance: active.reduce((s, d) => s + debtProgress(d, transactions).balance, 0),
    lastPayoff: last,
  };
}

export interface DebtRelief {
  debt: Debt;
  /** primeiro mês sem a parcela (o mês depois da última) */
  from: Month;
  /** centavos por mês que deixam de sair */
  amount: number;
}

/** Quando a despesa fixa vinculada "cai": a partir do mês seguinte à última parcela, a parcela deixa de pesar. Só com vínculo. */
export function getDebtRelief(debts: Debt[], transactions: Transaction[] = []): DebtRelief[] {
  return splitDebts(debts).active
    .filter((d) => d.linkedTransactionId)
    .map((debt) => {
      const last = debtProgress(debt).payoffMonth!;
      return { debt, from: changeMonth(last, 1), amount: installmentValueFor(debt, last, transactions) };
    });
}

/**
 * A despesa fixa vinculada já tem o pagamento do mês da próxima parcela registrado? Então dá para sugerir marcar a
 * parcela como paga (o usuário confirma, com o valor daquele mês). null se não há vínculo, se a despesa sumiu ou se não foi paga.
 */
export function detectedPayment(d: Debt, transactions: Transaction[]): { month: Month; date: string; value: number } | null {
  if (!d.linkedTransactionId || debtProgress(d).done) return null;
  const t = transactions.find((x) => x.id === d.linkedTransactionId);
  const payment = t ? paymentOf(t, d.nextMonth) : undefined;
  return payment ? { month: d.nextMonth, date: payment.date, value: installmentValueFor(d, d.nextMonth, transactions) } : null;
}
