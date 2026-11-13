import { useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_CENTS, PAYMENT_METHODS, baseValueOf, canPrepayLast, debtProgress, isScheduled, lastInstallmentMonth, todayISO, validatePaymentTiming, type Debt, type PaymentMethod } from "@/domain";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { formatMonthTitle } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

/**
 * Pagar a próxima parcela de uma dívida ou consórcio: confirma o valor (pode mudar: reajuste ou desconto), a forma e o dia.
 * No consórcio linear, dá para pagar junto a ÚLTIMA parcela (com o desconto negociado), também com valor editável.
 * Serve para a aba Dívidas e para "Marcar como paga" em Lançamentos: as duas são a mesma coisa.
 */
export default function DebtPayDialog({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  return (
    <Dialog open={!!debt} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Registrar parcela paga</DialogTitle>
          <DialogDescription>{debt ? `${debt.name} · parcela de ${formatMonthTitle(debt.nextMonth)}. A próxima passa para o mês seguinte.` : ""}</DialogDescription>
        </DialogHeader>
        {debt && <Fields key={`${debt.id}-${debt.nextMonth}`} debt={debt} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Fields({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const pay = useFinanceStore((s) => s.payDebtInstallment);
  const { nextValue } = debtProgress(debt);
  const prepayable = canPrepayLast(debt);
  const lastMonth = lastInstallmentMonth(debt);
  const [value, setValue] = useState(centsToInput(nextValue));
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [date, setDate] = useState(todayISO());
  const [withLast, setWithLast] = useState(false);
  const [lastValue, setLastValue] = useState(centsToInput(baseValueOf(debt, debt.totalInstallments)));
  const [error, setError] = useState("");

  const timing = validatePaymentTiming(method, date);
  const cents = parseBRL(value);
  const lastCents = parseBRL(lastValue);
  const total = (cents ?? 0) + (withLast ? (lastCents ?? 0) : 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (timing) return setError(timing);
    if (cents === null || cents > MAX_CENTS) return setError("Informe o valor pago da parcela (0 se foi abonada).");
    if (withLast && (lastCents === null || lastCents > MAX_CENTS)) return setError("Informe o valor pago da última parcela.");
    pay(debt.id, cents, { method, date }, withLast ? lastCents! : undefined);
    showToast({
      type: "success",
      text: isScheduled({ method, date })
        ? `Pagamento agendado: ${formatBRL(total)}`
        : withLast ? `Parcela de ${formatMonthTitle(debt.nextMonth)} e última parcela pagas: ${formatBRL(total)}` : `Parcela de ${formatMonthTitle(debt.nextMonth)} registrada: ${formatBRL(cents)}`,
    });
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Valor pago nesta parcela" htmlFor="pay-value">
        <MoneyInput id="pay-value" value={value} onChange={(v) => { setValue(v); setError(""); }} />
      </Field>
      <p className="-mt-2 text-xs text-muted-foreground">Confirme o valor: pode ter reajuste ou desconto por pagar antes. Ele fica registrado nesta parcela e entra no total já pago.</p>

      {prepayable && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={withLast} onChange={(e) => setWithLast(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
            <span>
              <span className="block text-sm font-medium text-foreground">Pagar também a última parcela ({formatMonthTitle(lastMonth)})</span>
              <span className="block text-xs text-muted-foreground">Antecipa a parcela final junto com esta, com o valor negociado. Ela fica como paga e o consórcio termina um mês antes.</span>
            </span>
          </label>
          {withLast && (
            <Field label="Valor pago na última parcela" htmlFor="pay-last-value">
              <MoneyInput id="pay-last-value" value={lastValue} onChange={(v) => { setLastValue(v); setError(""); }} />
            </Field>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Forma de pagamento" htmlFor="pay-method">
          <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Data do pagamento" htmlFor="pay-date">
          <input id="pay-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} block min-h-11 min-w-0 max-w-full appearance-none`} />
        </Field>
      </div>

      {withLast && <p className="rounded-md bg-secondary px-3 py-2 text-[12.5px] text-ink2">Total desta operação: <b className="num text-foreground">{formatBRL(total)}</b>. Entra em Lançamentos no mês do pagamento, em duas linhas.</p>}
      {(error || timing) && <p role="alert" className="text-[13px] font-semibold text-destructive">{error || timing}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={!!timing}>{isScheduled({ method, date }) ? "Agendar pagamento" : "Registrar parcela"}</Button>
      </div>
    </form>
  );
}
