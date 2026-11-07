import { useState } from "react";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import Icon from "@/components/Icon";
import Panel, { Empty, PageHeader, Pill } from "@/components/shared/Panel";
import RowMenu from "@/components/shared/RowMenu";
import { btnClass } from "@/components/shared/styles";
import { formatBRL } from "@/lib/money";
import { useFinanceStore, type CreditTransaction, type Transaction } from "@/Store/FinanceStore";
import { useHiddenTransactions, useMonthCredit, useMonthTransactions } from "@/Store/selectors";
import { useCategoryColor } from "@/Utils/categoryColors";
import { showToast } from "../Warnings/toast";
import { EditCreditDialog, EditTransactionDialog } from "./EditDialogs";
import { ProgressMini, Row } from "./rows";
import ScreenTour from "@/components/tour/ScreenTour";
import { LANCAMENTOS_TOUR } from "./tour";

function TransactionRow({ t, onEdit, onDelete }: { t: Transaction; onEdit: (t: Transaction) => void; onDelete: (id: string) => void }) {
  const toggleFixed = useFinanceStore((s) => s.toggleTransactionFixed);
  const colorOf = useCategoryColor();
  const income = t.type === "income";

  return (
    <Row
      color={income ? "hsl(var(--success))" : colorOf(t.category)}
      name={t.name}
      meta={
        <>
          {!income && t.category}
          {t.fixed ? <Pill tone="fix">Fixa</Pill> : income ? <Pill>Variável</Pill> : null}
          {t.notes && <span className="min-w-0 max-w-full break-words">{t.notes}</span>}
        </>
      }
      amount={formatBRL(t.amount)}
      amountClass={income ? "text-success" : ""}
      actions={
        <RowMenu
          label={t.name}
          pinned={!!t.fixed}
          pinLabel="Fixar como atalho"
          unpinLabel="Desafixar"
          deleteLabel={t.fixed ? "Ocultar neste mês" : "Excluir"}
          onEdit={() => onEdit(t)}
          onPin={() => toggleFixed(t.id)}
          onDelete={() => onDelete(t.id)}
        />
      }
    />
  );
}

function HiddenList({ kind }: { kind: "income" | "expense" }) {
  const month = useFinanceStore((s) => s.currentMonth);
  const restore = useFinanceStore((s) => s.restoreTransactionByMonth);
  const hidden = useHiddenTransactions().filter((t) => t.type === kind);
  if (hidden.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Ocultas neste mês</p>
      {hidden.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px] opacity-80">
          <span className="min-w-0 truncate">{t.name} · {formatBRL(t.monthlyValues?.[month] ?? t.amount)}</span>
          <button type="button" onClick={() => restore(t.id, month)} className={`${btnClass.base} ${btnClass.sm}`}>
            <Icon name="restore" size={14} />
            Restaurar
          </button>
        </div>
      ))}
    </div>
  );
}

function IncomesPanel() {
  const incomes = useMonthTransactions().filter((t) => t.type === "income");
  const month = useFinanceStore((s) => s.currentMonth);
  const removeByMonth = useFinanceStore((s) => s.removeTransactionByMonth);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = incomes.find((i) => i.id === toDelete);

  return (
    <Panel tour="rendas" title="Rendas" subtitle="Fontes do mês">
      {incomes.length === 0 ? <Empty>Nenhuma renda cadastrada. Use o botão Lançar.</Empty> : incomes.map((t) => <TransactionRow key={t.id} t={t} onEdit={setEditing} onDelete={setToDelete} />)}
      <HiddenList kind="income" />
      <EditTransactionDialog transaction={editing} onClose={() => setEditing(null)} />
      <ConfirmDeletion
        open={!!target}
        itemLabel={target?.fixed ? "renda fixa" : "renda"}
        hideOnly={!!target?.fixed}
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) removeByMonth(toDelete, month); setToDelete(null); }}
      />
    </Panel>
  );
}

function CreditRow({ c, onEdit, onDelete }: { c: ReturnType<typeof useMonthCredit>[number]; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const colorOf = useCategoryColor();
  return (
    <Row
      color={colorOf(c.category)}
      name={c.name}
      meta={
        <>
          <Pill>Parcela {c.currentInstallment}/{c.installments}</Pill>
          <span>Total {formatBRL(c.totalAmount)}</span>
        </>
      }
      below={<ProgressMini value={c.currentInstallment} max={c.installments} />}
      amount={formatBRL(c.installmentValue)}
      actions={<RowMenu label={c.name} onEdit={() => onEdit(c.id)} onDelete={() => onDelete(c.id)} />}
    />
  );
}

function ExpensesPanel() {
  const expenses = useMonthTransactions().filter((t) => t.type === "expense");
  const credit = useMonthCredit();
  const credits = useFinanceStore((s) => s.creditTransactions);
  const month = useFinanceStore((s) => s.currentMonth);
  const removeByMonth = useFinanceStore((s) => s.removeTransactionByMonth);
  const removeCredit = useFinanceStore((s) => s.removeCreditTransaction);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editingCredit, setEditingCredit] = useState<CreditTransaction | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; credit: boolean } | null>(null);
  const target = toDelete && !toDelete.credit ? expenses.find((e) => e.id === toDelete.id) : undefined;

  const sorted = [...expenses].sort((a, b) => Number(!!b.fixed) - Number(!!a.fixed) || b.amount - a.amount);
  const count = expenses.length + credit.length;

  return (
    <Panel tour="despesas" title="Despesas do mês" subtitle={`${count} ${count === 1 ? "lançamento" : "lançamentos"}`}>
      {count === 0 && <Empty>Nenhuma despesa neste mês. Use o botão Lançar.</Empty>}
      {sorted.map((t) => <TransactionRow key={t.id} t={t} onEdit={setEditing} onDelete={(id) => setToDelete({ id, credit: false })} />)}
      {credit.map((c) => (
        <CreditRow key={c.id} c={c} onEdit={(id) => setEditingCredit(credits.find((x) => x.id === id) ?? null)} onDelete={(id) => setToDelete({ id, credit: true })} />
      ))}
      <HiddenList kind="expense" />
      <EditTransactionDialog transaction={editing} onClose={() => setEditing(null)} />
      <EditCreditDialog credit={editingCredit} onClose={() => setEditingCredit(null)} />
      <ConfirmDeletion
        open={!!toDelete}
        itemLabel={toDelete?.credit ? "compra parcelada" : target?.fixed ? "despesa fixa" : "despesa"}
        hideOnly={!!target?.fixed}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete?.credit) removeCredit(toDelete.id);
          else if (toDelete) removeByMonth(toDelete.id, month);
          setToDelete(null);
        }}
      />
    </Panel>
  );
}

function NotesPanel() {
  const month = useFinanceStore((s) => s.currentMonth);
  const allNotes = useFinanceStore((s) => s.notes);
  const { addNote, removeNote, togglePinNote, updateNote } = useFinanceStore();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const notes = allNotes.filter((n) => n.month === month).sort((a, b) => Number(b.pinned) - Number(a.pinned));

  function save() {
    const content = draft.trim();
    if (!content) return showToast({ type: "error", text: "Escreva algo antes de salvar" });
    addNote({ id: crypto.randomUUID(), content, date: new Date().toLocaleDateString("pt-BR"), pinned: false, month });
    setDraft("");
    showToast({ type: "success", text: "Anotação criada" });
  }

  function saveEdit() {
    const content = editDraft.trim();
    if (!content) return showToast({ type: "error", text: "A anotação não pode ficar vazia" });
    if (editingId) updateNote(editingId, content);
    setEditingId(null);
    showToast({ type: "success", text: "Anotação atualizada" });
  }

  return (
    <Panel tour="anotacoes" title="Anotações" subtitle="Lembretes do mês">
      <div className="flex flex-col gap-2.5">
        {notes.map((n) => (
          <div key={n.id} className="flex flex-col gap-1 rounded-md border border-border bg-secondary px-3.5 py-3 text-[13.5px]">
            {editingId === n.id ? (
              <>
                <textarea
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  aria-label="Editar anotação"
                  className="min-h-16 w-full resize-y rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingId(null)} className={`${btnClass.base} ${btnClass.sm}`}>Cancelar</button>
                  <button type="button" onClick={saveEdit} className={`${btnClass.primary} ${btnClass.sm}`}>Salvar</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words">{n.content}</span>
                  <RowMenu
                    label="anotação"
                    pinned={n.pinned}
                    onEdit={() => { setEditDraft(n.content); setEditingId(n.id); }}
                    onPin={() => togglePinNote(n.id)}
                    onDelete={() => setToDelete(n.id)}
                  />
                </div>
                <small className="text-xs text-muted-foreground">{n.pinned ? "Fixada · " : ""}{n.date}</small>
              </>
            )}
          </div>
        ))}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ex.: Lembrar de pagar o cartão até o dia 15..."
          aria-label="Nova anotação"
          className="min-h-16 w-full resize-y rounded-md border border-border-strong bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="button" onClick={save} className={`${btnClass.primary} self-end`}>Salvar</button>
      </div>
      <ConfirmDeletion
        open={!!toDelete}
        itemLabel="anotação"
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) removeNote(toDelete); setToDelete(null); }}
      />
    </Panel>
  );
}

/** Só visualização e ajustes dos lançamentos. Para cadastrar, use o botão Lançar no topo. */
export default function LaunchPage() {
  return (
    <>
      <ScreenTour screen="lancamentos" steps={LANCAMENTOS_TOUR} />
      <PageHeader title="Lançamentos" subtitle="Rendas, despesas e parcelas do mês. Para cadastrar, use o botão Lançar." />
      <div className="grid grid-cols-12 items-start gap-3.5">
        <div className="col-span-12 flex min-w-0 flex-col gap-3.5 lg:col-span-4">
          <IncomesPanel />
          <NotesPanel />
        </div>
        <div className="col-span-12 lg:col-span-8"><ExpensesPanel /></div>
      </div>
    </>
  );
}
