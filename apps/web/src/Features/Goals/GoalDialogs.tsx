import { useState } from "react";
import { Field, inputClass, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { useFinanceStore, type Goal } from "@/Store/FinanceStore";
import { showToast } from "../Warnings/toast";

/** Criar (goal = null) ou editar uma meta. */
export function GoalDialog({ open, goal, onClose }: { open: boolean; goal: Goal | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle>
          <DialogDescription>{goal ? "Ajuste o valor, o aporte ou o prazo." : "Defina quanto guardar e até quando."}</DialogDescription>
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

  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? centsToInput(goal.target) : "");
  const [saved, setSaved] = useState(goal ? centsToInput(goal.saved) : "");
  const [monthly, setMonthly] = useState(goal && goal.monthly ? centsToInput(goal.monthly) : "");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const targetCents = parseBRL(target);
    if (!trimmed) return showToast({ type: "error", text: "Dê um nome à meta" });
    if (!targetCents) return showToast({ type: "error", text: "Informe o valor da meta" });

    const values = {
      name: trimmed,
      target: targetCents,
      saved: parseBRL(saved) ?? 0,
      monthly: parseBRL(monthly) ?? 0,
      deadline: deadline || null,
    };

    if (goal) {
      updateGoal(goal.id, values);
      showToast({ type: "success", text: `Meta "${trimmed}" atualizada` });
    } else {
      addGoal({ id: crypto.randomUUID(), ...values });
      showToast({ type: "success", text: `Meta "${trimmed}" criada` });
    }
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome da meta" htmlFor="goal-name">
        <input id="goal-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Viagem de férias" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor da meta" htmlFor="goal-target">
          <MoneyInput id="goal-target" value={target} onChange={setTarget} placeholder="10.000,00" />
        </Field>
        <Field label="Aporte mensal" hint="(opcional)" htmlFor="goal-monthly">
          <MoneyInput id="goal-monthly" value={monthly} onChange={setMonthly} placeholder="500,00" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Já guardado" htmlFor="goal-saved">
          <MoneyInput id="goal-saved" value={saved} onChange={setSaved} />
        </Field>
        <Field label="Prazo" hint="(opcional)" htmlFor="goal-deadline">
          <input id="goal-deadline" type="month" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">{goal ? "Salvar" : "Criar meta"}</Button>
      </div>
    </form>
  );
}

/** Soma um aporte ao valor guardado. */
export function ContributeDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  return (
    <Dialog open={!!goal} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aportar em “{goal?.name}”</DialogTitle>
          <DialogDescription>Guardado hoje: {goal ? formatBRL(goal.saved) : ""}</DialogDescription>
        </DialogHeader>
        {goal && <ContributeFields key={goal.id} goal={goal} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ContributeFields({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const contribute = useFinanceStore((s) => s.contributeToGoal);
  const [amount, setAmount] = useState(goal.monthly ? centsToInput(goal.monthly) : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRL(amount);
    if (!cents) return showToast({ type: "error", text: "Informe um valor maior que zero" });
    contribute(goal.id, cents);
    showToast({ type: "success", text: `${formatBRL(cents)} guardados em "${goal.name}"` });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Valor do aporte" htmlFor="contribute-amount">
        <MoneyInput id="contribute-amount" value={amount} onChange={setAmount} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Aportar</Button>
      </div>
    </form>
  );
}
