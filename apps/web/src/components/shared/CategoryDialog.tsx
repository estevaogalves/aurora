import { canAutoFocus } from "@/lib/device";
import { uuid } from "@/lib/uuid";
import { useState } from "react";
import { Field, inputClass } from "@/components/shared/FormFields";
import Icon from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showToast } from "@/Features/Warnings/toast";
import { useFinanceStore } from "@/Store/FinanceStore";
import { BUILTIN_CATEGORIES } from "@/Types/Category";

const SWATCHES = ["#8E80FF", "#4FD1E0", "#FFC857", "#FF7A93", "#4FD1B0", "#FF9F5A", "#6FA3FF", "#E58BF2", "#A3E635", "#F43F5E"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** chamado com o nome da categoria recém-criada */
  onCreated?: (name: string) => void;
}

/** Cria categorias com cor própria e permite apagar as que o usuário criou. */
export default function CategoryDialog({ open, onClose, onCreated }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <DialogDescription>Dê um nome e escolha a cor que aparece nos gráficos e listas.</DialogDescription>
        </DialogHeader>
        {open && <CategoryFields onClose={onClose} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function CategoryFields({ onClose, onCreated }: Omit<Props, "open">) {
  const categories = useFinanceStore((s) => s.customCategories);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const removeCategory = useFinanceStore((s) => s.removeCategory);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // este formulário fica dentro de outro modal
    const trimmed = name.trim();
    if (!trimmed) return showToast({ type: "error", text: "Dê um nome à categoria" });
    const taken = [...BUILTIN_CATEGORIES, ...categories.map((c) => c.name)].some((n) => n.toLowerCase() === trimmed.toLowerCase());
    if (taken) return showToast({ type: "error", text: `Já existe uma categoria "${trimmed}"` });

    addCategory({ id: uuid(), name: trimmed, color });
    showToast({ type: "success", text: `Categoria "${trimmed}" criada` });
    onCreated?.(trimmed);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="cat-name">
          <input id="cat-name" autoFocus={canAutoFocus()} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Ex.: Pets" className={inputClass} />
        </Field>
        <Field label="Cor">
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                aria-pressed={color.toLowerCase() === c.toLowerCase()}
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2 border-transparent aria-pressed:border-foreground"
                style={{ background: c }}
              />
            ))}
            <label className="ml-1 flex items-center gap-2 text-[12.5px] text-muted-foreground">
              Outra
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-border-strong bg-transparent p-0" />
            </label>
          </div>
        </Field>
        <div className="flex items-center gap-2 text-[13px] text-ink2">
          Prévia: <span className="inline-flex items-center gap-1.5 font-semibold"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />{name.trim() || "Nome da categoria"}</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Criar categoria</Button>
        </div>
      </form>

      {categories.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Suas categorias</p>
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />{c.name}</span>
              <button type="button" aria-label={`Apagar categoria ${c.name}`} onClick={() => removeCategory(c.id)} className="grid h-7 w-7 place-items-center rounded-md border border-border-strong text-muted-foreground hover:border-destructive hover:text-destructive">
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
          <p className="mt-1 text-xs text-muted-foreground">Apagar não altera lançamentos antigos: eles mantêm o nome, com cor neutra.</p>
        </div>
      )}
    </div>
  );
}
