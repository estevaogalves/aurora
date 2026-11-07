import { useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { centsToInput, parseBRL } from "@/lib/money";
import { useFinanceStore, type ExtraExpense } from "@/Store/FinanceStore";
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRL(amount);
    if (!name.trim()) return showToast({ type: "error", text: "Descreva a despesa" });
    if (!cents) return showToast({ type: "error", text: "Informe um valor maior que zero" });
    if (!month) return showToast({ type: "error", text: "Escolha o mês" });

    update(extra.id, { name: name.trim(), amount: cents, month });
    showToast({ type: "success", text: "Despesa extra atualizada" });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Descrição" htmlFor="edit-extra-name">
        <input id="edit-extra-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor" htmlFor="edit-extra-amount">
          <MoneyInput id="edit-extra-amount" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Mês" htmlFor="edit-extra-month">
          <input id="edit-extra-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
