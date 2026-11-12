import { changeMonth, compareMonths } from "../Utils/Date";
import { paymentOf } from "./payment";
import type { Debt, Month, Transaction } from "./types";

/**
 * Dívidas e consórcios em parcelas fixas. É só um acompanhamento: não cria nem muda despesas. Para não somar a parcela
 * duas vezes, a dívida pode ser vinculada à despesa fixa que já a traz no orçamento.
 */

export interface DebtProgress {
  /** parcelas que faltam */
  remaining: number;
  /** centavos já pagos */
  paidTotal: number;
  /** centavos que faltam pagar (parcelas restantes × valor da parcela; estimativa, sem juros nem correção) */
  balance: number;
  /** mês da última parcela, ou null se já foi quitada */
  payoffMonth: Month | null;
  done: boolean;
  /** 0 a 100 */
  percent: number;
}

export function debtProgress(d: Debt): DebtProgress {
  const remaining = Math.max(0, d.totalInstallments - d.paidInstallments);
  const done = remaining === 0;
  return {
    remaining,
    paidTotal: d.paidInstallments * d.installmentValue,
    balance: remaining * d.installmentValue,
    payoffMonth: done ? null : changeMonth(d.nextMonth, remaining - 1),
    done,
    percent: d.totalInstallments > 0 ? Math.round((d.paidInstallments / d.totalInstallments) * 100) : 0,
  };
}

/** Quitação antecipada: quanto pagar hoje com o desconto que o usuário informou (nunca abaixo de zero) e quanto economiza. */
export function earlyPayoff(d: Debt, discount: number): { toPay: number; saved: number } {
  const { balance } = debtProgress(d);
  const applied = Math.min(Math.max(0, discount), balance);
  return { toPay: balance - applied, saved: applied };
}

/** Em andamento (da que quita antes para a que quita depois) e quitadas (as mais recentes primeiro, por nome). */
export function splitDebts(debts: Debt[]): { active: Debt[]; paidOff: Debt[] } {
  const active = debts.filter((d) => !debtProgress(d).done).sort((a, b) => compareMonths(debtProgress(a).payoffMonth!, debtProgress(b).payoffMonth!) || a.name.localeCompare(b.name));
  const paidOff = debts.filter((d) => debtProgress(d).done).sort((a, b) => a.name.localeCompare(b.name));
  return { active, paidOff };
}

/** Totais do que está em andamento: parcela mensal somada, saldo restante e a quitação mais distante. */
export function getDebtTotals(debts: Debt[]) {
  const { active } = splitDebts(debts);
  const last = active.length > 0 ? debtProgress(active[active.length - 1]).payoffMonth : null;
  return {
    count: active.length,
    monthly: active.reduce((s, d) => s + d.installmentValue, 0),
    balance: active.reduce((s, d) => s + debtProgress(d).balance, 0),
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
export function getDebtRelief(debts: Debt[]): DebtRelief[] {
  return splitDebts(debts).active
    .filter((d) => d.linkedTransactionId)
    .map((debt) => ({ debt, from: changeMonth(debtProgress(debt).payoffMonth!, 1), amount: debt.installmentValue }));
}

/**
 * A despesa fixa vinculada já tem o pagamento do mês da próxima parcela registrado? Então dá para sugerir marcar a
 * parcela como paga (o usuário confirma com um clique). null se não há vínculo, se a despesa sumiu ou se não foi paga.
 */
export function detectedPayment(d: Debt, transactions: Transaction[]): { month: Month; date: string } | null {
  if (!d.linkedTransactionId || debtProgress(d).done) return null;
  const t = transactions.find((x) => x.id === d.linkedTransactionId);
  const payment = t ? paymentOf(t, d.nextMonth) : undefined;
  return payment ? { month: d.nextMonth, date: payment.date } : null;
}
