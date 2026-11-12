import { uuid } from "@/lib/uuid";
import { useState } from "react";
import Icon from "@/components/Icon";
import { inputClass } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isRequiredItem, sumPercent, validateDistribution } from "@/domain";
import type { DistributionItem } from "@/Store/FinanceStore";
import { showToast } from "../Warnings/toast";

/**
 * Edita os percentuais de uma sugestão. `current` é o que vale hoje, `base` é o padrão para onde "Restaurar padrão"
 * volta e `onSave` recebe a lista nova, ou null quando ela ficou igual ao padrão (assim a distribuição volta a seguir o padrão).
 */
export function DistributionDialog({ open, onClose, title, description, current, base, onSave }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  current: DistributionItem[];
  base: DistributionItem[];
  onSave: (items: DistributionItem[] | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && <Fields onClose={onClose} current={current} base={base} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function Fields({ onClose, current, base, onSave }: { onClose: () => void; current: DistributionItem[]; base: DistributionItem[]; onSave: (items: DistributionItem[] | null) => void }) {
  const [items, setItems] = useState<DistributionItem[]>(() => current.map((i) => ({ ...i })));
  const [newName, setNewName] = useState("");
  const [newPercent, setNewPercent] = useState("");

  const total = sumPercent(items);
  const error = validateDistribution(items);

  const change = (id: string, patch: Partial<DistributionItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // campo vazio vira 0; o que não for número inteiro é ignorado
  const toPercent = (text: string) => Math.min(100, Math.max(0, parseInt(text.replace(/\D/g, ""), 10) || 0));

  function addItem() {
    const label = newName.trim();
    if (!label) return showToast({ type: "error", text: "Dê um nome à categoria" });
    if (items.some((i) => i.label.trim().toLowerCase() === label.toLowerCase())) {
      return showToast({ type: "error", text: `Já existe "${label}"` });
    }
    setItems((prev) => [...prev, { id: uuid(), label, percent: toPercent(newPercent), custom: true }]);
    setNewName("");
    setNewPercent("");
  }

  function save() {
    if (error) return;
    const plain = (list: DistributionItem[]) => JSON.stringify(list.map(({ id, label, percent }) => ({ id, label: label.trim(), percent })));
    onSave(plain(items) === plain(base) ? null : items.map((i) => ({ ...i, label: i.label.trim() })));
    showToast({ type: "success", text: "Sugestão atualizada" });
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_88px_auto] items-center gap-2">
            {isRequiredItem(item) ? (
              <span className="px-1 text-sm font-medium">{item.label}</span>
            ) : (
              <input aria-label="Nome da categoria" value={item.label} maxLength={30} onChange={(e) => change(item.id, { label: e.target.value })} className={inputClass} />
            )}
            <div className="relative">
              <input
                aria-label={`Percentual de ${item.label}`}
                inputMode="numeric"
                value={String(item.percent)}
                onChange={(e) => change(item.id, { percent: toPercent(e.target.value) })}
                className={`${inputClass} pr-7 text-right font-semibold`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            {isRequiredItem(item) ? (
              <span className="h-8 w-8" />
            ) : (
              <button type="button" aria-label={`Remover ${item.label}`} onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))} className="grid h-8 w-8 place-items-center rounded-md border border-border-strong text-muted-foreground hover:border-destructive hover:text-destructive">
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_88px_auto] items-end gap-2 border-t border-border pt-3">
        <div>
          <label htmlFor="dist-new-name" className="mb-1 block text-[12.5px] font-bold text-ink2">Nova categoria</label>
          <input id="dist-new-name" value={newName} maxLength={30} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Viagem" className={inputClass} />
        </div>
        <input aria-label="Percentual da nova categoria" inputMode="numeric" value={newPercent} onChange={(e) => setNewPercent(String(toPercent(e.target.value) || ""))} placeholder="0" className={`${inputClass} text-right`} />
        <Button type="button" variant="secondary" onClick={addItem}>Adicionar</Button>
      </div>

      <div className={`rounded-md px-3 py-2 text-[13px] font-semibold ${error ? "bg-bad-bg text-destructive" : "bg-good-bg text-success"}`} role="status">
        Total: {total}% {error ? `· ${error}` : "· pronto para salvar"}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => setItems(base.map((i) => ({ ...i })))}>Restaurar padrão</Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!!error} onClick={save}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}
