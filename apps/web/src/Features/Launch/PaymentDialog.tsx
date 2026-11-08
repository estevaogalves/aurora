import { useState } from "react";
import { Field, FREE_TEXT_WARNING, inputClass } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isScheduled, isWeekend, PAYMENT_METHODS, todayISO, validatePaymentTiming, type Payment, type PaymentMethod } from "@/domain";
import { formatBRL } from "@/lib/money";

/** O que está sendo pago: o nome, o valor do mês e, se já houver, o pagamento atual (edição). */
export interface PaymentTarget {
  name: string;
  amount: number;
  current?: Payment;
}

/**
 * Confirmação de pagamento: forma, data e observação opcional. É só um registro para consulta e
 * relatórios; nada aqui muda saldo, Painel, Projeção ou Comparação.
 */
export default function PaymentDialog({ target, onConfirm, onClose }: { target: PaymentTarget | null; onConfirm: (payment: Payment) => void; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{target?.current ? "Editar pagamento" : "Marcar como paga"}</DialogTitle>
          <DialogDescription>{target ? `${target.name} · ${formatBRL(target.amount)}. É só um registro: o valor e os totais não mudam.` : ""}</DialogDescription>
        </DialogHeader>
        {/* a chave reinicia os campos a cada abertura */}
        {target && <PaymentFields key={`${target.name}-${target.current?.date ?? "new"}`} target={target} onConfirm={onConfirm} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentFields({ target, onConfirm, onClose }: { target: PaymentTarget; onConfirm: (payment: Payment) => void; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>(target.current?.method ?? "pix");
  const [date, setDate] = useState(target.current?.date ?? todayISO());
  const [notes, setNotes] = useState(target.current?.notes ?? "");

  // data futura só vale para boleto (agendado); a partir de hoje o pagamento já conta como feito
  const error = validatePaymentTiming(method, date);
  const scheduled = isScheduled({ method, date });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || error) return;
    const trimmed = notes.trim();
    onConfirm({ method, date, ...(trimmed && { notes: trimmed }) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-2 gap-2 rounded-md border border-border bg-secondary p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Forma de pagamento</legend>
        {PAYMENT_METHODS.map((m) => (
          <label key={m.value} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="radio" name="payment-method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            {m.label}
          </label>
        ))}
      </fieldset>
      <Field label="Data do pagamento" htmlFor="payment-date">
        <input id="payment-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      {error && <p role="alert" className="rounded-md bg-secondary px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
      {scheduled && (
        <p role="status" className="rounded-md border border-[hsl(var(--k6)/0.6)] bg-[hsl(var(--k6)/0.12)] px-3 py-2 text-[13px] text-foreground">
          <b>Pagamento agendado.</b> A data é futura: a linha fica em laranja como “Agendada” e vira “Paga” quando a data chegar.
          {isWeekend(date) && " Atenção: esta data cai em um fim de semana, e boletos só são compensados em dias úteis."}
        </p>
      )}
      <Field label="Observação" hint="(opcional)" htmlFor="payment-notes">
        <p className="-mt-1 text-xs text-muted-foreground">{FREE_TEXT_WARNING}</p>
        <Textarea id="payment-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className="min-h-[64px] rounded-md border-border-strong bg-secondary" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={!!error}>{scheduled ? "Agendar pagamento" : target.current ? "Salvar" : "Confirmar pagamento"}</Button>
      </div>
    </form>
  );
}
