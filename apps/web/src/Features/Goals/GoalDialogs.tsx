import { canAutoFocus } from "@/lib/device";
import { uuid } from "@/lib/uuid";
import MonthPicker from "@/components/shared/MonthPicker";
import { useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OriginBadge from "@/components/shared/OriginBadge";
import { GOAL_MOVEMENT_LABEL, formatDateBR, replayGoal, sortGoalMovements, todayISO, type GoalMovement, type GoalMovementType } from "@/domain";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { useFinanceStore, type Goal } from "@/Store/FinanceStore";
import { showToast } from "../Warnings/toast";

/** Criar (goal = null) ou editar uma meta. */
export function GoalDialog({ open, goal, onClose }: { open: boolean; goal: Goal | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal?.piggy ? "Editar porquinho" : goal ? "Editar meta" : "Nova meta"}</DialogTitle>
          <DialogDescription>{goal?.piggy ? "Ajuste o nome, o aporte ou o prazo." : goal ? "Ajuste o valor, o aporte ou o prazo." : "Defina quanto guardar e até quando."}</DialogDescription>
        </DialogHeader>
        {/* key reinicia os campos a cada abertura ou troca de meta */}
        {open && <GoalFields key={goal?.id ?? "new"} goal={goal} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function GoalFields({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const addGoal = useFinanceStore((s) => s.addGoal);
  const updateGoal = useFinanceStore((s) => s.updateGoal);

  const piggy = !!goal?.piggy;
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? centsToInput(goal.target) : "");
  const [saved, setSaved] = useState("");
  const [monthly, setMonthly] = useState(goal && goal.monthly ? centsToInput(goal.monthly) : "");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const targetCents = parseBRL(target);
    if (!trimmed) return showToast({ type: "error", text: "Dê um nome à meta" });
    if (!piggy && !targetCents) return showToast({ type: "error", text: "Informe o valor da meta" });

    const values = {
      name: trimmed,
      target: piggy ? 0 : (targetCents ?? 0),
      monthly: parseBRL(monthly) ?? 0,
      deadline: deadline || null,
    };

    if (goal) {
      // o guardado só muda pelo histórico (Aportar, Retirar ou Ajustar valor)
      updateGoal(goal.id, values);
      showToast({ type: "success", text: `${piggy ? "Porquinho" : "Meta"} "${trimmed}" atualizada` });
    } else {
      addGoal({ id: uuid(), ...values, saved: parseBRL(saved) ?? 0 });
      showToast({ type: "success", text: `Meta "${trimmed}" criada` });
    }
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={piggy ? "Nome do porquinho" : "Nome da meta"} htmlFor="goal-name">
        <input id="goal-name" autoFocus={canAutoFocus()} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Viagem de férias" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {!piggy && (
          <Field label="Valor da meta" htmlFor="goal-target">
            <MoneyInput id="goal-target" value={target} onChange={setTarget} placeholder="10.000,00" />
          </Field>
        )}
        <Field label="Aporte mensal" hint="(opcional)" htmlFor="goal-monthly">
          <MoneyInput id="goal-monthly" value={monthly} onChange={setMonthly} placeholder="500,00" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {goal ? (
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">Já guardado</span>
            <span className="num rounded-md bg-secondary px-3 py-2 font-semibold">{formatBRL(goal.saved)}</span>
            <span className="text-xs text-muted-foreground">Muda pelo Histórico: aporte, retirada ou ajuste de valor.</span>
          </div>
        ) : (
          <Field label="Já guardado" htmlFor="goal-saved">
            <MoneyInput id="goal-saved" value={saved} onChange={setSaved} />
          </Field>
        )}
        <Field label="Prazo" hint="(opcional)" htmlFor="goal-deadline">
          <MonthPicker id="goal-deadline" value={deadline} onChange={setDeadline} clearable placeholder="Sem prazo" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">{goal ? "Salvar" : "Criar meta"}</Button>
      </div>
    </form>
  );
}

const TYPE_HINT: Record<GoalMovementType, string> = {
  contribution: "Dinheiro novo colocado aqui.",
  withdrawal: "Dinheiro tirado (total ou parcial).",
  yield: "Quanto o que já estava guardado rendeu.",
  adjustment: "Informe quanto está guardado hoje; a diferença fica registrada no histórico.",
};

/** Aporte, retirada, rendimento ou ajuste de valor. Com `movement`, edita uma movimentação já registrada. */
export function GoalMovementDialog({ goal, movement, open, onClose }: { goal: Goal | null; movement?: GoalMovement | null; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open && !!goal} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{movement ? "Editar movimentação" : "Movimentar"} “{goal?.name}”</DialogTitle>
          <DialogDescription>Guardado hoje: {goal ? formatBRL(goal.saved) : ""}.</DialogDescription>
        </DialogHeader>
        {goal && <GoalMovementFields key={movement?.id ?? goal.id} goal={goal} movement={movement ?? null} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function GoalMovementFields({ goal, movement, onClose }: { goal: Goal; movement: GoalMovement | null; onClose: () => void }) {
  const addMovement = useFinanceStore((s) => s.addGoalMovement);
  const updateMovement = useFinanceStore((s) => s.updateGoalMovement);
  const movements = useFinanceStore((s) => s.goalMovements);
  const [type, setType] = useState<GoalMovementType>(movement?.type ?? "contribution");
  const [amount, setAmount] = useState(movement ? centsToInput(movement.amount) : !movement && goal.monthly ? centsToInput(goal.monthly) : "");
  const [date, setDate] = useState(movement?.date ?? todayISO());
  const [note, setNote] = useState(movement?.note ?? "");
  const [error, setError] = useState("");

  const cents = parseBRL(amount) ?? 0;
  // prévia do guardado depois desta movimentação, na ordem de datas (a mesma conta do histórico)
  const preview = replayGoal(goal, movement
    ? movements.map((m) => (m.id === movement.id ? { ...m, type, date, amount: cents } : m))
    : [...movements, { id: "previa", goalId: goal.id, type, date: date || todayISO(), amount: cents }]).saved;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return setError("Informe a data.");
    if (type === "adjustment" ? parseBRL(amount) === null : cents <= 0) return setError(type === "adjustment" ? "Informe o novo valor guardado." : "Informe um valor maior que zero.");
    if (type === "withdrawal" && !movement && cents > goal.saved) return setError(`A retirada (${formatBRL(cents)}) é maior que o guardado (${formatBRL(goal.saved)}).`);
    const trimmed = note.trim();
    const fields = { type, date, amount: cents, note: trimmed || undefined };
    if (movement) updateMovement(movement.id, fields);
    else addMovement({ id: uuid(), goalId: goal.id, ...fields });
    showToast({ type: "success", text: `${GOAL_MOVEMENT_LABEL[type]} registrado em "${goal.name}"` });
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="O que aconteceu" htmlFor="gmov-type" hint={TYPE_HINT[type]}>
        <select id="gmov-type" value={type} onChange={(e) => { setType(e.target.value as GoalMovementType); setError(""); }} className={inputClass}>
          {(Object.keys(GOAL_MOVEMENT_LABEL) as GoalMovementType[]).map((k) => <option key={k} value={k}>{GOAL_MOVEMENT_LABEL[k]}</option>)}
        </select>
      </Field>
      <Field label={type === "adjustment" ? "Novo valor guardado" : "Valor"} htmlFor="gmov-amount">
        <MoneyInput id="gmov-amount" value={amount} onChange={(v) => { setAmount(v); setError(""); }} />
      </Field>
      <Field label="Data" htmlFor="gmov-date">
        <input id="gmov-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Observação" hint="(opcional)" htmlFor="gmov-note">
        <input id="gmov-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: sobra do mês" className={inputClass} />
      </Field>
      <p className="rounded-md bg-secondary px-3 py-2 text-[13px] text-ink2">
        Guardado depois desta movimentação: <strong className="text-foreground">{formatBRL(preview)}</strong>
      </p>
      {error && <p role="alert" className="rounded-md bg-secondary px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">{movement ? "Salvar" : "Registrar"}</Button>
      </div>
    </form>
  );
}

/** Histórico de uma meta ou porquinho, da data mais recente para a mais antiga, com editar e excluir. */
export function GoalHistoryDialog({ goal, open, onClose, onEdit }: { goal: Goal | null; open: boolean; onClose: () => void; onEdit: (m: GoalMovement) => void }) {
  const movements = useFinanceStore((s) => s.goalMovements);
  const remove = useFinanceStore((s) => s.removeGoalMovement);
  const [confirming, setConfirming] = useState<string | null>(null);
  const list = goal ? sortGoalMovements(movements.filter((m) => m.goalId === goal.id)).reverse() : [];

  return (
    <Dialog open={open && !!goal} onOpenChange={(next) => { if (!next) { setConfirming(null); onClose(); } }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de “{goal?.name}”</DialogTitle>
          <DialogDescription>Aportes, retiradas, rendimentos e ajustes. Ao corrigir ou excluir, o valor guardado é recalculado.</DialogDescription>
        </DialogHeader>
        {list.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {list.map((m) => (
              <li key={m.id} className="flex flex-col gap-1.5 py-2.5 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    <b>{GOAL_MOVEMENT_LABEL[m.type]}</b>
                    <span className="text-muted-foreground"> · {formatDateBR(m.date)}</span>
                  </span>
                  <span className={`num font-semibold ${m.type === "withdrawal" ? "text-destructive" : m.type === "adjustment" ? "" : "text-success"}`}>
                    {m.type === "withdrawal" ? "−" : m.type === "adjustment" ? "= " : "+"}{formatBRL(m.amount)}
                  </span>
                </div>
                {(m.note || m.origin) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                    <OriginBadge origin={m.origin} />
                    {m.note && <span className="break-words">{m.note}</span>}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setConfirming(null); onEdit(m); }} className="text-[12px] font-semibold text-primary hover:underline">Editar</button>
                  {confirming === m.id ? (
                    <>
                      <button type="button" onClick={() => { remove(m.id); setConfirming(null); showToast({ type: "success", text: "Movimentação excluída" }); }} className="text-[12px] font-semibold text-destructive hover:underline">Confirmar exclusão</button>
                      <button type="button" onClick={() => setConfirming(null)} className="text-[12px] text-muted-foreground hover:underline">Cancelar</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirming(m.id)} className="text-[12px] font-semibold text-muted-foreground hover:text-destructive hover:underline">Excluir</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
