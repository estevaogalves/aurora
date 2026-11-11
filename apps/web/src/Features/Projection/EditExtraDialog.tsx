import { canAutoFocus } from "@/lib/device";
import MonthPicker from "@/components/shared/MonthPicker";
import { useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { centsToInput, parseBRL } from "@/lib/money";
import { useFinanceStore, type ExtraExpense } from "@/Store/FinanceStore";
import CardPurchaseField from "../Launch/CardPurchaseField";
import { isISODate } from "../Launch/isoDate";
import { showToast } from "../Warnings/toast";

/** Edita descrição, valor e mês de uma despesa extra planejada. */
export default function EditExtraDialog({ extra, onClose }: { extra: ExtraExpense | null; onClose: () => void }) {
  return (
    <Dialog open={!!extra} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar despesa extra</DialogTitle>
          <DialogDescription>Ajuste o que está previsto para a Projeção.</DialogDescription>
        </DialogHeader>
        {extra && <Fields key={extra.id} extra={extra} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Fields({ extra, onClose }: { extra: ExtraExpense; onClose: () => void }) {
  const update = useFinanceStore((s) => s.updateExtraExpense);
  const [name, setName] = useState(extra.name);
  const [amount, setAmount] = useState(centsToInput(extra.amount));
  const [month, setMonth] = useState(extra.month);
  const [cardId, setCardId] = useState(extra.cardId ?? "");
  const [purchaseDate, setPurchaseDate] = useState(extra.purchaseDate ?? `${extra.month}-01`);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRL(amount);
    if (!name.trim()) return showToast({ type: "error", text: "Descreva a despesa" });
    if (!cents) return showToast({ type: "error", text: "Informe um valor maior que zero" });
    if (cardId ? !isISODate(purchaseDate) : !month) return showToast({ type: "error", text: cardId ? "Informe a data da compra" : "Escolha o mês" });

    // no cartão, o valor vale no mês da fatura (que sai do dia da compra); aqui guarda o mês da compra
    update(extra.id, cardId ? { name: name.trim(), amount: cents, month: purchaseDate.slice(0, 7), cardId, purchaseDate } : { name: name.trim(), amount: cents, month, cardId: undefined });
    showToast({ type: "success", text: "Despesa extra atualizada" });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Descrição" htmlFor="edit-extra-name">
        <input id="edit-extra-name" autoFocus={canAutoFocus()} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor" htmlFor="edit-extra-amount">
          <MoneyInput id="edit-extra-amount" value={amount} onChange={setAmount} />
        </Field>
        {!cardId && (
          <Field label="Mês" htmlFor="edit-extra-month">
            <MonthPicker id="edit-extra-month" value={month} onChange={setMonth} />
          </Field>
        )}
      </div>
      <CardPurchaseField idPrefix="edit-extra" cardId={cardId} onCardChange={setCardId} date={purchaseDate} onDateChange={setPurchaseDate} onNavigate={onClose} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
