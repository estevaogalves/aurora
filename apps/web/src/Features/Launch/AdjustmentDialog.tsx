import { useState } from "react";
import Icon from "@/components/Icon";
import { Field, FREE_TEXT_WARNING, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { InvoiceAdjustment } from "@/domain";
import { uuid } from "@/lib/uuid";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";

/** O que está sendo ajustado: a fatura, o total das compras e os ajustes que ela já tem. */
export interface AdjustmentTarget {
  name: string;
  /** total das compras da fatura, sem os ajustes (centavos) */
  total: number;
  current: InvoiceAdjustment[];
}

type Kind = "discount" | "extra";

const signed = (cents: number) => `${cents < 0 ? "−" : "+"}${formatBRL(Math.abs(cents))}`;

/**
 * Ajustes da fatura: quantos descontos e acréscimos (juros, IOF, cashback...) forem precisos para o total a pagar
 * bater com o do banco. É só um registro da fatura: nenhuma despesa é alterada. As mudanças só valem em "Salvar".
 */
export default function AdjustmentDialog({ target, onSave, onClose }: { target: AdjustmentTarget | null; onSave: (list: InvoiceAdjustment[]) => void; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustes / descontos</DialogTitle>
          <DialogDescription className="break-words">{target ? `${target.name} · compras ${formatBRL(target.total)}. Nenhuma despesa muda: os ajustes só acertam o total a pagar da fatura.` : ""}</DialogDescription>
        </DialogHeader>
        {/* a chave reinicia o rascunho a cada abertura */}
        {target && <AdjustmentFields key={target.name} target={target} onSave={onSave} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentFields({ target, onSave, onClose }: { target: AdjustmentTarget; onSave: (list: InvoiceAdjustment[]) => void; onClose: () => void }) {
  const [list, setList] = useState<InvoiceAdjustment[]>(target.current);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("discount");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  const cents = parseBRL(value);
  const amount = cents && cents > 0 ? (kind === "discount" ? -cents : cents) : 0;
  const others = list.filter((a) => a.id !== editingId).reduce((s, a) => s + a.amount, 0);
  // o desconto somado nunca passa do total das compras
  const tooBig = amount !== 0 && target.total + others + amount < 0;
  const sum = list.reduce((s, a) => s + a.amount, 0);
  const payable = Math.max(0, target.total + sum);

  function resetForm() {
    setEditingId(null);
    setKind("discount");
    setValue("");
    setNote("");
  }

  function submitItem(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || tooBig) return;
    const trimmed = note.trim();
    const item: InvoiceAdjustment = { id: editingId ?? uuid(), amount, ...(trimmed && { note: trimmed }) };
    setList(editingId ? list.map((a) => (a.id === editingId ? item : a)) : [...list, item]);
    resetForm();
  }

  function edit(a: InvoiceAdjustment) {
    setEditingId(a.id);
    setKind(a.amount > 0 ? "extra" : "discount");
    setValue(centsToInput(Math.abs(a.amount)));
    setNote(a.note ?? "");
  }

  return (
    <div className="flex flex-col gap-4">
      {list.length > 0 && (
        <ul className="flex flex-col rounded-md border border-border bg-secondary px-3">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 border-t border-border py-1.5 text-[13.5px] first:border-t-0">
              <span className="min-w-0 break-words">{a.amount < 0 ? "Desconto" : "Acréscimo"}{a.note ? ` · ${a.note}` : ""}</span>
              <span className="flex flex-none items-center gap-0.5">
                <span className="num font-semibold">{signed(a.amount)}</span>
                <button type="button" aria-label="Editar ajuste" onClick={() => edit(a)} className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"><Icon name="edit" size={15} /></button>
                <button type="button" aria-label="Remover ajuste" onClick={() => { setList(list.filter((x) => x.id !== a.id)); if (editingId === a.id) resetForm(); }} className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"><Icon name="close" size={15} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submitItem} className="flex flex-col gap-3 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">{editingId ? "Editar ajuste" : "Novo ajuste"}</p>
        <div role="radiogroup" aria-label="Tipo de ajuste" className="grid grid-cols-2 gap-2">
          {([["discount", "Desconto"], ["extra", "Acréscimo"]] as const).map(([k, label]) => (
            <label key={k} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
              <input type="radio" name="adjustment-kind" checked={kind === k} onChange={() => setKind(k)} className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
              {label}
            </label>
          ))}
        </div>
        <Field label="Valor" htmlFor="adjustment-value">
          <MoneyInput id="adjustment-value" value={value} onChange={setValue} />
        </Field>
        {tooBig && <p role="alert" className="rounded-md bg-secondary px-3 py-2 text-[13px] font-semibold text-destructive">Os descontos não podem passar do total das compras.</p>}
        <Field label="Observação" hint="(opcional)" htmlFor="adjustment-note">
          <p className="-mt-1 text-xs text-muted-foreground">{FREE_TEXT_WARNING}</p>
          <input id="adjustment-note" type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: desconto do banco, juros, IOF" className={`${inputClass} min-h-11`} />
        </Field>
        <div className="flex justify-end gap-2">
          {editingId && <Button type="button" variant="secondary" onClick={resetForm}>Cancelar edição</Button>}
          <Button type="submit" variant="secondary" disabled={!amount || tooBig}>{editingId ? "Atualizar ajuste" : "Adicionar ajuste"}</Button>
        </div>
      </form>

      <div className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-secondary px-3 py-2 text-[13.5px]">
        <span className="text-muted-foreground">Total a pagar</span>
        <span className="num font-bold">{formatBRL(payable)}</span>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="button" onClick={() => onSave(list)}>Salvar</Button>
      </div>
    </div>
  );
}
