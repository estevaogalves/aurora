import { uuid } from "@/lib/uuid";
import { useState } from "react";
import ConfirmDeletion from "@/components/shared/ConfirmDeletion";
import { FREE_TEXT_WARNING } from "@/components/shared/FormFields";
import Icon from "@/components/Icon";
import Panel, { Empty, PageHeader, Pill } from "@/components/shared/Panel";
import RowMenu from "@/components/shared/RowMenu";
import { btnClass } from "@/components/shared/styles";
import { canAdvanceInstallment, chargeDay, formatPaymentDay, getCreditEffectiveTotal, getCreditProgress, getInstallmentMonth, isScheduled, paymentMethodLabel, paymentOf, paymentStatusLabel, type Payment } from "@/domain";
import { formatBRL } from "@/lib/money";
import { useFinanceStore, type CreditTransaction, type ExtraExpense, type Transaction } from "@/Store/FinanceStore";
import { useHiddenTransactions, useMonthCredit, useMonthTransactions } from "@/Store/selectors";
import { useCategoryColor } from "@/Utils/categoryColors";
import { formatMonthAbbr, formatMonthTitle, getCurrentMonth } from "@/Utils/Date";
import EditExtraDialog from "../Projection/EditExtraDialog";
import { showToast } from "../Warnings/toast";
import { EditCreditDialog, EditTransactionDialog } from "./EditDialogs";
import { AdvanceDialog, CancelRecurrenceDialog, EditInstallmentDialog, ScopeDialog } from "./InstallmentDialogs";
import PaymentDialog, { type PaymentTarget } from "./PaymentDialog";
import { ProgressMini, Row } from "./rows";
import { LANCAMENTOS_TOUR } from "./tour";

/** Selo e observação do pagamento: verde "Paga · Pix · 08/11"; laranja "Agendada · Boleto · 15/11" (boleto com data futura). */
function PaidBadge({ payment }: { payment: Payment }) {
  return (
    <>
      <Pill tone={isScheduled(payment) ? "scheduled" : "good"}>{paymentStatusLabel(payment)} · {paymentMethodLabel(payment.method)} · {formatPaymentDay(payment.date)}</Pill>
    </>
  );
}

/** Anotações escondidas por padrão: o olho mostra ou esconde o texto. Sem anotação, `button` e `text` ficam nulos. */
function useNotes(...notes: (string | undefined)[]) {
  const [open, setOpen] = useState(false);
  const text = notes.filter(Boolean).join(" · ");
  if (!text) return { button: null, text: null };
  return {
    button: (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Esconder anotação" : "Mostrar anotação"}
        aria-pressed={open}
        title={open ? "Esconder anotação" : "Mostrar anotação"}
        className="flex-none rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Icon name={open ? "eyeOff" : "eye"} size={16} />
      </button>
    ),
    text: open ? <p className="mt-0.5 min-w-0 max-w-full whitespace-pre-wrap break-words text-[12.5px] text-muted-foreground">{text}</p> : null,
  };
}

/** Ações de pagamento de uma linha (só despesas): marcar, editar e desmarcar. */
interface PayActions {
  onPay: () => void;
  onClearPay: () => void;
}

function TransactionRow({ t, onEdit, onDelete, pay }: { t: Transaction; onEdit: (t: Transaction) => void; onDelete: (id: string) => void; pay?: PayActions }) {
  const toggleFixed = useFinanceStore((s) => s.toggleTransactionFixed);
  const month = useFinanceStore((s) => s.currentMonth);
  const colorOf = useCategoryColor();
  const income = t.type === "income";
  const payment = pay ? paymentOf(t, month) : undefined;
  const note = useNotes(t.notes, payment?.notes);

  const menu = (
    <RowMenu
      label={t.name}
      pinned={!!t.fixed}
      pinLabel="Fixar como atalho"
      unpinLabel="Desafixar"
      deleteLabel={t.fixed ? "Ocultar neste mês" : "Excluir"}
      onEdit={() => onEdit(t)}
      onPin={() => toggleFixed(t.id)}
      onDelete={() => onDelete(t.id)}
      onPay={pay?.onPay}
      paid={!!payment}
      onClearPay={payment ? pay?.onClearPay : undefined}
    />
  );

  // fixa: só nome e valor (fica na área "Fixas", abaixo da linha divisória)
  if (t.fixed) {
    return (
      <div className="flex items-center justify-between gap-3 py-1 text-[13.5px]">
        <div className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words">{t.name}</span>
            {payment && <PaidBadge payment={payment} />}
          </span>
          {note.text}
        </div>
        <div className="flex items-center gap-2">
          {note.button}
          <span className={`num text-right font-semibold ${income ? "text-success" : ""}`}>{formatBRL(t.amount)}</span>
          {menu}
        </div>
      </div>
    );
  }

  return (
    <Row
      color={income ? "hsl(var(--success))" : colorOf(t.category)}
      name={t.name}
      meta={
        <>
          {!income && t.category}
          {t.fixed ? <Pill tone="fix">Fixa</Pill> : income ? <Pill>Variável</Pill> : null}
          {payment && <PaidBadge payment={payment} />}
        </>
      }
      amount={formatBRL(t.amount)}
      amountClass={income ? "text-success" : ""}
      below={note.text}
      actions={<>{note.button}{menu}</>}
    />
  );
}

function ExtraRow({ e, color, onEdit, onDelete, onPay, onClearPay }: { e: ExtraExpense; color: string; onEdit: () => void; onDelete: () => void; onPay: () => void; onClearPay?: () => void }) {
  const note = useNotes(e.payment?.notes);
  return (
    <Row
      color={color}
      name={e.name}
      meta={
        <>
          <Pill>Despesa extra</Pill>
          {e.payment && <PaidBadge payment={e.payment} />}
        </>
      }
      below={note.text}
      amount={formatBRL(e.amount)}
      actions={
        <>
          {note.button}
          <RowMenu label={e.name} onEdit={onEdit} onDelete={onDelete} onPay={onPay} paid={!!e.payment} onClearPay={onClearPay} />
        </>
      }
    />
  );
}

/** Rodapé dos cards de Lançamentos: o total do que está listado. */
function TotalFooter({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className={`mt-3 flex items-baseline justify-between gap-3 border-t border-border-strong pt-3 text-[13.5px] ${className}`}>
      <span className="font-semibold">{label}</span>
      <span className="num font-bold">{formatBRL(value)}</span>
    </div>
  );
}

/** Área das fixas: linha divisória e só nome e valor, abaixo das variáveis. */
function FixedSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-border-strong pt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Fixas</p>
      {children}
    </div>
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
  const variable = incomes.filter((t) => !t.fixed);
  const fixed = incomes.filter((t) => t.fixed);
  const month = useFinanceStore((s) => s.currentMonth);
  const removeByMonth = useFinanceStore((s) => s.removeTransactionByMonth);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = incomes.find((i) => i.id === toDelete);

  return (
    <Panel tour="rendas" title="Rendas" subtitle="Fontes do mês">
      {incomes.length === 0 ? <Empty>Nenhuma renda cadastrada. Use o botão Lançar.</Empty> : variable.map((t) => <TransactionRow key={t.id} t={t} onEdit={setEditing} onDelete={setToDelete} />)}
      {incomes.length > 0 && variable.length === 0 && <Empty>Nenhuma renda variável neste mês.</Empty>}
      {fixed.length > 0 && <FixedSection>{fixed.map((t) => <TransactionRow key={t.id} t={t} onEdit={setEditing} onDelete={setToDelete} />)}</FixedSection>}
      <HiddenList kind="income" />
      {incomes.length > 0 && <TotalFooter label="Total das rendas do mês" value={incomes.reduce((sum, t) => sum + t.amount, 0)} className="text-success" />}
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
function ExpensesPanel() {
  const expenses = useMonthTransactions().filter((t) => t.type === "expense");
  const month = useFinanceStore((s) => s.currentMonth);
  const removeByMonth = useFinanceStore((s) => s.removeTransactionByMonth);
  const extras = useFinanceStore((s) => s.extraExpenses).filter((e) => e.month === month);
  const removeExtra = useFinanceStore((s) => s.removeExtraExpense);
  const setTransactionPayment = useFinanceStore((s) => s.setTransactionPayment);
  const setExtraPayment = useFinanceStore((s) => s.setExtraPayment);
  const colorOf = useCategoryColor();
  // o pagamento que está sendo marcado ou editado (despesa do mês ou extra)
  const [paying, setPaying] = useState<({ kind: "tx"; id: string } | { kind: "extra"; id: string }) & PaymentTarget | null>(null);
  const [editingExtra, setEditingExtra] = useState<ExtraExpense | null>(null);
  const [extraToDelete, setExtraToDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const target = expenses.find((e) => e.id === toDelete);
  const fixed = expenses.filter((t) => t.fixed).sort((a, b) => b.amount - a.amount);
  const variable = expenses.filter((t) => !t.fixed).sort((a, b) => b.amount - a.amount);
  const count = expenses.length + extras.length;

  const payTx = (t: Transaction) => ({
    onPay: () => setPaying({ kind: "tx", id: t.id, name: t.name, amount: t.amount, current: paymentOf(t, month) }),
    onClearPay: () => setTransactionPayment(t.id, month, null),
  });
  const confirmPayment = (payment: Payment) => {
    if (!paying) return;
    if (paying.kind === "tx") setTransactionPayment(paying.id, month, payment);
    else setExtraPayment(paying.id, payment);
    showToast({ type: "success", text: isScheduled(payment) ? `Pagamento de "${paying.name}" agendado` : `"${paying.name}" marcada como paga` });
    setPaying(null);
  };

  return (
    <Panel tour="despesas" title="Despesas do mês" subtitle={`${count} ${count === 1 ? "lançamento" : "lançamentos"}`}>
      {count === 0 && <Empty>Nenhuma despesa neste mês. Use o botão Lançar.</Empty>}
      {count > 0 && variable.length === 0 && extras.length === 0 && <Empty>Nenhuma despesa variável neste mês.</Empty>}
      {variable.map((t) => <TransactionRow key={t.id} t={t} onEdit={setEditing} onDelete={setToDelete} pay={payTx(t)} />)}
      {extras.map((e) => (
        <ExtraRow
          key={e.id}
          e={e}
          color={colorOf("Outros")}
          onEdit={() => setEditingExtra(e)}
          onDelete={() => setExtraToDelete(e.id)}
          onPay={() => setPaying({ kind: "extra", id: e.id, name: e.name, amount: e.amount, current: e.payment })}
          onClearPay={e.payment ? () => setExtraPayment(e.id, null) : undefined}
        />
      ))}
      {fixed.length > 0 && <FixedSection>{fixed.map((t) => <TransactionRow key={t.id} t={t} onEdit={setEditing} onDelete={setToDelete} pay={payTx(t)} />)}</FixedSection>}
      <HiddenList kind="expense" />
      {count > 0 && <TotalFooter label="Total das despesas do mês (sem parcelas)" value={expenses.reduce((sum, t) => sum + t.amount, 0) + extras.reduce((sum, e) => sum + e.amount, 0)} />}
      <EditTransactionDialog transaction={editing} onClose={() => setEditing(null)} />
      <EditExtraDialog extra={editingExtra} onClose={() => setEditingExtra(null)} />
      <PaymentDialog target={paying} onConfirm={confirmPayment} onClose={() => setPaying(null)} />
      <ConfirmDeletion
        open={!!extraToDelete}
        itemLabel="despesa extra"
        onCancel={() => setExtraToDelete(null)}
        onConfirm={() => { if (extraToDelete) removeExtra(extraToDelete); setExtraToDelete(null); }}
      />
      <ConfirmDeletion
        open={!!toDelete}
        itemLabel={target?.fixed ? "despesa fixa" : "despesa"}
        hideOnly={!!target?.fixed}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) removeByMonth(toDelete, month);
          setToDelete(null);
        }}
      />
    </Panel>
  );
}

/** Linha de uma compra parcelada no mês visto. Parcela adiantada é identificada, com mês original e desconto. */
function InstallmentRow({ c, credit, month, today, onEdit, onDelete, onAdvance, onCancelRecurrence }: {
  c: ReturnType<typeof useMonthCredit>[number];
  credit: CreditTransaction | undefined;
  month: string;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
  onAdvance: () => void;
  onCancelRecurrence: () => void;
}) {
  const colorOf = useCategoryColor();

  // recorrente: sem parcelas, total nem barra de progresso; o menu ganha "Cancelar recorrência" enquanto estiver ativa
  if (c.recurring) {
    const ending = credit?.endMonth;
    return (
      <Row
        color={colorOf(c.category)}
        name={c.name}
        meta={
          <>
            <Pill>Recorrente</Pill>
            {credit?.billingDay && <span>Cobra dia {chargeDay(credit.billingDay, month)}</span>}
            <span>{ending ? `Cancelada · última cobrança em ${formatMonthAbbr(ending)}` : "Cobrada todo mês"}</span>
          </>
        }
        amount={formatBRL(c.installmentValue)}
        actions={<RowMenu label={c.name} onEdit={onEdit} onDelete={onDelete} onCancelRecurrence={credit && !ending ? onCancelRecurrence : undefined} />}
      />
    );
  }

  const source = credit ?? { startMonth: month, installments: c.installments, totalAmount: c.totalAmount };
  const { remaining, endMonth } = getCreditProgress(source, month);
  const total = credit ? getCreditEffectiveTotal(credit) : c.totalAmount;
  const canAdvance = !!credit && !c.advanced && canAdvanceInstallment(credit, c.currentInstallment, today);

  return (
    <Row
      color={colorOf(c.category)}
      name={c.name}
      meta={
        <>
          <Pill>Parcela {c.currentInstallment}/{c.installments}</Pill>
          {c.advanced && <Pill tone="good">Adiantada</Pill>}
          <span>Total {formatBRL(total)}</span>
          {credit?.billingDay && <span>Cobra dia {chargeDay(credit.billingDay, month)}</span>}
          {c.advanced ? (
            <span>Original em {formatMonthAbbr(c.advanced.originalMonth)} · desconto {formatBRL(c.advanced.discount)}</span>
          ) : (
            <span>{remaining === 0 ? "Última parcela" : `Faltam ${remaining} ${remaining === 1 ? "parcela" : "parcelas"}`} · termina em {formatMonthAbbr(endMonth)}</span>
          )}
        </>
      }
      below={<ProgressMini value={c.currentInstallment} max={c.installments} />}
      amount={formatBRL(c.installmentValue)}
      actions={<RowMenu label={c.name} onEdit={onEdit} onDelete={onDelete} onAdvance={canAdvance ? onAdvance : undefined} />}
    />
  );
}

/** Compras parceladas com parcela no mês visto: mesma fonte (`useMonthCredit`) do Painel, do saldo e da Projeção. */
function InstallmentsPanel() {
  const credit = useMonthCredit();
  const credits = useFinanceStore((s) => s.creditTransactions);
  const month = useFinanceStore((s) => s.currentMonth);
  const removeCredit = useFinanceStore((s) => s.removeCreditTransaction);
  const removeInstallment = useFinanceStore((s) => s.removeCreditInstallment);
  const today = getCurrentMonth();
  const total = credit.reduce((sum, c) => sum + c.installmentValue, 0);

  // a parcela escolhida no menu e o que fazer com ela
  const [target, setTarget] = useState<{ id: string; n: number; advanced: boolean } | null>(null);
  const [step, setStep] = useState<"edit-scope" | "delete-scope" | "edit-one" | "edit-all" | "delete-one" | "delete-all" | "advance" | "cancel-recurrence" | null>(null);
  const targetCredit = credits.find((x) => x.id === target?.id) ?? null;
  const close = () => { setStep(null); setTarget(null); };
  const open = (c: ReturnType<typeof useMonthCredit>[number], action: "edit" | "delete" | "advance" | "cancel-recurrence") => {
    setTarget({ id: c.id, n: c.currentInstallment, advanced: !!c.advanced });
    // parcela adiantada não muda individualmente: só "todas"; recorrente não tem parcelas, então também só "todas"
    if (action === "advance") setStep("advance");
    else if (action === "cancel-recurrence") setStep("cancel-recurrence");
    else if (c.advanced || c.recurring) setStep(action === "edit" ? "edit-all" : "delete-all");
    else setStep(action === "edit" ? "edit-scope" : "delete-scope");
  };
  const scopeLabel = targetCredit && target ? `Parcela ${target.n}/${targetCredit.installments} · ${formatMonthTitle(getInstallmentMonth(targetCredit, target.n))}` : "";

  return (
    <Panel tour="parcelas" title="Compras parceladas" subtitle="Parcelas do crédito em andamento">
      {credit.length === 0 ? (
        <Empty>Nenhuma compra parcelada neste mês.</Empty>
      ) : (
        <>
          {credit.map((c) => (
            <InstallmentRow
              key={`${c.id}-${c.currentInstallment}`}
              c={c}
              credit={credits.find((x) => x.id === c.id)}
              month={month}
              today={today}
              onEdit={() => open(c, "edit")}
              onDelete={() => open(c, "delete")}
              onAdvance={() => open(c, "advance")}
              onCancelRecurrence={() => open(c, "cancel-recurrence")}
            />
          ))}
          <TotalFooter label="Total das parcelas do mês" value={total} />
        </>
      )}

      <ScopeDialog
        open={step === "edit-scope"}
        title="Editar parcela"
        name={targetCredit?.name ?? ""}
        installmentLabel={`${scopeLabel}. Muda só o valor desta parcela.`}
        allNote="Muda nome, categoria e valor total. Parcelas adiantadas e com valor próprio não mudam."
        confirmLabel="Continuar"
        onChoose={(scope) => setStep(scope === "one" ? "edit-one" : "edit-all")}
        onClose={close}
      />
      <ScopeDialog
        open={step === "delete-scope"}
        title="Excluir parcela"
        name={targetCredit?.name ?? ""}
        installmentLabel={`${scopeLabel}. As outras parcelas continuam nos seus meses.`}
        allNote="Remove a compra inteira, com todas as parcelas (inclusive as adiantadas)."
        confirmLabel="Continuar"
        destructive
        onChoose={(scope) => setStep(scope === "one" ? "delete-one" : "delete-all")}
        onClose={close}
      />
      <EditInstallmentDialog credit={step === "edit-one" ? targetCredit : null} n={target?.n ?? 1} onClose={close} />
      <EditCreditDialog credit={step === "edit-all" ? targetCredit : null} onClose={close} />
      <AdvanceDialog credit={step === "advance" ? targetCredit : null} n={target?.n ?? 1} onClose={close} />
      <CancelRecurrenceDialog credit={step === "cancel-recurrence" ? targetCredit : null} month={month} onClose={close} />
      <ConfirmDeletion
        open={step === "delete-one"}
        itemLabel={`parcela ${target?.n ?? ""}/${targetCredit?.installments ?? ""} desta compra parcelada`}
        onCancel={close}
        onConfirm={() => {
          if (target) {
            const error = removeInstallment(target.id, target.n);
            if (error) showToast({ type: "error", text: error });
          }
          close();
        }}
      />
      <ConfirmDeletion
        open={step === "delete-all"}
        itemLabel={targetCredit?.recurring ? "compra recorrente (com todas as cobranças, inclusive as de meses passados)" : "compra parcelada"}
        onCancel={close}
        onConfirm={() => { if (target) removeCredit(target.id); close(); }}
      />
    </Panel>
  );
}

/** Anotações por página; as fixadas ficam sempre na primeira. */
const NOTES_PER_PAGE = 3;
/** Acima disso o texto é cortado com "... ler mais" para o card não crescer demais. */
const NOTE_PREVIEW_CHARS = 140;

/** Divide em páginas: a primeira leva todas as fixadas (e completa com as demais até o limite). */
function paginateNotes<T extends { pinned: boolean }>(notes: T[]): T[][] {
  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);
  const room = Math.max(0, NOTES_PER_PAGE - pinned.length);
  const pages = [[...pinned, ...rest.slice(0, room)]];
  const remaining = rest.slice(room);
  for (let i = 0; i < remaining.length; i += NOTES_PER_PAGE) pages.push(remaining.slice(i, i + NOTES_PER_PAGE));
  return pages;
}

function NoteText({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const long = content.length > NOTE_PREVIEW_CHARS;
  return (
    <span className="min-w-0 whitespace-pre-line break-words">
      {long && !open ? content.slice(0, NOTE_PREVIEW_CHARS).trimEnd() : content}
      {long && (
        <>
          {open ? " " : "... "}
          <button type="button" onClick={() => setOpen((v) => !v)} className="font-semibold text-primary hover:underline">
            {open ? "ler menos" : "ler mais"}
          </button>
        </>
      )}
    </span>
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
  const [page, setPage] = useState(0);

  const notes = allNotes.filter((n) => n.month === month);
  const pages = paginateNotes(notes);
  // apagar anotações ou trocar de mês pode deixar a página atual sem nada
  const current = Math.min(page, pages.length - 1);
  const paged = notes.length > NOTES_PER_PAGE;
  const pageBtn = `${btnClass.base} ${btnClass.sm} disabled:pointer-events-none disabled:opacity-40`;

  function save() {
    const content = draft.trim();
    if (!content) return showToast({ type: "error", text: "Escreva algo antes de salvar" });
    addNote({ id: uuid(), content, date: new Date().toLocaleDateString("pt-BR"), pinned: false, month });
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
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ex.: Lembrar de pagar o cartão até o dia 15..."
          aria-label="Nova anotação"
          className="min-h-16 w-full resize-y rounded-md border border-border-strong bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{FREE_TEXT_WARNING}</p>
        <button type="button" onClick={save} className={`${btnClass.primary} self-end`}>Salvar</button>

        {pages[current].map((n) => (
          <div key={n.id} className={`flex flex-col gap-1 rounded-md border bg-secondary px-3.5 py-3 text-[13.5px] ${n.pinned ? "border-primary" : "border-border"}`}>
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
                  <NoteText content={n.content} />
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

        {paged && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} className={pageBtn}>Anterior</button>
            <span className="num text-[12.5px] text-muted-foreground" aria-live="polite">Página {current + 1} de {pages.length}</span>
            <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages.length - 1} className={pageBtn}>Próxima</button>
          </div>
        )}
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
      <PageHeader tour={LANCAMENTOS_TOUR} title="Lançamentos" subtitle="Rendas, despesas e parcelas do mês. Para cadastrar, use o botão Lançar." />
      <div className="grid grid-cols-12 items-start gap-3.5">
        {/* no celular o wrapper some (contents) e os cards seguem a ordem: rendas, despesas, anotações */}
        <div className="col-span-12 flex min-w-0 flex-col gap-3.5 max-lg:contents lg:col-span-4">
          <div className="min-w-0 max-lg:order-1 max-lg:col-span-12"><IncomesPanel /></div>
          <div className="min-w-0 max-lg:order-3 max-lg:col-span-12"><NotesPanel /></div>
        </div>
        <div className="col-span-12 flex min-w-0 flex-col gap-3.5 max-lg:order-2 lg:col-span-8">
          <ExpensesPanel />
          <InstallmentsPanel />
        </div>
      </div>
    </>
  );
}
