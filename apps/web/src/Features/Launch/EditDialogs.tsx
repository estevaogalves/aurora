import { canAutoFocus } from "@/lib/device";
import { useState } from "react";
import CategorySelect from "@/components/shared/CategorySelect";
import { Field, FREE_TEXT_WARNING, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { patchEditAll } from "@/domain";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { useFinanceStore, type CreditTransaction, type Transaction } from "@/Store/FinanceStore";
import { formatMonthTitle } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

function Shell({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Edita nome, valor do mês visto, categoria e observação de uma renda ou despesa. */
export function EditTransactionDialog({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  const income = transaction?.type === "income";
  return (
    <Shell open={!!transaction} title={income ? "Editar renda" : "Editar despesa"} description={transaction?.fixed ? "Esta é uma fixa: ao mudar o valor, você escolhe se vale só para este mês ou também para os próximos." : "O valor vale para o mês que você está vendo."} onClose={onClose}>
      {transaction && <TransactionFields key={transaction.id} transaction={transaction} onClose={onClose} />}
    </Shell>
  );
}

function TransactionFields({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const month = useFinanceStore((s) => s.currentMonth);
  const { updateTransactionName, updateTransactionCategory, updateTransactionNotes, updateTransactionAmountForMonth, updateTransactionAmountFromMonth } = useFinanceStore();
  const income = transaction.type === "income";

  const [name, setName] = useState(transaction.name);
  const [amount, setAmount] = useState(centsToInput(transaction.amount));
  const [category, setCategory] = useState(transaction.category);
  const [notes, setNotes] = useState(transaction.notes ?? "");
  // fixa: o valor vale só para o mês visto ou também para os seguintes
  const [scope, setScope] = useState<"month" | "following">("month");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const cents = parseBRL(amount);
    if (!trimmed) return showToast({ type: "error", text: "Preencha o nome" });
    if (cents === null) return showToast({ type: "error", text: "Informe um valor válido" });

    if (trimmed !== transaction.name) updateTransactionName(transaction.id, trimmed);
    if (cents !== transaction.amount) {
      if (transaction.fixed && scope === "following") updateTransactionAmountFromMonth(transaction.id, month, cents);
      else updateTransactionAmountForMonth(transaction.id, month, cents);
    }
    if (!income && category !== transaction.category) updateTransactionCategory(transaction.id, category);
    if (notes.trim() !== (transaction.notes ?? "")) updateTransactionNotes(transaction.id, notes.trim());

    showToast({ type: "success", text: "Alterações salvas" });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome" htmlFor="edit-name">
        <input id="edit-name" autoFocus={canAutoFocus()} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label={`Valor em ${formatMonthTitle(month)}`} htmlFor="edit-amount">
        <MoneyInput id="edit-amount" value={amount} onChange={setAmount} />
      </Field>
      {transaction.fixed && (
        <fieldset className="flex flex-col gap-2 rounded-md border border-border bg-secondary p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">O novo valor vale para</legend>
          {([["month", `Apenas ${formatMonthTitle(month)}`], ["following", `${formatMonthTitle(month)} e todos os meses seguintes`]] as const).map(([value, text]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="radio" name="edit-scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              {text}
            </label>
          ))}
        </fieldset>
      )}
      {!income && (
        <Field label="Categoria" htmlFor="edit-category">
          <CategorySelect id="edit-category" value={category} onChange={setCategory} />
        </Field>
      )}
      <Field label="Observação" hint="(opcional)" htmlFor="edit-notes">
        <p className="-mt-1 text-xs text-muted-foreground">{FREE_TEXT_WARNING}</p>
        <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[64px] rounded-md border-border-strong bg-secondary" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}

/** Edita uma compra parcelada: nome, categoria, valor total e número de parcelas. */
export function EditCreditDialog({ credit, onClose }: { credit: CreditTransaction | null; onClose: () => void }) {
  return (
    <Shell open={!!credit} title={credit?.recurring ? "Editar compra recorrente" : "Editar compra parcelada"} description={credit?.recurring ? `Começou em ${formatMonthTitle(credit.startMonth)}. Valor mensal atual: ${formatBRL(credit.totalAmount)}. O novo valor vale para todos os meses da recorrência.` : credit ? `Começou em ${formatMonthTitle(credit.startMonth)}. Total atual: ${formatBRL(credit.totalAmount)}.${credit.adjustments && Object.keys(credit.adjustments).length > 0 ? " As parcelas adiantadas, excluídas ou com valor próprio não mudam." : ""}` : ""} onClose={onClose}>
      {credit && <CreditFields key={credit.id} credit={credit} onClose={onClose} />}
    </Shell>
  );
}

function CreditFields({ credit, onClose }: { credit: CreditTransaction; onClose: () => void }) {
  const update = useFinanceStore((s) => s.updateCreditTransaction);
  const [name, setName] = useState(credit.name);
  const [total, setTotal] = useState(centsToInput(credit.totalAmount));
  const [installments, setInstallments] = useState(credit.installments);
  const [category, setCategory] = useState(credit.category);
  // com parcelas ajustadas, excluídas ou adiantadas o nº de parcelas fica travado
  const locked = Object.keys(credit.adjustments ?? {}).length > 0;
  const recurring = !!credit.recurring;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRL(total);
    if (!name.trim()) return showToast({ type: "error", text: "Preencha o nome" });
    if (!cents) return showToast({ type: "error", text: "Informe um valor maior que zero" });

    const result = patchEditAll(credit, {
      name: name.trim(),
      totalAmount: cents,
      installments: recurring ? 1 : Math.min(60, Math.max(1, Math.floor(installments) || 1)),
      category,
    });
    if (!result.ok) return showToast({ type: "error", text: result.error });
    update(credit.id, result.patch);
    showToast({ type: "success", text: "Alterações salvas" });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome" htmlFor="edit-credit-name">
        <input id="edit-credit-name" autoFocus={canAutoFocus()} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <div className={recurring ? "" : "grid gap-4 sm:grid-cols-2"}>
        <Field label={recurring ? "Valor mensal" : "Valor total"} htmlFor="edit-credit-total">
          <MoneyInput id="edit-credit-total" value={total} onChange={setTotal} />
        </Field>
        {!recurring && (
          <Field label="Parcelas" htmlFor="edit-credit-installments">
            <input id="edit-credit-installments" type="number" min={1} max={60} value={installments} disabled={locked} onChange={(e) => setInstallments(Number(e.target.value))} className={inputClass} />
          </Field>
        )}
      </div>
      <Field label="Categoria" htmlFor="edit-credit-category">
        <CategorySelect id="edit-credit-category" value={category} onChange={setCategory} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
