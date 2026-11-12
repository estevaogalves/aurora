import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Pill } from "@/components/shared/Panel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import RowMenu from "@/components/shared/RowMenu";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import {
  cardPaymentOf,
  dayMonth,
  formatPaymentDay,
  getCardInvoice,
  isScheduled,
  paymentMethodLabel,
  paymentStatusLabel,
  type CardInvoice,
  type InvoicePurchase,
  type Payment,
} from "@/domain";
import { formatBRL } from "@/lib/money";
import { useFinanceStore, type ExtraExpense, type Transaction } from "@/Store/FinanceStore";
import { formatMonthTitle } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";
import EditExtraDialog from "../Projection/EditExtraDialog";
import AdjustmentDialog, { type AdjustmentTarget } from "./AdjustmentDialog";
import { EditTransactionDialog } from "./EditDialogs";
import PaymentDialog, { type PaymentTarget } from "./PaymentDialog";

/** "Paga · Pix · 08/12" (verde) ou "Agendada · Boleto · 15/12" (laranja). */
function PaidBadge({ payment }: { payment: Payment }) {
  return <Pill tone={isScheduled(payment) ? "scheduled" : "good"}>{paymentStatusLabel(payment)} · {paymentMethodLabel(payment.method)} · {formatPaymentDay(payment.date)}</Pill>;
}

function InvoiceMenu({ label, paid, adjusted, onPay, onClearPay, onAdjust }: { label: string; paid: boolean; adjusted: boolean; onPay: () => void; onClearPay: () => void; onAdjust: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Ações de ${label}`}
          className="grid h-10 w-10 flex-none place-items-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground data-[state=open]:bg-card data-[state=open]:text-foreground sm:h-8 sm:w-8"
        >
          <Icon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onPay}>
          <Icon name="check" size={15} />
          {paid ? "Editar pagamento" : "Marcar como paga"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAdjust}>
          <Icon name="edit" size={15} />
          {adjusted ? "Editar ajustes / descontos" : "Ajustes / descontos"}
        </DropdownMenuItem>
        {paid && (
          <DropdownMenuItem onSelect={onClearPay}>
            <Icon name="close" size={15} />
            Desmarcar pagamento
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-semibold">{value}</span>
    </div>
  );
}

/** Uma fatura: o valor completo do cartão no mês (parcelas, recorrências e compras avulsas) e onde marcar como paga. */
function InvoiceBlock({ invoice, first, onPay, onClearPay, onAdjust, onEditPurchase, onDeletePurchase }: { invoice: CardInvoice; first: boolean; onPay: () => void; onClearPay: () => void; onAdjust: () => void; onEditPurchase: (p: InvoicePurchase) => void; onDeletePurchase: (p: InvoicePurchase) => void }) {
  const [open, setOpen] = useState(false);
  const { card, month } = invoice;
  const payment = cardPaymentOf(card, month);
  const hasBreakdown = invoice.installments.length + invoice.recurring.length + invoice.purchases.length > 0 || invoice.adjustments.length > 0;

  return (
    <div data-tour={first ? "fatura" : undefined} className="rounded-md border border-border bg-secondary p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words font-semibold">Fatura {card.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span>Fecha {dayMonth(invoice.closingDate)}</span>
            <span>Vence {dayMonth(invoice.dueDate)}</span>
            {payment && <PaidBadge payment={payment} />}
          </div>
        </div>
        <div className="flex flex-none items-center gap-1">
          <span className="num text-right font-bold">{formatBRL(invoice.payable)}</span>
          <InvoiceMenu label={`fatura ${card.name}`} paid={!!payment} adjusted={invoice.adjustments.length > 0} onPay={onPay} onClearPay={onClearPay} onAdjust={onAdjust} />
        </div>
      </div>

      {hasBreakdown && (
        <div className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2.5 text-[12.5px]">
          {invoice.installments.length > 0 && <Line label={`Parcelas (${invoice.installments.length})`} value={formatBRL(invoice.installmentsTotal)} />}
          {invoice.recurring.length > 0 && <Line label={`Recorrentes (${invoice.recurring.length})`} value={formatBRL(invoice.recurringTotal)} />}
          {invoice.purchases.length > 0 && <Line label={`Compras avulsas (${invoice.purchases.length})`} value={formatBRL(invoice.purchasesTotal)} />}
          {invoice.adjustments.map((a) => (
            <Line key={a.id} label={`${a.amount < 0 ? "Desconto" : "Acréscimo"}${a.note ? ` · ${a.note}` : ""}`} value={`${a.amount < 0 ? "−" : "+"}${formatBRL(Math.abs(a.amount))}`} />
          ))}
        </div>
      )}

      {invoice.limit !== null && (
        <div className="mt-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
            <span className="text-muted-foreground">Teto {formatBRL(invoice.limit)}</span>
            {invoice.overLimit ? <Pill tone="bad">Passou do teto em {formatBRL(invoice.total - invoice.limit)}</Pill> : <span className="num font-semibold">{Math.round(invoice.limitUsed ?? 0)}% usado</span>}
          </div>
          <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-card" role="progressbar" aria-label="Uso do teto do cartão" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(invoice.limitUsed ?? 0))}>
            <i className={`block h-full rounded-full ${invoice.overLimit ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, invoice.limitUsed ?? 0)}%` }} />
          </div>
        </div>
      )}

      {invoice.purchases.length > 0 && (
        <div className="mt-2.5">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-[12.5px] font-bold text-primary hover:underline">
            {open ? "Esconder compras avulsas" : `Ver compras avulsas (${invoice.purchases.length})`}
          </button>
          {open && (
            <ul className="mt-1.5 flex flex-col">
              {invoice.purchases.map((p) => (
                <li key={`${p.source}-${p.id}`} className="flex items-baseline justify-between gap-3 border-t border-border py-1.5 text-[12.5px] first:border-t-0">
                  <span className="min-w-0 break-words">
                    <span className="num text-muted-foreground">{dayMonth(p.purchaseDate)}</span> · {p.name}
                    {p.source === "extra" && <span className="text-muted-foreground"> (despesa extra)</span>}
                  </span>
                  <span className="flex flex-none items-center gap-1">
                    <span className="num font-semibold">{formatBRL(p.amount)}</span>
                    <RowMenu label={p.name} onEdit={() => onEditPurchase(p)} onDelete={() => onDeletePurchase(p)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Faturas dos cartões com movimento no mês visto, dentro de Compras parceladas. Cada fatura junta o que cai no
 * cartão naquele mês (parcelas, recorrências e compras avulsas) num único valor, e é nela que se marca o pagamento.
 * É só uma visão agrupada: nenhum valor aqui é somado de novo nos totais do mês.
 */
export default function InvoicesSection() {
  const month = useFinanceStore((s) => s.currentMonth);
  const cards = useFinanceStore((s) => s.creditCards);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditTransactions = useFinanceStore((s) => s.creditTransactions);
  const extraExpenses = useFinanceStore((s) => s.extraExpenses);
  const setCardPayment = useFinanceStore((s) => s.setCardPayment);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);
  const removeExtra = useFinanceStore((s) => s.removeExtraExpense);
  const setCardAdjustments = useFinanceStore((s) => s.setCardAdjustments);
  const [adjusting, setAdjusting] = useState<(AdjustmentTarget & { cardId: string }) | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingExtra, setEditingExtra] = useState<ExtraExpense | null>(null);
  const [toDelete, setToDelete] = useState<InvoicePurchase | null>(null);
  const [paying, setPaying] = useState<(PaymentTarget & { cardId: string }) | null>(null);

  const invoices = useMemo(
    () =>
      cards
        .map((k) => getCardInvoice({ transactions, creditTransactions, extraExpenses, creditCards: cards }, k, month))
        .filter((i) => i.total > 0 || i.adjustments.length > 0 || !!cardPaymentOf(i.card, month)),
    [cards, transactions, creditTransactions, extraExpenses, month],
  );

  if (invoices.length === 0) return null;

  const pay = (i: CardInvoice) => setPaying({ cardId: i.card.id, name: `Fatura ${i.card.name}`, amount: i.payable, current: cardPaymentOf(i.card, month) });
  const adjust = (i: CardInvoice) => setAdjusting({ cardId: i.card.id, name: `Fatura ${i.card.name}`, total: i.total, current: i.adjustments });
  const editPurchase = (p: InvoicePurchase) => {
    if (p.source === "extra") setEditingExtra(extraExpenses.find((e) => e.id === p.id) ?? null);
    else setEditingTx(transactions.find((t) => t.id === p.id) ?? null);
  };
  const confirm = (payment: Payment) => {
    if (!paying) return;
    setCardPayment(paying.cardId, month, payment);
    showToast({ type: "success", text: isScheduled(payment) ? `Pagamento da ${paying.name} agendado` : `${paying.name} marcada como paga` });
    setPaying(null);
  };

  return (
    <div className="mt-3 border-t border-border-strong pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Faturas dos cartões · {formatMonthTitle(month)}</p>
      <div className="flex flex-col gap-3">
        {invoices.map((i, idx) => (
          <InvoiceBlock key={i.card.id} invoice={i} first={idx === 0} onPay={() => pay(i)} onClearPay={() => setCardPayment(i.card.id, month, null)} onAdjust={() => adjust(i)} onEditPurchase={editPurchase} onDeletePurchase={setToDelete} />
        ))}
      </div>
      <PaymentDialog target={paying} onConfirm={confirm} onClose={() => setPaying(null)} />
      <AdjustmentDialog
        target={adjusting}
        onClose={() => setAdjusting(null)}
        onSave={(list) => {
          if (!adjusting) return;
          setCardAdjustments(adjusting.cardId, month, list);
          showToast({ type: "success", text: list.length === 0 ? "Ajustes removidos" : `Ajustes salvos na ${adjusting.name}` });
          setAdjusting(null);
        }}
      />
      <EditTransactionDialog transaction={editingTx} onClose={() => setEditingTx(null)} />
      <EditExtraDialog extra={editingExtra} onClose={() => setEditingExtra(null)} />
      <ConfirmDeletion
        open={!!toDelete}
        itemLabel="compra no cartão"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) (toDelete.source === "extra" ? removeExtra : removeTransaction)(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
