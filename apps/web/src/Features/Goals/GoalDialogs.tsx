import MonthPicker from "@/components/shared/MonthPicker";
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
  const [saved, setSaved] = useState(goal ? centsToInput(goal.saved) : "");
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
      saved: parseBRL(saved) ?? 0,
      monthly: parseBRL(monthly) ?? 0,
      deadline: deadline || null,
    };

    if (goal) {
      updateGoal(goal.id, values);
      showToast({ type: "success", text: `${piggy ? "Porquinho" : "Meta"} "${trimmed}" atualizada` });
    } else {
      addGoal({ id: crypto.randomUUID(), ...values });
      showToast({ type: "success", text: `Meta "${trimmed}" criada` });
    }
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={piggy ? "Nome do porquinho" : "Nome da meta"} htmlFor="goal-name">
        <input id="goal-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Viagem de férias" className={inputClass} />
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
        <Field label="Já guardado" htmlFor="goal-saved">
          <MoneyInput id="goal-saved" value={saved} onChange={setSaved} />
        </Field>
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

/** Registra, juntos ou separados, o rendimento do que já estava guardado e um novo aporte. */
export function ContributeDialog({ goal, open, onClose }: { goal: Goal | null; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open && !!goal} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aportar em “{goal?.name}”</DialogTitle>
          <DialogDescription>Guardado hoje: {goal ? formatBRL(goal.saved) : ""}. Preencha o rendimento, o aporte ou os dois.</DialogDescription>
        </DialogHeader>
        {goal && <ContributeFields key={goal.id} goal={goal} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ContributeFields({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const contribute = useFinanceStore((s) => s.contributeToGoal);
  const [yieldAmount, setYieldAmount] = useState("");
  const [amount, setAmount] = useState(goal.monthly ? centsToInput(goal.monthly) : "");

  const yieldCents = parseBRL(yieldAmount) ?? 0;
  const contributionCents = parseBRL(amount) ?? 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (yieldCents === 0 && contributionCents === 0) {
      return showToast({ type: "error", text: "Informe o rendimento, o aporte ou os dois" });
    }
    contribute(goal.id, contributionCents, yieldCents);

    const parts = [
      contributionCents > 0 ? `aporte de ${formatBRL(contributionCents)}` : "",
      yieldCents > 0 ? `rendimento de ${formatBRL(yieldCents)}` : "",
    ].filter(Boolean);
    showToast({ type: "success", text: `Registrado em "${goal.name}": ${parts.join(" e ")}` });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Valor do rendimento" hint="(opcional)" htmlFor="contribute-yield">
        <MoneyInput id="contribute-yield" value={yieldAmount} onChange={setYieldAmount} />
        <span className="text-xs text-muted-foreground">Quanto o dinheiro já guardado rendeu desde o último registro.</span>
      </Field>
      <Field label="Valor do aporte" hint="(opcional)" htmlFor="contribute-amount">
        <MoneyInput id="contribute-amount" value={amount} onChange={setAmount} />
        <span className="text-xs text-muted-foreground">Quanto você está adicionando à meta agora.</span>
      </Field>
      <p className="rounded-md bg-secondary px-3 py-2 text-[13px] text-ink2">
        Novo guardado: <strong className="text-foreground">{formatBRL(goal.saved + contributionCents + yieldCents)}</strong>
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Registrar</Button>
      </div>
    </form>
  );
}
