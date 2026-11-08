import type { Month, Payment, PaymentMethod, Transaction } from "./types";

/*
 * Pagamento de despesas: só registro para consulta e relatórios (versão em TS de
 * apps/api/internal/domain/payment.go). Nada aqui entra em saldo, resumo, projeção ou comparação.
 */

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "debit", label: "Cartão débito" },
  { value: "credit", label: "Cartão crédito" },
  { value: "boleto", label: "Boleto" },
];

export const paymentMethodLabel = (method: PaymentMethod) => PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;

/** "2026-11-08" -> "08/11/2026" */
export function formatPaymentDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** "08/11" (sem o ano), para o selo da linha. */
export const formatPaymentDay = (iso: string) => formatPaymentDate(iso).slice(0, 5);

/** O dia de hoje no fuso do usuário, "YYYY-MM-DD". */
export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Pagamento agendado: boleto com data depois de hoje. Só boleto pode ter data futura (ele é compensado
 * em dia útil); Pix e cartão são na hora. Quando a data chega, vira "paga" sozinho, sem ninguém mexer.
 */
export const isScheduled = (p: Pick<Payment, "method" | "date">, today = todayISO()) => p.method === "boleto" && p.date > today;

/** Recusa data futura fora do boleto. null se válido. */
export function validatePaymentTiming(method: PaymentMethod, date: string, today = todayISO()): string | null {
  if (method !== "boleto" && date > today) return "Só boleto pode ter data futura (pagamento agendado). Pix e cartão são pagos na hora.";
  return null;
}

/** Sábado ou domingo (boleto não é compensado nesses dias). */
export function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

/** "Paga" ou "Agendada". */
export const paymentStatusLabel = (p: Pick<Payment, "method" | "date">, today = todayISO()) => (isScheduled(p, today) ? "Agendada" : "Paga");

/** Texto curto do pagamento: "Pix · 08/11/2026". */
export const describePayment = (p: Payment) => `${paymentMethodLabel(p.method)} · ${formatPaymentDate(p.date)}`;

/** Pagamento de uma despesa em um mês, se houver. */
export const paymentOf = (t: Pick<Transaction, "payments">, month: Month): Payment | undefined => t.payments?.[month];

/** Marca (ou troca) o pagamento de uma despesa em um mês: devolve o patch a aplicar. */
export function patchSetPayment(t: Pick<Transaction, "payments">, month: Month, payment: Payment): Pick<Transaction, "payments"> {
  return { payments: { ...t.payments, [month]: payment } };
}

/** Desmarca o pagamento de um mês e mantém os dos outros meses. */
export function patchClearPayment(t: Pick<Transaction, "payments">, month: Month): Pick<Transaction, "payments"> {
  const rest = Object.fromEntries(Object.entries(t.payments ?? {}).filter(([m]) => m !== month));
  return { payments: Object.keys(rest).length > 0 ? rest : undefined };
}
