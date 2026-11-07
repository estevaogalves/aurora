import { useState } from "react";
import CategorySelect from "@/components/shared/CategorySelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  centsToInput,
  parseBRL,
  sanitizeAmountInput,
  splitInstallments,
} from "@/lib/money";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore, type LaunchTab } from "@/Store/UiStore";
import type { Category } from "@/Types/Category";
import { formatMonthTitle } from "@/Utils/Date";
import { showToast } from "../Warnings/ToastContainer";

const tabClass =
  "rounded-[10px] py-2 text-[13px] font-semibold text-ink2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow";

const inputClass =
  "w-full rounded-md border border-border-strong bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12.5px] font-bold text-ink2">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function MoneyInput({ id, value, onChange, disabled }: { id: string; value: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(sanitizeAmountInput(e.target.value))}
        className={`${inputClass} pl-9 font-semibold`}
      />
    </div>
  );
}

/** Ação única de lançamento: despesa, renda ou compra parcelada no crédito. */
export default function TransactionForm() {
  const open = useUiStore((s) => s.launchOpen);
  const tab = useUiStore((s) => s.launchTab);
  const openLaunch = useUiStore((s) => s.openLaunch);
  const closeLaunch = useUiStore((s) => s.closeLaunch);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? openLaunch() : closeLaunch())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Um só formulário para renda, despesa e compra parcelada.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => openLaunch(v as LaunchTab)}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-md bg-secondary p-1">
            <TabsTrigger value="expense" className={tabClass}>Despesa</TabsTrigger>
            <TabsTrigger value="income" className={tabClass}>Renda</TabsTrigger>
            <TabsTrigger value="credit" className={tabClass}>Crédito parcelado</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* key reinicia os campos ao trocar de aba ou reabrir */}
        <LaunchFields key={tab} kind={tab} onDone={closeLaunch} />
      </DialogContent>
    </Dialog>
  );
}

function LaunchFields({ kind, onDone }: { kind: LaunchTab; onDone: () => void }) {
  const currentMonth = useFinanceStore((s) => s.currentMonth);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addCreditTransaction = useFinanceStore((s) => s.addCreditTransaction);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Moradia");
  const [fixed, setFixed] = useState(false);
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState(2);

  const totalCents = parseBRL(amount) ?? 0;
  const installmentValue =
    kind === "credit" && installments > 0 ? splitInstallments(totalCents, installments)[0] : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      showToast({ type: "error", text: "Preencha o nome" });
      return;
    }

    const cents = parseBRL(amount);
    if (!cents) {
      showToast({ type: "error", text: "Informe um valor maior que zero" });
      return;
    }

    if (kind === "credit") {
      addCreditTransaction({
        id: crypto.randomUUID(),
        name: trimmed,
        totalAmount: cents,
        installments: Math.min(60, Math.max(1, Math.floor(installments) || 1)),
        startMonth: currentMonth,
        category,
      });
      showToast({ type: "success", text: `Compra parcelada "${trimmed}" adicionada` });
    } else if (kind === "income") {
      addTransaction({
        id: crypto.randomUUID(),
        name: trimmed,
        amount: cents,
        type: "income",
        category: "Renda",
        fixed,
        month: currentMonth,
      });
      showToast({ type: "success", text: `Renda "${trimmed}" adicionada` });
    } else {
      addTransaction({
        id: crypto.randomUUID(),
        name: trimmed,
        amount: cents,
        type: "expense",
        category,
        notes,
        fixed,
        month: currentMonth,
      });
      showToast({ type: "success", text: `Despesa "${trimmed}" adicionada` });
    }

    onDone();
  }

  const labels = {
    expense: { name: "Nome da despesa", placeholder: "Ex.: Aluguel, internet...", amount: "Valor deste mês" },
    income: { name: "Nome da renda", placeholder: "Ex.: Salário, freelance...", amount: "Valor deste mês" },
    credit: { name: "Nome da compra", placeholder: "Ex.: Notebook", amount: "Valor total da compra" },
  }[kind];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={labels.name} htmlFor="launch-name">
        <input
          id="launch-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={labels.placeholder}
          className={inputClass}
        />
      </Field>

      <div className={kind === "credit" ? "grid gap-4 sm:grid-cols-2" : ""}>
        <Field label={labels.amount} htmlFor="launch-amount">
          <MoneyInput id="launch-amount" value={amount} onChange={setAmount} />
        </Field>

        {kind === "credit" && (
          <Field label="Parcelas" htmlFor="launch-installments">
            <input
              id="launch-installments"
              type="number"
              min={1}
              max={60}
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      {kind === "credit" && (
        <p className="text-sm text-muted-foreground">
          Parcela de <strong className="text-foreground">R$ {centsToInput(installmentValue) || "0,00"}</strong>,
          começando em {formatMonthTitle(currentMonth)}.
        </p>
      )}

      {kind !== "income" && (
        <Field label="Categoria" htmlFor="launch-category">
          <CategorySelect id="launch-category" value={category} onChange={setCategory} />
        </Field>
      )}

      {kind === "expense" && (
        <Field label="Observação" hint="(opcional)" htmlFor="launch-notes">
          <Textarea
            id="launch-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações sobre esta despesa..."
            className="min-h-[64px] rounded-md border-border-strong bg-secondary"
          />
        </Field>
      )}

      {kind !== "credit" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary p-3">
          <Checkbox checked={fixed} onCheckedChange={(c) => setFixed(Boolean(c))} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium text-foreground">
              {kind === "income" ? "Renda fixa" : "Despesa fixa"}
            </span>
            <span className="block text-xs text-muted-foreground">
              Repete todo mês a partir deste. Dá para ajustar o valor de cada mês depois.
            </span>
          </span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Adicionar</Button>
      </div>
    </form>
  );
}
