import { CONSORTIUM_CATEGORY, DEBT_CATEGORY } from "../Types/Category";
import { changeMonth, compareMonths, monthsDifference } from "../Utils/Date";
import type { Debt, DebtKind, Month, Payment, Transaction } from "./types";

/**
 * Dívidas e consórcios em parcelas. São independentes das despesas fixas: as parcelas são calculadas a partir do
 * cadastro e aparecem em Lançamentos sozinhas (`debtTransactions`), sem nada gravado por mês: calcular de novo dá
 * sempre o mesmo resultado, então nunca há lançamento duplicado.
 *
 * Cronograma: a parcela de número n vence em `nextMonth + (n − pagas − 1)`. As pagas são as anteriores a `nextMonth`.
 */

export const MAX_DEBT_INSTALLMENTS = 600;
export const MAX_DEBT_CENTS = 100_000_000_000;

export const debtKind = (d: Debt): DebtKind => d.kind ?? "debt";
export const isConsortium = (d: Debt) => debtKind(d) === "consortium";
export const isProgressive = (d: Debt) => isConsortium(d) && d.model === "progressive";

/** Valor da parcela de número n (1 = a primeira), sem considerar ajustes: linear = fixo; progressivo = inicial + (n − 1) × acréscimo. */
export function baseValueOf(d: Debt, n: number): number {
  return isProgressive(d) ? d.installmentValue + (n - 1) * (d.increment ?? 0) : d.installmentValue;
}

/** Mês da primeira parcela do cronograma. */
const firstMonth = (d: Debt): Month => changeMonth(d.nextMonth, -d.paidInstallments);

/** Número da parcela (1 = a primeira) que vence em `month`. */
export const installmentNumber = (d: Debt, month: Month): number => monthsDifference(month, firstMonth(d)) + 1;

/** Valor de uma parcela, pelo mês dela: o que foi pago e registrado (`paidValues`); senão o valor da parcela pela posição. */
export function installmentValueFor(d: Debt, month: Month): number {
  return d.paidValues?.[month] ?? baseValueOf(d, installmentNumber(d, month));
}

/** Os meses das parcelas já pagas, da mais antiga para a mais recente (a última é o mês anterior à próxima parcela). */
export function paidMonths(d: Debt): Month[] {
  const n = Math.min(d.paidInstallments, d.totalInstallments);
  return Array.from({ length: n }, (_, i) => changeMonth(d.nextMonth, i - n));
}

/** Parcelas ainda em aberto (a última já paga antes da hora não conta). */
const openCount = (d: Debt) => Math.max(0, d.totalInstallments - d.paidInstallments - (d.prepaidLast ? 1 : 0));

/** Mês da última parcela do cronograma. */
export const lastInstallmentMonth = (d: Debt): Month => changeMonth(d.nextMonth, d.totalInstallments - d.paidInstallments - 1);

/** Dá para pagar a última parcela junto? Só consórcio linear, ainda sem a última paga, e com ao menos 2 parcelas em aberto. */
export const canPrepayLast = (d: Debt) => isConsortium(d) && !isProgressive(d) && !d.prepaidLast && openCount(d) >= 2;

export interface DebtProgress {
  /** parcelas que faltam */
  remaining: number;
  /** centavos já pagos (somando o valor real de cada parcela paga) */
  paidTotal: number;
  /** centavos que faltam pagar (cada parcela restante pelo valor da posição dela; sem juros nem correção) */
  balance: number;
  /** mês da última parcela, ou null se já foi quitada */
  payoffMonth: Month | null;
  /** todas as parcelas pagas: quitada */
  done: boolean;
  /** 0 a 100 */
  percent: number;
  /** valor da próxima parcela */
  nextValue: number;
}

export function debtProgress(d: Debt): DebtProgress {
  const remaining = openCount(d);
  const done = remaining === 0;
  const paidTotal = paidMonths(d).reduce((s, m) => s + installmentValueFor(d, m), 0) + (d.prepaidLast?.value ?? 0);
  let balance = 0;
  for (let i = 0; i < remaining; i++) balance += installmentValueFor(d, changeMonth(d.nextMonth, i));
  return {
    remaining,
    paidTotal,
    balance,
    payoffMonth: done ? null : changeMonth(d.nextMonth, remaining - 1),
    done,
    percent: d.totalInstallments > 0 ? Math.round(((d.totalInstallments - remaining) / d.totalInstallments) * 100) : 0,
    nextValue: installmentValueFor(d, d.nextMonth),
  };
}

export interface PaidInstallment {
  /** número da parcela (1 = a primeira) */
  number: number;
  month: Month;
  /** centavos realmente pagos nela */
  value: number;
  /** o valor pago difere do valor da parcela (desconto ou acréscimo) */
  adjusted: boolean;
  /** a última parcela, paga antes da hora */
  prepaid?: boolean;
}

/** As parcelas já pagas, da mais recente para a mais antiga, com o valor de cada uma. */
export function getPaidInstallments(d: Debt): PaidInstallment[] {
  const list: PaidInstallment[] = paidMonths(d)
    .map((month, i) => {
      const value = installmentValueFor(d, month);
      return { number: i + 1, month, value, adjusted: value !== baseValueOf(d, i + 1) };
    })
    .reverse();
  if (d.prepaidLast) list.unshift({ number: d.totalInstallments, month: lastInstallmentMonth(d), value: d.prepaidLast.value, adjusted: d.prepaidLast.value !== baseValueOf(d, d.totalInstallments), prepaid: true });
  return list;
}

/** Quitação antecipada: quanto pagar hoje com o desconto que o usuário informou (nunca abaixo de zero) e quanto economiza. */
export function earlyPayoff(d: Debt, discount: number): { toPay: number; saved: number } {
  const { balance } = debtProgress(d);
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
export function getDebtTotals(debts: Debt[]) {
  const { active } = splitDebts(debts);
  const last = active.length > 0 ? debtProgress(active[active.length - 1]).payoffMonth : null;
  return {
    count: active.length,
    monthly: active.reduce((s, d) => s + debtProgress(d).nextValue, 0),
    balance: active.reduce((s, d) => s + debtProgress(d).balance, 0),
    lastPayoff: last,
  };
}

export interface DebtRelief {
  debt: Debt;
  /** primeiro mês sem a parcela (o mês depois da última) */
  from: Month;
  /** centavos por mês que deixam de sair (o valor da última parcela) */
  amount: number;
}

/** Quando cada obrigação em andamento termina: a partir do mês seguinte à última parcela, ela deixa de pesar. */
export function getDebtRelief(debts: Debt[]): DebtRelief[] {
  return splitDebts(debts).active.map((debt) => {
    const last = debtProgress(debt).payoffMonth!;
    return { debt, from: changeMonth(last, 1), amount: installmentValueFor(debt, last) };
  });
}

/* ---------- lançamentos gerados ---------- */

const ID_PREFIX = "debt:";

/** O lançamento é gerado por uma dívida (não existe no cadastro de lançamentos)? */
export const isDebtTransactionId = (id: string) => id.startsWith(ID_PREFIX);
/** O id da dívida que gerou o lançamento. */
export const debtIdOf = (transactionId: string) => transactionId.slice(ID_PREFIX.length);

/**
 * Uma despesa gerada por dívida: os meses do primeiro registrado até a última parcela (ou até a última paga, se quitada),
 * cada um com o valor da parcela. Dívida quitada não gera nada depois da última parcela paga. null se não há nada a mostrar.
 * Os meses em que a parcela foi paga trazem o pagamento (o do app; sem registro, o dia 1 do mês).
 */
export function debtTransaction(d: Debt): Transaction | null {
  const start = d.trackedFrom ?? d.nextMonth;
  const end = debtProgress(d).payoffMonth ?? changeMonth(d.nextMonth, -1);
  if (compareMonths(start, end) > 0) return null;
  const monthlyValues: Record<Month, number> = {};
  const payments: Record<Month, Payment> = {};
  for (let m = start; compareMonths(m, end) <= 0; m = changeMonth(m, 1)) {
    monthlyValues[m] = installmentValueFor(d, m);
    if (compareMonths(m, d.nextMonth) < 0) payments[m] = d.payments?.[m] ?? { method: "pix", date: `${m}-01` };
  }
  return {
    id: ID_PREFIX + d.id,
    name: d.name,
    amount: monthlyValues[start],
    type: "expense",
    category: isConsortium(d) ? CONSORTIUM_CATEGORY : DEBT_CATEGORY,
    fixed: true,
    month: start,
    endMonth: end,
    monthlyValues,
    payments,
    debtOrigin: debtKind(d),
    debtId: d.id,
  };
}

/**
 * A última parcela paga antes da hora vira uma despesa comum, já paga, no dia do pagamento (regime de caixa: o desembolso é
 * do mês em que saiu; o último mês do cronograma deixa de ter parcela). null se não houve.
 */
export function prepaidLastTransaction(d: Debt): Transaction | null {
  if (!d.prepaidLast) return null;
  const month = d.prepaidLast.payment.date.slice(0, 7);
  return {
    id: `${ID_PREFIX}${d.id}:last`,
    name: `${d.name} (última parcela)`,
    amount: d.prepaidLast.value,
    type: "expense",
    category: isConsortium(d) ? CONSORTIUM_CATEGORY : DEBT_CATEGORY,
    fixed: false,
    month,
    payments: { [month]: d.prepaidLast.payment },
    debtOrigin: debtKind(d),
    debtId: d.id,
  };
}

/** As despesas geradas por todas as dívidas e consórcios. */
export function debtTransactions(debts: Debt[]): Transaction[] {
  return debts.flatMap((d) => [debtTransaction(d), prepaidLastTransaction(d)].filter((t): t is Transaction => t !== null));
}

/** Os lançamentos do cadastro mais os gerados pelas dívidas, para tudo que soma, projeta ou lista. */
export function withDebtTransactions(transactions: Transaction[], debts: Debt[]): Transaction[] {
  return debts.length === 0 ? transactions : [...transactions, ...debtTransactions(debts)];
}

/* ---------- validação ---------- */

export interface DebtFields {
  name: string;
  kind: DebtKind;
  model?: "linear" | "progressive";
  installmentValue: number | null;
  increment?: number | null;
  total: number;
  paid: number;
  nextMonth: string;
}

/** Confere o cadastro de dívida ou consórcio. Devolve a mensagem do primeiro problema, ou null. */
export function validateDebtFields(f: DebtFields): string | null {
  if (!f.name.trim()) return "Dê um nome à " + (f.kind === "consortium" ? "consórcio." : "dívida.");
  if (f.installmentValue === null || f.installmentValue <= 0) return f.kind === "consortium" && f.model === "progressive" ? "Informe o valor da primeira parcela, maior que zero." : "Informe o valor da parcela, maior que zero.";
  if (f.installmentValue > MAX_DEBT_CENTS) return "O valor da parcela passa de R$ 1 bilhão.";
  if (f.kind === "consortium" && f.model === "progressive") {
    if (f.increment === null || f.increment === undefined || f.increment <= 0) return "Informe o acréscimo mensal, maior que zero.";
    if (f.installmentValue + (f.total - 1) * f.increment > MAX_DEBT_CENTS) return "Com este acréscimo, a última parcela passa de R$ 1 bilhão.";
  }
  if (!Number.isInteger(f.total) || f.total < 1 || f.total > MAX_DEBT_INSTALLMENTS) return `O total de parcelas vai de 1 a ${MAX_DEBT_INSTALLMENTS}.`;
  if (!Number.isInteger(f.paid) || f.paid < 0 || f.paid > f.total) return "As parcelas pagas vão de 0 até o total.";
  if (!f.nextMonth) return "Informe o mês da próxima parcela.";
  return null;
}
