import { useRef, useState } from "react";
import CategorySelect from "@/components/shared/CategorySelect";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import Icon from "@/components/Icon";
import Panel, { Empty, PageHeader, Pill } from "@/components/shared/Panel";
import { btnClass } from "@/components/shared/styles";
import { centsToInput, formatBRL, parseBRL, sanitizeAmountInput } from "@/lib/money";
import { useFinanceStore, type Transaction } from "@/Store/FinanceStore";
import { useHiddenTransactions, useMonthCredit, useMonthTransactions } from "@/Store/selectors";
import { useUiStore, type LaunchTab } from "@/Store/UiStore";
import type { Category } from "@/Types/Category";
import { categoryColors } from "@/Utils/categoryColors";
import { showToast } from "../Warnings/toast";
import { ProgressMini, Row } from "./rows";

const iconBtn =
  "grid h-8 w-8 place-items-center rounded-md border border-border-strong bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

function AddButton({ label, tab }: { label: string; tab: LaunchTab }) {
  const openLaunch = useUiStore((s) => s.openLaunch);
  return (
    <button type="button" onClick={() => openLaunch(tab)} className={`${btnClass.primary} ${btnClass.sm}`}>
      <Icon name="plus" size={16} />
      {label}
    </button>
  );
}

/** Texto que vira campo ao clicar. Enter ou sair do campo salva; Esc cancela. */
function InlineEdit({ value, onSave, className = "", inputClass = "" }: { value: string; onSave: (v: string) => void; className?: string; inputClass?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
    } else if (draft.trim() && draft.trim() !== value) {
      onSave(draft.trim());
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button type="button" title="Clique para editar" onClick={() => { setDraft(value); setEditing(true); }} className={`cursor-text text-left hover:text-primary ${className}`}>
        {value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
      }}
      className={`rounded-md border border-border-strong bg-secondary px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring ${inputClass}`}
    />
  );
}

function AmountEdit({ cents, onSave, className = "" }: { cents: number; onSave: (cents: number) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
    } else {
      const parsed = parseBRL(draft);
      if (parsed !== null && parsed !== cents) {
        onSave(parsed);
        showToast({ type: "success", text: "Valor atualizado" });
      }
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button type="button" title="Clique para editar" onClick={() => { setDraft(centsToInput(cents)); setEditing(true); }} className={`num font-bold hover:text-primary ${className}`}>
        {formatBRL(cents)}
      </button>
    );
  }
  return (
    <input
      autoFocus
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(sanitizeAmountInput(e.target.value))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
      }}
      className="num w-28 rounded-md border border-border-strong bg-secondary px-2 py-1 text-right text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function TransactionRow({ t, kind, onDelete }: { t: Transaction; kind: "income" | "expense"; onDelete: (id: string) => void }) {
  const month = useFinanceStore((s) => s.currentMonth);
  const { updateTransactionName, updateTransactionCategory, updateTransactionAmountForMonth, toggleTransactionFixed } = useFinanceStore();
  const [editingCategory, setEditingCategory] = useState(false);
  const income = kind === "income";

  return (
    <Row
      color={income ? "hsl(var(--success))" : categoryColors[t.category]}
      name={<InlineEdit value={t.name} onSave={(name) => updateTransactionName(t.id, name)} />}
      meta={
        <>
          {!income &&
            (editingCategory ? (
              <div className="w-40">
                <CategorySelect value={t.category} onChange={(c: Category) => { updateTransactionCategory(t.id, c); setEditingCategory(false); }} />
              </div>
            ) : (
              <button type="button" title="Trocar categoria" onClick={() => setEditingCategory(true)} className="hover:text-primary">{t.category}</button>
            ))}
          {t.fixed ? <Pill tone="fix">Fixa</Pill> : income ? <Pill>Variável</Pill> : null}
          {t.notes && <span className="truncate">{t.notes}</span>}
        </>
      }
      amount={<AmountEdit cents={t.amount} onSave={(c) => updateTransactionAmountForMonth(t.id, month, c)} className={income ? "text-success" : ""} />}
      actions={
        <>
          <button type="button" aria-label={t.fixed ? "Desafixar" : "Fixar"} aria-pressed={!!t.fixed} onClick={() => toggleTransactionFixed(t.id)} className={`${iconBtn} ${t.fixed ? "border-primary text-primary" : ""}`}>
            <Icon name="pin" size={15} />
          </button>
          <button type="button" aria-label={t.fixed ? "Ocultar neste mês" : "Remover"} onClick={() => onDelete(t.id)} className={`${iconBtn} hover:border-destructive hover:text-destructive`}>
            <Icon name="trash" size={15} />
          </button>
        </>
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
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = incomes.find((i) => i.id === toDelete);

  return (
    <Panel title="Rendas" subtitle="Fontes do mês" action={<AddButton label="Nova renda" tab="income" />}>
      {incomes.length === 0 ? <Empty>Nenhuma renda cadastrada.</Empty> : incomes.map((t) => <TransactionRow key={t.id} t={t} kind="income" onDelete={setToDelete} />)}
      <HiddenList kind="income" />
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

function ExpensesPanel() {
  const expenses = useMonthTransactions().filter((t) => t.type === "expense");
  const credit = useMonthCredit();
  const month = useFinanceStore((s) => s.currentMonth);
  const removeByMonth = useFinanceStore((s) => s.removeTransactionByMonth);
  const removeCredit = useFinanceStore((s) => s.removeCreditTransaction);
  const [toDelete, setToDelete] = useState<{ id: string; credit: boolean } | null>(null);
  const target = toDelete && !toDelete.credit ? expenses.find((e) => e.id === toDelete.id) : undefined;

  const sorted = [...expenses].sort((a, b) => Number(!!b.fixed) - Number(!!a.fixed) || b.amount - a.amount);
  const count = expenses.length + credit.length;

  return (
    <Panel title="Despesas do mês" subtitle={`${count} ${count === 1 ? "lançamento" : "lançamentos"}`} action={<AddButton label="Nova despesa" tab="expense" />}>
      {count === 0 && <Empty>Nenhuma despesa neste mês.</Empty>}
      {sorted.map((t) => <TransactionRow key={t.id} t={t} kind="expense" onDelete={(id) => setToDelete({ id, credit: false })} />)}
      {credit.map((c) => (
        <Row
          key={c.id}
          color={categoryColors["Crédito/Parcelado"]}
          name={c.name}
          meta={
            <>
              <Pill>Parcela {c.currentInstallment}/{c.installments}</Pill>
              <span>Total {formatBRL(c.totalAmount)}</span>
            </>
          }
          below={<ProgressMini value={c.currentInstallment} max={c.installments} />}
          amount={formatBRL(c.installmentValue)}
          actions={
            <button type="button" aria-label="Remover compra parcelada" onClick={() => setToDelete({ id: c.id, credit: true })} className={`${iconBtn} hover:border-destructive hover:text-destructive`}>
              <Icon name="trash" size={15} />
            </button>
          }
        />
      ))}
      <HiddenList kind="expense" />
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
  const { addNote, removeNote, togglePinNote } = useFinanceStore();
  const [draft, setDraft] = useState("");

  const notes = allNotes.filter((n) => n.month === month).sort((a, b) => Number(b.pinned) - Number(a.pinned));

  function save() {
    const content = draft.trim();
    if (!content) {
      showToast({ type: "error", text: "Escreva algo antes de salvar" });
      return;
    }
    addNote({ id: crypto.randomUUID(), content, date: new Date().toLocaleDateString("pt-BR"), pinned: false, month });
    setDraft("");
    showToast({ type: "success", text: "Anotação criada" });
  }

  return (
    <Panel title="Anotações" subtitle="Lembretes do mês">
      <div className="flex flex-col gap-2.5">
        {notes.map((n) => (
          <div key={n.id} className="flex flex-col gap-1 rounded-md border border-border bg-secondary px-3.5 py-3 text-[13.5px]">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 break-words">{n.content}</span>
              <span className="flex flex-none gap-1">
                <button type="button" aria-label={n.pinned ? "Desafixar anotação" : "Fixar anotação"} aria-pressed={n.pinned} onClick={() => togglePinNote(n.id)} className={`${iconBtn} !h-7 !w-7 ${n.pinned ? "border-primary text-primary" : ""}`}><Icon name="pin" size={14} /></button>
                <button type="button" aria-label="Excluir anotação" onClick={() => removeNote(n.id)} className={`${iconBtn} !h-7 !w-7 hover:border-destructive hover:text-destructive`}><Icon name="trash" size={14} /></button>
              </span>
            </div>
            <small className="text-xs text-muted-foreground">{n.pinned ? "Fixada · " : ""}{n.date}</small>
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
    </Panel>
  );
}

export default function LaunchPage() {
  const openLaunch = useUiStore((s) => s.openLaunch);

  return (
    <>
      <PageHeader
        title="Lançamentos"
        subtitle="Rendas, despesas e parcelas do mês."
        action={
          <button type="button" onClick={() => openLaunch("income")} className={`${btnClass.primary} ${btnClass.sm}`}>
            <Icon name="plus" size={16} />
            Nova renda
          </button>
        }
      />
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
