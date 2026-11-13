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
  const paid = d.paidValues?.[month];
  if (paid !== undefined) return paid;
  if (d.linkedTransactionId) {
    const linked = getTransactionsByMonth(transactions, month).find((t) => t.id === d.linkedTransactionId);
    if (linked) return linked.amount;
  }
  return d.installmentValue;
}

/** Os meses das parcelas já pagas, da mais antiga para a mais recente (a última é o mês anterior à próxima parcela). */
export function paidMonths(d: Debt): Month[] {
  const n = Math.min(d.paidInstallments, d.totalInstallments);
  return Array.from({ length: n }, (_, i) => changeMonth(d.nextMonth, i - n));
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
  const remaining = Math.max(0, d.totalInstallments - d.paidInstallments);
  const done = remaining === 0;
  const paidTotal = paidMonths(d).reduce((s, m) => s + installmentValueFor(d, m, transactions), 0);
  let balance = 0;
  for (let i = 0; i < remaining; i++) balance += installmentValueFor(d, changeMonth(d.nextMonth, i), transactions);
  return {
    remaining,
    paidTotal,
    balance,
    payoffMonth: done ? null : changeMonth(d.nextMonth, remaining - 1),
    done,
    percent: d.totalInstallments > 0 ? Math.round((d.paidInstallments / d.totalInstallments) * 100) : 0,
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
}

/** As parcelas já pagas, da mais recente para a mais antiga, com o valor de cada uma. */
export function getPaidInstallments(d: Debt, transactions: Transaction[] = []): PaidInstallment[] {
  const months = paidMonths(d);
  return months
    .map((month, i) => ({ number: i + 1, month, value: installmentValueFor(d, month, transactions), adjusted: d.paidValues?.[month] !== undefined }))
    .reverse();
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
