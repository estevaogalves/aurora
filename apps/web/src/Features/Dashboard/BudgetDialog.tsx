import { useState } from "react";
import { Field, MoneyInput } from "@/components/shared/FormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { budgetLimitFor, MAX_CENTS } from "@/domain";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { EXPENSE_CATEGORIES } from "@/Types/Category";
import { formatMonthTitle } from "@/Utils/Date";
import { showToast } from "../Warnings/toast";

/**
 * Limite mensal por categoria. É só uma referência (nunca bloqueia um lançamento, como o teto do cartão) e vale do
 * mês visto em diante: os meses anteriores ficam como estavam, e os seguintes herdam até você mudar de novo.
 */
export default function BudgetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const month = useFinanceStore((s) => s.currentMonth);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Orçamento por categoria</DialogTitle>
          <DialogDescription>
            Limite mensal opcional de cada categoria, a partir de {formatMonthTitle(month)}. Os meses seguintes herdam o limite até você mudá-lo. É só uma referência: nada é bloqueado e nenhum total muda.
          </DialogDescription>
        </DialogHeader>
        {open && <Fields month={month} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Fields({ month, onClose }: { month: string; onClose: () => void }) {
  const budgets = useFinanceStore((s) => s.budgets);
  const custom = useFinanceStore((s) => s.customCategories);
  const setBudget = useFinanceStore((s) => s.setBudget);
  const names = [...EXPENSE_CATEGORIES, ...custom.map((c) => c.name)];
  // categoria apagada que ainda tem limite continua na lista, para dar para tirar
  for (const c of Object.keys(budgets)) if (!names.includes(c)) names.push(c);

  const initial = Object.fromEntries(names.map((c) => [c, budgetLimitFor(budgets, c, month)]));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(names.map((c) => [c, initial[c] > 0 ? centsToInput(initial[c]) : ""])));
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const changes: [string, number][] = [];
    for (const c of names) {
      const text = values[c].trim();
      const cents = text ? parseBRL(text) : 0;
      if (cents === null) return setError(`O limite de “${c}” não é um valor válido.`);
      if (cents > MAX_CENTS) return setError(`O limite de “${c}” passa de R$ 1 bilhão.`);
      if (cents !== initial[c]) changes.push([c, cents]);
    }
    for (const [c, cents] of changes) setBudget(c, month, cents);
    showToast({ type: "success", text: changes.length > 0 ? `Orçamento atualizado a partir de ${formatMonthTitle(month)}` : "Nenhum limite mudou" });
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {names.map((c) => (
        <Field key={c} label={c} htmlFor={`budget-${c}`} hint={initial[c] > 0 ? `(hoje ${formatBRL(initial[c])})` : "(sem limite)"}>
          <MoneyInput id={`budget-${c}`} value={values[c]} onChange={(v) => { setValues((s) => ({ ...s, [c]: v })); setError(""); }} placeholder="Sem limite" />
        </Field>
      ))}
      <p className="text-xs text-muted-foreground">Deixe vazio para ficar sem limite a partir deste mês.</p>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
