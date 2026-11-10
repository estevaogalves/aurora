import { useState } from "react";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import Icon from "@/components/Icon";
import { Field, inputClass } from "@/components/shared/FormFields";
import { Empty, Pill } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isValidCard } from "@/domain";
import { useUiStore } from "@/Store/UiStore";
import { useFinanceStore, type CreditCard } from "@/Store/FinanceStore";
import { showToast } from "../Warnings/toast";

type Draft = { id: string; name: string; closingDay: string; dueDay: string };

/** Um card por cartão, na mesma grade da tela de Metas. */
function CardItem({ card, purchases, onEdit, onDelete }: { card: CreditCard; purchases: number; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h4 className="break-words font-display text-base font-semibold">{card.name}</h4>
        <Pill>{purchases} {purchases === 1 ? "compra" : "compras"}</Pill>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Fechamento <b className="num text-foreground">dia {card.closingDay}</b>
        <span className="mx-2.5 text-border-strong">·</span>
        Vencimento <b className="num text-foreground">dia {card.dueDay}</b>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} className={`${btnClass.base} ${btnClass.sm}`}>Editar</button>
        <button type="button" onClick={onDelete} className={`${btnClass.base} ${btnClass.sm} hover:!border-destructive hover:!text-destructive`}>
          <Icon name="trash" size={14} />
          Excluir
        </button>
      </div>
    </article>
  );
}

/**
 * Cartões cadastrados: aqui só se vê, edita e exclui. O cadastro é feito no "Lançar" (aba Cartão).
 * Um card por cartão, direto na página, sem caixa em volta (como na tela de Metas).
 */
export default function CreditCardsPanel() {
  const cards = useFinanceStore((s) => s.creditCards);
  const credits = useFinanceStore((s) => s.creditTransactions);
  const updateCard = useFinanceStore((s) => s.updateCreditCard);
  const removeCard = useFinanceStore((s) => s.removeCreditCard);
  const openLaunch = useUiStore((s) => s.openLaunch);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<CreditCard | null>(null);

  const linked = (id: string) => credits.filter((c) => c.cardId === id).length;
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const card = { name: draft.name.trim(), closingDay: Number(draft.closingDay), dueDay: Number(draft.dueDay) };
    if (!isValidCard(card)) return showToast({ type: "error", text: "Informe o nome e os dias de fechamento e vencimento (1 a 31)" });
    updateCard(draft.id, card);
    showToast({ type: "success", text: "Cartão atualizado" });
    setDraft(null);
  }

  return (
    <>
      {cards.length === 0 ? (
        <Empty>
          Nenhum cartão cadastrado. Cadastre pelo botão Lançar, na aba Cartão.{" "}
          <button type="button" onClick={() => openLaunch("card")} className="font-semibold text-primary underline-offset-2 hover:underline">Cadastrar cartão</button>
        </Empty>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
          {cards.map((k) => (
            <CardItem
              key={k.id}
              card={k}
              purchases={linked(k.id)}
              onEdit={() => setDraft({ id: k.id, name: k.name, closingDay: String(k.closingDay), dueDay: String(k.dueDay) })}
              onDelete={() => setToDelete(k)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cartão</DialogTitle>
            <DialogDescription>Não informe número do cartão, CVV nem CPF: só o nome e os dias.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={save} className="flex flex-col gap-4">
              <Field label="Nome do cartão" htmlFor="card-name">
                <input id="card-name" autoFocus value={draft.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Nubank" className={inputClass} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dia de fechamento" htmlFor="card-closing">
                  <input id="card-closing" type="number" inputMode="numeric" min={1} max={31} value={draft.closingDay} onChange={(e) => set({ closingDay: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Dia de vencimento" htmlFor="card-due">
                  <input id="card-due" type="number" inputMode="numeric" min={1} max={31} value={draft.dueDay} onChange={(e) => set({ dueDay: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeletion
        open={!!toDelete}
        itemLabel={`cartão${toDelete && linked(toDelete.id) ? ` (as ${linked(toDelete.id)} compras ligadas a ele ficam sem cartão e voltam a valer no mês da cobrança)` : ""}`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) removeCard(toDelete.id);
          setToDelete(null);
        }}
      />
    </>
  );
}
